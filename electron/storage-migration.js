'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Source builds previously stored canvas/drafts under this Chromium origin.
// Intercept it in Electron to read that storage without contacting a server.
async function readLegacyStorage({ app, BrowserWindow, protocol }, { resetScript } = {}) {
    if (app.isPackaged || !fs.existsSync(path.join(app.getPath('userData'), 'Local Storage', 'leveldb'))) return null;
    let window;
    protocol.handle('http', request => new Response('', {
        status: new URL(request.url).origin === 'http://localhost:8080' ? 200 : 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }));
    try {
        window = new BrowserWindow({ show: false, webPreferences: {
            contextIsolation: true, nodeIntegration: false, sandbox: true
        } });
        await window.loadURL('http://localhost:8080');
        if (resetScript) await window.webContents.executeJavaScript(resetScript);
        const snapshot = await window.webContents.executeJavaScript('Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))');
        // Reset/migration markers belong to each origin independently.
        for (const key of Object.keys(snapshot)) if (key.startsWith('__studyhub_')) delete snapshot[key];
        return Object.keys(snapshot).length ? snapshot : null;
    } finally {
        if (window && !window.isDestroyed()) window.destroy();
        protocol.unhandle('http');
    }
}

function storageMigrationScript(snapshot) {
    const data = JSON.stringify(snapshot).replace(/</g, '\\u003c');
    return `(() => {
        const marker = '__studyhub_localhost_storage_migrated__';
        if (localStorage.getItem(marker)) return;
        for (const [key, value] of Object.entries(${data})) {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        }
        localStorage.setItem(marker, '1');
    })();`;
}

module.exports = { readLegacyStorage, storageMigrationScript };
