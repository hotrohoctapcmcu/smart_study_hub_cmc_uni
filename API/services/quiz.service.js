'use strict';

const { randomUUID, createHash } = require('node:crypto');
const gemini = require('../utils/gemini-client');
const context = require('./study-context.service');
const { fail, clean, required } = require('../validators/hoctapai.validator');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const now = () => new Date().toISOString();
const { resolveQuizSource } = require('./quiz-source.service');

function createQuizService({ q, one, userId, mutate, getDb }) {
    const quizView = row => {
        const submitted = Boolean(row.submitted_at);
        return { id: row.quiz_id, subject: row.subject, topic: row.topic, difficulty: row.difficulty,
            createdAt: row.created_at, submittedAt: row.submitted_at, status: submitted ? 'submitted' : 'draft',
            source: row.source_json ? JSON.parse(row.source_json) : { kind: 'unspecified', title: 'Bản cũ: chưa ghi nhận nguồn' },
            questions: JSON.parse(row.questions_json).map(({ correctIndex, explanation, ...question }) => submitted ? { ...question, correctIndex, explanation } : question),
            ...(submitted && { answers: JSON.parse(row.answers_json), result: JSON.parse(row.result_json) }) };
    };
    const quizRow = id => one('SELECT * FROM AiQuizzes WHERE user_id=@uid AND quiz_id=@id', { id });
    const quiz = async id => quizView(await quizRow(id));
    async function quizzes() {
        return (await q('SELECT * FROM AiQuizzes WHERE user_id=@uid ORDER BY created_at DESC LIMIT 100')).map(row => {
            const item = quizView(row);
            return { id: item.id, subject: item.subject, topic: item.topic, createdAt: item.createdAt, status: item.status,
                questionCount: item.questions.length, score: item.result?.score ?? null };
        });
    }
    async function generateQuiz(body = {}, options = {}) {
        const subject = required(body.subject, 'Môn học', 120);
        const topic = required(body.topic, 'Chủ đề', 180);
        const count = body.count === undefined ? 5 : body.count;
        if (!Number.isInteger(count) || count < 3 || count > 15) throw fail('Số câu phải từ 3 đến 15.');
        const difficulty = body.difficulty || 'medium';
        if (!['easy', 'medium', 'hard'].includes(difficulty)) throw fail('Độ khó không hợp lệ.');
        const resolved = body.source ? await resolveQuizSource(body.source, { getDb, userId, subject }) : null;
        const sourceText = resolved?.text || (body.sourceText ? required(body.sourceText, 'Nội dung ôn tập', 15000) : '');
        const source = resolved?.evidence || { kind: sourceText ? 'provided-text' : 'general', title: sourceText ? 'Văn bản người học cung cấp' : 'Kiến thức chung; không dùng tài liệu nguồn' };
        const valid = output => Array.isArray(output?.questions) && output.questions.length === count && output.questions.every(item =>
            typeof item?.question === 'string' && item.question.trim() && item.question.length <= 2000 &&
            Array.isArray(item.options) && item.options.length === 4 && item.options.every(o => typeof o === 'string' && o.trim() && o.length <= 1000) &&
            new Set(item.options.map(o => o.trim())).size === 4 && Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex <= 3 &&
            typeof item.explanation === 'string' && item.explanation.trim() && item.explanation.length <= 2500);
        const output = await gemini.generateJson([
            `Tạo đúng ${count} câu trắc nghiệm kiến thức bằng tiếng Việt. Mỗi câu có 4 lựa chọn và duy nhất 1 đáp án đúng.`,
            `Môn: ${subject}. Chủ đề: ${topic}. Độ khó: ${difficulty}.`,
            'Mỗi câu ghi rõ chủ đề con để theo dõi điểm yếu, kèm giải thích đáp án. Không đặt câu hỏi về thông tin cá nhân của người học.',
            sourceText ? `Chỉ đặt câu dựa trên nội dung sau:\n${sourceText}` : 'Dùng kiến thức chuẩn của môn/chủ đề được yêu cầu.',
            sourceText ? 'Không sử dụng nguồn bên ngoài nội dung đã chọn.' : 'Không khẳng định đã sử dụng tệp hoặc tài liệu riêng của người học.'
        ].join('\n\n'), { signal: options.signal, validate: valid, schemaDescription: JSON.stringify({ questions: [{ question: 'string', topic: 'string', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'string' }] }) });
        if (!valid(output)) throw new gemini.GeminiError('Bộ câu hỏi AI chưa hợp lệ. Hãy thử lại.', 'GEMINI_SCHEMA', 502);
        const questions = output.questions.map((item, i) => ({ id: `q${i + 1}`, question: item.question.trim(), topic: clean(item.topic, 180) || topic,
            options: item.options.map(o => o.trim()), correctIndex: item.correctIndex, explanation: item.explanation.trim() }));
        const id = randomUUID();
        options.signal?.throwIfAborted();
        await q(`INSERT INTO AiQuizzes(quiz_id,user_id,subject,topic,difficulty,questions_json,created_at,source_json)
            VALUES(@id,@uid,@subject,@topic,@difficulty,@questions,@created,@source)`, { id, subject, topic, difficulty, questions: JSON.stringify(questions), created: now(), source: JSON.stringify(source) });
        return quiz(id);
    }
    async function submitQuiz(id, body = {}) {
        return mutate(async () => {
            const row = await quizRow(id);
            const questions = JSON.parse(row.questions_json);
            const answers = body.answers;
            if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length !== questions.length || questions.some(item =>
                !Number.isInteger(answers[item.id]) || answers[item.id] < 0 || answers[item.id] > 3)) throw fail('Hãy trả lời đủ các câu hỏi bằng lựa chọn hợp lệ.');
            const normalized = Object.fromEntries(questions.map(item => [item.id, answers[item.id]]));
            if (row.submitted_at) {
                if (hash(JSON.parse(row.answers_json)) !== hash(normalized)) throw fail('Bài này đã nộp. Hãy tạo bài mới để kiểm tra lại.', 409);
                return quizView(row);
            }
            const details = questions.map(item => ({ questionId: item.id, topic: item.topic, selectedIndex: normalized[item.id],
                correctIndex: item.correctIndex, correct: normalized[item.id] === item.correctIndex, explanation: item.explanation }));
            const correctCount = details.filter(item => item.correct).length;
            const result = { correctCount, total: questions.length, score: Math.round(correctCount / questions.length * 100), details };
            await q('UPDATE AiQuizzes SET answers_json=@answers,result_json=@result,submitted_at=@submitted WHERE user_id=@uid AND quiz_id=@id',
                { id, answers: JSON.stringify(normalized), result: JSON.stringify(result), submitted: now() });
            return quiz(id);
        });
    }
    async function weaknessEvidence() {
        const rows = await q('SELECT * FROM AiQuizzes WHERE user_id=@uid AND submitted_at IS NOT NULL ORDER BY submitted_at,quiz_id');
        const topics = new Map();
        for (const row of rows) {
            const result = JSON.parse(row.result_json);
            const byTopic = new Map();
            for (const detail of result.details) {
                const name = detail.topic;
                const key = JSON.stringify([row.subject.toLocaleLowerCase('vi'), name.toLocaleLowerCase('vi')]);
                if (!topics.has(key)) topics.set(key, { key, subject: row.subject, topic: name, attempts: [], wrong: [] });
                if (!byTopic.has(key)) byTopic.set(key, { correct: 0, total: 0 });
                const part = byTopic.get(key); part.total++; if (detail.correct) part.correct++;
                if (!detail.correct) topics.get(key).wrong.push({ quizId: row.quiz_id, questionId: detail.questionId });
            }
            for (const [key, part] of byTopic) topics.get(key).attempts.push({ ...part, quizId: row.quiz_id, date: row.submitted_at, score: Math.round(part.correct / part.total * 100) });
        }
        const data = [...topics.values()].map(item => {
            const total = item.attempts.reduce((sum, a) => sum + a.total, 0);
            const correct = item.attempts.reduce((sum, a) => sum + a.correct, 0);
            const latest = item.attempts.at(-1).score;
            const previous = item.attempts.length > 1 ? item.attempts.at(-2).score : null;
            return { ...item, total, correct, accuracy: Math.round(correct / total * 100), latestScore: latest,
                previousScore: previous, improvement: previous === null ? null : latest - previous,
                priority: latest < 50 ? 'high' : latest < 80 ? 'medium' : 'low', wrong: item.wrong.slice(-10), attempts: item.attempts.slice(-10) };
        }).sort((a, b) => a.latestScore - b.latestScore || a.accuracy - b.accuracy);
        return { quizCount: rows.length, topics: data };
    }
    async function weaknesses() {
        const evidence = await weaknessEvidence();
        const reports = await q('SELECT * FROM AiWeaknessReports WHERE user_id=@uid AND evidence_hash=@hash ORDER BY created_at DESC LIMIT 1', { hash: hash(evidence) });
        return { ...evidence, advice: reports.length ? JSON.parse(reports[0].advice_json) : [], analyzedAt: reports[0]?.created_at || null };
    }
    async function analyzeWeaknesses(options = {}) {
        const evidence = await weaknessEvidence();
        if (!evidence.topics.length) return { ...evidence, advice: [], analyzedAt: null };
        const study = await context.buildStudyContext(userId, { difficultOnly: true });
        const output = await gemini.generateJson([
            'Đề xuất nội dung ôn tập từ lịch sử làm bài. Không tự tính hoặc bịa điểm, độ thành thạo hay mức cải thiện.',
            'Mỗi đề xuất phải dùng đúng key của một chủ đề đã đo. Đưa ra nội dung cần học, một bài luyện tập cụ thể và cách tự kiểm tra lại.',
            `Kết quả đo từ bài kiểm tra:\n${JSON.stringify(evidence)}`,
            `Ghi chú khó và điểm thực tế (chỉ làm ngữ cảnh):\n${JSON.stringify({ notes: study.notes, grades: study.grades })}`
        ].join('\n\n'), { signal: options.signal, validate: value => Array.isArray(value?.advice),
            schemaDescription: JSON.stringify({ advice: [{ key: 'topic key from input', recommendation: 'string', exercise: 'string' }] }) });
        const advice = (Array.isArray(output?.advice) ? output.advice : []).map(item => ({ key: item?.key,
            recommendation: clean(item?.recommendation, 1500), exercise: clean(item?.exercise, 1500) }))
            .filter((item, i, all) => evidence.topics.some(t => t.key === item.key) && item.recommendation && all.findIndex(a => a.key === item.key) === i).slice(0, 30);
        if (!advice.length) throw new gemini.GeminiError('AI chưa trả đề xuất gắn với kết quả thực tế. Hãy thử lại.', 'GEMINI_SCHEMA', 502);
        const created = now();
        options.signal?.throwIfAborted();
        await q('INSERT INTO AiWeaknessReports(report_id,user_id,evidence_hash,advice_json,created_at) VALUES(@id,@uid,@hash,@advice,@created)',
            { id: randomUUID(), hash: hash(evidence), advice: JSON.stringify(advice), created });
        return { ...evidence, advice, analyzedAt: created };
    }
    return { quizzes, quiz, generateQuiz, submitQuiz, weaknesses, analyzeWeaknesses };
}

module.exports = { createQuizService };
