'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createEduxAccounts } = require('../../API/utils/edux-account');

function fixture(t, overrides = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-edux-account-'));
    t.after(() => {
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const entries = new Map();
    const sessions = { getSession: id => entries.get(id) || null, clearSession: id => entries.delete(id),
        saveSession: (id, session) => { entries.set(id, session); return { connected: true, email: session.email }; } };
    let calls = 0;
    const login = async ({ email }) => { calls++; return { cookie: 'test-only-session', email }; };
    const options = { directory, sessions, login, ...overrides };
    return { directory, sessions, options, manager: createEduxAccounts(options), calls: () => calls };
}

test('successful login remembers the local account and restores it after a process restart', async t => {
    const { directory, manager, sessions, options, calls } = fixture(t);
    const credentials = { email: 'local@example.test', password: 'local-test-password' };
    const status = await manager.connect(1, credentials);
    assert.deepEqual(status, { connected: true, email: credentials.email });
    assert.ok(!JSON.stringify(status).includes(credentials.password));
    assert.ok(!JSON.stringify(sessions.getSession(1)).includes(credentials.password));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, '1.json'), 'utf8')), credentials);
    sessions.clearSession(1);
    const restarted = createEduxAccounts(options);
    const [first, second] = await Promise.all([restarted.restore(1), restarted.restore(1)]);
    assert.equal(first.cookie, 'test-only-session'); assert.deepEqual(second, first); assert.equal(calls(), 2);
    restarted.disconnect(1);
    assert.equal(fs.existsSync(path.join(directory, '1.json')), false);
    assert.equal(await createEduxAccounts(options).restore(1), null);
});

test('failed login cannot overwrite a saved account; failed automatic restore is throttled', async t => {
    let failed = false, calls = 0, now = 100000;
    const { manager, directory, sessions } = fixture(t, { clock: () => now, login: async ({ email }) => {
        calls++; if (failed) throw Object.assign(new Error('upstream unavailable'), { statusCode: 401 });
        return { cookie: 'test', email };
    } });
    await manager.connect(1, { email: 'saved@example.test', password: 'saved-test-password' });
    failed = true;
    await assert.rejects(manager.connect(1, { email: 'wrong@example.test', password: 'wrong' }), { statusCode: 401 });
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, '1.json'))).email, 'saved@example.test');
    assert.equal(sessions.getSession(1), null);
    assert.equal(await manager.restore(1), null);
    assert.equal(await manager.restore(1), null); assert.equal(calls, 3);
    now += 30001; await manager.restore(1); assert.equal(calls, 4);
});

test('disconnect during an in-flight restore cannot reconnect or recreate the saved account', async t => {
    let release, wait = false;
    const { manager, sessions, directory } = fixture(t, { login: async ({ email }) => {
        if (wait) await new Promise(resolve => { release = resolve; });
        return { email, cookie: 'test' };
    } });
    await manager.connect(1, { email: 'local@example.test', password: 'test-only' });
    sessions.clearSession(1); wait = true;
    const restoring = manager.restore(1);
    manager.disconnect(1); release();
    assert.equal(await restoring, null);
    assert.equal(sessions.getSession(1), null);
    assert.equal(fs.existsSync(path.join(directory, '1.json')), false);
});

test('an older saved-account restore cannot replace a newly connected account', async t => {
    const release = {}; let wait = false;
    const { manager, sessions } = fixture(t, { login: async ({ email }) => {
        if (wait) await new Promise(resolve => { release[email] = resolve; });
        return { email, cookie: email };
    } });
    await manager.connect(1, { email: 'old@example.test', password: 'old-test-password' });
    sessions.clearSession(1); wait = true;
    const connecting = manager.connect(1, { email: 'new@example.test', password: 'new-test-password' });
    const restoring = manager.restore(1);
    release['new@example.test'](); await connecting;
    release['old@example.test'](); await restoring;
    assert.equal(sessions.getSession(1).email, 'new@example.test');
});
