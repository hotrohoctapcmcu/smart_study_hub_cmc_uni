'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

test('desktop serves its build, database and documents with no listening ports', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-study-desktop-'));
    Object.assign(process.env, {
        DB_PATH: path.join(directory, 'test.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
        EDUX_ACCOUNTS_PATH: path.join(directory, 'edux-accounts'), APP_USER_ID: '1', NODE_ENV: 'test',
        GEMINI_ENABLE_WEB_FALLBACK: 'false'
    });
    t.mock.method(net.Server.prototype, 'listen', () => assert.fail('Desktop must not open a port'));
    t.mock.method(net.Socket.prototype, 'connect', () => assert.fail('Local data must not use TCP'));
    const { createDesktopRuntime } = require('../electron/desktop');
    const runtime = await createDesktopRuntime({ legacyStorage: { 'legacy-draft': '</script><script>unexpected()</script>' } });
    t.after(async () => {
        await runtime.close();
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('smart-study-desktop-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const db = await require('../database')();
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'DESKTOP','Desktop Tester','IT')");
    const fetch = (route, options) => runtime.handle(new Request('studyhub://app' + route, options));
    const json = async (route, options) => {
        const response = await fetch('/api/v1' + route, options);
        const payload = await response.json();
        assert.ok(response.ok && payload.success, JSON.stringify(payload));
        return payload.data ?? payload;
    };
    const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    await t.test('compiled assets, PDF worker and direct React routes load', async () => {
        const html = await (await fetch('/')).text();
        assert.match(html, /\/assets\/index-[^" ]+\.js/);
        assert.match(html, /__studyhub_localhost_storage_migrated__/);
        assert.doesNotMatch(html, /<script>unexpected\(\)<\/script>/);
        for (const route of ['/schedule', '/sync', '/documents', '/textbook/test-book']) {
            assert.equal(await (await fetch(route)).text(), html);
        }
        const assets = fs.readdirSync(path.resolve(__dirname, '../Frontend/dist/assets'));
        assert.ok(assets.some(file => file.endsWith('.mjs')));
        for (const file of assets) {
            const response = await fetch('/assets/' + file, { method: 'HEAD' });
            assert.equal(response.status, 200, file);
            if (/\.(m?js)$/.test(file)) assert.match(response.headers.get('content-type'), /javascript/);
        }
        for (const route of ['/src/main.jsx', '/API/index.js', '/assets/missing', '/assets/missing.js']) {
            assert.equal((await fetch(route)).status, 404, route);
        }
        const apiMissing = await fetch('/api/v1/missing');
        assert.equal(apiMissing.status, 404);
        assert.match(apiMissing.headers.get('content-type'), /json/);
        await apiMissing.text();
    });
    await t.test('profile, health and IU status reach the actual backend', async () => {
        assert.equal((await (await fetch('/health')).json()).status, 'online');
        assert.equal((await json('/student/profile')).student_code, 'DESKTOP');
        assert.equal((await json('/sync/iu/status')).connected, false);
    });
    await t.test('notes persist and export as DOCX', async () => {
        const note = await json('/notes', post({ title: 'Desktop note', content: 'Nội dung không qua localhost' }));
        assert.ok((await json('/notes')).some(item => item.id === note.id));
        const exported = await fetch(`/api/v1/notes/${note.id}/export`);
        assert.equal(Buffer.from(await exported.arrayBuffer()).subarray(0, 2).toString(), 'PK');
    });
    await t.test('document uploads, downloads, byte ranges and deletes retain binary content', async () => {
        const bytes = Buffer.from('Tài liệu tiếng Việt\n');
        const document = await json('/documents', {
            method: 'POST', headers: {
                'Content-Type': 'application/octet-stream',
                'X-Document-Meta': encodeURIComponent(JSON.stringify({ filename: 'tài-liệu.txt', title: 'Desktop document' }))
            }, body: bytes
        });
        const route = `/api/v1/documents/${document.id}/file`;
        assert.deepEqual(Buffer.from(await (await fetch(route)).arrayBuffer()), bytes);
        const range = await fetch(route, { headers: { Range: 'bytes=0-4' } });
        assert.equal(range.status, 206);
        assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0, 5));
        assert.equal((await fetch(route, { method: 'HEAD' })).body, null);
        await json(`/documents/${document.id}`, { method: 'DELETE' });
    });
    await t.test('custom protocol rejects other hosts and renderer origins', async () => {
        assert.equal(runtime.handle(new Request('studyhub://evil/health')).status, 404);
        for (const origin of ['https://example.invalid', 'null', null]) {
            const request = new Request('studyhub://app/health');
            Object.defineProperty(request, 'initiatorOrigin', { value: origin });
            assert.equal(runtime.handle(request).status, 403);
        }
    });
    await runtime.close();
    assert.ok(fs.statSync(process.env.DB_PATH).size > 0);
});
