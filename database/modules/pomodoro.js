'use strict';

const { executeQuery } = require('../connection/db');
const { layStudentId } = require('../shared/studyStudent');

async function batDauPomodoro(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    const now = new Date();
    const sessionDate =
        data.sessionDate || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(now);

    await executeQuery(
        `INSERT INTO PomodoroSessions
            (student_id, subject_id, schedule_id,
             focus_duration, break_duration, long_break_duration, target_cycles,
             started_at, session_date, status, notes)
         VALUES
            (@sid, @subId, @schId,
             @fd, @bd, @lbd, @tc,
             @sa, @sd, 'IN_PROGRESS', @nt)`,
        {
            sid,
            subId: data.subjectId ? parseInt(data.subjectId, 10) : null,
            schId: data.scheduleId ? parseInt(data.scheduleId, 10) : null,
            fd: data.focusDuration || 25,
            bd: data.breakDuration || 5,
            lbd: data.longBreakDuration || 15,
            tc: data.targetCycles || 4,
            sa: now.toISOString(),
            sd: sessionDate,
            nt: data.notes || null,
        }
    );

    const idRes = await executeQuery('SELECT last_insert_rowid() AS session_id');
    return idRes.length > 0 ? idRes[0] : null;
}

async function capNhatPomodoro(sessionId, data = {}) {
    if (!sessionId) throw new Error('sessionId là bắt buộc');

    await executeQuery(
        `UPDATE PomodoroSessions
         SET completed_cycles = COALESCE(@cc, completed_cycles),
             total_focus_minutes = COALESCE(@tfm, total_focus_minutes),
             total_break_minutes = COALESCE(@tbm, total_break_minutes),
             status = COALESCE(@st, status),
             notes = COALESCE(@nt, notes),
             mood_rating = COALESCE(@mr, mood_rating),
             updated_at = datetime('now')
         WHERE session_id = @sid`,
        {
            cc: data.completedCycles ?? null,
            tfm: data.totalFocusMinutes ?? null,
            tbm: data.totalBreakMinutes ?? null,
            st: data.status || null,
            nt: data.notes || null,
            mr: data.moodRating ?? null,
            sid: parseInt(sessionId, 10),
        }
    );

    return layPhienPomodoro(sessionId);
}

async function ketThucPomodoro(sessionId, data = {}) {
    if (!sessionId) throw new Error('sessionId là bắt buộc');

    const now = new Date().toISOString();

    await executeQuery(
        `UPDATE PomodoroSessions
         SET status = @st,
             ended_at = @ea,
             completed_cycles = COALESCE(@cc, completed_cycles),
             total_focus_minutes = COALESCE(@tfm, total_focus_minutes),
             total_break_minutes = COALESCE(@tbm, total_break_minutes),
             mood_rating = COALESCE(@mr, mood_rating),
             notes = COALESCE(@nt, notes),
             updated_at = datetime('now')
         WHERE session_id = @sid`,
        {
            st: data.status || 'COMPLETED',
            ea: now,
            cc: data.completedCycles ?? null,
            tfm: data.totalFocusMinutes ?? null,
            tbm: data.totalBreakMinutes ?? null,
            mr: data.moodRating ?? null,
            nt: data.notes || null,
            sid: parseInt(sessionId, 10),
        }
    );

    return layPhienPomodoro(sessionId);
}

async function layPhienPomodoro(sessionId) {
    const rows = await executeQuery(
        'SELECT * FROM PomodoroSessions WHERE session_id = @sid',
        { sid: parseInt(sessionId, 10) }
    );
    return rows.length > 0 ? rows[0] : null;
}

async function layLichSuPomodoro(studentId, tuNgay = null, denNgay = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    let dateFilter = '';
    const params = { sid };

    if (tuNgay && denNgay) {
        dateFilter =
            'AND p.session_date >= @tu AND p.session_date <= @den';
        params.tu = tuNgay;
        params.den = denNgay;
    } else if (tuNgay) {
        dateFilter = 'AND p.session_date >= @tu';
        params.tu = tuNgay;
    }

    return await executeQuery(
        `SELECT p.session_id, p.student_id, p.subject_id,
                sub.subject_code, sub.subject_name,
                p.schedule_id,
                p.focus_duration, p.break_duration, p.long_break_duration,
                p.target_cycles, p.completed_cycles,
                p.total_focus_minutes, p.total_break_minutes,
                p.started_at, p.ended_at, p.session_date,
                p.status, p.notes, p.mood_rating,
                p.created_at
         FROM PomodoroSessions p
         LEFT JOIN Subjects sub ON p.subject_id = sub.subject_id
         WHERE p.student_id = @sid ${dateFilter}
         ORDER BY p.session_date DESC, p.started_at DESC`,
        params
    );
}

async function layThongKePomodoro(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid)
        return {
            total_sessions: 0,
            completed_sessions: 0,
            total_cycles: 0,
            total_focus_minutes: 0,
        };

    let dateFilter = '';
    const params = { sid };
    if (tuNgay && denNgay) {
        dateFilter =
            'AND p.session_date >= @tu AND p.session_date <= @den';
        params.tu = tuNgay;
        params.den = denNgay;
    }

    const rows = await executeQuery(
        `SELECT
            COUNT(1) AS total_sessions,
            COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_sessions,
            COALESCE(SUM(p.completed_cycles), 0) AS total_cycles,
            COALESCE(SUM(p.total_focus_minutes), 0) AS total_focus_minutes,
            COALESCE(SUM(p.total_break_minutes), 0) AS total_break_minutes,
            ROUND(COALESCE(AVG(CASE WHEN p.mood_rating IS NOT NULL THEN p.mood_rating END), 0), 1) AS avg_mood
         FROM PomodoroSessions p
         WHERE p.student_id = @sid ${dateFilter}`,
        params
    );

    return rows.length > 0 ? rows[0] : null;
}

async function layPomodoroTheoNgay(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT
            p.session_date,
            COUNT(1) AS sessions_count,
            COALESCE(SUM(p.completed_cycles), 0) AS total_cycles,
            COALESCE(SUM(p.total_focus_minutes), 0) AS total_focus_minutes
         FROM PomodoroSessions p
         WHERE p.student_id = @sid
           AND p.session_date >= @tu
           AND p.session_date <= @den
         GROUP BY p.session_date
         ORDER BY p.session_date ASC`,
        { sid, tu: tuNgay, den: denNgay }
    );
}

module.exports = {
    batDauPomodoro,
    capNhatPomodoro,
    ketThucPomodoro,
    layLichSuPomodoro,
    layThongKePomodoro,
    layPomodoroTheoNgay,
};
