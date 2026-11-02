'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createOutlookClient } = require('../../CRWEB/modules/OUTLOOK');

function hungIuLogin() {
    let destroyed = 0, opened = 0;
    const window = { webContents: { on() {} }, isDestroyed: () => destroyed > 0 };
    const modules = {
        './constants': {}, './pagescript': {},
        './window': {
            openLoginWindow: () => { opened++; return window; },
            safeGetURL: () => '', portalAuthState: () => new Promise(() => {}),
            destroyWindow: () => { destroyed++; }
        },
        './cookies': {}
    };
    const sandbox = { module: { exports: {} }, require: id => modules[id],
        console: { log() {} }, setTimeout, clearTimeout };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../CRWEB/modules/IU/login/flow.js'), 'utf8'), sandbox);
    return { login: sandbox.module.exports.loginIU, destroyed: () => destroyed, opened: () => opened };
}

test('IU deadline includes an unresponsive initial page and closes only its window', async () => {
    const flow = hungIuLogin();
    const first = flow.login({ timeoutMs: 20 });
    assert.equal(flow.login({ timeoutMs: 20 }), first);
    await assert.rejects(first, failure => failure.code === 'LOGIN_TIMEOUT');
    assert.equal(flow.opened(), 1);
    assert.equal(flow.destroyed(), 1);
});

test('IU cancellation stops a pending login without waiting for page scripts', async () => {
    const flow = hungIuLogin(), controller = new AbortController();
    const pending = flow.login({ signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, failure => failure.code === 'LOGIN_CANCELLED');
    assert.equal(flow.destroyed(), 1);
});

function pendingOutlook() {
    const windows = [];
    class Window extends EventEmitter {
        constructor() {
            super(); this.destroyed = false; windows.push(this);
            this.webContents = new EventEmitter();
            this.webContents.debugger = new EventEmitter();
            Object.assign(this.webContents.debugger, { attach() {}, detach() {}, sendCommand: async () => ({}) });
            this.webContents.setWindowOpenHandler = () => {};
        }
        isDestroyed() { return this.destroyed; }
        destroy() { this.destroyed = true; this.emit('closed'); }
        async loadURL() {}
    }
    return { windows, client: createOutlookClient({ tokenProvider: () => '',
        electronProvider: () => ({ app: { whenReady: async () => {} }, BrowserWindow: Window }) }) };
}

test('Outlook connection obeys its deadline and closes a stalled login window', async () => {
    const { client, windows } = pendingOutlook();
    await assert.rejects(client.connect({ timeoutMs: 20 }), failure => failure.statusCode === 504);
    assert.equal(windows.length, 1);
    assert.equal(windows[0].destroyed, true);
});

test('Outlook cancellation closes its window and allows another attempt', async () => {
    const { client, windows } = pendingOutlook(), controller = new AbortController();
    const pending = client.connect({ signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending, failure => failure.statusCode === 409);
    assert.equal(windows[0].destroyed, true);
    await assert.rejects(client.connect({ timeoutMs: 20 }), failure => failure.statusCode === 504);
    assert.equal(windows.length, 2);
});

function iuBridge({ session, fetchImpl }) {
    let destroyed = false;
    const win = { isDestroyed: () => destroyed, destroy: () => { destroyed = true; } };
    const modules = {
        electron: { BrowserWindow() {}, ipcMain: { handle() {} } },
        '../../CRWEB/modules/IU/login': {
            loginIU: async () => ({ count: 1, cookie: 'test-only' }),
            getIuWindow: () => win
        },
        '../../CRWEB/modules/IU/login/cookies': {},
        '../../CRWEB/modules/IU/payload': { laySession: session },
        '../../CRWEB/modules/IU/login/window': {},
        '../../CRWEB/modules/IU/login/constants': {}
    };
    const sandbox = { module: { exports: {} }, process: { env: {} },
        require: id => modules[id], fetch: fetchImpl, AbortController, setTimeout, clearTimeout };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../electron/bridges/iu.js'), 'utf8'), sandbox);
    sandbox.module.exports.registerIuBridge();
    return { connect: sandbox.module.exports.connectIU, destroyed: () => destroyed };
}

test('IU full connection deadline covers stuck session extraction and prevents a stale session save', async () => {
    let completeSession, requests = 0;
    const bridge = iuBridge({
        session: () => new Promise(resolve => { completeSession = resolve; }),
        fetchImpl: async () => { requests++; return { ok: true, json: async () => ({}) }; }
    });
    await assert.rejects(bridge.connect({ timeoutMs: 20 }), failure => failure.code === 'LOGIN_TIMEOUT');
    assert.equal(bridge.destroyed(), true);
    completeSession({ userId: 'test' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 0);
});

test('IU cancellation aborts a pending API session save', async () => {
    let requestSignal;
    const bridge = iuBridge({ session: async () => ({ userId: 'test' }),
        fetchImpl: async (_url, options) => {
            requestSignal = options.signal;
            return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted'))));
        }
    });
    const controller = new AbortController();
    const pending = bridge.connect({ signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending, failure => failure.code === 'LOGIN_CANCELLED');
    assert.equal(requestSignal.aborted, true);
    assert.equal(bridge.destroyed(), true);
});
