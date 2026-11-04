'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const fixture = require('../../tests/fixtures/iu-grade-transcript.cjs');
const { summarizeGrades } = require('../../database/shared/academic-results');
const { enrollmentYearFromCode, resolveEnrollmentYear } = require('../../database/shared/student-identity');

test('CMC cohort comes from the two year digits after the major, without guessing other ID formats', () => {
    assert.equal(enrollmentYearFromCode('BSE250047'), 2025);
    assert.equal(resolveEnrollmentYear(' bse250047 ', 2023), 2025);
    assert.equal(resolveEnrollmentYear('BIT240001', 2023), 2024);
    assert.equal(resolveEnrollmentYear('BSE230001', 2023), 2023);
    for (const code of ['GPA-TEST', '123456', 'BSE250047-extra', 'BSE25004', '', null]) {
        assert.equal(enrollmentYearFromCode(code), null);
    }
    assert.equal(resolveEnrollmentYear('TEST-IU', 2022), 2022);
    assert.equal(resolveEnrollmentYear('TEST-IU'), null);
});

test('startup repairs old hardcoded cohort years idempotently and preserves other profile data', async () => {
    const SQL = await require('sql.js')(), db = new SQL.Database();
    try {
        db.run('CREATE TABLE Students(student_id INTEGER PRIMARY KEY,student_code TEXT,enrollment_year INTEGER,full_name TEXT)');
        db.run("INSERT INTO Students VALUES(1,'BSE250001',2023,'Unchanged name'),(2,'BIT240001',NULL,'Other student'),(3,'LEGACY',2022,'Legacy'),(4,'BSE230001',2023,'Valid cohort')");
        const migrate = require('../../database/migrations/studentIdentityMigration').migrateStudentEnrollmentYears;
        migrate(db); migrate(db);
        assert.deepEqual(db.exec('SELECT student_id,enrollment_year FROM Students ORDER BY student_id')[0].values, [[1,2025],[2,2024],[3,2022],[4,2023]]);
        assert.equal(db.exec('SELECT full_name FROM Students WHERE student_id=1')[0].values[0][0], 'Unchanged name');
    } finally { db.close(); }
});

test('IU totals, term recaps, pass/fail grades and retakes keep their distinct scopes', () => {
    const summary = summarizeGrades(fixture);
    assert.deepEqual([summary.overall.average10, summary.overall.average4, summary.overall.cumulative10, summary.overall.cumulative4], [5.95, 2.25, 6.66, 2.52]);
    assert.equal(summary.overall.gradedCredits, 28); assert.equal(summary.overall.earnedCredits, 25);
    assert.equal(summary.overall.completedSubjects, 13);
    assert.deepEqual(summary.semesters.map(row => [row.semester, row.average10, row.average4, row.cumulative4]), [['1', 8.6, 4, 4], ['2', 4.96, 0.81, 1.3], ['3', 6.82, 2.23, 2.62]]);
    assert.deepEqual(summary.comparison, { latestSemester: '2025-2026|3', previousSemester: '2025-2026|2', average10Delta: 1.86, average4Delta: 1.42 });
    assert.equal(summary.retakes[0].previousScore, 0); assert.equal(summary.retakes[0].latestScore, 5.2);
    assert.deepEqual(summarizeGrades([...fixture].reverse()), summary, 'input order must not choose an old failed attempt');
});

test('legacy attempts, pending results, unknown credits and explicit scale-4 scores are not guessed', () => {
    const legacy = fixture.filter(row => row.letter_grade !== 'P').map(row => ({ ...row, attempt_number: 1, score_4: null }));
    assert.equal(summarizeGrades(legacy).overall.cumulative4, 2.52);
    const row = { ...fixture[0], letter_grade: 'A', final_score: 9, score_4: 3.7 };
    assert.equal(summarizeGrades([row]).overall.average4, 3.7, 'portal numeric scale-4 value takes priority over a letter conversion');
    assert.equal(summarizeGrades([{ ...row, credits: 0 }]).overall.average10, null);
    assert.equal(summarizeGrades([{ ...row, final_score: null }]).overall.average10, null);
    assert.equal(summarizeGrades([]).overall.cumulative4, null);
});

