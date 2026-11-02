const { executeQuery } = require('../connection/db');
const { layStudentId } = require('../shared/academic');
const { saveIUData } = require('./iuSync');

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
            COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) AS total_passed_credits,
            CASE
                WHEN COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) > 0
                THEN ROUND(
                    COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.final_score * g.credits ELSE 0 END), 0)
                    / COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 1), 2)
                ELSE 0.0
            END AS gpa_10_scale,
            CASE
                WHEN COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) > 0
                THEN ROUND(
                    COALESCE(SUM(
                        CASE g.letter_grade
                            WHEN 'A+' THEN 4.0 * g.credits
                            WHEN 'A'  THEN 3.8 * g.credits
                            WHEN 'B+' THEN 3.5 * g.credits
                            WHEN 'B'  THEN 3.0 * g.credits
                            WHEN 'C+' THEN 2.5 * g.credits
                            WHEN 'C'  THEN 2.0 * g.credits
                            WHEN 'D+' THEN 1.5 * g.credits
                            WHEN 'D'  THEN 1.0 * g.credits
                            ELSE 0.0
                        END
                    ), 0)
                    / COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 1), 2)
                ELSE 0.0
            END AS gpa_4_scale,
            COALESCE(COUNT(DISTINCT CASE WHEN g.letter_grade = 'F' AND g.is_passed = 0 THEN g.subject_id END), 0) AS failed_subject_count,
            COALESCE(COUNT(DISTINCT CASE WHEN g.is_passed = 1 THEN g.subject_id END), 0) AS passed_subject_count,
            (SELECT COUNT(1) FROM Assignments a WHERE a.student_id = s.student_id AND a.status IN ('PENDING','IN_PROGRESS','OVERDUE')) AS incomplete_assignments,
            (SELECT COUNT(1) FROM Exams e WHERE e.student_id = s.student_id AND date(e.exam_date) >= date('now')) AS upcoming_exams_count
        FROM Students s
        LEFT JOIN Grades g ON s.student_id = g.student_id
        WHERE s.student_id = @sid
        GROUP BY s.student_id, s.student_code, s.full_name, s.major,
                 s.dob, s.enrollment_year, s.current_semester, s.phone, s.avatar_url, s.email
    `, { sid });

    return rows.length > 0 ? rows[0] : null;
}

async function luuHoSo(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.studentCode || !data.fullName || !data.major) {
        throw new Error('studentCode, fullName và major là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    const params = {
        sc: data.studentCode, fn: data.fullName, mj: data.major,
        db: data.dob || null, ey: data.enrollmentYear || null,
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
               g.credits, g.component_score, g.exam_score,
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
               sub.credits, sub.department,
               COALESCE(ss.status, 'PLANNED') AS status,
               ss.semester, ss.academic_year
        FROM Subjects sub
        LEFT JOIN StudentSubjects ss ON sub.subject_id = ss.subject_id AND ss.student_id = @sid
        WHERE sub.is_active = 1
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
