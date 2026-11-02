'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('unified jobs expose actual queued, running and terminal state for all three portals', async t => {
    const iuClient = require('../../API/utils/iu-client');
    const eduxClient = require('../../API/utils/edux-client');
    const workspace = require('../../API/services/workspace.service');
    const learning = require('../../API/services/learning-runtime.service');
    const iuSessions = require('../../API/utils/iu-session');
    const eduxSessions = require('../../API/utils/edux-session');
    const outlook = require('../../CRWEB/modules/OUTLOOK');
    const originals = {
        iu: iuClient.keoDuLieuIU, map: iuClient.mapSangDataIU, edux: eduxClient.keoBaiTapEDUX,
        workspace: workspace.createWorkspaceService, background: learning.backgroundSync, status: outlook.status
    };
    let gate = null, failIu = false, partialIu = false, failEdux = false, failOutlook = false, saved = false;
    const events = [];
    iuClient.keoDuLieuIU = async () => {
        events.push('IU');
        if (gate) await gate;
        if (failIu) throw Object.assign(new Error('SECRET cookie'), { statusCode: 401 });
        return { data: { MSV: 'JOB-TEST', tkb: [{ ma_mon: 'SQL' }] }, thatBai: partialIu ? ['SECRET warning'] : [] };
    };
    iuClient.mapSangDataIU = value => value;
    eduxClient.keoBaiTapEDUX = async () => {
        events.push('EDUX');
        if (failEdux) throw Object.assign(new Error('SECRET password'), { statusCode: 502 });
        assert.ok(saved, 'EDUX reads the course scope after IU has saved it');
        return { assignments: [], subjectIds: ['sql'], subjects: 1, thatBai: [] };
    };
    workspace.createWorkspaceService = () => ({ syncEmails: async () => {
        events.push('OUTLOOK');
        if (failOutlook) throw Object.assign(new Error('SECRET token'), { statusCode: 401 });
        return { syncedCount: 4, account: 'private@example.test', messages: [{ body: 'SECRET mail' }] };
    } });
    learning.backgroundSync = async () => ({ skipped: true });
    outlook.status = () => ({ connected: true });
    const router = require('../../API/routes/dongbo');
    router.setDb({
        dongBoHoSoIU: async () => { saved = true; return { timetableCount: 2, examsCount: 1, gradesCount: 3 }; },
        layThoiKhoaBieu: async () => saved ? [{ subject_id: 1, subject_code: 'SQL', subject_name: 'SQL', start_date: '2020-01-01', end_date: '2099-12-31', source: 'IU' }] : [],
        luuBaiTapEDUX: async () => ({ saved: 2, removed: 0 })
    });
    const app = express();
    app.use(express.json()); app.use('/sync', router);
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${server.address().port}/sync`;
    t.after(async () => {
        iuClient.keoDuLieuIU = originals.iu; iuClient.mapSangDataIU = originals.map; eduxClient.keoBaiTapEDUX = originals.edux;
        workspace.createWorkspaceService = originals.workspace; learning.backgroundSync = originals.background; outlook.status = originals.status;
        iuSessions.clearSession(1); eduxSessions.clearSession(1);
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    });
    const request = async (method, suffix = '', body) => {
        const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json' },
            ...(body !== undefined && { body: JSON.stringify(body) }) });
        return { httpStatus: response.status, ...await response.json() };
    };
    const authenticate = () => {
        iuSessions.saveSession(1, { session: { studentId: 'JOB-TEST' }, cookie: 'SECRET' });
        eduxSessions.saveSession(1, { cookie: 'SECRET' });
    };
    async function terminal(jobId) {
        for (let attempt = 0; attempt < 100; attempt++) {
            const result = await request('GET', '/status?jobId=' + encodeURIComponent(jobId));
            if (['COMPLETED', 'PARTIAL', 'FAILED'].includes(result.status)) return result;
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        assert.fail('Job did not terminate');
    }

    const idle = await request('GET', '/status');
    assert.equal(idle.status, 'IDLE');
    assert.equal(idle.jobId, null);
    assert.deepEqual(idle.sources, ['IU', 'EDUX', 'OUTLOOK']);
    const initial = await request('GET', '/sources');
    assert.deepEqual(initial.sources.map(source => source.id), ['IU', 'EDUX', 'OUTLOOK']);
    assert.equal(initial.sources.find(source => source.id === 'IU').connected, false);
    assert.equal(initial.sources.find(source => source.id === 'OUTLOOK').connected, true);
    for (const body of [{ sources: [] }, { sources: null }, { sources: ['BAD'] }, { sources: 'IU' }, []]) {
        assert.equal((await request('POST', '', body)).httpStatus, 400);
    }
    assert.equal((await request('GET', '/status')).status, 'IDLE', 'invalid inputs do not create jobs');

    authenticate();
    let release;
    gate = new Promise(resolve => { release = resolve; });
    const started = await request('POST', '', {});
    assert.equal(started.httpStatus, 202);
    assert.equal(started.status, 'PENDING');
    assert.deepEqual(started.sources, ['IU', 'EDUX', 'OUTLOOK']);
    const running = await request('GET', '/status?jobId=' + started.jobId);
    assert.equal(running.status, 'RUNNING');
    assert.equal(running.activeSource, 'IU');
    assert.equal(running.results.iu.status, 'RUNNING');
    assert.equal(running.results.edux.status, 'PENDING');
    assert.equal(running.progress.completed, 0);
    const concurrent = await request('POST', '', { sources: ['OUTLOOK', 'IU', 'EDUX', 'IU'] });
    assert.equal(concurrent.jobId, started.jobId, 'same source set reuses its in-flight job');
    const blocking = request('POST', '/all', {});
    const sourceState = await request('GET', '/sources');
    assert.equal(sourceState.sources.find(source => source.id === 'IU').syncing, true);
    assert.equal(sourceState.sources.find(source => source.id === 'IU').lastSync, null);
    release(); gate = null;
    const finished = await terminal(started.jobId);
    assert.equal((await blocking).jobId, started.jobId, 'synchronous compatibility joins the asynchronous job');
    assert.equal(finished.status, 'COMPLETED');
    assert.equal(finished.ok, true);
    assert.deepEqual(events, ['IU', 'EDUX', 'OUTLOOK']);
    assert.deepEqual(finished.completedSources, ['IU', 'EDUX', 'OUTLOOK']);
    assert.deepEqual(finished.pendingSources, []);
    assert.deepEqual(finished.failedSources, []);
    assert.deepEqual(finished.progress, { completed: 3, total: 3, percent: 100 });
    assert.equal(finished.activeSource, null);
    assert.ok(finished.startedAt && finished.finishedAt);
    assert.deepEqual(finished.results.iu.counts, { timetableCount: 2, examsCount: 1, gradesCount: 3 });
    assert.deepEqual(finished.results.outlook.counts, { syncedCount: 4 });
    assert.equal(JSON.stringify(finished).includes('SECRET'), false);
    assert.equal(JSON.stringify(finished).includes('private@example.test'), false);
    const after = await request('GET', '/sources');
    assert.ok(after.sources.every(source => source.lastSync && !source.syncing && source.lastStatus === 'COMPLETED'));
    const priorSync = after.sources.find(source => source.id === 'IU').lastSync;

    failIu = true;
    const partiallyFailed = await request('POST', '/all', {});
    assert.equal(partiallyFailed.status, 'PARTIAL');
    assert.equal(partiallyFailed.results.iu.status, 'FAILED');
    assert.equal(partiallyFailed.results.iu.requiresLogin, true);
    assert.equal(partiallyFailed.results.iu.statusCode, 401);
    assert.equal(partiallyFailed.results.edux.status, 'COMPLETED');
    assert.equal((await request('GET', '/iu/status')).connected, false, 'expired remote IU session is cleared');
    assert.equal((await request('GET', '/iu/status')).lastSync, priorSync, 'a failed sync does not replace the previous lastSync');
    assert.equal(JSON.stringify(partiallyFailed).includes('SECRET'), false);

    authenticate(); failIu = false; partialIu = true;
    const incomplete = await request('POST', '/all', {});
    assert.equal(incomplete.status, 'PARTIAL');
    assert.equal(incomplete.results.iu.status, 'PARTIAL');
    assert.equal(incomplete.results.iu.warningCount, 1);
    assert.equal(incomplete.results.iu.synced, true);
    assert.equal(JSON.stringify(incomplete).includes('SECRET warning'), false);
    failIu = true; failEdux = true; failOutlook = true;
    const allFailed = await request('POST', '/all', {});
    assert.equal(allFailed.status, 'FAILED');
    assert.equal(allFailed.ok, false);
    assert.deepEqual(allFailed.failedSources, ['IU', 'EDUX', 'OUTLOOK']);
    assert.equal(allFailed.progress.percent, 100);
    assert.equal((await request('GET', '/status')).jobId, allFailed.jobId);
    assert.equal((await request('GET', '/status?jobId=does-not-exist')).httpStatus, 404);
    assert.equal((await request('GET', '/status?jobId=')).httpStatus, 400);

    // Startup refresh and a user-triggered all-source job can overlap. An IU
    // refresh that already cascaded to EDUX must not fetch EDUX a second time.
    authenticate(); failIu = false; failEdux = false; failOutlook = false; partialIu = false;
    events.length = 0;
    gate = new Promise(resolve => { release = resolve; });
    const startupPull = require('../../API/services/dongbo.service').pullAndSaveIU();
    const joined = await request('POST', '', {});
    release(); gate = null;
    await startupPull;
    assert.equal((await terminal(joined.jobId)).status, 'COMPLETED');
    assert.deepEqual(events, ['IU', 'EDUX', 'OUTLOOK']);
});
