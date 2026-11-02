'use strict';

// Actual frontend Axios -> HTTP job API -> isolated SQLite. Only school portal
// transports and Microsoft windows are replaced; no live account is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('one frontend action connects all sources, follows real API jobs and persists all three datasets', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unified-sync-http-'));
    Object.assign(process.env, {
        DB_PATH: path.join(directory, 'sync.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
        API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test', VITE_USE_MOCK: 'false', GEMINI_ENABLE_WEB_FALLBACK: 'false'
    });
    const iu = require('../API/utils/iu-client');
    const edux = require('../API/utils/edux-client');
    const eduxProvider = require('../CRWEB/modules/EDUX');
    const outlook = require('../CRWEB/modules/OUTLOOK');
    const learning = require('../API/services/learning-runtime.service');
    const originals = {
        iu: iu.keoDuLieuIU, edux: edux.keoBaiTapEDUX, loginEdux: eduxProvider.loginEdux,
        outlookList: outlook.listMessages, outlookStatus: outlook.status, background: learning.backgroundSync,
        window: globalThis.window
    };
    let db, server, vite, origin, failIu = false, outlookConnected = false, iuLogins = 0, eduxLogins = 0;
    let releaseFirstPull, firstPull = true;
    const firstPullGate = new Promise(resolve => { releaseFirstPull = resolve; });
    const events = [];
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    iu.keoDuLieuIU = async () => {
        events.push('IU');
        if (firstPull) { firstPull = false; await firstPullGate; }
        if (failIu) throw Object.assign(new Error('expired transport'), { statusCode: 401 });
        return { data: { IU: {
            ho_so_sinh_vien: { thong_tin_ca_nhan: { ma_sinh_vien: 'UNIFIED', ho_ten: 'Sinh viên tích hợp', nganh: 'CNTT' } },
            goc_hoc_tap: { tra_cuu_diem: { bang_diem: [{ hoc_ky: '1', nam_hoc: '2026-2027', ma_mon: 'SQL', ten_hoc_phan: 'Cơ sở dữ liệu', so_tin_chi: 3, diem_he_10: 8, diem_chu: 'B' }] } },
            lich_hoc: { fetched: true, chi_tiet_thoi_khoa_bieu: [{ ma_mon: 'SQL', ten_mon: 'Cơ sở dữ liệu', ngay: today, thoi_gian_bat_dau: '08:00', thoi_gian_ket_thuc: '09:30', hoc_ky: '1', nam_hoc: '2026-2027' }] },
            lich_thi: { fetched: true, chi_tiet_lich_thi: [] }
        } }, thatBai: [] };
    };
    eduxProvider.loginEdux = async ({ email, password, luu }) => {
        assert.equal(email, 'test@example.invalid'); assert.equal(password, 'one-use-only'); assert.equal(luu, false);
        eduxLogins++;
        return { email, cookie: 'fake-edux-cookie' };
    };
    edux.keoBaiTapEDUX = async (_cookie, options) => {
        events.push('EDUX');
        assert.ok(options.courseScope.courses.some(course => course.subjectCode === 'SQL'));
        assert.equal((await db.executeQuery("SELECT student_code FROM Students"))[0].student_code, 'UNIFIED');
        return { assignments: [{ id: 'edux-sync-task', title: 'Bài tập SQL', subject: 'Cơ sở dữ liệu', subjectId: 'sql', subjectCode: 'SQL', status: 'Chưa làm', source: 'EDUX' }], subjectIds: ['sql'], subjects: 1, thatBai: [] };
    };
    outlook.status = () => ({ connected: outlookConnected });
    outlook.listMessages = async () => {
        events.push('OUTLOOK');
        return { account: 'mailbox@example.invalid', source: 'outlook-web', messages: [{ id: 'unified-mail', subject: 'Thông báo học phần SQL', body: 'Đã có tài liệu học tập mới.', date: today + 'T08:00:00+07:00' }] };
    };
    learning.backgroundSync = async () => ({ skipped: true });
    t.after(async () => {
        releaseFirstPull();
        iu.keoDuLieuIU = originals.iu; edux.keoBaiTapEDUX = originals.edux; eduxProvider.loginEdux = originals.loginEdux;
        outlook.listMessages = originals.outlookList; outlook.status = originals.outlookStatus; learning.backgroundSync = originals.background;
        require('../API/utils/iu-session').clearSession(1); require('../API/utils/edux-session').clearSession(1);
        if (vite) await vite.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        if (originals.window === undefined) delete globalThis.window; else globalThis.window = originals.window;
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('unified-sync-http-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    db = await require('../database')();
    server = await require('../API').start();
    origin = `http://127.0.0.1:${server.address().port}`;
    async function request(endpoint, body) {
        const response = await fetch(origin + '/api/v1' + endpoint, body ? {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        } : {});
        const payload = await response.json();
        assert.ok(response.ok, payload.message);
        return payload.data || payload;
    }
    let authCalls = 0;
    globalThis.window = { location: { origin }, __uniStudySync: { connectAll: async options => {
        authCalls++;
        if (!(await request('/sync/iu/status')).connected) {
            iuLogins++;
            await request('/sync/iu/session', { session: { studentId: 'UNIFIED' }, cookie: 'fake-iu-cookie' });
        }
        if (!(await request('/sync/edux/status')).connected) await request('/sync/edux/session', options.edux);
        outlookConnected = true;
        return { ok: true, results: { iu: { ok: true }, edux: { ok: true }, outlook: { ok: true } } };
    } } };
    const frontend = path.resolve(__dirname, '../Frontend');
    const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [frontend] })).href);
    vite = await createServer({ root: frontend, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom',
        cacheDir: path.join(directory, 'vite-cache'), optimizeDeps: { noDiscovery: true, include: [] },
        define: { 'import.meta.env.VITE_API_URL': JSON.stringify(origin + '/api/v1'), 'import.meta.env.VITE_USE_MOCK': '"false"' } });
    const { syncApi } = await vite.ssrLoadModule('/src/api/index.js');
    const progress = [];
    const complete = await syncApi.all({ edux: { email: 'test@example.invalid', password: 'one-use-only' }, pollIntervalMs: 5, timeoutMs: 5000,
        onProgress: job => { progress.push(job); if (job.status === 'RUNNING' && job.activeSource === 'IU') releaseFirstPull(); } });
    assert.equal(complete.status, 'COMPLETED'); assert.equal(complete.ok, true);
    assert.deepEqual(events, ['IU', 'EDUX', 'OUTLOOK']);
    assert.equal(authCalls, 1); assert.equal(iuLogins, 1); assert.equal(eduxLogins, 1);
    assert.ok(progress.some(job => job.status === 'RUNNING' && job.results.iu.status === 'RUNNING'));
    assert.deepEqual(complete.progress, { completed: 3, total: 3, percent: 100 });
    for (const table of ['Students', 'Grades', 'Timetables', 'EduxAssignments', 'SchoolEmails']) {
        assert.equal((await db.executeQuery(`SELECT COUNT(*) AS count FROM ${table}`))[0].count, 1, table);
    }
    const registry = await request('/sync/sources');
    assert.deepEqual(registry.sources.map(source => source.id), ['IU', 'EDUX', 'OUTLOOK']);
    assert.ok(registry.sources.every(source => source.lastSync && source.connected));
    assert.equal((await request('/sync/status')).jobId, complete.jobId);
    assert.equal(JSON.stringify(complete).includes('one-use-only'), false);
    assert.equal(JSON.stringify(complete).includes('fake-iu-cookie'), false);

    failIu = true; events.length = 0;
    const expired = await syncApi.all({ pollIntervalMs: 5 });
    assert.equal(expired.status, 'PARTIAL'); assert.equal(expired.results.iu.requiresLogin, true);
    assert.equal(expired.results.edux.ok, true); assert.equal(expired.results.outlook.ok, true);
    assert.equal((await request('/sync/iu/status')).connected, false);
    assert.equal((await db.executeQuery('SELECT full_name FROM Students'))[0].full_name, 'Sinh viên tích hợp');
    failIu = false; events.length = 0;
    const reconnected = await syncApi.all({ pollIntervalMs: 5 });
    assert.equal(reconnected.ok, true); assert.equal(iuLogins, 2); assert.equal(eduxLogins, 1);
    assert.deepEqual(events, ['IU', 'EDUX', 'OUTLOOK']);
});
