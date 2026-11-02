'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const subjectDue = '2026-11-30T23:59:00+07:00';
const examDue = '2026-11-05T23:59:00+07:00';
const startTime = '2026-10-01T00:00:00+07:00';
const cookie = 'access_token=local-test-only';
const subject = { id: 'subject-1', name: 'Cơ sở dữ liệu', subject_code: 'SQL' };
const models = [
    { id: 'model-1', title: 'Bài 1', exist_exam: true },
    { id: 'model-2', title: 'Bài 2', exist_exam: true },
    { id: 'lecture-only', title: 'Bài giảng', exist_exam: false },
];
const emptyExam = () => ({ exam_deadline: null, status: 'no_deadline', source: null, is_available: true });
const error = status => Object.assign(new Error(`Upstream HTTP ${status}`), { status });

function stubEdux(t, overrides = {}) {
    const edux = require('../../CRWEB/modules/EDUX');
    const replacements = {
        layHocPhan: async () => [subject],
        layChuongTrinhHoc: async () => models,
        layHanHocPhan: async () => ({ start_time_subject: startTime, max_deadline: subjectDue }),
        layHanBaiTap: async () => emptyExam(),
        layBaiTap: async () => { throw new Error('Deadline sync must not create an exam session'); },
        ...overrides,
    };
    const original = Object.fromEntries(Object.keys(replacements).map(key => [key, edux[key]]));
    Object.assign(edux, replacements);
    t.after(() => Object.assign(edux, original));
    return require('../../API/utils/edux-client').keoBaiTapEDUX;
}

test('specific exam deadline takes precedence and subject limit is preserved separately', async t => {
    const seen = [];
    const signal = new AbortController().signal;
    const pull = stubEdux(t, {
        layHanHocPhan: async (id, modelIds, options) => {
            assert.equal(id, subject.id);
            assert.deepEqual(modelIds, models.map(model => model.id));
            assert.equal(options.cookie, cookie);
            assert.equal(options.timeoutMs, 1200);
            assert.equal(options.signal, signal);
            return { start_time_subject: startTime, max_deadline: subjectDue };
        },
        layHanBaiTap: async (id, options) => {
            seen.push(id);
            assert.equal(options.cookie, cookie);
            return id === 'model-1' ? { ...emptyExam(), exam_deadline: examDue, source: 'model' } : emptyExam();
        },
    });
    const result = await pull(cookie, { timeoutMs: 1200, signal });
    assert.deepEqual(result.assignments.map(item => item.modelId), ['model-1', 'model-2']);
    const [first, second] = result.assignments;
    assert.equal(first.due, examDue);
    assert.equal(first.dueSource, 'exam');
    assert.equal(first.subjectDeadline, subjectDue);
    assert.equal(first.subjectStartTime, startTime);
    assert.equal(second.due, subjectDue);
    assert.equal(second.dueSource, 'subject');
    assert.deepEqual(seen.sort(), ['model-1', 'model-2']);
    assert.deepEqual(result.thatBai, []);
});

test('missing exam route allows subject fallback, while confirmed no dates stays null', async t => {
    const pull = stubEdux(t, { layHanBaiTap: async () => { throw error(404); } });
    const result = await pull(cookie);
    assert.ok(result.assignments.every(item => item.due === subjectDue && item.dueSource === 'subject'));
    assert.deepEqual(result.thatBai, []);
    const edux = require('../../CRWEB/modules/EDUX');
    edux.layHanHocPhan = async () => ({ start_time_subject: null, max_deadline: null });
    edux.layHanBaiTap = async () => emptyExam();
    const noDates = await pull(cookie);
    assert.ok(noDates.assignments.every(item => item.due === null && item.dueSource === null));
});

test('transient exam lookup failure keeps tasks and omits due instead of clearing saved dates', async t => {
    const pull = stubEdux(t, { layHanBaiTap: async () => { throw error(503); } });
    const result = await pull(cookie);
    assert.equal(result.assignments.length, 2);
    assert.ok(result.assignments.every(item => !Object.hasOwn(item, 'due')));
    assert.ok(result.assignments.every(item => !Object.hasOwn(item, 'dueSource')));
    assert.ok(result.thatBai.length > 0);
});

test('subject lookup failure still keeps specific exam dates and leaves unavailable metadata untouched', async t => {
    const pull = stubEdux(t, {
        layHanHocPhan: async () => { throw error(503); },
        layHanBaiTap: async () => ({ ...emptyExam(), exam_deadline: examDue, source: 'model' }),
    });
    const result = await pull(cookie);
    assert.equal(result.assignments.length, 2);
    assert.ok(result.assignments.every(item => item.due === examDue && item.dueSource === 'exam'));
    assert.ok(result.assignments.every(item => !Object.hasOwn(item, 'subjectDeadline')));
    assert.ok(result.thatBai.length > 0);
});

test('invalid exam deadline is reported and never replaces a previously saved deadline', async t => {
    const pull = stubEdux(t, { layHanBaiTap: async () => ({ ...emptyExam(), exam_deadline: 'not-a-date' }) });
    const result = await pull(cookie);
    assert.equal(result.assignments.length, 2);
    assert.ok(result.assignments.every(item => !Object.hasOwn(item, 'due')));
    assert.ok(result.thatBai.length > 0);
});

