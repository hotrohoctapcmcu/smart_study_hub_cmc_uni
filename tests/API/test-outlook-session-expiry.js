'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createOutlookClient } = require('../../CRWEB/modules/OUTLOOK');

for (const status of [401, 403]) {
    test(`Outlook ${status} invalidates its connected state and a successful reconnect restores it`, async () => {
        let rejected = false, partitionClears = 0;
        const client = createOutlookClient({
            tokenProvider: () => 'test-only-token',
            electronProvider: () => ({ session: { fromPartition: () => ({ clearStorageData: async () => { partitionClears++; } }) } }),
            fetchImpl: async () => rejected
                ? { ok: false, status }
                : { ok: true, json: async () => ({ value: [{ id: 'mail', subject: 'Test mail' }] }) }
        });
        assert.equal((await client.connect()).messages.length, 1);
        assert.equal(client.status().connected, true);
        rejected = true;
        await assert.rejects(client.listMessages(), error => error.statusCode === status);
        assert.equal(client.status().connected, false);
        assert.equal(client.status().requiresLogin, true);
        assert.equal(client.status().source, null);
        assert.equal(partitionClears, 0, 'expiry must retain the saved Microsoft browser session');
        rejected = false;
        await client.connect();
        assert.equal(client.status().connected, true);
        assert.equal(client.status().requiresLogin, false);
    });
}

test('expired Outlook Web capture clears its cached connection so the next connection is interactive', async () => {
    let epoch = 100000, failCapture = false;
    const windows = [];
    class FakeWindow extends EventEmitter {
        constructor(options) {
            super(); this.options = options; this.destroyed = false; windows.push(this);
            this.webContents = new EventEmitter();
            const debuggerApi = new EventEmitter();
            debuggerApi.attach = () => {};
            debuggerApi.detach = () => {};
            debuggerApi.sendCommand = async method => method === 'Network.getResponseBody'
                ? { body: JSON.stringify({ value: [{ id: 'captured-mail', subject: 'Test', body: { content: 'Body' } }] }) } : {};
            this.webContents.debugger = debuggerApi;
            this.webContents.setWindowOpenHandler = () => {};
        }
        isDestroyed() { return this.destroyed; }
        destroy() { this.destroyed = true; this.emit('closed'); }
        async loadURL() {
            queueMicrotask(() => {
                if (failCapture) this.webContents.emit('did-navigate', {}, 'https://login.microsoftonline.com/test');
                else {
                    const debug = this.webContents.debugger;
                    debug.emit('message', {}, 'Network.responseReceived', { requestId: '1', response: { url: 'https://outlook.office.com/messages' } });
                    debug.emit('message', {}, 'Network.loadingFinished', { requestId: '1' });
                }
            });
        }
    }
    const filename = path.resolve(__dirname, '../../CRWEB/modules/OUTLOOK/index.js');
    const sandbox = {
        module: { exports: {} }, process: { env: {} }, Buffer, URL, AbortSignal,
        Date: class extends Date { static now() { return epoch; } },
        setTimeout: (callback, delay) => {
            const timer = { active: true };
            if (delay <= 5000) queueMicrotask(() => { if (timer.active) callback(); });
            return timer;
        }, clearTimeout: timer => { if (timer) timer.active = false; },
        require: id => id === './parser' ? require('../../CRWEB/modules/OUTLOOK/parser') : null
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox);
    const client = sandbox.module.exports.createOutlookClient({ tokenProvider: () => '',
        electronProvider: () => ({ app: { whenReady: async () => {} }, BrowserWindow: FakeWindow }) });
    await client.connect();
    assert.equal(client.status().connected, true);
    epoch += 20000; failCapture = true;
    await assert.rejects(client.listMessages(), error => error.statusCode === 401);
    assert.equal(windows.at(-1).options.show, false);
    assert.equal(client.status().connected, false);
    failCapture = false;
    await client.connect();
    assert.equal(windows.at(-1).options.show, true);
    assert.equal(client.status().connected, true);
});
