'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function collector(client, { examRequest = false } = {}) {
    const filename = path.resolve(__dirname, '../../CRWEB/modules/IU/data/fetch.js');
    const modules = {
        './client': { goiIU: client, layData: response => response.data },
        './schema': require('../../CRWEB/modules/IU/data/schema'),
        './maps': require('../../CRWEB/modules/IU/data/maps'),
        '../exam-calendar': {
            collectExamSchedule: async call => {
                if (examRequest) await call('LayTTLichThi', {});
                return { exams: [], range: { days: 70 } };
            },
        },
    };
    const context = { module: { exports: {} }, require: name => {
        assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
        return modules[name];
    } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return context.module.exports.layTatCaIU;
}

function expired(error) {
    assert.equal(error.statusCode, 401);
    assert.equal(error.code, 'SESSION_EXPIRED');
    assert.match(error.message, /đăng nhập IU lại/);
    assert.equal(error.message.includes('SECRET'), false);
    return true;
}

for (const status of [401, 403]) {
    test(`HTTP ${status} aborts IU snapshot at the first group without requesting another endpoint`, async () => {
        const calls = [];
        const collect = collector(async (_session, _cookie, endpoint) => {
            calls.push(endpoint);
            return { ok: false, status, data: null, message: 'cookie=SECRET' };
        });
        await assert.rejects(collect({}, 'test-only'), expired);
        assert.deepEqual(calls, ['LayThongTinChuongTrinhHoc']);
    });

    test(`thrown ${status} authentication errors are not hidden as partial IU results`, async () => {
        let calls = 0;
        const collect = collector(async () => {
            calls++;
            throw Object.assign(new Error('token=SECRET'), { statusCode: status });
        });
        await assert.rejects(collect({}, 'test-only'), expired);
        assert.equal(calls, 1);
    });
}

test('expired exam authentication aborts IU collection before later appeal endpoints', async () => {
    const calls = [];
    const collect = collector(async (_session, _cookie, endpoint) => {
        calls.push(endpoint);
        return endpoint === 'LayTTLichThi'
            ? { ok: false, status: 401, data: null, message: 'token=SECRET' }
            : { ok: true, status: 200, data: [] };
    }, { examRequest: true });
    await assert.rejects(collect({}, 'test-only'), expired);
    assert.equal(calls.at(-1), 'LayTTLichThi');
    assert.equal(calls.includes('LayThoiGian'), false);
    assert.equal(calls.includes('LayDSThiPhucKhaoCaNhan'), false);
});

test('non-authentication group failure stays partial and later IU groups still run', async () => {
    const calls = [];
    const collect = collector(async (_session, _cookie, endpoint) => {
        calls.push(endpoint);
        return endpoint === 'LayThongTinChuongTrinhHoc'
            ? { ok: false, status: 500, data: null, message: 'temporary failure' }
            : { ok: true, status: 200, data: [] };
    });
    const result = await collect({}, 'test-only');
    assert.equal(result.thatBai.length, 1);
    assert.match(result.thatBai[0], /LayThongTinChuongTrinhHoc: HTTP 500/);
    assert.equal(calls.at(-1), 'LayDSThiPhucKhaoCaNhan');
    assert.equal(result.data.IU.lich_thi.fetched, true);
});
