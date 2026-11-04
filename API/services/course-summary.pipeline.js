'use strict';

const { aggregateCourseText, fingerprint, documentsOf } = require('../utils/course-material-text');
const { learningAiQueue } = require('../utils/learning-ai-queue');
const { responseFailure } = require('../utils/ai-response');
const { PIPELINE_VERSION, summaryLimits, summarizeInBatches } = require('../utils/course-summary-ai');
const { cardBatches, generateCardBatch } = require('../utils/course-cards-ai');
const fail = (message, statusCode = 400, stage = 'summary') => Object.assign(new Error(message), { statusCode, stage });
const validText = (value, max = 200000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function createCourseSummaryPipeline({ q, rowFor, courseView, course, mutate, db, ai, now, timeoutMs, onSummarySaved = async () => {} }) {
    async function requestAI(work, update, stage) {
        for (let attempt = 0; ; attempt++) {
            try { return await learningAiQueue.run(() => work(attempt)); }
            catch (error) {
                if (attempt === 0 && ['GEMINI_TIMEOUT', 'GEMINI_NETWORK', 'GEMINI_RESPONSE_ERROR'].includes(error.code)) {
                    update(stage === 'cards' ? 'AI chưa tạo được Flashcard. Đang thử lại từ bản tóm tắt đã lưu…' :
                        'AI chưa trả được bản tóm tắt. Đang thử lại phần đang xử lý…');
                    continue;
                }
                if (['GEMINI_TIMEOUT', 'GEMINI_NETWORK'].includes(error.code)) throw fail(
                    stage === 'cards' ? 'Bản tóm tắt toàn môn đã được lưu. Chưa tạo được Flashcard; hãy thử lại.' :
                        'AI chưa trả được bản tóm tắt toàn môn. Nội dung tổng hợp vẫn được giữ để thử lại.', error.statusCode || 504, stage);
                if (error.code === 'GEMINI_RESPONSE_ERROR') throw fail(stage === 'cards' ?
                    'Bản tóm tắt toàn môn đã được lưu. AI trả thông báo lỗi khi tạo Flashcard; hãy thử lại.' :
                    'AI trả thông báo lỗi thay vì bản tóm tắt toàn môn. Nội dung tổng hợp vẫn được giữ để thử lại.', 502, stage);
                error.stage = stage;
                throw error;
            }
        }
    }

    async function run(id, update = () => {}) {
        let row = await rowFor(id);
        const existing = await courseView(row, true);
        if (!row.complete || !existing.sourceCount) throw fail('Cần quét đủ nội dung tất cả chương trước khi tóm tắt toàn bộ môn.', 409);
        const fullText = aggregateCourseText(existing);
        const limits = summaryLimits();
        const inputHash = fingerprint(fullText);
        const coverage = [...new Set(documentsOf(existing.chapters).map(document => String(document.id)))];
        const ensureCurrent = async () => {
            const latest = await rowFor(id);
            if (!latest.complete || latest.source_hash !== row.source_hash) throw fail('Học liệu đã thay đổi trong lúc AI xử lý. Hãy tạo lại từ nội dung mới.', 409);
            return latest;
        };
        // Save the exact complete text BEFORE sending anything to AI.
        await mutate(async () => {
            await ensureCurrent();
            await q(`INSERT INTO LearningCourseTexts(user_id,course_id,source_hash,input_hash,content,created_at)
                VALUES(@uid,@id,@source,@input,@content,@created)
                ON CONFLICT(user_id,course_id) DO UPDATE SET source_hash=excluded.source_hash,input_hash=excluded.input_hash,
                content=excluded.content,created_at=excluded.created_at`, {
                id, source: row.source_hash, input: inputHash, content: fullText, created: now()
            });
        });

        let [saved] = await q('SELECT * FROM LearningSummaries WHERE user_id=@uid AND course_id=@id', { id });
        if (!saved || responseFailure(saved.content) || !validText(saved.content, limits.storedChars) || saved.pipeline_version !== PIPELINE_VERSION || saved.source_hash !== row.source_hash || saved.input_hash !== inputHash) {
            let format = {};
            const answer = await summarizeInBatches(existing, fullText, { limits, update, onFormat: value => { format = value; },
                ask: prompt => requestAI(async () => {
                    const text = await ai.ask(prompt, { timeoutMs, retry: false, maxInputChars: limits.inputChars });
                    const failure = responseFailure(text);
                    if (failure) throw Object.assign(new Error(failure.message), failure);
                    return text;
                }, update, 'summary'),
                load: async key => (await q(`SELECT content FROM LearningSummaryParts
                    WHERE user_id=@uid AND course_id=@id AND input_hash=@input AND part_key=@key`, { id, input: inputHash, key }))[0]?.content,
                save: (key, content) => mutate(async () => {
                    await ensureCurrent();
                    await q(`INSERT INTO LearningSummaryParts(user_id,course_id,input_hash,part_key,content,created_at)
                        VALUES(@uid,@id,@input,@key,@content,@created)
                        ON CONFLICT(user_id,course_id,input_hash,part_key) DO UPDATE SET content=excluded.content,created_at=excluded.created_at`,
                    { id, input: inputHash, key, content, created: now() });
                })
            });
            if (!validText(answer, limits.storedChars)) throw fail('AI chưa trả về bản tóm tắt toàn môn hợp lệ.', 502);
            const content = answer.trim();
            const summaryHash = fingerprint([id, content]);
            // The returned summary is the durable result. Card generation must
            // never roll this write back or replace it with source text.
            await mutate(async () => {
                await ensureCurrent();
                await q(`INSERT INTO LearningSummaries(user_id,course_id,source_hash,input_hash,pipeline_version,summary_hash,content,coverage_json,format_json,cards_state_json,created_at)
                    VALUES(@uid,@id,@source,@input,@version,@summary,@content,@coverage,@format,'{}',@created)
                    ON CONFLICT(user_id,course_id) DO UPDATE SET source_hash=excluded.source_hash,input_hash=excluded.input_hash,
                    pipeline_version=excluded.pipeline_version,summary_hash=excluded.summary_hash,content=excluded.content,
                    coverage_json=excluded.coverage_json,format_json=excluded.format_json,cards_state_json='{}',created_at=excluded.created_at`, {
                    id, source: row.source_hash, input: inputHash, version: PIPELINE_VERSION, summary: summaryHash, content, coverage: JSON.stringify(coverage), format: JSON.stringify(format), created: now()
                });
            });
            [saved] = await q('SELECT * FROM LearningSummaries WHERE user_id=@uid AND course_id=@id', { id });
        }

        await onSummarySaved(id);
        const [count] = await q(`SELECT COUNT(*) AS total FROM LearningCards WHERE user_id=@uid AND course_id=@id
            AND source_hash=@source AND summary_hash=@summary`, { id, source: row.source_hash, summary: saved.summary_hash });
        let state;
        try { state = JSON.parse(saved.cards_state_json || '{}'); } catch { state = {}; }
        const checkpointRows = await q(`SELECT batch_key FROM LearningCardBatches WHERE user_id=@uid AND course_id=@id
            AND source_hash=@source AND summary_hash=@summary`, { id, source: row.source_hash, summary: saved.summary_hash });
        // Preserve complete legacy decks; a partial new deck must resume.
        if (count?.total && (state.status === 'complete' || !state.status && !checkpointRows.length)) return course(id);
        update(`Đã lưu bản tóm tắt toàn môn ${row.subject_name}. Đang tạo Flashcard từ bản đã lưu…`,
            { done: 3, total: 4 }, { phase: 'cards' });
        const batches = cardBatches(saved.content, Math.max(128, Math.min(3500, limits.inputChars - 3000)));
        const checkpoints = new Set(checkpointRows.map(item => item.batch_key));
        const assertSummary = async () => {
            await ensureCurrent();
            const [latest] = await q('SELECT summary_hash FROM LearningSummaries WHERE user_id=@uid AND course_id=@id', { id });
            if (latest?.summary_hash !== saved.summary_hash) throw fail('Bản tóm tắt đã thay đổi. Hãy tạo lại Flashcard.', 409, 'cards');
        };
        let done = batches.filter(batch => checkpoints.has(batch.key)).length;
        const saveState = completed => q(`UPDATE LearningSummaries SET cards_state_json=@state WHERE user_id=@uid AND course_id=@id AND summary_hash=@summary`, {
            id, summary: saved.summary_hash, state: JSON.stringify({ status: completed === batches.length ? 'complete' : completed ? 'partial' : 'pending',
                completedBatches: completed, totalBatches: batches.length })
        });
        await mutate(async () => { await assertSummary(); await saveState(done); });
        for (const [index, batch] of batches.entries()) {
            if (checkpoints.has(batch.key)) continue;
            update(`Đang tạo lô Flashcard ${index + 1}/${batches.length}. Đã lưu ${done} lô; bản tóm tắt được giữ nguyên.`,
                { done: 3, total: 4 }, { phase: 'cards', completedBatches: done, totalBatches: batches.length });
            const cards = await generateCardBatch({ subject: row.subject_name, text: batch.text, update,
                generate: (prompt, config) => requestAI(() => ai.generateJson(prompt, {
                    ...config, timeoutMs, retry: false, maxInputChars: limits.inputChars
                }), update, 'cards') });
            await mutate(async () => {
                await assertSummary();
                await db().withTransaction(async () => {
                    for (const card of cards) {
                        const front = card.front.trim(), back = card.back.trim();
                        const cardId = fingerprint([id, row.source_hash, saved.summary_hash, front, back]);
                        await q(`INSERT INTO LearningCards(user_id,card_id,course_id,source_hash,summary_hash,front,back,chapter,source_ids_json,due_at,created_at)
                            VALUES(@uid,@card,@id,@source,@summary,@front,@back,@chapter,'[]',@due,@created)
                            ON CONFLICT(user_id,card_id) DO NOTHING`, { card: cardId, id, source: row.source_hash, summary: saved.summary_hash,
                            front, back, chapter: card.chapter?.trim() || '', due: now(), created: now() });
                    }
                    await q(`INSERT INTO LearningCardBatches(user_id,course_id,source_hash,summary_hash,batch_key,created_at)
                        VALUES(@uid,@id,@source,@summary,@key,@created) ON CONFLICT DO NOTHING`,
                    { id, source: row.source_hash, summary: saved.summary_hash, key: batch.key, created: now() });
                    await saveState(done + 1);
                });
            });
            done++;
        }
        return course(id);
    }

    return run;
}

module.exports = { createCourseSummaryPipeline, PIPELINE_VERSION };
