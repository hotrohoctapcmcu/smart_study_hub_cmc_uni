'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

test('real Electron loads the desktop UI and mutates local data with all TCP listeners disabled', { timeout: 60000 }, async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-study-electron-desktop-'));
    const env = { ...process.env,
        SMART_STUDY_USER_DATA: path.join(directory, 'profile'), SMART_STUDY_TEST_WINDOW: 'hidden',
        DB_PATH: path.join(directory, 'test.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
        EDUX_ACCOUNTS_PATH: path.join(directory, 'edux-accounts'),
        EDUX_COOKIE_PATH: path.join(directory, 'edux-cookie.txt'), GEMINI_SESSION_DIR: path.join(directory, 'gemini'),
        APP_USER_ID: '1', NODE_ENV: 'test', GEMINI_ENABLE_WEB_FALLBACK: 'false'
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const children = [];
    t.after(() => { for (const child of children) if (child.exitCode === null) child.kill(); });
    async function launch(extra = {}) {
        const child = spawn(require('electron'), [path.join(__dirname, 'helpers/desktop-electron-smoke.cjs'), '--disable-gpu'], {
            cwd: path.resolve(__dirname, '..'), env: { ...env, ...extra }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        children.push(child);
        let output = '';
        child.stdout.on('data', data => { output += data; });
        child.stderr.on('data', data => { output += data; });
        const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
        assert.equal(code, 0, output);
        return output;
    }
    let output = await launch();
    assert.match(output, /DESKTOP_ELECTRON_OK/);
    // The second launch owns the same temporary profile and exercises actual
    // startup deletion, storage migration and reset acknowledgement.
    require('../electron/data-management').writeRequest({ getPath: () => env.SMART_STUDY_USER_DATA }, {
        id: randomUUID(), categories: ['notes']
    });
    const restarted = await launch({ SMART_STUDY_VERIFY_RESET: '1' });
    assert.match(restarted, /DESKTOP_RESET_OK/);
    output += restarted;
    assert.doesNotMatch(output, /\[FE\] http|\[API\] http/);
    t.diagnostic(output.split(/\r?\n/).filter(line => line.startsWith('PASS ')).join('\n'));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('smart-study-electron-desktop-'));
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