test('academic migration preserves existing grades/IDs/indexes and allows P without including it in GPA', async () => {
    const SQL = await require('sql.js')();
    const db = new SQL.Database();
    try {
        let schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema/00_sqlite_init.sql'), 'utf8');
        schema = schema.replace(",'P','NP'", '').replace(/^\s*score_4 REAL[^\n]*\n/m, '').replace(/^\s*exam_attempt INTEGER[^\n]*\n/m, '').replace('final_score REAL CHECK', 'final_score REAL NOT NULL CHECK');
        db.run(schema);
        db.run("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'TEST','Academic tester','IT');INSERT INTO Subjects(subject_id,subject_code,subject_name,credits) VALUES(1,'OLD','Old subject',3),(2,'P','Pass fail subject',8)");
        db.run("INSERT INTO Grades(grade_id,student_id,subject_id,semester,academic_year,credits,final_score,letter_grade,is_passed) VALUES(71,1,1,'1','2025-2026',3,8.6,'A',1)");
        const migrate = require('../../database/migrations/academicMigration').migrateAcademicResults;
        migrate(db); migrate(db);
        assert.equal(db.exec('SELECT grade_id FROM Grades')[0].values[0][0], 71);
        assert.equal(db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name='IX_Grades_Student_Semester'")[0].values[0][0], 'IX_Grades_Student_Semester');
        db.run("INSERT INTO Grades(student_id,subject_id,semester,academic_year,credits,final_score,letter_grade,score_4,is_passed) VALUES(1,2,'1','2025-2026',8,NULL,'P',0,1)");
        assert.equal(db.exec('SELECT COUNT(*) FROM Grades')[0].values[0][0], 2);
        assert.equal(db.exec('PRAGMA foreign_key_check').length, 0);
    } finally { db.close(); }
});

test('IU mapping/sync keeps P, numeric GPA, year and learning attempts; profile/progress/context agree', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iu-academic-regression-'));
    process.env.DB_PATH = path.join(directory, 'academic.db');
    let db;
    t.after(async () => {
        await db?.closePool();
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    db = await require('../../database')();
    const { mapBangDiem } = require('../../CRWEB/modules/IU/data/maps');
    const portal = fixture.map(row => ({ DAOTAO_HOCPHAN_ID: row.subject_code, DAOTAO_HOCPHAN_MA: row.subject_code,
        DAOTAO_HOCPHAN_TEN: row.subject_name, DAOTAO_HOCPHAN_HOCTRINH: row.credits, DIEM: row.final_score,
        DIEMQUYDOI: row.score_4, DIEMQUYDOI_TEN: row.letter_grade, HOCKY: row.semester[0], NAMHOC: '2025_2026', LANHOC: row.attempt_number, LANTHI: 1, DANHGIA_TEN: row.is_passed ? 'Đạt' : 'Không đạt' }));
    const studentCode = 'BSE250001';
    await db.executeQuery('INSERT INTO Students(student_code,full_name,major,enrollment_year) VALUES(@code,@name,@major,@year)', { code: studentCode, name: 'Old sync fixture', major: 'IT', year: 2023 });
    assert.equal((await db.layHoSo(studentCode)).enrollment_year, 2025, 'legacy rows are corrected when read even before a new sync');
    assert.equal((await db.layTienDoHocTap(studentCode)).enrollment_year, 2025);
    const schema = { IU: { ho_so_sinh_vien: { thong_tin_ca_nhan: { ma_sinh_vien: studentCode, ho_ten: 'Academic tester', nganh: 'IT' } }, goc_hoc_tap: { tra_cuu_diem: { bang_diem: mapBangDiem(portal, []) } } } };
    const data = require('../utils/iu-client').mapSangDataIU(schema);
    await db.dongBoHoSoIU(studentCode, data);
    await db.dongBoHoSoIU(studentCode, data);
    assert.equal((await db.executeQuery('SELECT enrollment_year,current_semester FROM Students WHERE student_code=@code', { code: studentCode }))[0].enrollment_year, 2025);
    assert.equal((await db.luuHoSo(studentCode, { studentCode, fullName: 'Academic tester', major: 'IT', enrollmentYear: 2023 })).enrollment_year, 2025, 'editing a profile cannot restore the stale year');
    const grades = await db.layBangDiem(studentCode);
    assert.equal(grades.length, 14); assert.equal(grades.filter(row => row.letter_grade === 'P').length, 4);
    assert.equal(grades.find(row => row.subject_code === 'MATH' && row.final_score === 5.2).attempt_number, 2);
    const profile = await db.layHoSo(studentCode);
    assert.equal(profile.gpa_10_scale, 6.66); assert.equal(profile.gpa_4_scale, 2.52);
    assert.equal(profile.average_10_scale, 5.95); assert.equal(profile.average_4_scale, 2.25);
    const progress = require('../services/progress.service').createProgressService({ getDb: () => db });
    assert.deepEqual((await progress.getGPA(studentCode)).map(row => row.gpa4), [4, 0.81, 2.23]);
    const context = require('../services/study-context.service'); context.setDb(db);
    const study = await context.buildStudyContext(studentCode, { limits: { grades: 1 } });
    assert.equal(study.profile.enrollmentYear, 2025, 'AI receives the same cohort year as the profile');
    assert.equal(study.grades.length, 1); assert.equal(study.sources.grades.truncated, true);
    assert.equal(study.academicHistory.semesters.length, 3);
    assert.equal(study.academicHistory.retakes[0].previousScore, 0);
    const gemini = require('../utils/gemini-client'), ask = gemini.ask, generateJson = gemini.generateJson;
    let prompt;
    gemini.ask = async text => { prompt = text; return 'Nhận xét từ kết quả đã ghi nhận.'; };
    const build = context.buildStudyContext;
    context.buildStudyContext = async (...args) => ({ ...await build(...args), documents: [{ text: 'x'.repeat(20000) }] });
    try {
        const { createHoiThoaiService } = require('../services/hoithoai.service');
        const service = createHoiThoaiService({ userId: profile.student_id, q: (sql, params) => db.executeQuery(sql, { ...params, uid: profile.student_id }) });
        await service.ask({ question: 'Đối chiếu lực học với học kỳ trước.' });
        assert.ok(prompt.includes('academicHistory')); assert.ok(prompt.includes('2025-2026|2'));
        assert.ok(prompt.includes('previousScore')); assert.ok(prompt.includes('5.95')); assert.ok(prompt.includes('2.52'));
        assert.ok(!prompt.includes('x'.repeat(1000)), 'large unrelated context is trimmed while academic comparison is retained');
        gemini.generateJson = async text => { prompt = text; return { overview: 'Điểm tích lũy hệ 4 là 2,52.', comments: [], revisionSuggestions: [] }; };
        const tutor = require('../services/trolyai.service').createTrolyaiService({ getDb: () => db, getHocTapAiService: () => service });
        const advice = await tutor.progressAdvice({ progress: { completedTasks: 1, academicHistory: { overall: { cumulative4: 3.99 } } } });
        assert.ok(advice.overview.includes('2,52'), 'Vietnamese decimal comma must preserve supported GPA claims');
        assert.ok(prompt.includes('academicHistory')); assert.ok(prompt.includes('previousScore'));
        assert.ok(prompt.includes('2.52')); assert.ok(!prompt.includes('3.99'), 'client-supplied grade history must not replace server transcript totals');
    } finally { gemini.ask = ask; gemini.generateJson = generateJson; context.buildStudyContext = build; }
});
