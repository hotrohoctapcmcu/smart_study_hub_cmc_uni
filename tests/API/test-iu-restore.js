'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('silent Electron IU restore reuses saved cookies, stays hidden and cleans up its own window', async () => {
    const handlers = new Map();
    let connected = false, cookieCount = 0, authenticated = true, opens = 0, posts = 0, loads = 0;
    let legacyCookieCount = 0;
    const newUrl = 'https://example.invalid/iu';
    const legacyUrl = 'https://example.invalid/legacy';
    const targets = [];
    const saved = [];
    let existing = null;
    const windows = [];
    const electron = { BrowserWindow: function () {}, ipcMain: { handle: (name, callback) => handlers.set(name, callback) } };
    const modules = {
        electron,
        '../../CRWEB/modules/IU/login': { getIuWindow: () => existing, loginIU: async () => ({ count: 1, cookie: 'test-only' }), logoutIU: async () => {} },
        '../../CRWEB/modules/IU/login/cookies': { readIuCookies: async (portal) => portal === 'legacy'
            ? { count: legacyCookieCount, cookie: 'legacy-test-only' } : { count: cookieCount, cookie: 'test-only' } },
        '../../CRWEB/modules/IU/payload': { laySession: async () => targets.at(-1) === newUrl
            ? { portal: 'sinhvien' } : { userId: 'legacy-test' } },
        '../../CRWEB/modules/IU/login/constants': { IU_URL: newUrl, LEGACY_IU_URL: legacyUrl },
        '../../CRWEB/modules/IU/login/window': {
            openLoginWindow: (_url, options) => { assert.equal(options.hidden, true); opens++; const window = { destroyed: false, isVisible: () => false,
                isDestroyed() { return this.destroyed; }, destroy() { this.destroyed = true; } }; windows.push(window); return window; },
            loadAndWait: async (_win, url) => { loads++; targets.push(url); await new Promise(resolve => setTimeout(resolve, 5)); },
            waitForPortalAuth: async () => authenticated
        }
    };
    const sandbox = { module: { exports: {} }, process: { env: {} }, require: id => {
        if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id];
    }, fetch: async (_url, options) => {
        if (options?.method === 'POST') { posts++; connected = true; saved.push(JSON.parse(options.body)); }
        return { ok: true, json: async () => ({ connected }) };
    } };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../electron/bridges/iu.js'), 'utf8'), sandbox);
    assert.equal(sandbox.module.exports.registerIuBridge(), true);
    const restore = handlers.get('iu:restore');
    assert.equal((await restore()).reason, 'session_required'); assert.equal(opens, 0);
    cookieCount = 1;
    const results = await Promise.all([restore(), restore()]);
    assert.ok(results.every(result => result.connected && result.restored));
    assert.equal(opens, 1); assert.equal(loads, 1); assert.equal(posts, 1); assert.equal(windows[0].destroyed, true);
    assert.deepEqual(saved[0], { session: { portal: 'sinhvien' }, cookie: 'test-only' });
    assert.equal((await restore()).restored, false); assert.equal(opens, 1);
    connected = false; authenticated = false;
    assert.equal((await restore()).reason, 'session_required'); assert.equal(windows.at(-1).destroyed, true);
    existing = { isVisible: () => true };
    assert.equal((await restore()).reason, 'login_in_progress'); assert.equal(opens, 2);
    existing = null;
    authenticated = true;
    cookieCount = 0;
    legacyCookieCount = 1;
    assert.equal((await restore()).restored, true);
    assert.equal(targets.at(-1), legacyUrl);
    assert.deepEqual(saved[1], { session: { userId: 'legacy-test' }, cookie: 'legacy-test-only' });
    assert.equal(windows.at(-1).destroyed, true);
});
