'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createPortalWorkflow } = require('../../CRWEB/shared/portal-workflow');
const { registerSyncBridge } = require('../../electron/bridges/sync');

test('EDUX nonpersistent login retains only its cookie in memory and logout clears it', async () => {
    const filename = path.resolve(__dirname, '../../CRWEB/modules/EDUX/login/index.js');
    const files = new Map();
    const writes = [];
    const taskEnv = { EDUX_COOKIE: 'session=old-env' };
    const fakeFs = {
        existsSync: name => files.has(name), readFileSync: name => files.get(name),
        mkdirSync: () => {}, writeFileSync: (name, value) => { writes.push(name); files.set(name, value); },
        rmSync: name => files.delete(name)
    };
    const exported = { exports: {} };
    const context = {
        module: exported, exports: exported.exports, __dirname: path.dirname(filename),
        process: { env: taskEnv }, AbortSignal,
        require: name => name === 'node:fs' ? fakeFs : name === 'node:path' ? path : require('../../CRWEB/modules/EDUX/utils'),
        fetch: async (_url, request) => {
            assert.deepEqual(JSON.parse(request.body), { email: 'student@example.test', password: 'PASSWORD_SECRET' });
            return { ok: true, text: async () => '{}', headers: { getSetCookie: () => ['session=fresh; Path=/; HttpOnly'] } };
        }
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    const provider = exported.exports;
    const result = await provider.loginEdux({ email: 'student@example.test', password: 'PASSWORD_SECRET', luu: false });
    assert.equal(provider.layCookie(), result.cookie);
    assert.match(provider.layCookie(), /session=fresh/);
    assert.equal(writes.length, 0);
    assert.equal(JSON.stringify(result).includes('PASSWORD_SECRET'), false);
    provider.luuCookie('session=updated');
    assert.equal(provider.layCookie(), 'session=updated');
    assert.equal(writes.length, 1);
    provider.logoutEdux();
    assert.equal(files.size, 0);
    assert.equal(provider.docCookie(), '');
    assert.equal(taskEnv.EDUX_COOKIE, undefined);
    assert.throws(() => provider.layCookie(), /Chua co cookie/);
});

test('partial sync reports only warning counts and continues other providers', async () => {
    const calls = [];
    const workflow = createPortalWorkflow(Object.fromEntries(['iu', 'edux', 'outlook'].map(source => [source, {
        sync: async () => { calls.push(source); return source === 'iu' ? { thatBai: ['cookie=SECRET', 'password=SECRET'] } : {}; }
    }])));
    const result = await workflow.syncAll();
    assert.equal(result.ok, false);
    assert.deepEqual(calls, ['iu', 'edux', 'outlook']);
    assert.equal(result.results.iu.partial, true);
    assert.equal(result.results.iu.synced, true);
    assert.equal(result.results.iu.warningCount, 2);
    assert.equal(result.results.edux.ok, true);
    assert.equal(result.results.outlook.ok, true);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('authenticates independently, skips connected portals and isolates cancellation without secrets', async () => {
    const calls = [];
    const workflow = createPortalWorkflow({
        iu: { status: async () => ({ connected: true }), connect: async () => calls.push('unexpected') },
        edux: { connect: async () => { calls.push('edux'); throw new Error('password=SECRET'); } },
        outlook: { connect: async () => { calls.push('outlook'); return { cookie: 'SECRET' }; } }
    });
    const result = await workflow.connectAll();
    assert.deepEqual(calls, ['edux', 'outlook']);
    assert.equal(result.ok, false);
    assert.equal(result.results.iu.connected, true);
    assert.equal(result.results.edux.ok, false);
    assert.equal(result.results.outlook.ok, true);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('Outlook connection failures expose actionable allowlisted diagnoses without raw portal secrets', async () => {
    const cases = [
        ['OUTLOOK_LOGIN_REQUIRED', 401, true, /đăng nhập tài khoản trường/],
        ['OUTLOOK_ACCESS_DENIED', 403, true, /Mail.Read/],
        ['OUTLOOK_LOGIN_CANCELLED', 409, undefined, /hủy cửa sổ Outlook/],
        ['OUTLOOK_LOGIN_TIMEOUT', 504, undefined, /thời gian chờ/],
        ['OUTLOOK_NETWORK_ERROR', 502, undefined, /outlook.office.com/],
        ['OUTLOOK_CAPTURE_UNAVAILABLE', 503, undefined, /khởi tạo/],
        ['OUTLOOK_ELECTRON_REQUIRED', 409, undefined, /ứng dụng máy tính/],
        ['OUTLOOK_INVALID_RESPONSE', 502, undefined, /dữ liệu email/]
    ];
    for (const [code, statusCode, requiresLogin, message] of cases) {
        const updates = [];
        const workflow = createPortalWorkflow({
            iu: { status: () => ({ connected: true }) },
            edux: { status: () => ({ connected: true }) },
            outlook: { connect: () => { throw Object.assign(new Error('cookie=SECRET; Bearer SECRET'), {
                code, statusCode: 999, response: { password: 'SECRET' }
            }); } }
        });
        const result = await workflow.connectAll({ onProgress: state => updates.push(state) });
        assert.equal(result.results.outlook.code, code);
        assert.equal(result.results.outlook.statusCode, statusCode);
        assert.equal(result.results.outlook.requiresLogin, requiresLogin);
        assert.match(result.results.outlook.message, message);
        assert.equal(result.results.iu.ok, true);
        assert.equal(result.results.edux.ok, true);
        assert.equal(JSON.stringify([result, updates]).includes('SECRET'), false);
    }
});

test('unknown Outlook error codes remain private and cannot inject prototype values', async () => {
    for (const code of ['UNKNOWN_SECRET', '__proto__', 'constructor']) {
        const workflow = createPortalWorkflow({
            iu: { status: () => ({ connected: true }) },
            edux: { status: () => ({ connected: true }) },
            outlook: { connect: () => { throw Object.assign(new Error('cookie=SECRET'), { code }); } }
        });
        const result = await workflow.connectAll();
        assert.match(result.results.outlook.message, /Không thể kết nối OUTLOOK/);
        assert.equal(result.results.outlook.code, undefined);
        assert.equal(JSON.stringify(result).includes('SECRET'), false);
    }
});

test('a stalled status check cannot block other portals and duplicate observers receive sanitized progress', async () => {
    let statusSignal;
    const firstUpdates = [], secondUpdates = [];
    const workflow = createPortalWorkflow({
        iu: { status: ({ signal }) => { statusSignal = signal; return new Promise(() => {}); }, connect: () => assert.fail('unreachable') },
        edux: { connect: async () => ({ cookie: 'SECRET' }) },
        outlook: { connect: async () => ({ cookie: 'SECRET' }) }
    });
    const first = workflow.connectAll({ statusTimeoutMs: 25, onProgress: state => firstUpdates.push(state) });
    assert.equal(first, workflow.connectAll({ onProgress: state => secondUpdates.push(state) }));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(firstUpdates.some(state => state.results.edux.connected && state.results.iu.status === 'CHECKING'));
    assert.ok(secondUpdates.some(state => state.results.outlook.connected));
    const result = await first;
    assert.equal(statusSignal.aborted, true);
    assert.equal(result.results.iu.code, 'connection_timeout');
    assert.equal(result.results.edux.connected, true);
    assert.equal(result.results.outlook.connected, true);
    assert.equal(JSON.stringify([result, firstUpdates, secondUpdates]).includes('SECRET'), false);
});

test('connection deadline aborts its provider, releases deduplication and ignores late completion', async () => {
    let resolveLate, signal;
    const updates = [];
    let attempts = 0;
    const workflow = createPortalWorkflow({
        iu: { connect: opts => { attempts++; signal = opts.signal; return attempts === 1 ? new Promise(resolve => { resolveLate = resolve; }) : { connected: true }; } },
        edux: { status: () => ({ connected: true }) },
        outlook: { status: () => ({ connected: true }) }
    });
    const result = await workflow.connectAll({ iu: { timeoutMs: 10 }, onProgress: state => updates.push(state) });
    assert.equal(result.results.iu.code, 'connection_timeout');
    assert.equal(signal.aborted, true);
    const updateCount = updates.length;
    resolveLate({ connected: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(updates.length, updateCount);
    assert.equal(result.results.iu.status, 'FAILED');
    assert.equal((await workflow.connectAll()).ok, true);
    assert.equal(attempts, 2);
});

test('nonfinite and overflowing timeout options never become one-millisecond timers', async () => {
    for (const value of [Infinity, -1, NaN, 2 ** 40]) {
        const budgets = {};
        const workflow = createPortalWorkflow(Object.fromEntries(['iu', 'edux', 'outlook'].map(source => [source, {
            status: async () => { await new Promise(resolve => setTimeout(resolve, 4)); return { connected: false }; },
            connect: async options => {
                budgets[source] = options.timeoutMs;
                await new Promise(resolve => setTimeout(resolve, 4));
                return { connected: true };
            }
        }])));
        const result = await workflow.connectAll({
            statusTimeoutMs: value, iu: { timeoutMs: value }, edux: { timeoutMs: value }, outlook: { timeoutMs: value }
        });
        assert.equal(result.ok, true);
        assert.deepEqual(budgets, { iu: 180000, edux: 45000, outlook: 180000 });
    }
});

test('duplicate callers share authentication and sync keeps IU before dependent providers', async () => {
    const calls = [];
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    const adapters = Object.fromEntries(['iu', 'edux', 'outlook'].map(source => [source, {
        connect: async () => { calls.push(`connect:${source}`); if (source === 'iu') await ready; },
        sync: async () => calls.push(`sync:${source}`)
    }]));
    const workflow = createPortalWorkflow(adapters);
    const first = workflow.connectAll();
    assert.equal(first, workflow.connectAll());
    release();
    await first;
    assert.deepEqual(calls, ['connect:iu', 'connect:edux', 'connect:outlook']);
    calls.length = 0;
    const result = await workflow.syncAll();
    assert.equal(result.ok, true);
    assert.ok(calls.indexOf('sync:iu') < calls.indexOf('sync:edux'));
    assert.ok(calls.indexOf('sync:iu') < calls.indexOf('sync:outlook'));
});

test('IPC rejects untrusted origins, continues after missing EDUX credentials and never returns cookies', async () => {
    const handlers = new Map();
    let iuCalls = 0, outlookCalls = 0;
    registerSyncBridge({
        electron: { ipcMain: { handle: (name, fn) => handlers.set(name, fn) } },
        fetchImpl: async url => ({ ok: true, json: async () => ({ connected: false }) }),
        connectIU: async () => { iuCalls++; return { ok: true, cookie: 'SECRET' }; },
        outlook: { status: () => ({ connected: false }), connect: async () => { outlookCalls++; return { cookie: 'SECRET' }; } }
    });
    const invoke = handlers.get('sync:connect-all');
    for (const url of ['https://evil.example:8080', 'http://localhost:8081', 'file:///app', 'https://localhost:8080']) {
        assert.throws(() => invoke({ senderFrame: { url } }), /không hợp lệ/);
    }
    assert.equal(iuCalls, 0);
    const result = await invoke({ senderFrame: { url: 'http://localhost:8080/sync' } });
    assert.equal(result.results.edux.code, 'credentials_required');
    assert.equal(result.results.iu.ok, true);
    assert.equal(result.results.outlook.ok, true);
    assert.equal(iuCalls, 1);
    assert.equal(outlookCalls, 1);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('sync-only orchestration isolates failure and honors selected sources without authentication', async () => {
    const calls = [];
    const workflow = createPortalWorkflow({
        iu: { connect: () => assert.fail('must not authenticate'), sync: async () => { calls.push('iu'); throw Object.assign(new Error('secret'), { statusCode: 401 }); } },
        edux: { sync: async () => { calls.push('edux'); } },
        outlook: { sync: async () => { calls.push('outlook'); } }
    });
    const result = await workflow.syncAll({ sources: ['OUTLOOK', 'IU'] });
    assert.deepEqual(calls, ['iu', 'outlook']);
    assert.deepEqual(Object.keys(result.results), ['iu', 'outlook']);
    assert.equal(result.results.iu.statusCode, 401);
    assert.equal(result.results.outlook.ok, true);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('IPC registers EDUX session only when needed and skips all existing connections', async () => {
    const handlers = new Map(), requests = [];
    let connected = false;
    registerSyncBridge({
        electron: { ipcMain: { handle: (name, fn) => handlers.set(name, fn) } },
        fetchImpl: async (url, options) => {
            requests.push({ url, options });
            return { ok: true, json: async () => ({ success: true, data: { connected: options.method === 'POST' || connected } }) };
        },
        connectIU: async () => ({ ok: true }),
        outlook: { status: () => ({ connected: true }), connect: () => { throw new Error('unexpected'); } }
    });
    const invoke = handlers.get('sync:connect-all');
    const event = { senderFrame: { url: 'http://127.0.0.1:8080/sync' } };
    const result = await invoke(event, { edux: { email: ' student@example.test ', password: 'SECRET' } });
    assert.equal(result.ok, true);
    const post = requests.find(request => request.options.method === 'POST');
    assert.deepEqual(JSON.parse(post.options.body), { email: 'student@example.test', password: 'SECRET' });
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
    connected = true;
    requests.length = 0;
    assert.equal((await invoke(event)).ok, true);
    assert.equal(requests.some(request => request.options.method === 'POST'), false);
});

test('IPC delivers connection progress only to its invoking frame and forwards native abort signal', async () => {
    const handlers = new Map(), sent = [];
    let iuSignal, outlookSignal;
    registerSyncBridge({
        electron: { ipcMain: { handle: (name, fn) => handlers.set(name, fn) } },
        fetchImpl: async () => ({ ok: true, json: async () => ({ connected: false }) }),
        connectIU: async ({ signal }) => { iuSignal = signal; return { cookie: 'SECRET' }; },
        outlook: { status: () => ({ connected: false }), connect: async ({ signal }) => { outlookSignal = signal; return { accessToken: 'SECRET' }; } }
    });
    const event = { senderFrame: { url: 'http://localhost:8080/sync', send: (channel, state) => sent.push({ channel, state }) } };
    await handlers.get('sync:connect-all')(event);
    assert.equal(iuSignal instanceof AbortSignal, true);
    assert.equal(outlookSignal instanceof AbortSignal, true);
    assert.ok(sent.length > 3);
    assert.ok(sent.every(item => item.channel === 'sync:connection-progress'));
    assert.ok(sent.some(item => item.state.results.iu.status === 'CONNECTED'));
    assert.equal(JSON.stringify(sent).includes('SECRET'), false);
});

test('preload progress subscription strips IPC event and removes the exact listener', () => {
    const exposed = new Map(), handlers = new Map();
    const electron = {
        contextBridge: { exposeInMainWorld: (name, value) => exposed.set(name, value) },
        ipcRenderer: {
            on: (channel, listener) => handlers.set(channel, listener),
            removeListener: (channel, listener) => { assert.equal(handlers.get(channel), listener); handlers.delete(channel); },
            invoke: () => Promise.resolve({})
        }
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../electron/preload.js'), 'utf8'), {
        require: name => { assert.equal(name, 'electron'); return electron; }
    });
    let received;
    const unsubscribe = exposed.get('__uniStudySync').onConnectionProgress(state => { received = state; });
    const state = { results: { iu: { status: 'CONNECTED' } } };
    handlers.get('sync:connection-progress')({ sender: 'private IPC event' }, state);
    assert.equal(received, state);
    unsubscribe();
    assert.equal(handlers.size, 0);
});
