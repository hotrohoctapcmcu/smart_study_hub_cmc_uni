'use strict';

const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { getCurrentCourseScope, matchCourse } = require('../utils/current-courses');
const eduxSessions = require('../utils/edux-session');
const { collectCourseMaterials } = require('../utils/edux-materials');
const { textOnlyChapters } = require('../../database/shared/eduxContent');
const gemini = require('../utils/gemini-client');
const { aggregateCourseText, documentsOf } = require('../utils/course-material-text');
const { createCourseSummaryPipeline } = require('./course-summary.pipeline');

const { loi: fail } = require('../utils/error');
const parse = (value, fallback = []) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const { nonempty } = require('../validators/learning.validator');
const { createLearningCatalog, sourceHash } = require('./learning.catalog.service');
const { createLearningJobs } = require('./learning.jobs.service');
const { createLearningReview } = require('./learning.review.service');

function createLearningService({ getDb, userId = NGUOI_DUNG_ID, getScope = getCurrentCourseScope,
    collect = collectCourseMaterials, sessions = eduxSessions, ai = gemini, clock = () => new Date() } = {}) {
    const db = () => { const value = getDb?.(); if (!value) throw fail('Cơ sở dữ liệu chưa sẵn sàng.', 503); return value; };
    const now = () => new Date(clock()).toISOString();
    const q = (sql, params = {}) => db().executeQuery(sql, { ...params, uid: userId });
    const scope = () => getScope(db(), userId, { now: clock() });
    const aiTimeoutMs = Math.max(1000, Number(process.env.LEARNING_AI_TIMEOUT_MS) || 120000);
    let writes = Promise.resolve();
    const mutate = fn => { const result = writes.then(fn); writes = result.catch(() => {}); return result; };
    const { jobs, activeJobs, startJob, job } = createLearningJobs();
    const summariesInFlight = new Map();
    const { syncFailures, saveFailures, rowFor, cardView, courseView, courses, course } =
        createLearningCatalog({ q, scope, now, jobs, activeJobs });

    async function saveCollected(collected) {
        const current = await scope();
        for (const incoming of collected.courses || []) {
            if (!matchCourse(current, incoming)) continue;
            const [previous] = await q('SELECT * FROM LearningCourses WHERE user_id=@uid AND course_id=@id', { id: incoming.id });
            const oldChapters = textOnlyChapters(parse(previous?.chapters_json));
            let chapters = textOnlyChapters(incoming.chapters || []).map(chapter => {
                const old = oldChapters.find(item => String(item.id) === String(chapter.id));
                // A failed chapter-list request must not erase its stored sources.
                if (chapter.complete === false && !chapter.documents?.length && old) return { ...old, complete: false,
                    documents: old.documents.map(document => ({ ...document, status: 'error', cached: true, error: 'Chưa cập nhật được chương. Nội dung là bản đã lưu.' })) };
                return { ...chapter, documents: (chapter.documents || []).map(document => {
                    const cached = old?.documents?.find(item => String(item.id) === String(document.id));
                    return document.status !== 'ready' && cached?.content ? { ...document, content: cached.content,
                        rawContent: cached.rawContent, cached: true } : document;
                }) };
            });
            if (incoming.complete === false && !chapters.length && oldChapters.length) chapters = oldChapters.map(chapter => ({ ...chapter, complete: false,
                documents: chapter.documents.map(document => ({ ...document, status: 'error', cached: true, error: 'Chưa tải lại được danh sách chương.' })) }));
            const complete = incoming.complete !== false && chapters.length > 0 && chapters.every(chapter => chapter.complete !== false) &&
                documentsOf(chapters).length > 0 && documentsOf(chapters).every(document => document.status === 'ready' &&
                    String(document.content || '').trim());
            await q(`INSERT INTO LearningCourses(user_id,course_id,subject_name,subject_code,chapters_json,source_hash,complete,failures_json,updated_at)
                VALUES(@uid,@id,@subject,@code,@chapters,@hash,@complete,@failures,@updated)
                ON CONFLICT(user_id,course_id) DO UPDATE SET subject_name=excluded.subject_name,subject_code=excluded.subject_code,
                chapters_json=excluded.chapters_json,source_hash=excluded.source_hash,complete=excluded.complete,
                failures_json=excluded.failures_json,updated_at=excluded.updated_at`, {
                id: String(incoming.id), subject: incoming.subject, code: incoming.subjectCode || '', chapters: JSON.stringify(chapters),
                hash: sourceHash(chapters), complete: complete ? 1 : 0,
                failures: JSON.stringify((collected.failures || []).filter(failure => failure.courseId === String(incoming.id))), updated: now()
            });
        }
    }
    async function startSync(options = {}) {
        const current = await scope();
        if (!current.resolved) throw fail(current.message, 409);
        if (!current.courses.length) throw fail('Lịch hiện tại chưa có môn học để đồng bộ tài liệu.', 409);
        const session = sessions.ensureSession ? await sessions.ensureSession(userId) : sessions.getSession(userId);
        if (!session?.cookie) throw fail('Hãy kết nối EDUX trong Đồng bộ dữ liệu để lấy nội dung bài giảng.', 401);
        if (options.subjectId != null && !nonempty(options.subjectId, 200)) throw fail('Mã môn học không hợp lệ.');
        const [stored] = options.subjectId ? await q('SELECT subject_name FROM LearningCourses WHERE user_id=@uid AND course_id=@id', { id: options.subjectId }) : [];
        const key = options.subjectId ? `sync:${options.subjectId}` : 'sync';
        return startJob(activeJobs.has('sync') ? 'sync' : key, async update => {
            // A queued request may start much later. Resolve scope/session again.
            const current = await scope();
            if (!current.resolved || !current.courses.length) throw fail(current.message || 'Chưa có môn hiện tại để đồng bộ.', 409);
            const session = sessions.ensureSession ? await sessions.ensureSession(userId) : sessions.getSession(userId);
            if (!session?.cookie) throw fail('Hãy kết nối lại EDUX trước khi đồng bộ slide.', 401);
            update('Đang lấy toàn bộ chương và nội dung slide của các môn đang học…', null, { phase: 'materials' });
            let collected;
            try { collected = await collect(session.cookie, { scope: current, subjectId: options.subjectId,
                onProgress: ({ subject, courseId, done, total }) => update(`Đang quét slide: ${subject} (${done + 1}/${total})`, { done, total }, { phase: 'materials', currentCourseId: courseId, currentSubject: subject }),
                onCourse: async (course, failures) => {
                    await mutate(() => saveCollected({ courses: [course], failures }));
                    update(`Đã lưu slide: ${course.subject}.`, null, { phase: 'materials', materialsUpdatedAt: now() });
                }
            }); }
            catch (error) { if ([401, 403].includes(error.statusCode || error.status)) sessions.clearSession(userId); throw error; }
            await mutate(() => saveCollected(collected));
            update('Đã lưu nội dung slide. Bạn có thể bấm tóm tắt khi cần.', null, { phase: 'materials', materialsUpdatedAt: now() });
            const failures = [...(collected.failures || [])];
            await mutate(async () => {
                const previous = await syncFailures();
                await saveFailures(options.subjectId ? [...previous.filter(failure => failure.courseId !== options.subjectId), ...failures] : failures);
            });
            const result = await courses();
            return { ...result, failures };
        }, { kind: 'sync', courseId: options.subjectId || null, subject: stored?.subject_name || (options.subjectId ? 'Môn đã chọn' : 'Tất cả môn kỳ hiện tại'), phase: 'materials' });
    }

    function summarize(id, update = () => {}) {
        if (summariesInFlight.has(id)) return summariesInFlight.get(id);
        const pending = summarizeNow(id, update).then(async result => {
            await mutate(async () => saveFailures((await syncFailures()).filter(failure => !(failure.courseId === id && ['summary', 'cards'].includes(failure.stage)))));
            return result;
        }, async error => {
            if (error.statusCode !== 404 && error.statusCode !== 409) await mutate(async () => {
                const stage = error.stage || 'summary';
                const failures = (await syncFailures()).filter(failure => !(failure.courseId === id && failure.stage === stage));
                failures.push({ courseId: id, stage, message: error.message });
                await saveFailures(failures);
            });
            throw error;
        }).finally(() => summariesInFlight.delete(id));
        summariesInFlight.set(id, pending);
        return pending;
    }
    const summarizeNow = createCourseSummaryPipeline({ q, rowFor, courseView, course, mutate, db, ai, now, timeoutMs: aiTimeoutMs,
        onSummarySaved: id => mutate(async () => saveFailures((await syncFailures()).filter(failure => !(failure.courseId === id && failure.stage === 'summary')))) });

    async function startSummary(id) {
        const row = await rowFor(id);
        if (!row.complete || !documentsOf(parse(row.chapters_json)).length) throw fail('Cần đồng bộ đủ slide của môn trước khi tạo tóm tắt và Flashcard.', 409);
        return startJob(`summary:${id}`, update => summarize(id, update), { kind: 'summary', courseId: id, subject: row.subject_name, phase: 'summaries' });
    }
    const review = createLearningReview({ q, mutate, rowFor, courseView, cardView, db, clock, now });

    return { courses, course, startSync, startSummary, job, review, summarize };
}

module.exports = { createLearningService, sourceHash, aggregateCourseText };
