'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('IU semester refresh retains history and never treats missing, empty or malformed schedules as deletion', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'study-timetable-history-'));
    process.env.DB_PATH = path.join(directory, 'test.db');
    const db = await require('../database')();
    t.after(async () => {
        await db.closePool();
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('study-timetable-history-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const lesson = (date, term, code = 'HISTORY') => ({ ma_mon: code, ten_mon: code, ten_lop: 'Lớp học phần',
        phong: 'A101', thu: 2, gio_bat_dau: '08:00', gio_ket_thuc: '09:00',
        ngay_bat_dau: date, ngay_ket_thuc: date, hoc_ky: term, nam_hoc: '2099-2100' });
    const profile = { ho_ten: 'History student', ten_nganh_hoc: 'IT' };
    const save = data => db.dongBoHoSoIU('HISTORY', { ...profile, ...data });
    const list = () => db.layThoiKhoaBieu('HISTORY');
    await save({ tkb: [lesson('2020-01-06', '1'), lesson('2099-01-05', '2'), lesson('2099-01-12', '2'), lesson('2099-02-02', '3')] });
    const sid = (await db.executeQuery("SELECT student_id FROM Students WHERE student_code='HISTORY'"))[0].student_id;
    const subject = (await db.executeQuery('SELECT subject_id FROM Subjects'))[0].subject_id;
    await db.themTietHoc(sid, { subjectId: subject, className: 'Personal class', room: 'B1', dayOfWeek: 2,
        startTime: '12:00', endTime: '13:00', startDate: '2099-01-05', endDate: '2099-01-05' });
    const baseline = await list();
    for (const data of [
        { tkb_range: { from: '01/01/2099', to: '31/12/2099' } },
        { tkb: [], tkb_range: { from: '01/01/2099', to: '31/12/2099' } },
        { tkb: [{ ...lesson('2099-01-05', '2'), ngay_bat_dau: '2099-02-31' }], tkb_range: { from: '01/01/2099', to: '31/12/2099' } },
        { tkb: [{ ...lesson('2099-01-05', '2'), gio_bat_dau: '' }], tkb_range: { from: '01/01/2099', to: '31/12/2099' } }
    ]) {
        const result = await save(data);
        assert.equal(result.timetable.preserved, true);
        assert.deepEqual(await list(), baseline);
    }
    const updated = { ...lesson('2099-01-05', '2'), phong: 'Updated room' };
    const snapshot = { tkb: [updated], tkb_range: { from: '01/01/2099', to: '31/12/2099' } };
    await save(snapshot);
    let rows = await list();
    assert.ok(rows.some(row => row.start_date === '2020-01-06'), 'past semester survives');
    assert.ok(rows.some(row => row.semester === '3'), 'different semester survives');
    assert.ok(rows.some(row => row.source === 'TEACHER'), 'personal class survives');
    assert.equal(rows.filter(row => row.semester === '2').length, 1, 'cancelled lesson in verified term is replaced');
    assert.equal(rows.find(row => row.semester === '2').room, 'Updated room');
    await save(snapshot);
    assert.equal((await list()).length, rows.length, 'repeated snapshots do not duplicate history');
    await save({ tkb: [lesson('2099-03-02', '4')] });
    assert.equal((await list()).length, rows.length + 1, 'unscoped data is additive');
    const state = await db.layTrangThaiThoiKhoaBieu(sid);
    assert.equal(state.status, 'updated');
    assert.ok(state.last_success_at);
    await save({ tkb: [] });
    const empty = await db.layTrangThaiThoiKhoaBieu(sid);
    assert.equal(empty.status, 'empty');
    assert.equal(empty.last_success_at, state.last_success_at);
    await db.ghiLoiDongBoThoiKhoaBieu(sid);
    const failed = await db.layTrangThaiThoiKhoaBieu(sid);
    assert.equal(failed.status, 'unavailable');
    assert.equal(failed.last_success_at, state.last_success_at);

    // A recurring row crossing the fetched interval retains both outer pieces.
    await save({ tkb: [{ ...lesson('2099-04-01', '5', 'RANGE'), ngay_ket_thuc: '2099-04-30' }] });
    await save({ tkb: [lesson('2099-04-10', '5', 'RANGE')], tkb_range: { from: '10/04/2099', to: '15/04/2099' } });
    rows = (await list()).filter(row => row.subject_code === 'RANGE');
    assert.deepEqual(rows.map(row => [row.start_date, row.end_date]).sort(), [
        ['2099-04-01', '2099-04-09'], ['2099-04-10', '2099-04-10'], ['2099-04-16', '2099-04-30']
    ]);
    await save({ tkb: [lesson('2099-05-04', '', 'LEGACY-A'), lesson('2099-06-01', '', 'LEGACY-B')] });
    await save({ tkb: [lesson('2099-05-04', '', 'LEGACY-A')], tkb_range: { from: '01/05/2099', to: '30/06/2099' } });
    assert.ok((await list()).some(row => row.subject_code === 'LEGACY-B'), 'unknown term is never erased by a different course');
});
