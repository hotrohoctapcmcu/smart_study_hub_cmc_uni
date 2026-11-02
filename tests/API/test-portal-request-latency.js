'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClient(relativePath, dependencies, env = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8'), {
        module, exports: module.exports, require: name => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        }, process: { env }, fetch, AbortSignal, AbortController, URLSearchParams, setTimeout, clearTimeout,
    });
    return module.exports;
}

async function stalledBodyServer(t) {
    const server = http.createServer((_request, response) => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.flushHeaders();
        // Headers arrive, but the upstream never completes its response body.
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    return { url: `http://127.0.0.1:${server.address().port}` };
}

test('IU request timeout also aborts a stalled body after successful HTTP headers', async t => {
    const upstream = await stalledBodyServer(t);
    const client = loadClient('../../CRWEB/modules/IU/data/client.js', {
        '../payload': { buildPayload: () => ({}), setPayload: value => value, layUrl: () => upstream.url },
        '../crypto': { ma_hoa: () => 'payload', giai_ma: () => [], APIS_KEYS: [] },
    }, { IU_REQUEST_TIMEOUT_MS: '150', IU_REQUEST_RETRIES: '0' });
    await assert.rejects(client.goiIU({}, 'test-only', 'endpoint'), /timeout sau 150ms/);
});

test('EDUX requests have a body deadline even when the caller supplies an unbounded signal', async t => {
    const upstream = await stalledBodyServer(t);
    const client = loadClient('../../CRWEB/modules/EDUX/request/index.js', {
        '../login': { layCookie: () => 'test-only', API_BASE: upstream.url, ORIGIN: upstream.url },
    }, { EDUX_REQUEST_TIMEOUT_MS: '150' });
    await assert.rejects(client.goiEdux('/subjects/joined'), { name: 'TimeoutError' });
    await assert.rejects(client.goiEdux('/subjects/joined', { signal: new AbortController().signal }), { name: 'TimeoutError' });
});

test('EDUX assignments fetch three subjects concurrently while preserving source order and partial errors', async t => {
    const edux = require('../../CRWEB/modules/EDUX');
    const original = { list: edux.layHocPhan, models: edux.layChuongTrinhHoc, subjectDeadline: edux.layHanHocPhan, examDeadline: edux.layHanBaiTap };
    let release, firstBatchStarted;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { firstBatchStarted = resolve; });
    let active = 0, maximum = 0, calls = 0;
    const subjects = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `Môn ${i}` }));
    edux.layHocPhan = async () => subjects;
    edux.layHanHocPhan = async () => ({ start_time_subject: null, max_deadline: null });
    edux.layHanBaiTap = async () => ({ exam_deadline: null, status: 'no_deadline', source: null, is_available: true });
    edux.layChuongTrinhHoc = async (id, options) => {
        assert.equal(options.cookie, 'test-only');
        maximum = Math.max(maximum, ++active);
        if (++calls === 3) firstBatchStarted();
        await gate;
        active--;
        if (id === '2') throw Object.assign(new Error('temporarily unavailable'), { status: 503 });
        return [{ id: `model-${id}`, exist_exam: true, title: `Chương ${id}` }];
    };
    t.after(() => { release(); edux.layHocPhan = original.list; edux.layChuongTrinhHoc = original.models; edux.layHanHocPhan = original.subjectDeadline; edux.layHanBaiTap = original.examDeadline; });
    const pull = require('../../API/utils/edux-client').keoBaiTapEDUX('test-only');
    let timer;
    try {
        await Promise.race([started, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Subjects were fetched sequentially')), 3000);
        })]);
    } finally { clearTimeout(timer); release(); }
    const result = await pull;
    assert.equal(maximum, 3);
    assert.equal(result.subjects, 5);
    assert.deepEqual(result.assignments.map(item => item.subjectId), ['0', '1', '3', '4']);
    assert.equal(result.thatBai.length, 1);
    assert.match(result.thatBai[0], /Môn 2/);
});

test('EDUX forbidden session fails the pull instead of appearing as a partial successful empty list', async t => {
    const edux = require('../../CRWEB/modules/EDUX');
    const original = { list: edux.layHocPhan, models: edux.layChuongTrinhHoc, subjectDeadline: edux.layHanHocPhan, examDeadline: edux.layHanBaiTap };
    edux.layHocPhan = async () => [{ id: 'expired' }];
    edux.layHanHocPhan = async () => ({ start_time_subject: null, max_deadline: null });
    edux.layHanBaiTap = async () => ({ exam_deadline: null, status: 'no_deadline', source: null, is_available: true });
    edux.layChuongTrinhHoc = async () => { throw Object.assign(new Error('expired'), { status: 403 }); };
    t.after(() => { edux.layHocPhan = original.list; edux.layChuongTrinhHoc = original.models; edux.layHanHocPhan = original.subjectDeadline; edux.layHanBaiTap = original.examDeadline; });
    await assert.rejects(require('../../API/utils/edux-client').keoBaiTapEDUX('test-only'), { status: 403 });
});
