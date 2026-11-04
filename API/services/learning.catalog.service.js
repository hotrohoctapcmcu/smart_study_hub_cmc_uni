'use strict';

const { matchCourse } = require('../utils/current-courses');
const { aggregateCourseText, fingerprint, documentsOf } = require('../utils/course-material-text');
const { responseFailure } = require('../utils/ai-response');
const { summaryLimits } = require('../utils/course-summary-ai');
const { PIPELINE_VERSION } = require('./course-summary.pipeline');
const { textOnlyChapters } = require('../../database/shared/eduxContent');

const { loi: fail } = require('../utils/error');
const parse = (value, fallback = []) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const sourceHash = chapters => fingerprint(chapters.map(chapter => [chapter.id, chapter.title,
    (chapter.documents || []).map(document => [document.id, document.title, document.number, document.rawContent ?? document.content])]));

function createLearningCatalog({ q, scope, now, jobs, activeJobs }) {
    const matchesFailure = (failure, row) => Boolean(failure.courseId && failure.courseId === row.course_id) || Boolean(matchCourse({ resolved: true,
        courses: [{ subjectCode: row.subject_code, subjectName: row.subject_name }] }, failure));
    async function syncFailures() {
        const [report] = await q('SELECT failures_json FROM LearningSyncReports WHERE user_id=@uid');
        return parse(report?.failures_json);
    }
    async function saveFailures(failures) {
        await q(`INSERT INTO LearningSyncReports(user_id,failures_json,updated_at) VALUES(@uid,@failures,@updated)
            ON CONFLICT(user_id) DO UPDATE SET failures_json=excluded.failures_json,updated_at=excluded.updated_at`,
        { failures: JSON.stringify(failures), updated: now() });
    }

    async function rowFor(id) {
        const [row] = await q('SELECT * FROM LearningCourses WHERE user_id=@uid AND course_id=@id', { id });
        if (!row || !matchCourse(await scope(), row)) throw fail('Môn học này không có trong lịch học hiện tại.', 404);
        return row;
    }
    const cardView = row => ({ id: row.card_id, courseId: row.course_id, front: row.front, back: row.back,
        chapter: row.chapter, sourceIds: parse(row.source_ids_json), dueAt: row.due_at,
        summaryHash: row.summary_hash, intervalDays: row.interval_days, reviews: row.review_count, forgottenCount: Number(row.forgotten_count) || 0 });

    async function courseView(row, detail = false) {
        const chapters = textOnlyChapters(parse(row.chapters_json));
        const sources = documentsOf(chapters);
        const [saved] = await q('SELECT * FROM LearningSummaries WHERE user_id=@uid AND course_id=@id', { id: row.course_id });
        const inputHash = fingerprint(aggregateCourseText({ subject: row.subject_name, chapters }));
        const stale = Boolean(saved && (!saved.content?.trim() || responseFailure(saved.content) || saved.content.length > summaryLimits().storedChars || saved.source_hash !== row.source_hash || !row.complete ||
            saved.pipeline_version !== PIPELINE_VERSION || saved.input_hash !== inputHash));
        const summary = saved ? { content: saved.content, sourceHash: saved.source_hash, createdAt: saved.created_at,
            stale, sourceIds: parse(saved.coverage_json), summaryHash: saved.summary_hash, inputHash: saved.input_hash,
            pipelineVersion: saved.pipeline_version, ...parse(saved.format_json, {}), cardsState: parse(saved.cards_state_json, {}) } : null;
        const cards = saved && !stale ? (await q(`SELECT LearningCards.*,
            (SELECT COUNT(*) FROM LearningReviews r WHERE r.user_id=LearningCards.user_id AND r.card_id=LearningCards.card_id AND r.rating='again') AS forgotten_count
            FROM LearningCards WHERE user_id=@uid AND course_id=@id
            AND source_hash=@hash AND summary_hash=@summary ORDER BY created_at,card_id`, {
            id: row.course_id, hash: row.source_hash, summary: saved.summary_hash })).map(cardView) : [];
        const persistedFailures = [...parse(row.failures_json), ...(await syncFailures()).filter(failure => matchesFailure(failure, row))];
        // Also expose failures stored by previous versions, before reports existed.
        for (const chapter of chapters) {
            if (chapter.error && !persistedFailures.some(failure => failure.chapterId === chapter.id && !failure.documentId)) persistedFailures.push({
                courseId: row.course_id, stage: 'slides', chapterId: chapter.id, chapter: chapter.title, message: chapter.error });
            for (const document of chapter.documents || []) if (document.error && !persistedFailures.some(failure => failure.documentId === document.id)) persistedFailures.push({
                courseId: row.course_id, stage: 'content', chapterId: chapter.id, chapter: chapter.title, documentId: document.id, document: document.title, message: document.error });
        }
        const failures = [...new Map(persistedFailures.map(failure => [JSON.stringify([failure.stage, failure.courseId, failure.chapterId, failure.documentId, failure.message]), failure])).values()];
        const failedCount = sources.filter(item => item.status !== 'ready').length + chapters.filter(item => item.complete === false && !item.documents?.some(d => d.status !== 'ready')).length;
        return { id: row.course_id, subject: row.subject_name, subjectCode: row.subject_code,
            chapterCount: chapters.length, sourceCount: sources.filter(item => item.status === 'ready').length,
            failedCount: failedCount || (!row.complete ? 1 : 0),
            complete: Boolean(row.complete), summary, cardCount: cards.length,
            dueCount: cards.filter(card => card.dueAt <= now()).length, updatedAt: row.updated_at,
            failures, ...(detail ? { chapters, cards } : {}) };
    }
    const placeholder = item => ({ id: `pending-${item.subjectId ?? fingerprint(item).slice(0, 16)}`, subject: item.subjectName,
        subjectCode: item.subjectCode, chapterCount: 0, sourceCount: 0, failedCount: 0, complete: false,
        summary: null, cardCount: 0, dueCount: 0, chapters: [], cards: [], pending: true });

    async function courses() {
        const current = await scope();
        if (!current.resolved) return { scope: current, courses: [], jobs: [] };
        const stored = await q('SELECT * FROM LearningCourses WHERE user_id=@uid ORDER BY updated_at DESC');
        const failures = await syncFailures();
        const found = [];
        for (const item of current.courses) {
            const row = stored.find(candidate => matchCourse({ ...current, courses: [item] }, candidate));
            found.push(row ? await courseView(row) : { ...placeholder(item), failures: failures.filter(failure => matchesFailure(failure, {
                subject_code: item.subjectCode, subject_name: item.subjectName })) });
        }
        return { scope: current, courses: found, jobs: [...activeJobs.values()].map(jobId => {
            const entry = jobs.get(jobId);
            return { jobId, status: entry.status, message: entry.message, progress: entry.progress, phase: entry.phase,
                kind: entry.kind, courseId: entry.courseId, subject: entry.subject, queuePosition: entry.queuePosition,
                currentSubject: entry.currentSubject, materialsUpdatedAt: entry.materialsUpdatedAt,
                summaryStage: entry.summaryStage, completedParts: entry.completedParts, totalParts: entry.totalParts,
                activeWorkers: entry.activeWorkers, parallelism: entry.parallelism };
        }) };
    }
    async function course(id) {
        if (String(id).startsWith('pending-')) {
            const item = (await courses()).courses.find(entry => entry.id === id);
            if (!item) throw fail('Môn học không có trong lịch hiện tại.', 404);
            return { ...item, chapters: [], cards: [] };
        }
        return courseView(await rowFor(id), true);
    }

    return { syncFailures, saveFailures, rowFor, cardView, courseView, courses, course };
}

module.exports = { createLearningCatalog, sourceHash };
