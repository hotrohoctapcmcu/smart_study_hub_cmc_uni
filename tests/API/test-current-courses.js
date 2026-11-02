'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { getCurrentCourseScope, matchCourse } = require('../../API/utils/current-courses');
const { mapSangDataIU } = require('../../API/utils/iu-client');
const { mapLichHoc } = require('../../CRWEB/modules/IU/data/maps');
const now = new Date('2026-10-28T02:00:00Z');
const row = (id, start, end = start, extra = {}) => ({
    subject_id: id, subject_code: `C${id}`, subject_name: `Môn ${id}`, source: 'IU', start_date: start, end_date: end, ...extra
});
const scope = rows => getCurrentCourseScope({ layThoiKhoaBieu: async () => rows }, 1, { now });

test('explicit current semester includes all its courses, excludes previous and future terms', async () => {
    const current = { semester: 'HK1', academic_year: '2026-2027' };
    const result = await scope([
        row(1, '2026-09-01', '2026-12-20', current),
        row(2, '2026-11-05', '2026-12-20', current),
        row(3, '2026-02-01', '2026-06-20', { semester: 'HK2', academic_year: '2025-2026' }),
        row(4, '2027-01-10', '2027-06-01', { semester: 'HK2', academic_year: '2026-2027' })
    ]);
    assert.equal(result.semester, 'HK1');
    assert.deepEqual(result.courses.map(item => item.subjectId), [1, 2]);
});

test('legacy single-lesson rows span weekends and weekdays without a lesson', async () => {
    const result = await scope([
        row(1, '2026-10-23'), row(1, '2026-11-05'),
        row(2, '2026-10-30'), row(2, '2026-11-10'),
        row(3, '2026-01-01'), row(3, '2026-05-01'),
        row(4, '2027-01-05'), row(99, '2026-10-28', '2026-10-28', { source: 'MANUAL' })
    ]);
    assert.deepEqual(result.courses.map(item => item.subjectId), [1, 2]);
});

test('no timetable is unresolved; historical-only timetable never falls back to old courses', async () => {
    assert.equal((await scope([])).resolved, false);
    const result = await scope([row(3, '2025-01-01', '2025-05-01')]);
    assert.equal(result.resolved, true);
    assert.deepEqual(result.courses, []);
});

test('scope uses Vietnam week boundaries instead of host timezone', async () => {
    const result = await getCurrentCourseScope({ layThoiKhoaBieu: async () => [row(1, '2026-10-26'), row(2, '2026-10-19')] }, 1,
        { now: new Date('2026-10-25T18:00:00Z') });
    assert.deepEqual(result.courses.map(item => item.subjectId), [1]);
});

test('matching uses real course codes or exact normalized names, never external ids or substrings', () => {
    const current = { resolved: true, courses: [{ subjectId: 1, subjectCode: 'DB01', subjectName: 'Cơ sở dữ liệu' }] };
    assert.equal(matchCourse(current, { subject_code: 'DB01', name: 'Database' }).subjectId, 1);
    assert.equal(matchCourse(current, { name: 'Co_so_du_lieu' }).subjectId, 1);
    assert.equal(matchCourse(current, { id: 1, name: 'Cơ sở dữ liệu nâng cao' }), null);
    assert.equal(matchCourse(current, { subject_code: 'SUB_123' }), null);
    assert.equal(matchCourse({ resolved: false }, { name: 'Cơ sở dữ liệu' }), null);
    assert.equal(matchCourse(current, { name: 'Cơ sở dữ liệu - K4' }).subjectId, 1);
    assert.equal(matchCourse(current, { name: 'Cơ sở dữ liệu (Khóa 4)' }).subjectId, 1);
    assert.equal(matchCourse({ resolved: true, courses: [{ subjectId: 1, subjectName: 'Cơ sở dữ liệu - K4' }] }, { name: 'Cơ sở dữ liệu - K5' }), null);
});

test('IU mapping retains semester metadata and distinguishes failed from successful empty timetable', () => {
    const rows = mapLichHoc([{ HOCKY: 'HK1', NAMHOC: '2026-2027', NGAYHOC: '28/10/2026', TENHOCPHAN: 'CSDL' }]);
    const mapped = mapSangDataIU({ IU: { lich_hoc: { fetched: true, chi_tiet_thoi_khoa_bieu: rows } } });
    assert.equal(mapped.tkb[0].hoc_ky, 'HK1');
    assert.equal(mapped.tkb[0].nam_hoc, '2026-2027');
    assert.equal('tkb' in mapSangDataIU({ IU: { lich_hoc: { fetched: false, chi_tiet_thoi_khoa_bieu: [] } } }), false);
    assert.deepEqual(mapSangDataIU({ IU: { lich_hoc: { fetched: true, chi_tiet_thoi_khoa_bieu: [] } } }).tkb, []);
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-course-scope-'));
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');
let database;
after(async () => {
    if (database) await database.closePool();
    assert.ok(path.resolve(tempDir).startsWith(path.join(path.resolve(os.tmpdir()), 'unistudy-course-scope-')));
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('scoped EDUX updates preserve historical assignments and survive database reopen', async () => {
    database = await require('../../database')();
    const item = (id, subject) => ({ id, title: 'Chương 1', subject, subjectId: subject, status: 'Chưa làm' });
    await database.luuBaiTapEDUX(1, [item('edux-old', 'Môn cũ')]);
    await database.luuBaiTapEDUX(1, [item('edux-current', 'Môn hiện tại')], { preserveExisting: true });
    assert.equal((await database.layBaiTapEDUX(1)).length, 2);
    await database.closePool();
    database = await require('../../database')();
    assert.equal((await database.layBaiTapEDUX(1)).length, 2);
});

test('successful empty IU refresh clears only remote lessons in coverage and failure keeps data', async () => {
    database ||= await require('../../database')();
    const base = { ho_ten: 'Test', ten_nganh_hoc: 'CNTT', tkb: [{
        ma_mon: 'C1', ten_mon: 'Môn 1', ten_lop: 'A', phong: 'A1', co_so: 'CMC', thu: 4,
        gio_bat_dau: '07:30', gio_ket_thuc: '09:30', ngay_bat_dau: '28/10/2026', ngay_ket_thuc: '28/10/2026'
    }, { ma_mon: 'C2', ten_mon: 'Môn cũ', ten_lop: 'B', phong: 'A2', co_so: 'CMC', thu: 4,
        gio_bat_dau: '07:30', gio_ket_thuc: '09:30', ngay_bat_dau: '01/04/2026', ngay_ket_thuc: '01/04/2026' }] };
    await database.dongBoHoSoIU('TEST01', base);
    let rows = await database.layThoiKhoaBieu(1);
    assert.equal(rows.length, 2);
    const { tkb, ...failed } = base;
    await database.dongBoHoSoIU('TEST01', failed);
    assert.equal((await database.layThoiKhoaBieu(1)).length, 2);
    await database.executeQuery(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,source)
        SELECT student_id,subject_id,'Manual','M','CMC',4,'12:00','13:00','2026-10-28','2026-10-28','MANUAL' FROM Timetables LIMIT 1`);
    await database.dongBoHoSoIU('TEST01', { ...failed, tkb: [], tkb_range: { from: '01/09/2026', to: '31/08/2027' } });
    rows = await database.layThoiKhoaBieu(1);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(item => item.source === 'MANUAL').length, 1);
    assert.equal(rows.filter(item => item.source === 'IU')[0].subject_code, 'C2');
});
