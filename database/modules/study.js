'use strict';

const { executeQuery } = require('../connection/db');
const { layStudentId } = require('../shared/studyStudent');

async function layLichTuHocTheoKhoangThoiGian(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!tuNgay || !denNgay) throw new Error('tuNgay và denNgay là bắt buộc');

    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT ss.schedule_id, ss.student_id, ss.subject_id,
                sub.subject_code, sub.subject_name,
                ss.title, ss.study_date, ss.start_time, ss.end_time,
                ss.duration_minutes, ss.is_ai_suggested, ss.status, ss.notes,
                ss.created_at, ss.updated_at
         FROM StudySchedules ss
         LEFT JOIN Subjects sub ON ss.subject_id = sub.subject_id
         WHERE ss.student_id = @sid
           AND date(ss.study_date) >= date(@tu)
           AND date(ss.study_date) <= date(@den)
         ORDER BY ss.study_date ASC, ss.start_time ASC`,
        { sid, tu: tuNgay, den: denNgay }
    );
}

async function layThongKeBuoiTuHoc(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid)
        return {
            total_sessions: 0,
            completed_sessions: 0,
            total_minutes: 0,
            avg_minutes_per_session: 0,
        };

    let dateFilter = '';
    const params = { sid };

    if (tuNgay && denNgay) {
        dateFilter =
            'AND date(ss.study_date) >= date(@tu) AND date(ss.study_date) <= date(@den)';
        params.tu = tuNgay;
        params.den = denNgay;
    }

    const rows = await executeQuery(
        `SELECT
            COUNT(1) AS total_sessions,
            COALESCE(SUM(CASE WHEN ss.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_sessions,
            COALESCE(SUM(CASE WHEN ss.status = 'COMPLETED' THEN ss.duration_minutes ELSE 0 END), 0) AS total_minutes,
            CASE
                WHEN SUM(CASE WHEN ss.status = 'COMPLETED' THEN 1 ELSE 0 END) > 0
                THEN ROUND(
                    CAST(SUM(CASE WHEN ss.status = 'COMPLETED' THEN ss.duration_minutes ELSE 0 END) AS REAL)
                    / SUM(CASE WHEN ss.status = 'COMPLETED' THEN 1 ELSE 0 END), 1)
                ELSE 0.0
            END AS avg_minutes_per_session
         FROM StudySchedules ss
         WHERE ss.student_id = @sid ${dateFilter}`,
        params
    );

    return rows.length > 0 ? rows[0] : null;
}

async function hoanThanhBuoiTuHoc(scheduleId, actualEndTime = null) {
    if (!scheduleId) throw new Error('scheduleId là bắt buộc');

    const endTime = actualEndTime || new Date().toTimeString().substring(0, 5);

    await executeQuery(
        `UPDATE StudySchedules
         SET status = 'COMPLETED',
             end_time = COALESCE(@et, end_time),
             duration_minutes = CASE
                 WHEN @et IS NOT NULL THEN
                     (CAST(substr(@et, 1, 2) AS INTEGER) * 60 + CAST(substr(@et, 4, 2) AS INTEGER))
                     - (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
                 ELSE duration_minutes
             END,
             updated_at = datetime('now')
         WHERE schedule_id = @sid`,
        { et: endTime, sid: parseInt(scheduleId, 10) }
    );
    return true;
}

module.exports = {
    layLichTuHocTheoKhoangThoiGian,
    layThongKeBuoiTuHoc,
    hoanThanhBuoiTuHoc,
};
