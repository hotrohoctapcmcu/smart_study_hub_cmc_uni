'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('one unified request saves IU before EDUX, deduplicates pulls and isolates failures', async t => {
    const iuClient = require('../../API/utils/iu-client');
    const eduxClient = require('../../API/utils/edux-client');
    const workspace = require('../../API/services/workspace.service');
    const learning = require('../../API/services/learning-runtime.service');
    const iuSessions = require('../../API/utils/iu-session');
    const eduxSessions = require('../../API/utils/edux-session');
    const originals = {
        iuPull: iuClient.keoDuLieuIU, iuMap: iuClient.mapSangDataIU,
        eduxPull: eduxClient.keoBaiTapEDUX, workspace: workspace.createWorkspaceService,
        background: learning.backgroundSync
    };
    const events = [];
    let failIu = false, failEdux = false, partialIu = false, saved = false;
    iuClient.keoDuLieuIU = async () => {
        events.push('iu:pull');
        await new Promise(resolve => setTimeout(resolve, 15));
        if (failIu) throw Object.assign(new Error('IU unavailable'), { statusCode: 502 });
        return { data: { MSV: 'SYNC-ALL', tkb: [{ ma_mon: 'SQL' }] }, thatBai: partialIu ? ['LichThi: unavailable'] : [] };
    };
    iuClient.mapSangDataIU = value => value;
    eduxClient.keoBaiTapEDUX = async (_cookie, options) => {
        assert.equal(saved, true, 'IU data must be committed before EDUX resolves course scope');
        assert.equal(options.courseScope.courses.length, 1);
        events.push('edux:pull');
        if (failEdux) throw Object.assign(new Error('EDUX unavailable'), { statusCode: 502 });
        return { assignments: [], subjectIds: ['sql'], subjects: 1, thatBai: [] };
    };
    workspace.createWorkspaceService = () => ({ syncEmails: async () => { events.push('outlook:pull'); } });
    learning.backgroundSync = async () => ({ skipped: true });
    const router = require('../../API/routes/dongbo');
    router.setDb({
        dongBoHoSoIU: async () => { saved = true; events.push('iu:save'); return { timetableCount: 1 }; },
        layThoiKhoaBieu: async () => saved ? [{ subject_id: 1, subject_code: 'SQL', subject_name: 'SQL', start_date: '2020-01-01', end_date: '2099-12-31', source: 'IU' }] : [],
        luuBaiTapEDUX: async () => { events.push('edux:save'); return { saved: 0, removed: 0 }; }
    });
    iuSessions.saveSession(1, { session: { studentId: 'SYNC-ALL' }, cookie: 'test-only' });
    eduxSessions.saveSession(1, { cookie: 'test-only' });
    const app = express();
    app.use(express.json());
    app.use('/sync', router);
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    t.after(async () => {
        iuClient.keoDuLieuIU = originals.iuPull; iuClient.mapSangDataIU = originals.iuMap;
        eduxClient.keoBaiTapEDUX = originals.eduxPull; workspace.createWorkspaceService = originals.workspace;
        learning.backgroundSync = originals.background;
        iuSessions.clearSession(1); eduxSessions.clearSession(1);
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    });
    async function request(body = {}) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/sync/all`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        return { httpStatus: response.status, ...await response.json() };
    }
    const simultaneous = await Promise.all([request(), request()]);
    assert.ok(simultaneous.every(result => result.ok));
    assert.deepEqual(events, ['iu:pull', 'iu:save', 'edux:pull', 'edux:save', 'outlook:pull']);
    assert.deepEqual(Object.keys(simultaneous[0].results), ['iu', 'edux', 'outlook']);
    events.length = 0;
    partialIu = true;
    const incomplete = await request();
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.results.iu.partial, true);
    assert.equal(incomplete.results.iu.synced, true);
    assert.equal(incomplete.results.iu.warningCount, 1);
    assert.equal(incomplete.results.edux.ok, true);
    assert.equal(incomplete.results.outlook.ok, true);
    assert.deepEqual(events, ['iu:pull', 'iu:save', 'edux:pull', 'edux:save', 'outlook:pull']);
    events.length = 0;
    partialIu = false;
    failIu = true; failEdux = true;
    const partial = await request();
    assert.equal(partial.httpStatus, 200);
    assert.equal(partial.ok, false);
    assert.equal(partial.results.iu.statusCode, 502);
    assert.equal(partial.results.edux.statusCode, 502);
    assert.equal(partial.results.outlook.ok, true);
    assert.deepEqual(events, ['iu:pull', 'edux:pull', 'outlook:pull']);
    events.length = 0;
    const subset = await request({ sources: ['OUTLOOK', 'OUTLOOK'] });
    assert.equal(subset.ok, true);
    assert.deepEqual(Object.keys(subset.results), ['outlook']);
    assert.deepEqual(events, ['outlook:pull']);
    events.length = 0;
    for (const sources of [[], ['UNKNOWN'], 'IU', null]) assert.equal((await request({ sources })).httpStatus, 400);
    assert.deepEqual(events, [], 'invalid selections must not start any source');
});
