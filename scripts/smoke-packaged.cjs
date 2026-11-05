'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const executable = path.resolve(process.argv[2] || path.join(root, 'release/win-unpacked/SmartStudyHub.exe'));
const label = path.basename(executable).includes('Portable') ? 'portable' : executable.includes('win-unpacked') ? 'unpacked' : 'installed';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-study-release-smoke-'));
const profile = path.join(directory, 'profile');
const output = path.join(root, 'tests/artifacts/release', label);
fs.mkdirSync(output, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { date: '2026-11-05', executable, label, isolatedProfile: true, checks: [], launches: [] };
function check(name, passed, detail) {
    report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
    assert.ok(passed, name);
}
async function freePort() {
    return new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
}
async function cdp(url) {
    const socket = new WebSocket(url), pending = new Map(); let counter = 0;
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (!message.id || !pending.has(message.id)) return;
        const request = pending.get(message.id); pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
    });
    socket.addEventListener('close', () => {
        for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP connection closed')); }
        pending.clear();
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++counter;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    return { send, close: () => socket.close(), evaluate: async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    } };
}
async function launch() {
    const port = await freePort();
    const env = { ...process.env, SMART_STUDY_USER_DATA: profile, SMART_STUDY_TEST_WINDOW: 'hidden',
        PATH: [process.env.SystemRoot, path.join(process.env.SystemRoot, 'System32'), path.join(process.env.SystemRoot, 'System32/Wbem')].join(path.delimiter) };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', '--disable-gpu'], {
        cwd: os.tmpdir(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { log += bytes; });
    let target;
    for (let i = 0; i < 240; i++) {
        if (child.exitCode !== null) throw new Error('Packaged app exited: ' + log);
        try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(page => page.type === 'page' && page.url.startsWith('studyhub://app/')); } catch {}
        if (target) break;
        await pause(250);
    }
    if (!target) { child.kill(); throw new Error('Packaged UI did not start: ' + log); }
    const client = await cdp(target.webSocketDebuggerUrl);
    for (let i = 0; i < 150; i++) {
        if (await client.evaluate(`Boolean(document.querySelector('.brand-app-icon img')?.naturalWidth)`)) break;
        if (i === 149) throw new Error('Packaged logo/UI did not load: ' + log);
        await pause(100);
    }
    const api = await client.evaluate('globalThis.__SSH_RUNTIME__?.apiBaseUrl');
    assert.match(api, /^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/);
    report.launches.push({ origin: await client.evaluate('location.origin'), api });
    return { child, client, api, log: () => log };
}
async function close(instance) {
    try { await instance.client.send('Browser.close'); } catch {}
    instance.client.close();
    for (let i = 0; i < 100 && instance.child.exitCode === null; i++) await pause(100);
    if (instance.child.exitCode === null) { instance.child.kill(); await pause(300); }
}
async function api(instance, route, options) {
    const response = await fetch(instance.api + route, options);
    const body = await response.json();
    assert.ok(response.ok && body.success, `${route}: ${response.status} ${JSON.stringify(body)}`);
    return body.data;
}

(async () => {
    let current;
    try {
        check('Release executable exists', fs.existsSync(executable));
        report.externalNodeOnChildPath = false;
        current = await launch();
        check('Packaged UI uses a stable custom origin', await current.client.evaluate(`location.origin === 'studyhub://app'`));
        check('Bundled backend is online', (await (await fetch(current.api.replace('/api/v1', '/health'))).json()).status === 'online');
        check('Renderer reaches the bundled API through its runtime address', await current.client.evaluate(`fetch(globalThis.__SSH_RUNTIME__.apiBaseUrl.replace('/api/v1','/health')).then(r=>r.json()).then(r=>r.status==='online')`));
        await current.client.evaluate(`localStorage.setItem('release-persistence-check','kept-across-restart')`);
        const screenshot = await current.client.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(output, 'first-launch.png'), Buffer.from(screenshot.data, 'base64'));
        await close(current); current = null;

        const dbPath = path.join(profile, 'data/unistudy.db');
        check('SQLite database is created under the private user profile', fs.existsSync(dbPath));
        const initSql = require('sql.js');
        const SQL = await initSql({ wasmBinary: fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')) });
        const db = new SQL.Database(fs.readFileSync(dbPath));
        check('Fresh distribution contains no student records', db.exec('SELECT COUNT(*) FROM Students')[0].values[0][0] === 0);
        db.run("INSERT INTO Students(student_id,student_code,full_name,major,enrollment_year) VALUES(1,'RELEASE-FIXTURE','Release smoke fixture','IT',2026)");
        fs.writeFileSync(dbPath, Buffer.from(db.export())); db.close();

        current = await launch();
        check('Local canvas/preferences storage survives restart', await current.client.evaluate(`localStorage.getItem('release-persistence-check') === 'kept-across-restart'`));
        check('Persisted profile loads through the packaged API', (await api(current, '/student/profile')).full_name === 'Release smoke fixture');
        const notebook = await api(current, '/notebooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Release notebook' }) });
        await api(current, '/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'release-note', notebookId: notebook.notebook_id, title: 'Release note', content: 'Packaged persistence evidence' }) });
        const document = await api(current, '/documents', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Document-Meta': encodeURIComponent(JSON.stringify({ filename: 'release.txt', title: 'Release document' })) }, body: Buffer.from('Release file bytes') });
        check('Upload/download uses the writable document directory', await (await fetch(current.api + `/documents/${document.id}/file`)).text() === 'Release file bytes');
        await close(current); current = null;

        if (label === 'installed' && process.env.SMART_STUDY_TEST_INSTALLER) {
            const before = fs.readFileSync(dbPath);
            const installer = spawnSync(process.env.SMART_STUDY_TEST_INSTALLER, ['/S', '/D=' + path.dirname(executable)], {
                env: { ...process.env, SMART_STUDY_USER_DATA: profile, SMART_STUDY_TEST_WINDOW: 'hidden' },
                windowsHide: true, timeout: 120000
            });
            assert.ifError(installer.error);
            check('Setup reinstalls successfully without requesting administrator privileges', installer.status === 0);
            check('Reinstall preserves the existing profile database', before.equals(fs.readFileSync(dbPath)));
        }
        current = await launch();
        check('Notes survive closing and reopening the packaged application', (await api(current, '/notes')).some(note => note.title === 'Release note' && note.content === 'Packaged persistence evidence'));
        const documents = await api(current, '/documents');
        check('Document metadata and bytes survive restart', documents.length === 1 && await (await fetch(current.api + `/documents/${documents[0].id}/file`)).text() === 'Release file bytes');
        check('Stable browser storage is retained on the third launch', await current.client.evaluate(`localStorage.getItem('release-persistence-check') === 'kept-across-restart'`));
        check('Developer credentials were not copied into the private profile', !fs.existsSync(path.join(profile, 'data/edux-accounts/1.json')));
        await close(current); current = null;
    } catch (error) { report.failure = error.stack; console.error(error.stack); process.exitCode = 1; }
    finally {
        if (current) await close(current);
        report.passed = report.checks.filter(item => item.passed).length;
        report.failed = report.checks.filter(item => !item.passed).length + (report.failure && !report.checks.some(item => !item.passed) ? 1 : 0);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        // The named isolated profile is retained for readback; no user data is touched.
        console.log(JSON.stringify({ passed: report.passed, failed: report.failed, report: path.join(output, 'report.json') }));
    }
})();
