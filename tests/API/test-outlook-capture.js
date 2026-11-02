'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, getEventListeners } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture({ redirectAbort = false, navigationError, whenReady = async () => {} } = {}) {
    const windows = [];
    class Window extends EventEmitter {
        constructor(options) {
            super(); this.options = options; this.visible = options.show; this.destroyed = false;
            windows.push(this);
            this.webContents = new EventEmitter();
            const debug = this.webContents.debugger = new EventEmitter();
            debug.attach = () => {};
            debug.detach = () => {};
            debug.sendCommand = async (method, options) => method === 'Network.getResponseBody'
                ? { body: JSON.stringify(this.bodies.get(options.requestId)) } : {};
            this.bodies = new Map();
            this.webContents.setWindowOpenHandler = () => {};
            this.webContents.getURL = () => this.url || '';
            this.webContents.getUserAgent = () => 'Mozilla/5.0 hotrohoctap/1.0.0 Chrome/150.0.0.0 Electron/44.0.0 Safari/537.36';
            this.webContents.setUserAgent = value => { this.userAgent = value; };
        }
        show() { this.visible = true; }
        focus() { this.focused = true; }
        isVisible() { return this.visible; }
        isDestroyed() { return this.destroyed; }
        destroy() { this.destroyed = true; this.emit('closed'); }
        async loadURL(url) {
            this.url = url;
            if (navigationError) throw navigationError;
            if (redirectAbort) throw Object.assign(new Error('ERR_ABORTED (-3)'), { code: 'ERR_ABORTED', errno: -3 });
        }
        receive(url = 'https://outlook.office.com/owa/service.svc?action=FindItem') {
            const requestId = String(this.bodies.size + 1);
            this.bodies.set(requestId, { Body: { ResponseMessages: { Items: [{
                RootFolder: { Items: [{ ItemId: { Id: 'mail-1' }, Subject: 'Thông báo', Body: { Value: 'Nội dung' } }] }
            }] } } });
            this.webContents.debugger.emit('message', {}, 'Network.responseReceived', { requestId, response: { url } });
            this.webContents.debugger.emit('message', {}, 'Network.loadingFinished', { requestId });
        }
    }
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../CRWEB/modules/OUTLOOK/index.js'), 'utf8'), {
        module, process: { env: {} }, Buffer, URL, AbortSignal, AbortController,
        setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds === 1800 || milliseconds === 2500 ? 1 : milliseconds),
        clearTimeout,
        require: id => id === './parser' ? require('../../CRWEB/modules/OUTLOOK/parser') : null,
    });
    const client = module.exports.createOutlookClient({ tokenProvider: () => '',
        electronProvider: () => ({ app: { whenReady }, BrowserWindow: Window }) });
    return { client, windows };
}

const nextTick = () => new Promise(resolve => setImmediate(resolve));

test('Microsoft redirect abort does not terminate Outlook capture before inbox data arrives', async () => {
    const { client, windows } = fixture({ redirectAbort: true });
    const pending = client.connect({ timeoutMs: 500 });
    // Attach a handler immediately because the old implementation rejects during redirect.
    pending.catch(() => {});
    await nextTick();
    windows[0].receive();
    const result = await pending;
    assert.equal(result.messages[0].id, 'mail-1');
    assert.equal(windows[0].destroyed, true, 'completed sync must close the Outlook window');
    assert.equal(client.status().connected, true);
});

test('Outlook captures mail from the current cloud.microsoft startup payload', async () => {
    const { client, windows } = fixture();
    const pending = client.connect({ timeoutMs: 100 });
    await nextTick();
    windows[0].receive('https://outlook.cloud.microsoft/owa/startupdata.ashx?app=Mail');
    const result = await pending;
    assert.equal(result.messages[0].subject, 'Thông báo');
    assert.equal(result.messages[0].body, 'Nội dung');
    assert.equal(windows[0].destroyed, true, 'the redirected Outlook inbox closes after capture');
    assert.equal(client.status().connected, true, 'closing the window retains the authenticated session');
});

test('simultaneous Outlook connects share a single native login window', async () => {
    const { client, windows } = fixture();
    const first = client.connect({ timeoutMs: 500 }), second = client.connect({ timeoutMs: 500 });
    await nextTick();
    for (const win of windows) win.receive();
    await Promise.all([first, second]);
    assert.equal(windows.length, 1);
    assert.equal(windows[0].destroyed, true);
});

test('interactive connection reveals a pending hidden Outlook capture', async () => {
    const { client, windows } = fixture();
    const background = client.listMessages({ timeoutMs: 500 });
    await nextTick();
    assert.equal(windows[0].visible, false);
    const interactive = client.connect({ timeoutMs: 500 });
    await nextTick();
    const revealed = windows[0].visible;
    windows[0].receive();
    await Promise.all([background, interactive]);
    assert.equal(windows.length, 1);
    assert.equal(revealed, true);
});

test('Outlook presents the installed Chromium version without Electron application UA tokens', async () => {
    const { client, windows } = fixture();
    const pending = client.connect({ timeoutMs: 500 });
    await nextTick();
    const ua = windows[0].userAgent;
    windows[0].receive();
    await pending;
    assert.match(ua, /Chrome\/150\.0\.0\.0/);
    assert.match(ua, /Safari\/537\.36/);
    assert.doesNotMatch(ua, /Electron|hotrohoctap/i);
});

test('real Outlook navigation failure reports its network error without creating an authenticated session', async () => {
    const { client, windows } = fixture({ navigationError: Object.assign(new Error('ERR_NAME_NOT_RESOLVED'), { code: 'ERR_NAME_NOT_RESOLVED', errno: -105 }) });
    await assert.rejects(client.connect({ timeoutMs: 500 }), failure => failure.code === 'OUTLOOK_NETWORK_ERROR' && failure.statusCode === 502);
    assert.equal(windows[0].destroyed, true);
    assert.equal(client.status().connected, false);
    assert.equal(client.status().source, null);
});

test('cancelling an interactive promotion closes its hidden capture and removes the joined abort listener', async () => {
    const { client, windows } = fixture();
    const background = client.listMessages({ timeoutMs: 500 });
    background.catch(() => {});
    await nextTick();
    const controller = new AbortController();
    const interactive = client.connect({ timeoutMs: 500, signal: controller.signal });
    interactive.catch(() => {});
    await nextTick();
    assert.equal(windows[0].visible, true);
    controller.abort();
    await assert.rejects(interactive, failure => failure.code === 'OUTLOOK_LOGIN_CANCELLED');
    await assert.rejects(background, failure => failure.code === 'OUTLOOK_LOGIN_CANCELLED');
    assert.equal(windows[0].destroyed, true);
    assert.equal(client.status().connected, false);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('cancellation while waiting for Electron readiness cannot open an Outlook window afterward', async () => {
    let ready;
    const { client, windows } = fixture({ whenReady: () => new Promise(resolve => { ready = resolve; }) });
    const background = client.listMessages({ timeoutMs: 100 });
    background.catch(() => {});
    await nextTick();
    const controller = new AbortController();
    const interactive = client.connect({ timeoutMs: 100, signal: controller.signal });
    interactive.catch(() => {});
    controller.abort();
    ready();
    await assert.rejects(interactive, failure => failure.code === 'OUTLOOK_LOGIN_CANCELLED');
    await assert.rejects(background, failure => failure.code === 'OUTLOOK_LOGIN_CANCELLED');
    assert.equal(windows.length, 0);
    assert.equal(client.status().connected, false);
});
