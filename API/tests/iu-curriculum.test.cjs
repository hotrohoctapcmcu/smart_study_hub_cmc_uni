'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const fixture = require('../../tests/fixtures/iu-curriculum.cjs');
const maps = require('../../CRWEB/modules/IU/data/maps');
const { mapSangDataIU } = require('../utils/iu-client');

function collector({ failCatalog = false, failResults = false, programs = fixture.programs, method = 'layTatCaIU', calls = [] } = {}) {
    const filename = path.resolve(__dirname, '../../CRWEB/modules/IU/data/fetch.js');
    const responses = { LayThongTinChuongTrinhHoc: programs, KetQuaHocTapCaNhan: fixture.results,
        LayKetQuaTichLuyTheoKhoi: fixture.accumulated };
    const dependencies = {
        './client': { goiIU: async (_session, _cookie, endpoint) => {
            calls.push(endpoint);
            return failCatalog && endpoint === 'LayKetQuaTichLuyTheoKhoi' || failResults && endpoint === 'KetQuaHocTapCaNhan'
                ? { ok: false, status: 503, data: null } : { ok: true, status: 200, data: responses[endpoint] || [] };
        }, layData: result => result.data },
        './schema': require('../../CRWEB/modules/IU/data/schema'), './maps': maps,
        '../exam-calendar': { collectExamSchedule: async () => ({ exams: [], range: { days: 70 } }) },
    };
    const context = { module: { exports: {} }, require: name => { assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name]; } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return context.module.exports[method];
}

test('profile credit refresh collects only program data and preserves failed catalogs', async () => {
    const calls = [];
    const refresh = collector({ method: 'layDuLieuChuongTrinh', calls });
    const result = await refresh({}, 'synthetic-only');
    const mapped = mapSangDataIU(result.data);
    assert.deepEqual(calls.sort(), ['KetQuaHocTapCaNhan', 'LayKetQuaTichLuyTheoKhoi', 'LayThongTinChuongTrinhHoc'].sort());
    assert.equal(mapped.MSV, 'BSE250001');
    assert.equal(mapped.chuong_trinh.tong_tin_chi, 126);
    assert.equal(mapped.hoc_phan_chuong_trinh.length, 5);
    assert.equal(Object.hasOwn(mapped, 'tkb'), false);
    assert.equal(Object.hasOwn(mapped, 'lich_thi'), false);
    assert.deepEqual(Object.keys(mapped.bang_diem), []);
    const partial = await collector({ method: 'layDuLieuChuongTrinh', failCatalog: true })({}, 'synthetic-only');
    assert.equal(mapSangDataIU(partial.data).chuong_trinh.tong_tin_chi, 126);
    assert.equal(Object.hasOwn(mapSangDataIU(partial.data), 'hoc_phan_chuong_trinh'), false);
    assert.equal(partial.thatBai.length, 1);
    await assert.rejects(collector({ method: 'layDuLieuChuongTrinh', failResults: true })({}, 'synthetic-only'), /KetQuaHocTapCaNhan/);
    await assert.rejects(collector({ method: 'layDuLieuChuongTrinh', programs: [] })({}, 'synthetic-only'), /chương trình học/);
});

test('IU collector maps rsChiTiet even when the program dropdown is nonempty; catalog never becomes grades', async () => {
    const { data, thatBai } = await collector()({}, 'synthetic-only');
    assert.equal(thatBai.length, 0);
    const mapped = mapSangDataIU(data);
    assert.equal(mapped.chuong_trinh.tong_tin_chi, 126);
    assert.equal(mapped.hoc_phan_chuong_trinh.length, 5);
    assert.equal(mapped.hoc_phan_chuong_trinh.find(row => row.ma_mon === 'INFO2011').so_tin_chi, 4);
    assert.equal(mapped.khoi_kien_thuc[0].tong_tin_chi, 203);
    assert.equal(Object.keys(mapped.bang_diem).length, 0);
    assert.equal(Object.hasOwn(mapped.hoc_phan_chuong_trinh[0], 'diem_tong_ket'), false);
    assert.equal(maps.mapChuongTrinhHoc(fixture.programs, []).length, 0);
    assert.equal(maps.mapChuongTrinhHoc(fixture.programs).length, 0);
});

