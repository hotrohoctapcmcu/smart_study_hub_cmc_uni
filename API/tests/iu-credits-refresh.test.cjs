'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

test('credit refresh persists the matching IU program, deduplicates, and keeps other student data on failures', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iu-credit-refresh-'));
    process.env.DB_PATH = path.join(directory, 'credits.db');
    const db = await require('../../database')();
    const client = require('../utils/iu-client');
    const original = client.keoNhomIU;
    const sessions = require('../utils/iu-session');
    const fixture = require('../../tests/fixtures/iu-curriculum.cjs');
    const maps = require('../../CRWEB/modules/IU/data/maps');
    let pulls = 0, mode = 'ok';
    client.keoNhomIU = async (_session, _cookie, group) => {
        assert.equal(group, 'chuongtrinh'); pulls++;
        await new Promise(resolve => setTimeout(resolve, 15));
        if (mode === 'expired') throw Object.assign(new Error('expired'), { statusCode: 401 });
        if (mode === 'failed') throw Object.assign(new Error('IU unavailable'), { statusCode: 502 });
        return { data: { IU: {
            ho_so_sinh_vien: { thong_tin_ca_nhan: { ma_sinh_vien: mode === 'mismatch' ? 'OTHER' : 'BSE250001', ho_ten: 'Portal name' } },
            goc_hoc_tap: {
                chuong_trinh: { ...maps.mapThongTinChuongTrinh(fixture.programs, fixture.portalResults, fixture.accumulated),
                    ...(mode === 'missing' ? { tong_tin_chi: null } : {}) },
                ...(mode === 'missing' ? {} : { khoi_kien_thuc: maps.mapKhoiKienThuc(fixture.portalBlocks) }),
                chuong_trinh_fetched: mode !== 'missing',
                chuong_trinh_hoc_tap: mode === 'missing' ? [] : maps.mapChuongTrinhHoc([], fixture.accumulated.rsChiTiet),
            },
        } }, thatBai: mode === 'missing' ? ['IU chưa cung cấp tổng tín chỉ.'] : [] };
    };
    const router = require('../routes/dongbo'); router.setDb(db);
    const app = express(); app.use(express.json()); app.use(router);
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(async () => {
        client.keoNhomIU = original; sessions.clearSession(1);
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        await db.closePool();
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('iu-credit-refresh-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    await db.dongBoHoSoIU('BSE250001', { ho_ten: 'Local name', ten_nganh_hoc: 'Local major', ngay_thang_nam_sinh: '01/01/2007',
        bang_diem: { HK1: { passed: { ma_mon: 'PASSED', ten_mon: 'Passed', so_tin_chi: 3, diem_tong_ket: 8, diem_chu: 'B', trang_thai: 'dat' } } } });
    const before = await db.layHoSo('BSE250001');
    const gradesBefore = await db.layBangDiem('BSE250001');
    const request = async () => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/iu/group`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nhom: 'chuongtrinh', luuDb: true }),
        });
        return { status: response.status, body: await response.json() };
    };
    assert.equal((await request()).status, 401); assert.equal(pulls, 0);
    sessions.saveSession(1, { session: { studentId: 'fixture' }, cookie: 'synthetic-only' });
    const refreshed = await Promise.all([request(), request()]);
    assert.equal(pulls, 1);
    for (const response of refreshed) {
        assert.equal(response.status, 200); assert.equal(response.body.persisted, true);
        assert.equal(response.body.totalProgramCredits, 126);
    }
    let profile = await db.layHoSo('BSE250001');
    assert.equal(profile.required_program_credits, 129);
    assert.equal(profile.available_block_credits, 203);
    assert.equal(profile.block_earned_credits, 28);
    for (const field of ['full_name', 'major', 'dob', 'total_passed_credits', 'gpa_4_scale']) assert.equal(profile[field], before[field], field);
    assert.deepEqual(await db.layBangDiem('BSE250001'), gradesBefore);
    const catalog = await db.layDanhSachMonHoc('BSE250001');
    mode = 'missing';
    assert.equal((await request()).body.totalProgramCredits, 126);
    assert.deepEqual(await db.layDanhSachMonHoc('BSE250001'), catalog);
    mode = 'mismatch'; assert.equal((await request()).status, 409);
    mode = 'failed'; assert.equal((await request()).status, 502);
    mode = 'expired'; assert.equal((await request()).status, 401);
    assert.equal(sessions.getStatus(1).connected, false);
    profile = await db.layHoSo('BSE250001');
    assert.equal(profile.total_program_credits, 126);
    assert.deepEqual(await db.layBangDiem('BSE250001'), gradesBefore);
    assert.deepEqual(await db.executeQuery('PRAGMA foreign_key_check'), []);
});
