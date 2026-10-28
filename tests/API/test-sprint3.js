'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createProvider, today, addDays } = require('../helpers/sprint3-provider.cjs');

test('Sprint 3: real HTTP provider contract, API, SQLite persistence and failure recovery', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-sprint3-'));
    const { provider, origin, state } = await createProvider();
    Object.assign(process.env, { DB_PATH: path.join(directory, 'test.db'), API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test',
        GEMINI_ORIGIN: origin, GEMINI_SESSION_DIR: directory, GEMINI_ENABLE_WEB_FALLBACK: 'false', GEMINI_TIMEOUT_MS: '1000' });
    const db = await require('../../database')();
    const query = (...args) => db.executeQuery(...args);
    const server = await require('../../API').start();
    const base = `http://127.0.0.1:${server.address().port}/api/v1/ai`;
    const call = async (method, endpoint, body) => {
        const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined && { body: JSON.stringify(body) }) });
        return { status: response.status, ...(await response.json()) };
    };
    t.after(async () => {
        for (const s of [server, provider]) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); }
        await db.closePool();
        const resolved = path.resolve(directory);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    const tomorrow = addDays(today(), 1), examDate = addDays(today(), 3);
    await query("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'SPRINT3','Sprint 3','IT'),(2,'OTHER','Other','IT')");
    await query("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','CSDL')");
    await query("INSERT INTO Exams(exam_id,student_id,subject_id,exam_name,exam_date,exam_time,duration_minutes,room,campus) VALUES(1,1,1,'CSDL',@date,'14:00',90,'A','CMC'),(2,2,1,'Other exam',@date,'14:00',90,'A','CMC')", { date: examDate });
    const weekday = new Date(`${tomorrow}T00:00:00Z`).getUTCDay();
    await query("INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date) VALUES(1,1,'IT','A','CMC',@day,'08:00','10:00',@date,@date)", { day: weekday === 0 ? 8 : weekday + 1, date: tomorrow });
    let quiz, quiz2, draft, preview, confirmation;
    const quizInput = { subject: 'CSDL', topic: 'JOIN', count: 3, difficulty: 'medium', sourceText: 'JOIN kết hợp các dòng.' };

    await t.test('additive migration can be rerun without changing existing records', async () => {
        require('../../database/sprint3/migration').migrateSprint3(await db.getPool());
        assert.equal((await query('SELECT * FROM Students')).length, 2);
        assert.equal((await query('SELECT * FROM Exams')).length, 2);
    });
    await t.test('empty evidence does not invent scores or call AI', async () => {
        const before = state.calls.length;
        const result = await call('POST', '/weaknesses/analyze', {});
        assert.equal(result.status, 200); assert.equal(result.data.quizCount, 0);
        assert.deepEqual(result.data.topics, []); assert.deepEqual(result.data.advice, []);
        assert.equal(state.calls.length, before);
    });
    await t.test('quiz input and malformed provider output cannot create invalid quizzes', async () => {
        const before = state.calls.length;
        for (const body of [{ ...quizInput, count: 2 }, { ...quizInput, count: '3' }, { ...quizInput, difficulty: 'bad' }, { ...quizInput, topic: '' }]) assert.equal((await call('POST', '/quizzes', body)).status, 400);
        assert.equal(state.calls.length, before);
        state.override = JSON.stringify({ questions: [{ question: 'Bad', options: ['A'], correctIndex: 99 }] });
        assert.equal((await call('POST', '/quizzes', quizInput)).status, 502);
        state.override = null;
        assert.equal((await query('SELECT * FROM AiQuizzes')).length, 0);
    });
    await t.test('generated quizzes persist while answer keys remain hidden until submission', async () => {
        const result = await call('POST', '/quizzes', quizInput); assert.equal(result.status, 200); quiz = result.data;
        assert.equal(quiz.questions.length, 3); assert.equal(quiz.status, 'draft');
        for (const question of quiz.questions) { assert.equal(question.correctIndex, undefined); assert.equal(question.explanation, undefined); }
        assert.equal((await call('GET', `/quizzes/${quiz.id}`)).data.questions[0].correctIndex, undefined);
        assert.equal((await call('GET', '/quizzes')).data[0].score, null);
    });
    await t.test('server grading rejects missing/tampered answers and ignores client supplied scores', async () => {
        assert.equal((await call('POST', `/quizzes/${quiz.id}/submit`, { answers: { q1: 1 } })).status, 400);
        assert.equal((await call('POST', `/quizzes/${quiz.id}/submit`, { answers: { q1: '0', q2: 0, q3: 0 } })).status, 400);
        const body = { answers: { q1: 1, q2: 1, q3: 1 }, score: 100, correctIndex: 1 };
        const result = await call('POST', `/quizzes/${quiz.id}/submit`, body); assert.equal(result.status, 200);
        assert.equal(result.data.result.score, 0); assert.equal(result.data.questions[0].correctIndex, 0);
        assert.ok(result.data.result.details.every(d => !d.correct && d.explanation));
        assert.equal((await call('POST', `/quizzes/${quiz.id}/submit`, body)).status, 200);
        assert.equal((await call('POST', `/quizzes/${quiz.id}/submit`, { answers: { q1: 0, q2: 0, q3: 0 } })).status, 409);
    });
    await t.test('weakness trends and AI recommendations are tied to actual topic evidence', async () => {
        let evidence = (await call('GET', '/weaknesses')).data;
        assert.equal(evidence.topics[0].priority, 'high'); assert.equal(evidence.topics[0].improvement, null);
        quiz2 = (await call('POST', '/quizzes', quizInput)).data;
        await call('POST', `/quizzes/${quiz2.id}/submit`, { answers: { q1: 0, q2: 0, q3: 0 } });
        evidence = (await call('POST', '/weaknesses/analyze', {})).data;
        assert.equal(evidence.quizCount, 2); assert.equal(evidence.topics[0].accuracy, 50);
        assert.equal(evidence.topics[0].improvement, 100); assert.equal(evidence.topics[0].latestScore, 100);
        assert.equal(evidence.advice[0].key, evidence.topics[0].key);
        assert.ok((await call('GET', '/weaknesses')).data.analyzedAt);
        const draftOnly = await call('POST', '/quizzes', quizInput);
        assert.equal((await call('GET', '/weaknesses')).data.quizCount, 2);
        await call('POST', `/quizzes/${draftOnly.data.id}/submit`, { answers: { q1: 1, q2: 1, q3: 1 } });
        assert.deepEqual((await call('GET', '/weaknesses')).data.advice, [], 'new evidence must invalidate stale AI advice');
    });
    await t.test('chat history is persistent and reused after a provider conversation reset', async () => {
        const first = await call('POST', '/ask', { question: 'Giải thích JOIN', conversationId: 'sprint3-chat' });
        assert.equal(first.status, 200);
        await call('POST', '/ask', { question: 'Cho ví dụ tiếp theo', conversationId: 'sprint3-chat' });
        assert.ok(state.calls.at(-1).includes('Giải thích JOIN'));
        assert.equal((await call('GET', '/conversations/sprint3-chat')).data.messages.length, 4);
        state.status = 403;
        assert.equal((await call('POST', '/ask', { question: 'Lỗi tạm thời', conversationId: 'sprint3-chat' })).status, 503);
        state.status = 200;
        assert.equal((await call('GET', '/conversations/sprint3-chat')).data.messages.length, 4);
        assert.equal((await call('GET', '/conversations')).data[0].title, 'Giải thích JOIN');
    });
    await t.test('leave letter matches the timetable, saves edits and exports a real DOCX', async () => {
        const fields = { date: tomorrow, subject: 'CSDL', reason: 'Bị ốm', recipient: 'Giảng viên' };
        const generated = await call('POST', '/draft-leave', fields);
        assert.equal(generated.data.matchedClasses, 1);
        draft = (await call('POST', '/leave-drafts', { fields, content: generated.data.draft })).data;
        const edited = 'Đơn đã chỉnh sửa\nEm xin phép nghỉ học vì bị ốm.';
        assert.equal((await call('PUT', `/leave-drafts/${draft.id}`, { fields, content: edited })).status, 200);
        assert.equal((await call('GET', '/leave-drafts')).data[0].content, edited);
        assert.equal((await call('POST', '/leave-drafts', { fields: { ...fields, date: '2030-02-30' }, content: edited })).status, 400);
        const response = await fetch(base + `/leave-drafts/${draft.id}/docx`); const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(response.status, 200); assert.equal(bytes.subarray(0, 2).toString(), 'PK'); assert.ok(bytes.includes(Buffer.from('word/document.xml')));
    });
    await t.test('exam plan preview is grounded in free slots and does not write records', async () => {
        const result = await call('POST', '/exam-plan', { examId: 1 }); assert.equal(result.status, 200); preview = result.data;
        assert.equal(preview.persisted, false); assert.equal(preview.phases.length, 1); assert.equal(preview.sessions.length, 1);
        assert.ok(state.calls.at(-1).includes('Điểm yếu đo từ bài kiểm tra'));
        assert.equal((await query('SELECT * FROM ExamStudyPlans')).length, 0);
        confirmation = { confirmed: true, requestId: 'confirm-sprint3', phases: preview.phases.map(p => ({ ...p, title: 'Giai đoạn đã chỉnh' })), sessions: preview.sessions };
        assert.equal((await call('POST', '/exam-plan/confirm', { ...confirmation, confirmed: false })).status, 400);
    });
    await t.test('exam confirmation validates ownership, dates and fresh conflicts before any writes', async () => {
        assert.equal((await call('POST', '/exam-plan/confirm', { ...confirmation, phases: [{ ...confirmation.phases[0], examId: 2 }] })).status, 404);
        assert.equal((await call('POST', '/exam-plan/confirm', { ...confirmation, phases: [{ ...confirmation.phases[0], endDate: addDays(examDate, 1) }] })).status, 409);
        assert.equal((await call('POST', '/exam-plan/confirm', { ...confirmation, sessions: [{ ...preview.sessions[0], date: tomorrow, start: '08:00', end: '09:00' }] })).status, 409);
        assert.equal((await call('POST', '/exam-plan/confirm', { ...confirmation, sessions: [{ ...preview.sessions[0], date: examDate, start: '18:00', end: '19:00' }] })).status, 409);
        assert.equal((await query('SELECT * FROM ExamStudyPlans')).length, 0);
    });
    await t.test('a late failure rolls back both phases and schedules; concurrent retries save once', async () => {
        await query("CREATE TRIGGER reject_sprint3_schedule BEFORE INSERT ON StudySchedules BEGIN SELECT RAISE(ABORT,'Test late write failure'); END");
        assert.equal((await call('POST', '/exam-plan/confirm', confirmation)).status, 500);
        assert.equal((await query('SELECT * FROM ExamStudyPlans')).length, 0);
        assert.equal((await query('SELECT * FROM AiExamConfirmations')).length, 0);
        await query('DROP TRIGGER reject_sprint3_schedule');
        const results = await Promise.all([call('POST', '/exam-plan/confirm', confirmation), call('POST', '/exam-plan/confirm', confirmation)]);
        assert.ok(results.every(r => r.status === 200 && r.data.persisted));
        assert.equal((await query('SELECT * FROM ExamStudyPlans'))[0].phase_title, 'Giai đoạn đã chỉnh');
        assert.equal((await query('SELECT * FROM StudySchedules')).length, 1);
        assert.equal((await call('POST', '/exam-plan/confirm', { ...confirmation, phases: [{ ...confirmation.phases[0], title: 'Different' }] })).status, 409);
    });
    await t.test('records cannot be read or overwritten through another user scope', async () => {
        const other = require('../../API/modules/sprint3.service').createSprint3Service({ getDb: () => db, userId: 2 });
        await assert.rejects(other.quiz(quiz.id), e => e.statusCode === 404);
        await assert.rejects(other.conversation('sprint3-chat'), e => e.statusCode === 404);
        await assert.rejects(other.saveLeave(draft.id, { fields: { date: tomorrow, reason: 'Other' }, content: 'Other' }), e => e.statusCode === 404);
        assert.equal((await other.weaknesses()).quizCount, 0);
        assert.deepEqual(await other.leaveDrafts(), []);
    });
    await t.test('all Sprint 3 records and idempotency survive a database reopen', async () => {
        await db.closePool(); await db.getPool();
        assert.equal((await call('GET', `/quizzes/${quiz.id}`)).data.result.score, 0);
        assert.equal((await call('GET', '/conversations/sprint3-chat')).data.messages.length, 4);
        assert.equal((await call('GET', '/leave-drafts')).data.length, 1);
        assert.equal((await call('POST', '/exam-plan/confirm', confirmation)).status, 200);
        assert.equal((await query('SELECT * FROM ExamStudyPlans')).length, 1);
        assert.equal((await query('SELECT * FROM StudySchedules')).length, 1);
    });
});