test('only official program-level credit totals qualify; blocks, subjects and conflicting totals do not', () => {
    const map = (programs, results, accumulated, id = 'PROGRAM-K4') => maps.mapThongTinChuongTrinh(programs, results, accumulated, id);
    const official = map(fixture.programs, fixture.results, fixture.accumulated);
    assert.equal(official.tong_tin_chi, 126);
    assert.match(official.nguon_tong_tin_chi, /rsThongTinNguoiHoc\[0\]\.TONGSOHOCTRINH$/);
    assert.equal(map(fixture.programs, {}, fixture.accumulated).tong_tin_chi, null);
    assert.equal(map(fixture.programs, { rsThongKeHocKy: [{ TONGTINCHI: 28 }] }, { TONGTINCHI: 203 }).tong_tin_chi, null,
        'unrelated singleton summaries and a block-result root total are not official program denominators');
    assert.equal(map(fixture.programs, { rsTongHop: [{ TONGSOHOCTRINH: 203 }], rsDiemKetThucHocPhan: [{ TONGSOHOCTRINH: 129 }] }, {}).tong_tin_chi, null);
    assert.equal(map([{ ...fixture.programs[0], TONGTINCHI: 129 }], fixture.results, {}).tong_tin_chi, null, 'ambiguous totals must not silently select a denominator');
    assert.equal(map([{ ...fixture.programs[0], TONGTINCHI: 129 }], { TOTAL_PROGRAM_CREDITS: '126,0' }, {}).tong_tin_chi, 126, 'an explicit program field wins over a generic total');
    assert.equal(map([{ ...fixture.programs[0], TONGTINCHI: 126 }], {}, {}, 'OTHER').tong_tin_chi, null, 'a different selected program cannot borrow the first dropdown total');
    for (const value of ['', null, -1, 'not-a-number', true, 0]) assert.equal(map([{ ...fixture.programs[0], TONGTINCHI: value }], {}, {}).tong_tin_chi, null);
});

test('diemhoc source fields distinguish 126 program credits from 129 required, 203 offered and 28 block-earned credits', () => {
    const program = maps.mapThongTinChuongTrinh(fixture.programs, fixture.portalResults, { rsTongHop: fixture.portalBlocks });
    assert.equal(program.tong_tin_chi, 126);
    assert.equal(program.nguon_tong_tin_chi, 'KetQuaHocTapCaNhan.rsDiemTrungBinhChung[2].TONGSOTINCHICTDT');
    assert.equal(maps.mapThongTinChuongTrinh([{ ...fixture.programs[0], TONGTINCHI: 129 }], fixture.portalResults, {}).tong_tin_chi, 126);
    for (const row of fixture.portalResults.rsDiemTrungBinhChung.filter((_row, index) => index !== 2)) {
        assert.equal(maps.mapThongTinChuongTrinh(fixture.programs, { rsDiemTrungBinhChung: [row] }, {}).tong_tin_chi, null);
    }
    const blocks = maps.mapKhoiKienThuc(fixture.portalBlocks);
    assert.equal(blocks.reduce((sum, row) => sum + row.tong_tin_chi, 0), 203);
    assert.equal(blocks.reduce((sum, row) => sum + row.tin_chi_bat_buoc, 0), 129);
    assert.equal(blocks.reduce((sum, row) => sum + row.tin_chi_dat, 0), 28);
    assert.equal(blocks.find(row => row.ma === 'ENG').tin_chi_bat_buoc, 0);
    assert.equal(maps.mapKhoiKienThuc([{ MAKHOI: 'UNKNOWN' }])[0].tin_chi_dat, null);
});

test('a failed curriculum group is omitted from the database adapter, including an empty schema default', async () => {
    const { data, thatBai } = await collector({ failCatalog: true })({}, 'synthetic-only');
    assert.equal(thatBai.length, 1);
    assert.equal(data.IU.goc_hoc_tap.chuong_trinh_fetched, false);
    assert.equal(Object.hasOwn(mapSangDataIU(data), 'hoc_phan_chuong_trinh'), false);
    assert.equal(Object.hasOwn(mapSangDataIU(require('../../CRWEB/modules/IU/data/schema').schemaRong()), 'hoc_phan_chuong_trinh'), false);
});

