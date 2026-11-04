'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const express = require('express');
const fixture = require('./fixtures/endpoints.before.json');
const apiRoot = path.resolve(__dirname, '..');
// Routers create their default service instances during require(), so configure
// document storage before the endpoint inventory imports those instances.
const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'api-contract-storage-'));
const previousStorage = process.env.DOCUMENTS_PATH;
process.env.DOCUMENTS_PATH = storageDirectory;
after(() => {
    if (previousStorage === undefined) delete process.env.DOCUMENTS_PATH;
    else process.env.DOCUMENTS_PATH = previousStorage;
    assert.ok(path.resolve(storageDirectory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(storageDirectory, { recursive: true, force: true });
});

function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? files(filename) : [filename];
    });
}

function endpoints(router, prefix = '') {
    return router.stack.flatMap(layer => {
        if (layer.route) {
            const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            return paths.flatMap(routePath => Object.keys(layer.route.methods)
                .filter(method => layer.route.methods[method])
                .map(method => ({ method: method.toUpperCase(), path: (prefix + routePath).replace(/\/$/, '') || '/' })));
        }
        if (layer.handle.stack) {
            assert.equal(layer.regexp.fast_slash, true, 'nested feature router has no hidden mount prefix');
            return endpoints(layer.handle, prefix);
        }
        return [];
    });
}

test('every effective endpoint retains its HTTP method, path, aliases and registration order', () => {
    const { MODULES } = require('../routes');
    const actual = [
        ...endpoints(require('../routes/status')),
        ...MODULES.flatMap(module => module.paths.flatMap(mount => endpoints(module.router, '/api/v1' + mount.replace(/\/$/, '')))),
        ...endpoints(require('../routes/dashboard'), '/api/v1/dashboard')
    ];
    // New unified sync is additive; all pre-existing routes keep their order.
    const unified = actual.filter(endpoint => endpoint.path === '/api/v1/sync/all');
    assert.deepEqual(unified, [{ method: 'POST', path: '/api/v1/sync/all' }]);
    assert.deepEqual(actual.filter(endpoint => endpoint.path === '/api/v1/learning/images/:file'), []);
    assert.deepEqual(actual.filter(endpoint => endpoint.path === '/api/v1/ai/summary-jobs/:id'), [
        { method: 'GET', path: '/api/v1/ai/summary-jobs/:id' }, { method: 'DELETE', path: '/api/v1/ai/summary-jobs/:id' }
    ]);
    assert.deepEqual(actual.filter(endpoint => endpoint.path === '/api/v1/ai/pomodoro-goals'), [{ method: 'POST', path: '/api/v1/ai/pomodoro-goals' }]);
    const previous = actual.filter(endpoint => !['/api/v1/sync/all', '/api/v1/ai/summary-jobs/:id', '/api/v1/ai/pomodoro-goals'].includes(endpoint.path));
    assert.equal(previous.length, fixture.endpoints.length);
    assert.deepEqual(previous, fixture.endpoints);
});

