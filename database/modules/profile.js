const { executeQuery } = require('../connection/db');
const { layStudentId } = require('../shared/academic');
const { saveIUData } = require('./iuSync');
const { summarizeGrades } = require('../shared/academic-results');
const { resolveEnrollmentYear } = require('../shared/student-identity');

async function layHoSo(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return null;

    const rows = await executeQuery(`
        SELECT
            s.student_id,
            s.student_code,
            s.full_name,
            s.major,
            s.dob,
            s.enrollment_year,
            s.current_semester,
            s.phone,
            s.avatar_url,
            s.email,
            (SELECT COUNT(1) FROM Assignments a WHERE a.student_id = s.student_id AND a.status IN ('PENDING','IN_PROGRESS','OVERDUE')) AS incomplete_assignments,
            (SELECT COUNT(1) FROM Exams e WHERE e.student_id = s.student_id AND date(e.exam_date) >= date('now')) AS upcoming_exams_count
        FROM Students s
        WHERE s.student_id = @sid
    `, { sid });

    if (!rows.length) return null;
    const academicSummary = summarizeGrades(await layBangDiem(sid));
    const totals = academicSummary.overall;
    const program = (await executeQuery(`SELECT program_id,program_name,total_credits AS total_program_credits,
        total_credits_source AS program_credits_source,knowledge_blocks_json,curriculum_synced_at
        FROM StudentPrograms WHERE student_id=@sid AND is_current=1`, { sid }))[0];
    let blocks = [];
    try { blocks = JSON.parse(program?.knowledge_blocks_json || '[]'); } catch { /* keep empty */ }
    if (!Array.isArray(blocks)) blocks = [];
    const blockSum = field => blocks.length && blocks.every(row => typeof row?.[field] === 'number' && Number.isFinite(row[field]) && row[field] >= 0)
        ? blocks.reduce((sum, row) => sum + row[field], 0) : null;
    return { ...rows[0], enrollment_year: resolveEnrollmentYear(rows[0].student_code, rows[0].enrollment_year), academic_summary: academicSummary,
        program_id: program?.program_id ?? null, program_name: program?.program_name ?? null,
        total_program_credits: program?.total_program_credits ?? null,
        program_credits_source: program?.program_credits_source ?? null,
        curriculum_synced_at: program?.curriculum_synced_at ?? null, knowledge_blocks: blocks,
        required_program_credits: blockSum('tin_chi_bat_buoc'),
        available_block_credits: blockSum('tong_tin_chi'), block_earned_credits: blockSum('tin_chi_dat'),
        total_passed_credits: totals.earnedCredits,
        gpa_10_scale: totals.cumulative10, gpa_4_scale: totals.cumulative4,
        average_10_scale: totals.average10, average_4_scale: totals.average4,
        passed_subject_count: totals.passedSubjects, failed_subject_count: totals.failedSubjects };
}

async function luuHoSo(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.studentCode || !data.fullName || !data.major) {
        throw new Error('studentCode, fullName và major là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    const params = {
        sc: data.studentCode, fn: data.fullName, mj: data.major,
        db: data.dob || null, ey: resolveEnrollmentYear(data.studentCode, data.enrollmentYear),
        cs: data.currentSemester || null, ph: data.phone || null,
        av: data.avatarUrl || null, em: data.email || null
    };

    if (sid) {
        await executeQuery(`
            UPDATE Students
            SET student_code = @sc, full_name = @fn, major = @mj,
                dob = COALESCE(@db, dob),
                enrollment_year = COALESCE(@ey, enrollment_year),
                current_semester = COALESCE(@cs, current_semester),
                phone = COALESCE(@ph, phone),
                avatar_url = COALESCE(@av, avatar_url),
                email = COALESCE(@em, email),
                updated_at = datetime('now')
            WHERE student_id = @sid
        `, { ...params, sid });
    } else {
        await executeQuery(`
            INSERT INTO Students (student_code, full_name, major, dob, enrollment_year, current_semester, phone, avatar_url, email)
            VALUES (@sc, @fn, @mj, @db, @ey, @cs, @ph, @av, @em)
        `, params);
    }

    return await layHoSo(data.studentCode);
}

