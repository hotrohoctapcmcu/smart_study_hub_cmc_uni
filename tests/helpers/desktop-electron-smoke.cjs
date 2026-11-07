'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');
const { app, BrowserWindow, protocol } = electron;
app.setPath('userData', process.env.SMART_STUDY_USER_DATA);
net.Server.prototype.listen = () => { throw new Error('Desktop attempted to open a listening port'); };
net.Socket.prototype.connect = () => { throw new Error('Local backend attempted a TCP connection'); };
const timer = setTimeout(() => fail(new Error('Desktop smoke timed out')), 45000);
function fail(error) { console.error(error.stack || error); clearTimeout(timer); app.exit(1); }
process.on('unhandledRejection', fail);
app.on('browser-window-created', (_event, window) => {
    if (window.getTitle() !== 'Smart Study Hub - CMC University') return;
    window.webContents.once('did-finish-load', () => run(window).catch(fail));
});

async function run(window) {
    if (process.env.SMART_STUDY_VERIFY_RESET === '1') return verifyReset(window);
    const db = await require('../../database')();
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'NATIVE','Native Desktop Tester','IT')");
    const evaluate = expression => window.webContents.executeJavaScript(expression);
    const result = await evaluate(`(async () => {
        const checks = [];
        const check = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
        check(location.href === 'studyhub://app/', 'desktop uses the custom origin');
        check(globalThis.__SSH_RUNTIME__.desktop && globalThis.__SSH_RUNTIME__.apiBaseUrl === 'studyhub://app/api/v1', 'preload supplies the in-process address');
        check(isSecureContext && typeof crypto.randomUUID === 'function', 'secure browser features remain available');
        const base = globalThis.__SSH_RUNTIME__.apiBaseUrl;
        const json = async (route, options) => {
            const response = await fetch(base + route, options);
            const body = await response.json();
            if (!response.ok || body.success === false) throw new Error(route + ': ' + JSON.stringify(body));
            return body.data;
        };
        check((await (await fetch('/health')).json()).status === 'online', 'health works through the custom protocol');
        check((await json('/student/profile')).student_code === 'NATIVE', 'renderer reads SQLite data');
        check((await window.__uniStudyIU.iuStatus()).connected === false, 'IU bridge uses the in-memory transport');
        check((await window.__uniStudyData.catalog()).some(item => item.id === 'timetable'), 'desktop exposes selective data management');
        const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const note = await json('/notes', post({ title: 'Native desktop note', content: 'Ghi chú không cần localhost' }));
        check((await json('/notes')).some(item => item.id === note.id), 'notes save and reload');
        const exported = new Uint8Array(await (await fetch(base + '/notes/' + note.id + '/export')).arrayBuffer());
        check(exported[0] === 80 && exported[1] === 75, 'DOCX exports retain binary content');
        const text = 'Tài liệu desktop tiếng Việt';
        const document = await json('/documents', {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream',
                'X-Document-Meta': encodeURIComponent(JSON.stringify({ filename: 'native.txt', title: 'Native desktop document' })) },
            body: new Blob([text])
        });
        const file = base + '/documents/' + document.id + '/file';
        check(await (await fetch(file)).text() === text, 'binary document uploads and downloads work');
        const partial = await fetch(file, { headers: { Range: 'bytes=0-2' } });
        check(partial.status === 206 && (await partial.arrayBuffer()).byteLength === 3, 'document byte ranges work');
        localStorage.setItem('desktop-smoke', 'persisted');
        return checks;
    })()`);
    for (const message of result) console.log('PASS ' + message);
    // The real page uses Axios, not the smoke's fetch helper. Its profile screen
    // must load from the production bundle through the fetch adapter.
    for (let attempt = 0; attempt < 150; attempt++) {
        if (await evaluate(`Boolean(document.querySelector('a[href="/profile"]'))`)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    await evaluate(`document.querySelector('a[href="/profile"]').click()`);
    let loaded = false;
    for (let attempt = 0; attempt < 150; attempt++) {
        loaded = await evaluate(`document.body.innerText.includes('Native Desktop Tester')`);
        if (loaded) break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(loaded, 'Production React/Axios profile screen must read the seeded SQLite profile');
    console.log('PASS production React/Axios screen loads local data');
    // Seed a legacy origin through interception, then exercise real Chromium
    // storage migration. TCP is still disabled throughout.
    protocol.handle('http', () => new Response('', { headers: { 'Content-Type': 'text/html' } }));
    const legacy = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await legacy.loadURL('http://localhost:8080');
    await legacy.webContents.executeJavaScript(`localStorage.setItem('legacy-canvas', 'saved drawing'); localStorage.setItem('keep-new-value', 'old'); localStorage.setItem('ssh-textbooks-v1:legacy-smoke', 'old drawing')`);
    legacy.destroy();
    protocol.unhandle('http');
    const { readLegacyStorage, storageMigrationScript } = require('../../electron/storage-migration');
    const snapshot = await readLegacyStorage(electron);
    assert.equal(snapshot['legacy-canvas'], 'saved drawing');
    await evaluate(`localStorage.setItem('keep-new-value', 'new')`);
    await evaluate(storageMigrationScript(snapshot));
    assert.equal(await evaluate(`localStorage.getItem('legacy-canvas')`), 'saved drawing');
    assert.equal(await evaluate(`localStorage.getItem('keep-new-value')`), 'new');
    await evaluate(`localStorage.removeItem('legacy-canvas')`);
    await evaluate(storageMigrationScript(snapshot));
    assert.equal(await evaluate(`localStorage.getItem('legacy-canvas')`), null);
    console.log('PASS legacy canvas/drafts migrate without ports or replacing newer data');
    const reloaded = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
    window.webContents.reload();
    await reloaded;
    assert.equal(await evaluate(`localStorage.getItem('desktop-smoke')`), 'persisted');
    assert.equal(await evaluate('location.pathname'), '/profile');
    console.log('PASS direct React route reload preserves browser storage');
    await window.loadURL('studyhub://app/settings?section=data');
    let dataReady = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        dataReady = await evaluate(`document.querySelectorAll('.data-management input[type="checkbox"]').length >= 13`);
        if (dataReady) break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(dataReady, 'Actual desktop settings must show selectable data categories');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.data-management button')).find(button => button.textContent.includes('Xóa dữ liệu đã chọn')).disabled`), true);
    assert.ok(await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll('.data-management button')).find(button => button.textContent.includes('Xóa dữ liệu đã chọn'));
        const bounds = button.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
    })()`), 'Reset action must be visible before scrolling through all categories');
    const artifacts = path.resolve(__dirname, '../artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    window.webContents.setBackgroundThrottling(false);
    await window.webContents.insertCSS('.route-view { animation: none !important; opacity: 1 !important; transform: none !important; }');
    await new Promise(resolve => setTimeout(resolve, 700));
    const visualState = await evaluate(`['.main-content','.route-view','.settings-page','.card-content','.data-management'].map(selector => {
        const node = document.querySelector(selector), style = getComputedStyle(node);
        return { selector, opacity: style.opacity, color: style.color, filter: style.filter, animation: style.animationName };
    })`);
    fs.writeFileSync(path.join(artifacts, 'desktop-data-management-state.json'), JSON.stringify(visualState, null, 2));
    fs.writeFileSync(path.join(artifacts, 'desktop-data-management.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate(`localStorage.setItem('ssh-textbooks-v1:smoke', 'drawing to delete'); localStorage.setItem('reset-keep', 'keep me')`);
    console.log('PASS actual data-management screen loads without selecting or deleting any data');
    console.log('DESKTOP_ELECTRON_OK');
    clearTimeout(timer);
    await db.closePool();
    app.exit(0);
}

async function verifyReset(window) {
    const result = await window.webContents.executeJavaScript(`(async () => {
        const base = globalThis.__SSH_RUNTIME__.apiBaseUrl;
        const notes = await (await fetch(base + '/notes')).json();
        const documents = await (await fetch(base + '/documents')).json();
        const profile = await (await fetch(base + '/student/profile')).json();
        return { notes: notes.data, documents: documents.data, profile: profile.data,
            canvas: localStorage.getItem('ssh-textbooks-v1:smoke'),
            legacyCanvas: localStorage.getItem('ssh-textbooks-v1:legacy-smoke'),
            kept: localStorage.getItem('reset-keep') };
    })()`);
    assert.deepEqual(result.notes, []);
    assert.equal(result.canvas, null);
    assert.equal(result.legacyCanvas, null);
    assert.equal(result.kept, 'keep me');
    assert.equal(result.documents.length, 1);
    assert.equal(result.profile.student_code, 'NATIVE');
    const { readLegacyStorage } = require('../../electron/storage-migration');
    const old = await readLegacyStorage(electron);
    assert.equal(old?.['ssh-textbooks-v1:legacy-smoke'], undefined);
    const management = require('../../electron/data-management');
    for (let attempt = 0; attempt < 40 && management.readResetRequest(app); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(management.readResetRequest(app), null, 'renderer acknowledges reset before clearing the request');
    console.log('PASS restarted Electron deletes selected notes/canvas and keeps documents/profile/unselected storage');
    console.log('PASS deleted legacy storage cannot be imported again');
    console.log('DESKTOP_RESET_OK');
    clearTimeout(timer);
    await require('../../database/connection/db').closePool();
    app.exit(0);
}

require('../../electron/main');
