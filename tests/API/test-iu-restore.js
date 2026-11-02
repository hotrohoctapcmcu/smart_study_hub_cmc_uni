'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('silent Electron IU restore reuses saved cookies, stays hidden and cleans up its own window', async () => {
    const handlers = new Map();
    let connected = false, cookieCount = 0, authenticated = true, opens = 0, posts = 0, loads = 0;
    let existing = null;
    const windows = [];
    const electron = { BrowserWindow: function () {}, ipcMain: { handle: (name, callback) => handlers.set(name, callback) } };
    const modules = {
        electron,
        '../../CRWEB/modules/IU/login': { getIuWindow: () => existing, loginIU: async () => ({ count: 1, cookie: 'test-only' }), logoutIU: async () => {} },
        '../../CRWEB/modules/IU/login/cookies': { readIuCookies: async () => ({ count: cookieCount, cookie: 'test-only' }) },
        '../../CRWEB/modules/IU/payload': { laySession: async () => ({ studentId: 'test' }) },
        '../../CRWEB/modules/IU/login/constants': { IU_URL: 'https://example.invalid/iu' },
        '../../CRWEB/modules/IU/login/window': {
            openLoginWindow: (_url, options) => { assert.equal(options.hidden, true); opens++; const window = { destroyed: false, isVisible: () => false,
                isDestroyed() { return this.destroyed; }, destroy() { this.destroyed = true; } }; windows.push(window); return window; },
            loadAndWait: async () => { loads++; await new Promise(resolve => setTimeout(resolve, 5)); },
            waitForPortalAuth: async () => authenticated
        }
    };
    const sandbox = { module: { exports: {} }, process: { env: {} }, require: id => {
        if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id];
    }, fetch: async (_url, options) => {
        if (options?.method === 'POST') { posts++; connected = true; }
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
    assert.equal((await restore()).restored, false); assert.equal(opens, 1);
    connected = false; authenticated = false;
    assert.equal((await restore()).reason, 'session_required'); assert.equal(windows.at(-1).destroyed, true);
    existing = { isVisible: () => true };
    assert.equal((await restore()).reason, 'login_in_progress'); assert.equal(opens, 2);
});
