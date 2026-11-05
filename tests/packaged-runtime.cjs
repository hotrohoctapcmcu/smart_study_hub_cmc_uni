'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { configurePackagedRuntime } = require('../electron/runtime');

test('packaged runtime keeps all writable data outside the installation and keeps a stable profile', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-study-runtime-test-'));
    try {
        const paths = {}, env = { SMART_STUDY_USER_DATA: path.join(directory, 'user profile'), DB_PATH: 'ignored-developer.db' };
        const app = { isPackaged: true, getPath: () => directory, setPath: (key, value) => { paths[key] = value; } };
        const first = configurePackagedRuntime(app, env);
        assert.equal(paths.userData, path.resolve(env.SMART_STUDY_USER_DATA));
        for (const key of ['DB_PATH', 'DOCUMENTS_PATH', 'EDUX_ACCOUNTS_PATH', 'EDUX_COOKIE_PATH', 'GEMINI_SESSION_DIR']) {
            assert.ok(path.isAbsolute(env[key]));
            assert.ok(env[key].startsWith(first.data + path.sep));
        }
        fs.writeFileSync(env.DB_PATH, 'persisted fixture');
        const second = configurePackagedRuntime(app, env);
        assert.deepEqual(second, first);
        assert.equal(fs.readFileSync(env.DB_PATH, 'utf8'), 'persisted fixture');
        assert.equal(env.API_PORT, '0'); assert.equal(env.FE_PORT, '0');
        assert.equal(env.API_HOST, '127.0.0.1'); assert.equal(env.NODE_ENV, 'production');
    } finally {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('smart-study-runtime-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('development runtime leaves existing paths and environment untouched', () => {
    const env = { DB_PATH: 'existing.db' };
    assert.equal(configurePackagedRuntime({ isPackaged: false }, env), null);
    assert.deepEqual(env, { DB_PATH: 'existing.db' });
});
