'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createPomodoroGoalService } = require('../services/pomodoro-goals.service');
const { createTrolyaiController } = require('../controllers/trolyai.controller');

const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
const lessons = [
    { source: 'IU', semester: 'HK1', academic_year: `${year}-${year + 1}`, subject_id: 1, subject_name: 'SQL', start_date: `${year}-01-01`, end_date: `${year}-12-31` },
    { source: 'IU', semester: 'HK2', academic_year: `${year - 1}-${year}`, subject_id: 2, subject_name: 'Môn kỳ cũ', start_date: `${year - 1}-01-01`, end_date: `${year - 1}-12-31` }
];
const output = { steps: [{ title: 'Nhận diện điều kiện JOIN', minutes: 5, doneWhen: 'Viết được hai điều kiện nối' }, { title: 'Viết và chạy truy vấn', minutes: 10, doneWhen: 'Truy vấn chạy đúng trên dữ liệu mẫu' }], note: 'Thực hành một phạm vi nhỏ trong phiên này.' };
const db = (rows = lessons) => ({ layThoiKhoaBieu: async () => rows, layHoSo: async () => ({ student_id: 1 }),
    executeQuery: async (sql, params) => ['12', 'edux-12'].includes(params.id) ? [{ title: 'Bài JOIN', subject_id: 1, subject_name: 'SQL', description: 'Luyện các phép nối' }] : [] });

test('Pomodoro goal analysis respects the current term and returns a bounded preview over HTTP', async t => {
    let calls = 0, prompt;
    const service = createPomodoroGoalService({ getDb: () => db(), userId: 1, generateJson: async (input, options) => {
        calls++; prompt = input; assert.equal(options.validate(output), true); return output;
    } });
    const controller = createTrolyaiController({ pomodoroGoals: service.breakdown });
    const app = express(); app.use(express.json()); app.post('/ai/pomodoro-goals', controller.pomodoroGoals); app.use(require('../middlewares/trolyai').errorHandler);
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const request = async body => { const result = await fetch(`http://127.0.0.1:${server.address().port}/ai/pomodoro-goals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: result.status, ...(await result.json()) }; };
    await t.test('rejects empty/oversized goals, unsupported duration and historical courses before calling AI', async () => {
        for (const body of [{}, { goal: 'a'.repeat(301) }, { goal: 'Ôn SQL', durationMinutes: 17 }]) assert.ok((await request(body)).status >= 400);
        assert.equal((await request({ goal: 'Ôn môn cũ', subjectId: 2 })).status, 409);
        assert.equal(calls, 0);
    });
    await t.test('produces small goals with observable completion criteria and no persistence', async () => {
        const result = await request({ goal: 'Ôn phép JOIN', subjectId: 1, taskId: '12', taskSource: 'PERSONAL', durationMinutes: 15 });
        assert.equal(result.status, 200); assert.equal(result.data.persisted, false); assert.equal(result.data.subjectId, 1);
        assert.equal(result.data.steps.length, 2); assert.ok(result.data.steps.every(step => step.doneWhen && step.id));
        assert.ok(result.data.steps.reduce((sum, step) => sum + step.minutes, 0) <= 15);
        assert.match(prompt, /Bài JOIN/); assert.match(prompt, /SQL/); assert.equal(calls, 1);
    });
    await t.test('reuses a valid analysis for the same goal and context', async () => {
        const result = await request({ goal: 'Ôn phép JOIN', subjectId: 1, taskId: '12', taskSource: 'PERSONAL', durationMinutes: 15 });
        assert.equal(result.data.cached, true); assert.equal(calls, 1);
    });
    await t.test('rejects unavailable task links and accepts a scoped EDUX task', async () => {
        assert.equal((await request({ goal: 'Ôn JOIN', taskId: 'foreign', taskSource: 'PERSONAL' })).status, 404);
        assert.equal((await request({ goal: 'Ôn JOIN EDUX', taskId: 'edux-12', taskSource: 'EDUX' })).status, 200);
    });
});

test('malformed, duplicated or over-budget AI steps fail without fabricating a fallback', async () => {
    for (const invalid of [{ steps: [] }, { steps: [{ ...output.steps[0], minutes: 20 }, { ...output.steps[1], minutes: 20 }] }, { steps: [output.steps[0], output.steps[0]] }]) {
        const service = createPomodoroGoalService({ getDb: () => db(), generateJson: async () => invalid });
        await assert.rejects(service.breakdown({ goal: 'Ôn JOIN', durationMinutes: 25 }), error => error.statusCode === 502);
    }
});

test('an unknown current term permits self-study but never treats historical subjects as current', async () => {
    const service = createPomodoroGoalService({ getDb: () => db([]), generateJson: async () => output });
    await assert.rejects(service.breakdown({ goal: 'Ôn SQL', subjectId: 1 }), error => error.statusCode === 409);
    assert.equal((await service.breakdown({ goal: 'Luyện đọc hiểu', durationMinutes: 15 })).subjectId, null);
});

test('EDUX lookups use the application owner even when the academic profile resolves to a different ID', async () => {
    const database = db();
    database.executeQuery = async (sql, params) => { assert.equal(params.sid, 9); return [{ title: 'Bài EDUX đúng hồ sơ', subject_name: 'SQL' }]; };
    const service = createPomodoroGoalService({ getDb: () => database, userId: 9, generateJson: async () => output });
    assert.equal((await service.breakdown({ goal: 'Ôn JOIN', taskId: 'edux-12', taskSource: 'EDUX' })).steps.length, 2);
});

test('aborted analysis is not cached and cannot replace a later result', async () => {
    let resolve, calls = 0;
    const controller = new AbortController();
    const service = createPomodoroGoalService({ getDb: () => db(), generateJson: async (prompt, options) => {
        calls++; if (calls === 1) { assert.equal(options.signal, controller.signal); return new Promise(done => { resolve = done; }); } return output;
    } });
    const pending = service.breakdown({ goal: 'Ôn JOIN', durationMinutes: 15 }, { signal: controller.signal });
    await new Promise(done => setImmediate(done)); controller.abort(); resolve(output);
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal((await service.breakdown({ goal: 'Ôn JOIN', durationMinutes: 15 })).steps.length, 2); assert.equal(calls, 2);
});
