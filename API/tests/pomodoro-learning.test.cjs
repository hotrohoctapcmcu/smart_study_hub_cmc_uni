'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

test('Pomodoro learning goals persist and task completion is explicit, owned and atomic', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-learning-'));
    const previousPath = process.env.DB_PATH;
    process.env.DB_PATH = path.join(directory, 'learning.db');
    let db, server;
    t.after(async () => {
        server?.closeAllConnections();
        if (server) await new Promise(resolve => server.close(resolve));
        await db?.closePool();
        if (previousPath === undefined) delete process.env.DB_PATH; else process.env.DB_PATH = previousPath;
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('pomodoro-learning-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    db = await require('../../database')();
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'POMO-1','Owner','IT'),(2,'POMO-2','Other','IT')");
    await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','Cơ sở dữ liệu')");
    await db.executeQuery("INSERT INTO Assignments(assignment_id,student_id,subject_id,title,deadline,status) VALUES(1,1,1,'Bài JOIN','2030-01-01','PENDING'),(2,2,1,'Private','2030-01-01','PENDING'),(3,1,1,'Rollback','2030-01-01','PENDING')");
    await db.executeQuery("INSERT INTO EduxAssignments(user_id,external_id,title,subject_name,status) VALUES(1,'edux-pomo','Bài EDUX','Cơ sở dữ liệu','Chưa làm')");
    const service = require('../services/workspace.service').createWorkspaceService({ getDb: () => db, userId: 1, storageDir: path.join(directory, 'documents') });
    const controller = require('../controllers/workspace.controller').createWorkspaceController(service);
    const app = express(); app.use(express.json());
    app.get('/pomodoro', controller.pomodoros); app.post('/pomodoro', controller.savePomodoro);
    app.use(require('../middlewares/error').errorHandler);
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const request = async (method, body) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/pomodoro`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: response.status, ...(await response.json()) };
    };
    const base = { startTime: '2026-11-04T09:00:00Z', endTime: '2026-11-04T09:15:00Z', actualStudySeconds: 900, workDurationMinutes: 15, status: 'Hoàn thành' };
    const context = { subjectId: 1, taskId: '1', taskSource: 'PERSONAL', goal: 'Làm 3 bài JOIN', outcome: 'DONE', reflection: 'Đã giải được 3 bài', nextStep: '' };

    await t.test('adds context to an older schema and retains legacy sessions', async () => {
        await request('POST', { ...base, id: 'legacy' });
        await db.executeQuery('ALTER TABLE PomodoroSessions DROP COLUMN learning_context');
        const pool = await db.getPool();
        const migrate = require('../../database/migrations/workspaceMigration').migrateWorkspace;
        migrate(pool); migrate(pool);
        const result = await request('GET');
        assert.equal(result.data.length, 1);
        assert.deepEqual(result.data[0].learningContext, {});
    });
    await t.test('saves the goal and canonical task/subject labels without completing its task', async () => {
        const result = await request('POST', { ...base, id: 'goal-only', learningContext: { ...context, subjectName: 'Forged name' } });
        assert.equal(result.status, 201);
        assert.equal(result.data.workDurationMinutes, 15);
        assert.deepEqual(result.data.learningContext, { ...context, subjectName: 'Cơ sở dữ liệu', taskTitle: 'Bài JOIN' });
        assert.equal((await db.executeQuery('SELECT status FROM Assignments WHERE assignment_id=1'))[0].status, 'PENDING');
    });
    await t.test('completes an owned task only with opt-in and does not rewrite an idempotent retry', async () => {
        const body = { ...base, id: 'complete-owned', learningContext: context, completeTask: true };
        assert.equal((await request('POST', body)).status, 201);
        assert.equal((await db.executeQuery('SELECT status FROM Assignments WHERE assignment_id=1'))[0].status, 'COMPLETED');
        const retry = await request('POST', { ...body, learningContext: { ...context, goal: 'Changed retry' } });
        assert.equal(retry.data.learningContext.goal, context.goal);
        assert.equal((await db.executeQuery("SELECT COUNT(*) AS n FROM PomodoroSessions WHERE client_id='complete-owned'"))[0].n, 1);
    });
    await t.test('supports owned EDUX tasks without confusing their external IDs with local IDs', async () => {
        const result = await request('POST', { ...base, id: 'edux-session', learningContext: { ...context, taskId: 'edux-pomo', taskSource: 'EDUX' }, completeTask: true });
        assert.equal(result.status, 201);
        assert.equal(result.data.learningContext.taskTitle, 'Bài EDUX');
        assert.equal((await db.executeQuery("SELECT status FROM EduxAssignments WHERE external_id='edux-pomo'"))[0].status, 'Hoàn thành');
    });
    await t.test('retains EDUX ownership when the academic profile uses a different internal ID', async () => {
        await db.executeQuery("INSERT INTO EduxAssignments(user_id,external_id,title,subject_name,status) VALUES(9,'edux-pomo','EDUX của owner 9','Cơ sở dữ liệu','Chưa làm')");
        const aliased = require('../services/workspace.service').createWorkspaceService({ getDb: () => ({ ...db, layHoSo: async () => ({ student_id: 1 }) }), userId: 9, storageDir: path.join(directory, 'documents') });
        const result = await aliased.savePomodoro({ ...base, id: 'aliased-edux', learningContext: { ...context, taskId: 'edux-pomo', taskSource: 'EDUX' }, completeTask: true });
        assert.equal(result.learningContext.taskTitle, 'EDUX của owner 9');
        assert.equal((await db.executeQuery("SELECT status FROM EduxAssignments WHERE user_id=9 AND external_id='edux-pomo'"))[0].status, 'Hoàn thành');
    });
    await t.test('rejects foreign/deleted task links without saving a partial session', async () => {
        for (const taskId of ['2', '999']) {
            const result = await request('POST', { ...base, id: `foreign-${taskId}`, learningContext: { ...context, taskId }, completeTask: true });
            assert.equal(result.status, 404);
        }
        assert.equal((await db.executeQuery("SELECT COUNT(*) AS n FROM PomodoroSessions WHERE client_id LIKE 'foreign-%'"))[0].n, 0);
        assert.equal((await db.executeQuery('SELECT status FROM Assignments WHERE assignment_id=2'))[0].status, 'PENDING');
    });
    await t.test('validates lengths, outcome, subject and completion intent', async () => {
        for (const learningContext of [{ ...context, goal: 'a'.repeat(301) }, { ...context, outcome: 'AUTO_DONE' }, { ...context, taskId: '', outcome: 'DONE' }, { ...context, outcome: 'CONTINUE' }]) {
            assert.equal((await request('POST', { ...base, id: 'invalid', learningContext, completeTask: true })).status, 400);
        }
        assert.equal((await request('POST', { ...base, id: 'unknown-subject', learningContext: { subjectId: 999 } })).status, 404);
    });
    await t.test('rolls back the session when completing the task fails and allows a safe retry', async () => {
        await db.executeQuery("CREATE TRIGGER fail_pomo_task BEFORE UPDATE OF status ON Assignments WHEN NEW.assignment_id=3 BEGIN SELECT RAISE(ABORT,'Simulated task failure'); END");
        const body = { ...base, id: 'atomic', learningContext: { ...context, taskId: '3' }, completeTask: true };
        assert.ok((await request('POST', body)).status >= 400);
        assert.equal((await db.executeQuery("SELECT COUNT(*) AS n FROM PomodoroSessions WHERE client_id='atomic'"))[0].n, 0);
        assert.equal((await db.executeQuery('SELECT status FROM Assignments WHERE assignment_id=3'))[0].status, 'PENDING');
        await db.executeQuery('DROP TRIGGER fail_pomo_task');
        assert.equal((await request('POST', body)).status, 201);
    });
    await t.test('retains goals, outcomes and next steps after reopening the database', async () => {
        const microGoals = [{ id: 'step-1', title: 'Đọc điều kiện nối', minutes: 5, doneWhen: 'Viết được hai điều kiện', completed: true }, { id: 'step-2', title: 'Chạy truy vấn', minutes: 10, doneWhen: 'Kết quả đúng', completed: false }];
        const planned = await request('POST', { ...base, id: 'micro-goals', learningContext: { subjectId: 1, goal: 'Ôn SQL', microGoals } });
        assert.equal(planned.status, 201);
        assert.deepEqual(planned.data.learningContext.microGoals, microGoals);
        assert.equal((await request('POST', { ...base, id: 'bad-micro-goals', learningContext: { microGoals: microGoals.map(step => ({ ...step, minutes: 15 })) } })).status, 400);
        await request('POST', { ...base, id: 'continue', learningContext: { subjectId: 1, goal: 'Ôn SQL', outcome: 'CONTINUE', nextStep: 'Luyện LEFT JOIN' } });
        await db.closePool(); db = await require('../../database')();
        const result = await request('GET');
        assert.equal(result.data.find(row => row.id === 'continue').learningContext.nextStep, 'Luyện LEFT JOIN');
        assert.equal(result.data.find(row => row.id === 'goal-only').learningContext.goal, context.goal);
        assert.deepEqual(result.data.find(row => row.id === 'micro-goals').learningContext.microGoals, microGoals);
    });
});