async function layBangDiem(studentId, hocKy = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        SELECT g.grade_id, g.student_id, g.subject_id,
               sub.subject_code, sub.subject_name,
               g.semester, g.academic_year, g.attempt_number,
               g.credits, g.component_score, g.exam_score, g.score_4, g.exam_attempt,
               g.final_score, g.letter_grade, g.total_points, g.is_passed, g.source
        FROM Grades g
        INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
        WHERE g.student_id = @sid${hocKy ? ' AND g.semester = @hk' : ''}
        ORDER BY g.academic_year DESC, g.semester DESC, sub.subject_name ASC
    `, hocKy ? { sid, hk: hocKy } : { sid });
}

async function layMonHocChuaDat(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        SELECT g.grade_id, g.subject_id,
               sub.subject_code, sub.subject_name,
               g.credits, g.final_score, g.letter_grade,
               g.semester, g.academic_year, g.attempt_number
        FROM Grades g
        INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
        WHERE g.student_id = @sid AND (g.is_passed = 0 OR g.letter_grade = 'F')
        ORDER BY g.academic_year DESC, g.semester DESC
    `, { sid });
}

async function layMonHocDaDat(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        SELECT g.grade_id, g.subject_id,
               sub.subject_code, sub.subject_name,
               g.credits, g.final_score, g.letter_grade,
               g.semester, g.academic_year
        FROM Grades g
        INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
        WHERE g.student_id = @sid AND g.is_passed = 1
        ORDER BY g.academic_year DESC, g.semester DESC
    `, { sid });
}

async function layDanhSachMonHoc(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        SELECT sub.subject_id, sub.subject_code, sub.subject_name,
               CASE WHEN cs.subject_id IS NOT NULL THEN cs.credits ELSE sub.credits END AS credits,
               sub.department, cs.block_code, cs.block_name, cs.portal_status,
               CASE WHEN cs.subject_id IS NOT NULL THEN 'IU' ELSE NULL END AS curriculum_source,
               COALESCE((SELECT ss.status FROM StudentSubjects ss
                   WHERE ss.student_id=@sid AND ss.subject_id=sub.subject_id
                   ORDER BY ss.academic_year DESC,ss.semester DESC,ss.student_subject_id DESC LIMIT 1),
                   CASE WHEN EXISTS(SELECT 1 FROM Timetables t WHERE t.student_id=@sid AND t.subject_id=sub.subject_id AND date(t.end_date)>=date('now'))
                   THEN 'STUDYING' ELSE 'PLANNED' END) AS status,
               cs.semester, cs.academic_year
        FROM Subjects sub
        LEFT JOIN CurriculumSubjects cs ON cs.subject_id=sub.subject_id AND cs.student_id=@sid
            AND cs.program_id=(SELECT program_id FROM StudentPrograms WHERE student_id=@sid AND is_current=1)
        WHERE sub.is_active = 1
          AND (cs.subject_id IS NOT NULL
            OR EXISTS(SELECT 1 FROM StudentSubjects ss WHERE ss.student_id=@sid AND ss.subject_id=sub.subject_id)
            OR EXISTS(SELECT 1 FROM Grades g WHERE g.student_id=@sid AND g.subject_id=sub.subject_id)
            OR EXISTS(SELECT 1 FROM Timetables t WHERE t.student_id=@sid AND t.subject_id=sub.subject_id)
            OR EXISTS(SELECT 1 FROM Exams e WHERE e.student_id=@sid AND e.subject_id=sub.subject_id)
            OR EXISTS(SELECT 1 FROM Assignments a WHERE a.student_id=@sid AND a.subject_id=sub.subject_id))
        ORDER BY sub.subject_name ASC
    `, { sid });
}

async function dongBoHoSoIU(studentCode, dataIU) {
    if (!studentCode) throw new Error('studentCode là bắt buộc');
    if (!dataIU) throw new Error('dataIU là bắt buộc');
    return await saveIUData(studentCode, dataIU);
}

module.exports = {
    layHoSo,
    luuHoSo,
    layBangDiem,
    layMonHocChuaDat,
    layMonHocDaDat,
    layDanhSachMonHoc,
    dongBoHoSoIU
};