test('relative imports resolve and implementation dependencies follow the layers', () => {
    assert.equal(fs.existsSync(path.join(apiRoot, 'shared')), false);
    assert.equal(fs.existsSync(path.join(apiRoot, 'modules')), false);
    for (const filename of files(apiRoot).filter(filename => /\.(?:js|cjs)$/.test(filename))) {
        const source = fs.readFileSync(filename, 'utf8');
        const localRequire = createRequire(filename);
        for (const match of source.matchAll(/\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
            let resolved;
            assert.doesNotThrow(() => { resolved = localRequire.resolve(match[1]); }, `${path.relative(apiRoot, filename)}: ${match[1]}`);
            // Database is a separate layer outside the API directory.
            const relative = path.relative(apiRoot, resolved);
            if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) {
                assert.doesNotMatch(relative.split(path.sep).join('/'), /(?:^|\/)(?:shared|modules)(?:\/|$)/);
            }
        }
        if (filename.startsWith(path.join(apiRoot, 'services') + path.sep)) {
            assert.doesNotMatch(source, /require\(['"]express['"]\)/, filename);
            assert.doesNotMatch(source, /require\(['"]\.\.\/(?:controllers|routes)\//, filename);
            assert.doesNotMatch(source, /\b(?:req|res)\.(?:body|query|params|status|json|send|set|type)\b/, filename);
        }
        if (filename.startsWith(path.join(apiRoot, 'routes') + path.sep)) {
            assert.doesNotMatch(source, /\.(?:executeQuery|layHoSo|themBaiTap|dongBoHoSoIU)\(/, filename);
        }
    }
});

test('database dependencies stay inside the persistence layer', () => {
    const databaseRoot = path.resolve(apiRoot, '../database');
    assert.equal(fs.existsSync(path.join(apiRoot, 'database')), false);
    for (const filename of files(databaseRoot).filter(filename => filename.endsWith('.js'))) {
        const source = fs.readFileSync(filename, 'utf8');
        const localRequire = createRequire(filename);
        assert.doesNotMatch(source, /require\(['"](?:express|cors)['"]\)/, filename);
        for (const match of source.matchAll(/\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
            const resolved = localRequire.resolve(match[1]);
            assert.ok(resolved.startsWith(databaseRoot + path.sep), `${filename}: ${match[1]}`);
        }
    }
});

test('HTTP contracts survive JSON/raw parsing, route ordering and error handling', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'api-layer-contract-'));
    const previous = { DB_PATH: process.env.DB_PATH, DOCUMENTS_PATH: process.env.DOCUMENTS_PATH, NODE_ENV: process.env.NODE_ENV };
    process.env.DB_PATH = path.join(directory, 'contract.db');
    process.env.DOCUMENTS_PATH = path.join(directory, 'documents');
    process.env.NODE_ENV = 'production';
    const database = await require('../../database')();
    const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
    await database.executeQuery('INSERT INTO Students(student_id,student_code,full_name,major) VALUES(@id,@code,@name,@major)', {
        id: NGUOI_DUNG_ID, code: 'CONTRACT', name: 'Contract Student', major: 'IT'
    });
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(require('../routes/status'));
    const { setDbForAll, registerModules } = require('../routes');
    setDbForAll(database);
    registerModules(app, '/api/v1');
    const dashboard = require('../routes/dashboard');
    dashboard.setDb(database);
    app.use('/api/v1/dashboard', dashboard);
    const { notFound, errorHandler } = require('../middlewares/error');
    app.use(notFound);
    app.use(errorHandler);
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, endpoint, body, headers = {}) => {
        const response = await fetch(base + endpoint, { method, headers, ...(body === undefined ? {} : { body }) });
        return { status: response.status, body: await response.json() };
    };
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await database.closePool();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });

    await t.test('root status aliases keep their original responses', async () => {
        assert.deepEqual(await request('GET', '/health'), { status: 200, body: { success: true, status: 'online' } });
        for (const endpoint of ['/', '/api', '/api/v1']) {
            assert.deepEqual(await request('GET', endpoint), { status: 200, body: { success: true, status: 'online', endpoints: '/api/v1' } });
        }
    });
    await t.test('DELETE IU session matches the captured pre-refactor status/body and clears the session', async () => {
        const sessions = require('../utils/iu-session');
        sessions.saveSession(NGUOI_DUNG_ID, { cookie: 'contract-only', session: { studentId: 'CONTRACT' } });
        assert.ok(sessions.getSession(NGUOI_DUNG_ID));
        assert.deepEqual(await request('DELETE', '/api/v1/sync/iu/session'), fixture.deleteIuSession);
        assert.equal(sessions.getSession(NGUOI_DUNG_ID), null);
        assert.deepEqual(await request('DELETE', '/api/v1/sync/iu/session'), fixture.deleteIuSession);
    });
    await t.test('specific task checklist paths and both mount aliases stay reachable', async () => {
        assert.deepEqual(await request('GET', '/api/v1/tasks/checklist'), { status: 200, body: { success: true, data: [] } });
        assert.deepEqual(await request('GET', '/api/v1/checklist/checklist'), { status: 200, body: { success: true, data: [] } });
    });
    await t.test('raw document uploads preserve bytes and download headers', async () => {
        const bytes = Buffer.from('contract document\n\u0000end', 'utf8');
        const meta = encodeURIComponent(JSON.stringify({ filename: 'contract.txt', title: 'Contract document', subject: 'Contract subject' }));
        const uploaded = await request('POST', '/api/v1/documents', bytes, { 'Content-Type': 'application/octet-stream', 'X-Document-Meta': meta });
        assert.equal(uploaded.status, 201);
        assert.equal(uploaded.body.success, true);
        assert.equal(uploaded.body.data.size, bytes.length);
        const response = await fetch(base + '/api/v1/documents/' + uploaded.body.data.id + '/file');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.match(response.headers.get('content-disposition'), /^inline;/);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    });
    await t.test('invalid upload metadata and AI input retain their distinct error envelopes', async () => {
        const invalid = await request('POST', '/api/v1/documents', Buffer.from('test'), { 'Content-Type': 'application/octet-stream', 'X-Document-Meta': '%invalid' });
        assert.equal(invalid.status, 400);
        assert.equal(invalid.body.success, false);
        assert.equal(typeof invalid.body.message, 'string');
        assert.equal('data' in invalid.body, false);
        const ai = await request('POST', '/api/v1/ai/check', '{}', { 'Content-Type': 'application/json' });
        assert.equal(ai.status, 400);
        assert.equal(ai.body.success, false);
        assert.equal(ai.body.data, null);
        assert.equal(ai.body.error.code, 'AI_ERROR');
        assert.equal(ai.body.error.message, ai.body.message);
        const missing = await request('GET', '/api/v1/not-an-endpoint');
        assert.equal(missing.status, 404);
        assert.equal(missing.body.success, false);
    });
});
