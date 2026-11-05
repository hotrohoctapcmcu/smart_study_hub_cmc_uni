'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('Electron package entry starts the server, registers bridges and loads its preload', async () => {
    const root = path.resolve(__dirname, '..');
    const entry = path.resolve(root, require('../package.json').main);
    const localRequire = createRequire(entry);
    const registered = new Set();
    let ready, windowOptions, loadedUrl, appId, appDetails, serverStarted = false;
    const windows = [];
    class BrowserWindow {
        constructor(options) {
            windowOptions = options;
            windows.push(this);
            this.webContents = {
                setZoomMode() {}, setZoomFactor() {}, setVisualZoomLevelLimits: async () => {},
                on() {}, setWindowOpenHandler() {}
            };
        }
        isDestroyed() { return false; }
        once() {}
        on() {}
        loadURL(url) { loadedUrl = url; return Promise.resolve(); }
        setAppDetails(details) { appDetails = details; }
        static getAllWindows() { return windows; }
    }
    const electron = {
        app: { whenReady: () => ({ then: callback => { ready = callback; return { catch() {} }; } }), on() {}, quit() {}, setAppUserModelId(id) { appId = id; } },
        BrowserWindow, shell: { openExternal: async () => {} }
    };
    const bridges = {
        iu: 'registerIuBridge', outlook: 'registerOutlookBridge', sync: 'registerSyncBridge'
    };
    const bridgeFiles = new Map(Object.entries(bridges).map(([name, method]) => [
        path.join(root, 'electron', 'bridges', `${name}.js`),
        { [method]: () => registered.add(name) }
    ]));
    vm.runInNewContext(fs.readFileSync(entry, 'utf8'), {
        __dirname: path.dirname(entry), process, console, setTimeout, clearTimeout,
        require: name => {
            if (name === 'electron') return electron;
            if (name === 'path' || name === 'node:path') return path;
            const resolved = localRequire.resolve(name);
            if (resolved === path.join(root, 'index.js')) { serverStarted = true; return {}; }
            if (bridgeFiles.has(resolved)) return bridgeFiles.get(resolved);
            throw new Error(`Unexpected startup dependency: ${name}`);
        }
    }, { filename: entry });
    assert.equal(typeof ready, 'function');
    await ready();
    assert.equal(serverStarted, true);
    assert.deepEqual([...registered].sort(), ['iu', 'outlook', 'sync']);
    assert.equal(windows.length, 1);
    assert.equal(loadedUrl, 'http://localhost:8080');
    assert.equal(windowOptions.title, 'Smart Study Hub - CMC University');
    assert.ok(path.isAbsolute(windowOptions.icon));
    assert.ok(fs.statSync(windowOptions.icon).isFile());
    if (process.platform === 'win32') {
        assert.equal(appId, 'vn.cmcu.smartstudyhub');
        assert.equal(appDetails.appId, appId);
        assert.equal(appDetails.appIconPath, windowOptions.icon);
        assert.equal(appDetails.relaunchDisplayName, windowOptions.title);
        assert.ok(appDetails.relaunchCommand.includes(path.resolve(root)));
    }
    assert.ok(path.isAbsolute(windowOptions.webPreferences.preload));
    assert.ok(fs.statSync(windowOptions.webPreferences.preload).isFile());
    assert.equal(windowOptions.webPreferences.contextIsolation, true);
    assert.equal(windowOptions.webPreferences.nodeIntegration, false);
    assert.equal(windowOptions.webPreferences.sandbox, true);
});