test('401 and 403 from either deadline endpoint fail the pull as expired sessions', async t => {
    const pull = stubEdux(t);
    const edux = require('../../CRWEB/modules/EDUX');
    for (const status of [401, 403]) {
        edux.layHanHocPhan = async () => { throw error(status); };
        await assert.rejects(pull(cookie), { status });
        edux.layHanHocPhan = async () => ({ start_time_subject: null, max_deadline: null });
        edux.layHanBaiTap = async () => { throw error(status); };
        await assert.rejects(pull(cookie), { status });
        edux.layHanBaiTap = async () => emptyExam();
    }
});

test('real deadline adapter reads groups then posts model/group ids without starting exam sessions', async t => {
    const requests = [];
    let mode = 'valid';
    const server = http.createServer(async (request, response) => {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        requests.push({ method: request.method, path: request.url, cookie: request.headers.cookie, body: raw ? JSON.parse(raw) : null });
        response.setHeader('Content-Type', 'application/json');
        if (mode === 'auth') { response.statusCode = 401; response.end(JSON.stringify({ detail: 'expired' })); return; }
        if (mode === 'business-auth') { response.end(JSON.stringify({ code: 403, message: 'expired' })); return; }
        if (mode === 'invalid') { response.end(JSON.stringify({ data: { unexpected: true } })); return; }
        if (request.url === '/api/groups?subject_id=subject-1') {
            response.end(JSON.stringify({ data: { groups: mode === 'no-groups' ? [] : [{ id: 'group-1' }, { id: 'group-2' }] } }));
        } else if (request.url === '/api/groups/get_subject_deadlines') {
            response.end(JSON.stringify({ data: { start_time_subject: startTime, max_deadline: subjectDue } }));
        } else if (request.url === '/api/exam/deadline/check/model-1') {
            response.end(JSON.stringify({ data: mode === 'no-deadline' ? { status: 'no_deadline', is_available: true } : { exam_deadline: examDue, status: 'available', source: 'model', is_available: true } }));
        } else { response.statusCode = 404; response.end('{}'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    // Reload only the low-level adapter so no request can reach the real portal.
    const loginPath = require.resolve('../../CRWEB/modules/EDUX/login');
    const requestPath = require.resolve('../../CRWEB/modules/EDUX/request');
    const dataPath = require.resolve('../../CRWEB/modules/EDUX/data');
    const oldModules = [loginPath, requestPath, dataPath].map(key => [key, require.cache[key]]);
    const originalEnv = { origin: process.env.EDUX_ORIGIN, base: process.env.EDUX_API_BASE };
    process.env.EDUX_ORIGIN = origin;
    process.env.EDUX_API_BASE = origin + '/api';
    for (const [key] of oldModules) delete require.cache[key];
    t.after(() => {
        for (const [key, value] of oldModules) { if (value) require.cache[key] = value; else delete require.cache[key]; }
        if (originalEnv.origin === undefined) delete process.env.EDUX_ORIGIN; else process.env.EDUX_ORIGIN = originalEnv.origin;
        if (originalEnv.base === undefined) delete process.env.EDUX_API_BASE; else process.env.EDUX_API_BASE = originalEnv.base;
    });
    const data = require('../../CRWEB/modules/EDUX/data');
    const options = { cookie };
    const deadlines = await data.layHanHocPhan(subject.id, ['model-1', 'model-2'], options);
    assert.equal(deadlines.max_deadline, subjectDue);
    assert.deepEqual(requests[0], { method: 'GET', path: '/api/groups?subject_id=subject-1', cookie, body: null });
    assert.deepEqual(requests[1], { method: 'POST', path: '/api/groups/get_subject_deadlines', cookie, body: { model_ids: ['model-1', 'model-2'], group_ids: ['group-1', 'group-2'] } });
    assert.equal((await data.layHanBaiTap('model-1', options)).exam_deadline, examDue);
    assert.equal(requests[2].method, 'GET');
    assert.equal(requests[2].body, null);
    assert.ok(!requests.some(request => request.path.includes('/exam/start')));
    mode = 'no-deadline';
    assert.equal((await data.layHanBaiTap('model-1', options)).exam_deadline, null, 'the official no_deadline status is an explicit empty date');
    mode = 'no-groups';
    const before = requests.length;
    assert.deepEqual(await data.layHanHocPhan(subject.id, ['model-1'], options), { start_time_subject: null, max_deadline: null });
    assert.equal(requests.length - before, 1, 'no group means no deadline POST request');
    mode = 'invalid';
    await assert.rejects(data.layHanHocPhan(subject.id, ['model-1'], options));
    await assert.rejects(data.layHanBaiTap('model-1', options));
    const pull = stubEdux(t, { layHanHocPhan: data.layHanHocPhan, layHanBaiTap: data.layHanBaiTap });
    const partial = await pull(cookie);
    assert.equal(partial.assignments.length, 2);
    assert.ok(partial.assignments.every(item => !Object.hasOwn(item, 'due')));
    assert.ok(partial.thatBai.length >= 3, 'malformed subject and exam replies become explicit partial-sync warnings');
    mode = 'auth';
    await assert.rejects(data.layHanBaiTap('model-1', options), { status: 401 });
    mode = 'business-auth';
    await assert.rejects(data.layHanBaiTap('model-1', options), { status: 403 });
});