test('curriculum persists by student/program, survives partial sync, and leaves grades/current course scope intact', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iu-curriculum-'));
    process.env.DB_PATH = path.join(directory, 'curriculum.db');
    let db;
    t.after(async () => {
        await db?.closePool();
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('iu-curriculum-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    db = await require('../../database')();
    const pool = await db.getPool();
    const { migrateCurriculum } = require('../../database/migrations/curriculumMigration');
    migrateCurriculum(pool); migrateCurriculum(pool);
    const { data } = await collector()({}, 'synthetic-only');
    const mapped = mapSangDataIU(data);
    const transcript = require('../../tests/fixtures/iu-grade-transcript.cjs');
    const portal = transcript.map(row => ({ DAOTAO_HOCPHAN_ID: row.subject_code, DAOTAO_HOCPHAN_MA: row.subject_code,
        DAOTAO_HOCPHAN_TEN: row.subject_name, DAOTAO_HOCPHAN_HOCTRINH: row.credits, DIEM: row.final_score,
        DIEMQUYDOI: row.score_4, DIEMQUYDOI_TEN: row.letter_grade, HOCKY: row.semester[0], NAMHOC: '2025_2026', LANHOC: row.attempt_number, LANTHI: 1,
        DANHGIA_TEN: row.is_passed ? 'Đạt' : 'Không đạt' }));
    const withGrades = mapSangDataIU({ IU: { ...data.IU, goc_hoc_tap: { ...data.IU.goc_hoc_tap,
        tra_cuu_diem: { bang_diem: maps.mapBangDiem(portal, []) } } } });
    for (let i = 0; i < 2; i++) await db.dongBoHoSoIU('BSE250001', withGrades);
    let profile = await db.layHoSo('BSE250001');
    assert.equal(profile.total_program_credits, 126); assert.equal(profile.total_passed_credits, 25);
    assert.equal(profile.gpa_4_scale, 2.52); assert.equal(profile.program_name, fixture.programs[0].TEN);
    assert.equal(profile.knowledge_blocks[0].tong_tin_chi, 203);
    let subjects = await db.layDanhSachMonHoc('BSE250001');
    assert.equal(subjects.filter(row => row.curriculum_source === 'IU').length, 5);
    assert.equal(subjects.find(row => row.subject_code === 'ZERO').credits, 0);
    assert.equal(subjects.find(row => row.subject_code === 'UNKNOWN').credits, null);
    assert.equal(subjects.find(row => row.subject_code === 'SENG3009').status, 'PLANNED');
    assert.equal((await db.layBangDiem('BSE250001')).length, 14);
    const { getCurrentCourseScope } = require('../utils/current-courses');
    assert.equal((await getCurrentCourseScope(db, profile.student_id)).resolved, false, 'future catalog is not current enrollment');
    await db.dongBoHoSoIU('BSE250002', { ho_ten: 'Other student', chuong_trinh: { ma: 'OTHER', tong_tin_chi: 140 },
        hoc_phan_chuong_trinh: [{ ma_mon: 'OTHER', ten_mon: 'Other program course', so_tin_chi: 5 }] });
    assert.equal((await db.layDanhSachMonHoc('BSE250001')).some(row => row.subject_code === 'OTHER'), false);
    assert.deepEqual((await db.layDanhSachMonHoc('BSE250002')).map(row => row.subject_code), ['OTHER']);
    assert.equal((await db.layHoSo('BSE250002')).total_program_credits, 140);
    const failed = mapSangDataIU((await collector({ failCatalog: true })({}, 'synthetic-only')).data);
    failed.chuong_trinh.tong_tin_chi = null;
    await db.dongBoHoSoIU('BSE250001', failed);
    assert.equal((await db.layHoSo('BSE250001')).total_program_credits, 126);
    assert.equal((await db.layDanhSachMonHoc('BSE250001')).filter(row => row.curriculum_source === 'IU').length, 5);
    await db.dongBoHoSoIU('BSE250001', { ...mapped, chuong_trinh: { ma: 'SECOND', ten: 'Second program' },
        hoc_phan_chuong_trinh: [{ ma_mon: 'SAME-NAME', ten_mon: fixture.accumulated.rsChiTiet[0].DAOTAO_HOCPHAN_TEN, so_tin_chi: 4 }] });
    profile = await db.layHoSo('BSE250001');
    assert.equal(profile.total_program_credits, null, 'changing program cannot retain the old denominator');
    subjects = await db.layDanhSachMonHoc('BSE250001');
    assert.equal(subjects.some(row => row.subject_code === 'SENG3009'), false, 'the prior program catalog is no longer current');
    assert.ok(subjects.some(row => row.subject_code === 'SAME-NAME'), 'real course codes distinguish courses sharing a title');
    await db.dongBoHoSoIU('BSE250001', { ...mapped, hoc_phan_chuong_trinh: [] });
    assert.equal((await db.layHoSo('BSE250001')).total_program_credits, 126);
    assert.equal((await db.layDanhSachMonHoc('BSE250001')).filter(row => row.curriculum_source === 'IU').length, 0, 'a successful empty catalog replaces just that program');
    assert.equal((await db.layBangDiem('BSE250001')).length, 14);
    assert.equal((await db.layDanhSachMonHoc('BSE250002')).length, 1);
    assert.deepEqual(await db.executeQuery('PRAGMA foreign_key_check'), []);
    const context = require('../services/study-context.service'); context.setDb(db);
    const study = await context.buildStudyContext(profile.student_id);
    assert.equal(study.profile.totalProgramCredits, 126); assert.equal(study.profile.earnedCredits, 25);
    assert.equal(study.academicHistory.overall.cumulative4, 2.52);
});
