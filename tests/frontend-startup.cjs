'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

test('existing launcher serves the built frontend and React routes on port 8080', async t => {
    const root = path.resolve(__dirname, '..');
    const dist = path.join(root, 'Frontend', 'dist');
    assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Run npm --prefix Frontend run build first.');
    const probe = net.createServer();
    const available = await new Promise((resolve, reject) => {
        probe.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
        probe.listen(8080, () => probe.close(() => resolve(true)));
    });
    if (!available) {
        t.skip('Port 8080 is occupied; existing processes are left untouched.');
        return;
    }

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-frontend-startup-'));
    const child = spawn(process.execPath, [path.join(root, 'index.js')], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DB_PATH: path.join(directory, 'test.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
            API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test', GEMINI_ENABLE_WEB_FALLBACK: 'false' }
    });
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('unistudy-frontend-startup-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    let output = '';
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Launcher did not become ready: ${output}`)), 20000);
        const finish = () => {
            if (output.includes('[FE] http://localhost:8080') && output.includes('[API] http://localhost:0')) {
                clearTimeout(timer);
                resolve();
            }
        };
        child.stdout.on('data', bytes => { output += bytes; finish(); });
        child.stderr.on('data', bytes => { output += bytes; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`Launcher exited (${code}): ${output}`)); });
    });
    const get = (route, method = 'GET') => fetch(`http://127.0.0.1:8080${route}`, { method, signal: AbortSignal.timeout(10000) });
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    await t.test('root and direct React URLs return the compiled HTML', async () => {
        for (const route of ['/', '/index.html', '/schedule', '/tasks?status=COMPLETED', '/learning?tab=quiz', '/textbook/test-book', '/sync', '/documents']) {
            const response = await get(route);
            assert.equal(response.status, 200, route);
            assert.match(response.headers.get('content-type'), /^text\/html/);
            assert.equal(await response.text(), html, route);
        }
        assert.doesNotMatch(html, /\/src\/main\.jsx/);
        assert.match(html, /\/assets\/index-[^" ]+\.js/);
    });
    await t.test('every generated asset is served with its correct MIME type', async () => {
        const mime = {
            '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css',
            '.png': 'image/png', '.wav': 'audio/wav', '.svg': 'image/svg+xml',
            '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
        };
        const assets = fs.readdirSync(path.join(dist, 'assets'), { withFileTypes: true }).filter(entry => entry.isFile());
        assert.ok(assets.some(entry => entry.name.endsWith('.mjs')), 'Built PDF worker must be checked.');
        for (const name of [...assets.map(entry => `assets/${entry.name}`), 'favicon.svg', 'icons.svg']) {
            assert.ok(Object.hasOwn(mime, path.extname(name)), `Add an expected MIME type for generated asset: ${name}`);
            const response = await get(`/${name}`, 'HEAD');
            assert.equal(response.status, 200, name);
            assert.equal(response.headers.get('content-type')?.split(';')[0], mime[path.extname(name)], name);
        }
        t.diagnostic(`${assets.length + 2} built assets checked, including the PDF .mjs worker.`);
    });
    await t.test('source files and missing assets remain unavailable', async () => {
        for (const route of ['/src/main.jsx', '/assets/not-found.js', '/assets/not-found', '/missing.png', '/API/index.js']) {
            const response = await get(route);
            assert.equal(response.status, 404, route);
            assert.doesNotMatch(await response.text(), /<html/i, route);
        }
    });
});
