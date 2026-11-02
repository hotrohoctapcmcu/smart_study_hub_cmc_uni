'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('schedule refresh runs on every entry and after 24 hours, deduplicates and preserves data on failure', async t => {
    const client = require('../../API/utils/iu-client');
    const sessions = require('../../API/utils/iu-session');
    const eduxClient = require('../../API/utils/edux-client');
    const eduxSessions = require('../../API/utils/edux-session');
    const originalPull = client.keoDuLieuIU, originalMap = client.mapSangDataIU, originalClock = Date.now;
    const originalEdux = eduxClient.keoBaiTapEDUX;
    let eduxPulls = 0, taskSaves = 0;
    eduxClient.keoBaiTapEDUX = async (_cookie, options) => {
        eduxPulls++; assert.equal(options.questions, false); assert.equal(options.courseScope.courses.length, 1);
        return { assignments: [{ id: 'current-task', subject: 'SQL' }], subjects: 1, subjectIds: ['sql'], thatBai: [] };
    };
    let epoch = originalClock(), pulls = 0, saves = 0, rejected = false, empty = false;
    Date.now = () => epoch;
    client.mapSangDataIU = value => value;
    client.keoDuLieuIU = async () => {
        pulls++;
        await new Promise(resolve => setTimeout(resolve, 20));
        if (rejected) throw Object.assign(new Error('IU unavailable'), { statusCode: 502 });
        return { data: { MSV: 'REFRESH', tkb: empty ? [] : [{ ma_mon: 'SQL', ten_mon: 'SQL' }] }, thatBai: [] };
    };
    let rows = [{ subject_id: 1, subject_code: 'SQL', subject_name: 'SQL', start_date: '2026-09-01', end_date: '2026-12-31', semester: '1', academic_year: '2026-2027', source: 'IU' }];
    const router = require('../../API/routes/dongbo');
    router.setDb({
        layThoiKhoaBieu: async () => rows,
        executeQuery: async () => [{ student_code: 'REFRESH' }],
        luuBaiTapEDUX: async (_uid, _items, options) => { taskSaves++; assert.equal(options.preserveExisting, true); return { saved: 1, removed: 0 }; },
        dongBoHoSoIU: async (_code, data) => { saves++; if (!data.tkb.length) rows = []; return { timetableCount: data.tkb.length }; }
    });
    const app = express(); app.use(express.json()); app.use(router);
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const request = async body => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { status: response.status, ...(await response.json()) };
    };
    t.after(async () => {
        Date.now = originalClock; client.keoDuLieuIU = originalPull; client.mapSangDataIU = originalMap; sessions.clearSession(1);
        eduxClient.keoBaiTapEDUX = originalEdux; eduxSessions.clearSession(1);
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    });
    assert.equal((await request({ startup: true })).reason, 'session_required');
    assert.equal(pulls, 0); assert.equal(rows.length, 1);
    sessions.saveSession(1, { session: { studentId: 'REFRESH' }, cookie: 'test-only', ttlMs: 7 * 86400000 });
    const simultaneous = await Promise.all([request({ startup: true }), request({ startup: true })]);
    assert.ok(simultaneous.every(result => result.refreshed));
    assert.equal(pulls, 1); assert.equal(saves, 1);
    assert.equal((await request({})).reason, 'up_to_date'); assert.equal(pulls, 1);
    await request({ startup: true }); assert.equal(pulls, 2, 'new app entry forces refresh');
    epoch += 86400001;
    assert.equal((await request({})).reason, 'session_required');
    sessions.saveSession(1, { session: { studentId: 'REFRESH' }, cookie: 'restored-test-only' });
    assert.equal((await request({})).refreshed, true); assert.equal(pulls, 3);
    epoch += 86400001; rejected = true;
    sessions.saveSession(1, { session: { studentId: 'REFRESH' }, cookie: 'restored-test-only' });
    assert.equal((await request({})).status, 502); assert.equal(saves, 3); assert.equal(rows.length, 1);
    rejected = false; empty = true;
    assert.equal((await request({})).refreshed, true); assert.equal(rows.length, 0);
    empty = false;
    rows = [{ subject_id: 1, subject_code: 'SQL', subject_name: 'SQL', start_date: '2020-01-01', end_date: '2099-12-31', source: 'IU' }];
    eduxSessions.saveSession(1, { cookie: 'test-edux-only' });
    const refreshed = await request({ startup: true });
    assert.equal(refreshed.refreshed, true); assert.equal(refreshed.eduxRefresh.saved, 1);
    assert.equal(eduxPulls, 1); assert.equal(taskSaves, 1);
});
