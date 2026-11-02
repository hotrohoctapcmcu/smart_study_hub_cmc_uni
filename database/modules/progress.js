'use strict';

const { executeQuery } = require('../connection/db');
const { layStudentId } = require('../shared/studyStudent');

async function layBangDiemTheoNamHoc(studentId, academicYear) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    let filter = 'WHERE g.student_id = @sid';
    const params = { sid };

    if (academicYear) {
        filter += ' AND g.academic_year = @ay';
        params.ay = academicYear;
    }

    return await executeQuery(
        `SELECT g.grade_id, g.student_id, g.subject_id,
                sub.subject_code, sub.subject_name,
                g.semester, g.academic_year, g.attempt_number,
                g.credits, g.component_score, g.exam_score,
                g.final_score, g.letter_grade, g.total_points,
                g.is_passed, g.source,
                g.created_at, g.updated_at
         FROM Grades g
         INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
         ${filter}
         ORDER BY g.academic_year DESC, g.semester DESC, sub.subject_name ASC`,
        params
    );
}

async function layLichSuHocLai(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT g.grade_id, g.subject_id,
                sub.subject_code, sub.subject_name,
                g.semester, g.academic_year, g.attempt_number,
                g.credits, g.component_score, g.exam_score,
                g.final_score, g.letter_grade, g.is_passed
         FROM Grades g
         INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
         WHERE g.student_id = @sid
           AND g.subject_id IN (
               SELECT subject_id FROM Grades
               WHERE student_id = @sid
               GROUP BY subject_id
               HAVING COUNT(1) > 1
           )
         ORDER BY sub.subject_name ASC, g.attempt_number ASC`,
        { sid }
    );
}

async function layTienDoHocTap(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return null;

    const rows = await executeQuery(
        `SELECT
            s.student_id, s.student_code, s.full_name, s.major,
            s.enrollment_year, s.current_semester,

            COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) AS total_passed_credits,
            COUNT(DISTINCT CASE WHEN g.is_passed = 1 THEN g.subject_id END) AS passed_subjects,
            COUNT(DISTINCT CASE WHEN g.is_passed = 0 THEN g.subject_id END) AS failed_subjects,
            COUNT(DISTINCT g.subject_id) AS total_subjects,

            CASE
                WHEN COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) > 0
                THEN ROUND(
                    CAST(SUM(CASE WHEN g.is_passed = 1 THEN g.final_score * g.credits ELSE 0 END) AS REAL)
                    / SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 2)
                ELSE 0.0
            END AS gpa_10,

            (SELECT COUNT(1) FROM StudySchedules ss
             WHERE ss.student_id = s.student_id AND ss.status = 'COMPLETED'
               AND ss.study_date >= date('now', '-7 days')) AS study_sessions_7d,

            (SELECT COALESCE(SUM(p.total_focus_minutes), 0) FROM PomodoroSessions p
             WHERE p.student_id = s.student_id
               AND p.session_date >= date('now', '-7 days')) AS focus_minutes_7d,

            (SELECT COUNT(1) FROM Assignments a
             WHERE a.student_id = s.student_id
               AND a.status IN ('PENDING', 'IN_PROGRESS')) AS pending_assignments,

            (SELECT COUNT(1) FROM Exams e
             WHERE e.student_id = s.student_id
               AND date(e.exam_date) >= date('now')) AS upcoming_exams

         FROM Students s
         LEFT JOIN Grades g ON s.student_id = g.student_id
         WHERE s.student_id = @sid
         GROUP BY s.student_id`,
        { sid }
    );

    return rows.length > 0 ? rows[0] : null;
}

module.exports = {
    layBangDiemTheoNamHoc,
    layLichSuHocLai,
    layTienDoHocTap,
};
