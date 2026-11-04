'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Learning workflows: persisted classification, quiz provenance, real scores and reviewed checklist steps', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-flows-'));
    const previous = process.env.DB_PATH, previousDocs = process.env.DOCUMENTS_PATH;
    process.env.DB_PATH = path.join(directory, 'flows.db'); process.env.DOCUMENTS_PATH = path.join(directory, 'documents');
    const db = await require('../../database')();
    const gemini = require('../utils/gemini-client'), originalGenerate = gemini.generateJson;
    t.after(async () => {
        gemini.generateJson = originalGenerate; await db.closePool();
        if (previous === undefined) delete process.env.DB_PATH; else process.env.DB_PATH = previous;
        if (previousDocs === undefined) delete process.env.DOCUMENTS_PATH; else process.env.DOCUMENTS_PATH = previousDocs;
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); assert.ok(path.basename(directory).startsWith('learning-flows-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const q = (sql, params = {}) => db.executeQuery(sql, { ...params, uid: 1 });
    await q("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'FLOW-1','Test','IT'),(2,'FLOW-2','Other','IT')");
    await q("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','SQL'),(2,'OLD','Historical')");
    const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
    await q("INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,semester,academic_year,source) VALUES(1,1,'IT','A','CMC',2,'08:00','09:00',@start,@end,'1',@year,'IU')", { start: `${year}-01-01`, end: `${year}-12-31`, year: `${year}-${year + 1}` });
    await q("INSERT INTO Assignments(assignment_id,student_id,subject_id,title,deadline,status) VALUES(7,1,1,'JOIN','2099-11-04T20:00','PENDING'),(8,2,1,'Private','2099-11-04T20:00','PENDING')");
    const workspace = require('../services/workspace.service').createWorkspaceService({ getDb: () => db, userId: 1 });
    const { resolveQuizSource } = require('../services/quiz-source.service');
    const sourceOptions = { getDb: () => db, userId: 1, subject: 'SQL' };
    let uploaded, quiz, nextQuiz, capturedPrompt;

    await t.test('uploads store the canonical subject and current IU term, while missing metadata stays unclassified', async () => {
        uploaded = await workspace.upload({ filename: 'join.txt', title: 'JOIN source', subjectId: 1, subject: 'Forged', semester: 'old' }, Buffer.from('INNER JOIN combines matching rows.'));
        assert.equal(uploaded.subject, 'SQL'); assert.equal(uploaded.subjectId, 1); assert.equal(uploaded.semester, '1'); assert.equal(uploaded.academicYear, `${year}-${year + 1}`);
        const unclassified = await workspace.upload({ filename: 'notes.md', title: 'Notes' }, Buffer.from('Unclassified notes'));
        assert.equal(unclassified.subject, ''); assert.equal(unclassified.semester, ''); assert.equal(unclassified.subjectId, null);
        await assert.rejects(workspace.upload({ filename: 'old.txt', title: 'Old', subjectId: 2 }, Buffer.from('Old')), /kỳ hiện tại/);
        assert.equal((await workspace.documents()).length, 2);
    });
    await t.test('Pomodoro retains an explicit review topic separately from the session goal', async () => {
        const saved = await workspace.savePomodoro({ id: 'topic-session', startTime: '2026-11-04T09:00:00Z', endTime: '2026-11-04T09:01:00Z', actualStudySeconds: 60, workDurationMinutes: 15, status: 'Kết thúc sớm',
            learningContext: { subjectId: 1, goal: 'Hoàn thành 3 bài truy vấn', topic: 'JOIN' } });
        assert.equal(saved.learningContext.topic, 'JOIN'); assert.equal(saved.learningContext.goal, 'Hoàn thành 3 bài truy vấn');
        await assert.rejects(workspace.savePomodoro({ id: 'bad-topic', startTime: '2026-11-04T09:00:00Z', actualStudySeconds: 60, learningContext: { topic: 'a'.repeat(201) } }), /topic/);
    });
    const chapters = [{ id: 'ch1', title: 'JOIN', documents: [{ id: 's1', title: 'INNER JOIN', status: 'ready', content: 'INNER JOIN combines matching rows.' }] }];
    await q("INSERT INTO LearningCourses(user_id,course_id,subject_name,subject_code,chapters_json,source_hash,complete,updated_at) VALUES(1,'sql','SQL','SQL',@chapters,'hash',1,'2026-11-04')", { chapters: JSON.stringify(chapters) });
    await t.test('source resolution reads owned text and course documents, and refuses foreign/unsupported/missing sources', async () => {
        const source = await resolveQuizSource({ uploadId: uploaded.id }, sourceOptions);
        assert.match(source.text, /INNER JOIN/); assert.equal(source.evidence.kind, 'upload');
        const course = await resolveQuizSource({ courseId: 'sql', chapterId: 'ch1', documentId: 's1' }, sourceOptions);
        assert.match(course.text, /INNER JOIN/); assert.deepEqual(course.evidence.documents, [{ id: 's1', title: 'INNER JOIN', chapter: 'JOIN' }]);
        await assert.rejects(resolveQuizSource({ uploadId: uploaded.id }, { ...sourceOptions, userId: 2 }), /hiện tại|đang học/);
        await assert.rejects(resolveQuizSource({ courseId: 'sql', chapterId: 'missing' }, sourceOptions), /chưa đầy đủ/);
        const pdf = await workspace.upload({ filename: 'source.pdf', title: 'PDF source', subjectId: 1 }, Buffer.from('%PDF-1.4'));
        await assert.rejects(resolveQuizSource({ uploadId: pdf.id }, sourceOptions), /Chưa trích xuất/);
    });
    const service = require('../services/quiz.service').createQuizService({ q, one: async (sql, params) => { const rows = await q(sql, params); if (!rows.length) throw new Error('Not found'); return rows[0]; }, userId: 1, mutate: fn => db.withTransaction(fn), getDb: () => db });
    gemini.generateJson = async (prompt, options) => {
        capturedPrompt = prompt;
        const count = Number(prompt.match(/Tạo đúng (\d+)/)[1]);
        const output = { questions: Array.from({ length: count }, (_, i) => ({ question: `JOIN question ${i + 1}`, topic: 'JOIN', options: ['Matching rows', 'Delete', 'Drop', 'Exit'], correctIndex: 0, explanation: 'JOIN combines matching rows.' })) };
        assert.equal(options.validate(output), true); return output;
    };
    await t.test('quiz generation persists only sources actually read and keeps answer keys hidden', async () => {
        quiz = await service.generateQuiz({ subject: 'SQL', topic: 'JOIN', count: 5, difficulty: 'hard', source: { courseId: 'sql', chapterId: 'ch1', documentId: 's1' } });
        assert.match(capturedPrompt, /INNER JOIN combines matching rows/); assert.equal(quiz.source.kind, 'course'); assert.equal(quiz.questions.length, 5);
        assert.ok(quiz.questions.every(item => item.correctIndex === undefined));
        assert.equal((await service.quiz(quiz.id)).source.documents[0].id, 's1');
        nextQuiz = await service.generateQuiz({ subject: 'SQL', topic: 'JOIN', count: 5 });
        assert.equal(nextQuiz.source.kind, 'general'); assert.match(nextQuiz.source.title, /không dùng tài liệu/);
    });
    await t.test('source failures and invalid AI results do not write successful quiz records', async () => {
        const before = (await service.quizzes()).length;
        await assert.rejects(service.generateQuiz({ subject: 'SQL', topic: 'JOIN', source: { courseId: 'missing' } }));
        const valid = gemini.generateJson; gemini.generateJson = async () => ({ questions: [] });
        try { await assert.rejects(service.generateQuiz({ subject: 'SQL', topic: 'JOIN' }), /chưa hợp lệ/); } finally { gemini.generateJson = valid; }
        assert.equal((await service.quizzes()).length, before);
    });
    await t.test('before/after weakness scores come from submitted answers, never client-supplied scores', async () => {
        await service.submitQuiz(quiz.id, { answers: Object.fromEntries(quiz.questions.map(item => [item.id, 1])), score: 100 });
        let evidence = await service.weaknesses(); assert.equal(evidence.topics[0].latestScore, 0); assert.equal(evidence.topics[0].previousScore, null);
        await service.submitQuiz(nextQuiz.id, { answers: Object.fromEntries(nextQuiz.questions.map(item => [item.id, 0])), score: 0 });
        evidence = await service.weaknesses(); assert.equal(evidence.topics[0].previousScore, 0); assert.equal(evidence.topics[0].latestScore, 100); assert.equal(evidence.topics[0].improvement, 100);
    });
    const tasks = require('../services/baitap.service'); tasks.setDb(db);
    const steps = [{ title: 'Read schema', doneWhen: 'Two tables identified', minutes: 10 }, { title: 'Write JOIN', doneWhen: 'Three working queries', minutes: 30 }];
    await t.test('reviewed checklist steps save outputs and estimates atomically without completing their parent task', async () => {
        await tasks.createTaskChecklist(7, { steps });
        const rows = await tasks.getTaskChecklist(7);
        assert.equal(rows.length, 2); assert.equal(rows[0].done_when, steps[0].doneWhen); assert.equal(rows[0].estimated_minutes, 10);
        assert.ok(rows.every(row => row.is_completed === 0)); assert.equal((await q('SELECT status FROM Assignments WHERE assignment_id=7'))[0].status, 'PENDING');
        await assert.rejects(tasks.createTaskChecklist(8, { steps }), /công việc/);
        await assert.rejects(tasks.createTaskChecklist(7, { steps: [...steps, { title: 'Invalid', minutes: -1 }] }));
        assert.equal((await tasks.getTaskChecklist(7)).length, 2);
        await assert.rejects(tasks.updateChecklist(String(rows[0].checklist_id), { minutes: -1 }), /Thời lượng/);
        await tasks.updateChecklist(String(rows[0].checklist_id), { minutes: 15, doneWhen: 'Edited output' });
        assert.equal((await tasks.getTaskChecklist(7))[0].done_when, 'Edited output');
    });
    await t.test('a mid-batch database failure rolls back all newly added checklist steps', async () => {
        let calls = 0; tasks.setDb({ ...db, themChecklist: async (...args) => { if (++calls === 2) throw new Error('Injected write failure'); return db.themChecklist(...args); } });
        try { await assert.rejects(tasks.createTaskChecklist(7, { steps }), /Injected/); } finally { tasks.setDb(db); }
        assert.equal((await tasks.getTaskChecklist(7)).length, 2);
    });
    await t.test('flashcard catalog exposes actual forgotten review counts', async () => {
        const { fingerprint, aggregateCourseText } = require('../utils/course-material-text');
        await q("INSERT INTO LearningSummaries(user_id,course_id,source_hash,content,coverage_json,created_at,input_hash,pipeline_version,summary_hash) VALUES(1,'sql','hash','JOIN summary','[]','2026-11-04',@input,@version,'summary')", { input: fingerprint(aggregateCourseText({ subject: 'SQL', chapters })), version: require('../services/course-summary.pipeline').PIPELINE_VERSION });
        await q("INSERT INTO LearningCards(user_id,card_id,course_id,source_hash,front,back,chapter,source_ids_json,due_at,created_at,summary_hash) VALUES(1,'card','sql','hash','Question','Answer','JOIN','[]','2026-01-01','2026-01-01','summary')");
        await q("INSERT INTO LearningReviews(user_id,request_id,card_id,rating,result_json,created_at) VALUES(1,'r1','card','again','{}','2026-01-01'),(1,'r2','card','good','{}','2026-01-02'),(2,'foreign','card','again','{}','2026-01-01')");
        const learning = require('../services/learning.service').createLearningService({ getDb: () => db, userId: 1 });
        assert.equal((await learning.course('sql')).cards[0].forgottenCount, 1);
    });
    await t.test('additive migrations and stored classification survive a database reopen', async () => {
        require('../../database/migrations/workspaceMigration').migrateWorkspace(await db.getPool());
        require('../../database/migrations/aiMigration').migrateSprint3(await db.getPool());
        await db.closePool(); await db.getPool();
        assert.equal((await workspace.documents()).find(d => d.id === uploaded.id).semester, '1');
        assert.equal((await service.quiz(quiz.id)).source.kind, 'course'); assert.equal((await tasks.getTaskChecklist(7))[0].estimated_minutes, 15);
    });
});
