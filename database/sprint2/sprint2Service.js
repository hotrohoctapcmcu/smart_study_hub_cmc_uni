/**
 * database/sprint2/sprint2Service.js
 * ===================================================================================
 * BACKEND SERVICE LAYER — SPRINT 2
 * ===================================================================================
 * Cung cấp toàn bộ hàm CRUD + business logic cho Sprint 2:
 *   - PB-13: Lưu buổi tự học (mở rộng StudySchedules)
 *   - PB-42: Lịch sử Pomodoro
 *   - PB-38: Sổ tay & Ghi chú (Notebooks / Notes)
 *   - PB-30, PB-32: Hồ sơ học tập (bổ sung)
 *   - PB-05, PB-06: Đồng bộ EDUX
 *
 * Giữ quy ước:
 *   - Tên hàm tiếng Việt có dấu (camelCase).
 *   - Tham số đầu vào chấp nhận student_id (số) hoặc student_code (chuỗi).
 *   - Trả về mảng rows hoặc object đơn.
 * ===================================================================================
 */

"use strict";

const { getPool, executeQuery } = require("../connection/db");

// ─── Helper dùng chung ─────────────────────────────────────────────────────────

/**
 * Lấy student_id từ student_id (số) hoặc student_code (chuỗi).
 */
async function layStudentId(studentId) {
    const parsed = parseInt(studentId, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
        const rows = await executeQuery(
            "SELECT student_id FROM Students WHERE student_id = @sid LIMIT 1",
            { sid: parsed }
        );
        if (rows.length > 0) return rows[0].student_id;
    }
    const rows = await executeQuery(
        "SELECT student_id FROM Students WHERE student_code = @code LIMIT 1",
        { code: String(studentId) }
    );
    return rows.length > 0 ? rows[0].student_id : null;
}

// ===================================================================================
// 1. PB-13: BUỔI TỰ HỌC (MỞ RỘNG STUDY SCHEDULES)
// ===================================================================================

/**
 * Lấy lịch tự học theo khoảng thời gian.
 */
async function layLichTuHocTheoKhoangThoiGian(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    if (!tuNgay || !denNgay) throw new Error("tuNgay và denNgay là bắt buộc");

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

/**
 * Lấy thống kê buổi tự học theo tuần/tháng.
 */
async function layThongKeBuoiTuHoc(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid)
        return {
            total_sessions: 0,
            completed_sessions: 0,
            total_minutes: 0,
            avg_minutes_per_session: 0,
        };

    let dateFilter = "";
    const params = { sid };

    if (tuNgay && denNgay) {
        dateFilter =
            "AND date(ss.study_date) >= date(@tu) AND date(ss.study_date) <= date(@den)";
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

/**
 * Đánh dấu buổi tự học đã hoàn thành (ghi nhận thời gian thực tế).
 */
async function hoanThanhBuoiTuHoc(scheduleId, actualEndTime = null) {
    if (!scheduleId) throw new Error("scheduleId là bắt buộc");

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

// ===================================================================================
// 2. PB-42: LỊCH SỬ POMODORO
// ===================================================================================

/**
 * Bắt đầu phiên Pomodoro mới.
 */
async function batDauPomodoro(studentId, data = {}) {
    if (!studentId) throw new Error("studentId là bắt buộc");

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error("Không tìm thấy sinh viên");

    const now = new Date();
    const sessionDate =
        data.sessionDate || now.toISOString().substring(0, 10);

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

    const idRes = await executeQuery(
        "SELECT last_insert_rowid() AS session_id"
    );
    return idRes.length > 0 ? idRes[0] : null;
}

/**
 * Cập nhật tiến trình phiên Pomodoro (sau mỗi chu kỳ).
 */
async function capNhatPomodoro(sessionId, data = {}) {
    if (!sessionId) throw new Error("sessionId là bắt buộc");

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
            cc: data.completedCycles != null ? data.completedCycles : null,
            tfm: data.totalFocusMinutes != null ? data.totalFocusMinutes : null,
            tbm: data.totalBreakMinutes != null ? data.totalBreakMinutes : null,
            st: data.status || null,
            nt: data.notes || null,
            mr: data.moodRating != null ? data.moodRating : null,
            sid: parseInt(sessionId, 10),
        }
    );

    const res = await executeQuery(
        "SELECT * FROM PomodoroSessions WHERE session_id = @sid",
        { sid: parseInt(sessionId, 10) }
    );
    return res.length > 0 ? res[0] : null;
}

/**
 * Kết thúc phiên Pomodoro.
 */
async function ketThucPomodoro(sessionId, data = {}) {
    if (!sessionId) throw new Error("sessionId là bắt buộc");

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
            st: data.status || "COMPLETED",
            ea: now,
            cc: data.completedCycles != null ? data.completedCycles : null,
            tfm: data.totalFocusMinutes != null ? data.totalFocusMinutes : null,
            tbm: data.totalBreakMinutes != null ? data.totalBreakMinutes : null,
            mr: data.moodRating != null ? data.moodRating : null,
            nt: data.notes || null,
            sid: parseInt(sessionId, 10),
        }
    );

    const res = await executeQuery(
        "SELECT * FROM PomodoroSessions WHERE session_id = @sid",
        { sid: parseInt(sessionId, 10) }
    );
    return res.length > 0 ? res[0] : null;
}

/**
 * Lấy lịch sử Pomodoro theo student và khoảng ngày.
 */
async function layLichSuPomodoro(studentId, tuNgay = null, denNgay = null) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    let dateFilter = "";
    const params = { sid };

    if (tuNgay && denNgay) {
        dateFilter =
            "AND p.session_date >= @tu AND p.session_date <= @den";
        params.tu = tuNgay;
        params.den = denNgay;
    } else if (tuNgay) {
        dateFilter = "AND p.session_date >= @tu";
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

/**
 * Lấy thống kê Pomodoro theo ngày/tuần/tháng.
 */
async function layThongKePomodoro(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid)
        return {
            total_sessions: 0,
            completed_sessions: 0,
            total_cycles: 0,
            total_focus_minutes: 0,
        };

    let dateFilter = "";
    const params = { sid };
    if (tuNgay && denNgay) {
        dateFilter =
            "AND p.session_date >= @tu AND p.session_date <= @den";
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

/**
 * Lấy thống kê Pomodoro nhóm theo ngày (biểu đồ timeline).
 */
async function layPomodoroTheoNgay(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error("studentId là bắt buộc");
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

// ===================================================================================
// 3. PB-38: SỔ TAY & GHI CHÚ (NOTEBOOKS / NOTES)
// ===================================================================================

// ─── Notebooks ─────────────────────────────────────────────────────────────────

/**
 * Tạo sổ tay mới.
 */
async function taoSoTay(studentId, data = {}) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    if (!data.title) throw new Error("title là bắt buộc");

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error("Không tìm thấy sinh viên");

    await executeQuery(
        `INSERT INTO Notebooks (student_id, subject_id, title, description, color, icon)
         VALUES (@sid, @subId, @title, @desc, @color, @icon)`,
        {
            sid,
            subId: data.subjectId ? parseInt(data.subjectId, 10) : null,
            title: data.title,
            desc: data.description || null,
            color: data.color || "#4A90D9",
            icon: data.icon || "📒",
        }
    );

    const idRes = await executeQuery(
        "SELECT last_insert_rowid() AS notebook_id"
    );
    return idRes.length > 0 ? idRes[0] : null;
}

/**
 * Lấy danh sách sổ tay của sinh viên.
 */
async function layDanhSachSoTay(studentId, includeArchived = false) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    const archiveFilter = includeArchived ? "" : "AND nb.is_archived = 0";

    return await executeQuery(
        `SELECT nb.notebook_id, nb.student_id, nb.subject_id,
                sub.subject_code, sub.subject_name,
                nb.title, nb.description, nb.color, nb.icon,
                nb.is_archived, nb.created_at, nb.updated_at,
                (SELECT COUNT(1) FROM Notes n WHERE n.notebook_id = nb.notebook_id) AS notes_count,
                (SELECT COUNT(1) FROM Notes n WHERE n.notebook_id = nb.notebook_id AND n.is_hard = 1) AS hard_notes_count
         FROM Notebooks nb
         LEFT JOIN Subjects sub ON nb.subject_id = sub.subject_id
         WHERE nb.student_id = @sid ${archiveFilter}
         ORDER BY nb.updated_at DESC`,
        { sid }
    );
}

/**
 * Cập nhật sổ tay.
 */
async function capNhatSoTay(notebookId, data = {}) {
    if (!notebookId) throw new Error("notebookId là bắt buộc");

    await executeQuery(
        `UPDATE Notebooks
         SET title = COALESCE(@title, title),
             description = COALESCE(@desc, description),
             color = COALESCE(@color, color),
             icon = COALESCE(@icon, icon),
             is_archived = COALESCE(@arch, is_archived),
             updated_at = datetime('now')
         WHERE notebook_id = @nid`,
        {
            title: data.title || null,
            desc: data.description || null,
            color: data.color || null,
            icon: data.icon || null,
            arch: data.isArchived != null ? (data.isArchived ? 1 : 0) : null,
            nid: parseInt(notebookId, 10),
        }
    );

    const res = await executeQuery(
        "SELECT * FROM Notebooks WHERE notebook_id = @nid",
        { nid: parseInt(notebookId, 10) }
    );
    return res.length > 0 ? res[0] : null;
}

/**
 * Xóa sổ tay (cascade xóa luôn notes bên trong).
 */
async function xoaSoTay(notebookId) {
    if (!notebookId) throw new Error("notebookId là bắt buộc");
    await executeQuery("DELETE FROM Notebooks WHERE notebook_id = @nid", {
        nid: parseInt(notebookId, 10),
    });
    return true;
}

// ─── Notes ────────────────────────────────────────────────────────────────────

/**
 * Thêm ghi chú vào sổ tay.
 */
async function themGhiChu(studentId, notebookId, data = {}) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    if (!notebookId) throw new Error("notebookId là bắt buộc");

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error("Không tìm thấy sinh viên");

    // Xác nhận quyền sở hữu notebook
    const nbRows = await executeQuery(
        "SELECT 1 FROM Notebooks WHERE notebook_id = @nid AND student_id = @sid LIMIT 1",
        { nid: parseInt(notebookId, 10), sid }
    );
    if (!nbRows.length)
        throw new Error("Sổ tay không tồn tại hoặc không thuộc quyền sở hữu");

    // Tính sort_order
    const maxOrder = await executeQuery(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM Notes WHERE notebook_id = @nid",
        { nid: parseInt(notebookId, 10) }
    );

    const tags =
        data.tags && Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags || null;

    await executeQuery(
        `INSERT INTO Notes (notebook_id, student_id, chapter, title, content, tags, is_hard, is_favorite, sort_order)
         VALUES (@nid, @sid, @ch, @title, @content, @tags, @hard, @fav, @so)`,
        {
            nid: parseInt(notebookId, 10),
            sid,
            ch: data.chapter || null,
            title: data.title || "Ghi chú mới",
            content: data.content || null,
            tags,
            hard: data.isHard ? 1 : 0,
            fav: data.isFavorite ? 1 : 0,
            so: maxOrder.length > 0 ? maxOrder[0].next_order : 0,
        }
    );

    const idRes = await executeQuery(
        "SELECT last_insert_rowid() AS note_id"
    );
    return idRes.length > 0 ? idRes[0] : null;
}

/**
 * Lấy danh sách ghi chú trong sổ tay.
 */
async function layGhiChuTheoSoTay(notebookId, filters = {}) {
    if (!notebookId) throw new Error("notebookId là bắt buộc");

    let extraFilter = "";
    const params = { nid: parseInt(notebookId, 10) };

    if (filters.isHard) {
        extraFilter += " AND n.is_hard = 1";
    }
    if (filters.isFavorite) {
        extraFilter += " AND n.is_favorite = 1";
    }
    if (filters.chapter) {
        extraFilter += " AND n.chapter = @ch";
        params.ch = filters.chapter;
    }
    if (filters.searchTerm) {
        extraFilter +=
            " AND (n.title LIKE @q OR n.content LIKE @q OR n.tags LIKE @q)";
        params.q = `%${filters.searchTerm}%`;
    }

    return await executeQuery(
        `SELECT n.note_id, n.notebook_id, n.student_id,
                n.chapter, n.title, n.content, n.tags,
                n.is_hard, n.is_favorite, n.sort_order,
                n.created_at, n.updated_at
         FROM Notes n
         WHERE n.notebook_id = @nid ${extraFilter}
         ORDER BY n.sort_order ASC, n.updated_at DESC`,
        params
    );
}

/**
 * Lấy tất cả ghi chú "khó" của sinh viên (ôn tập nhanh).
 */
async function layGhiChuKho(studentId) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT n.note_id, n.notebook_id, n.student_id,
                nb.title AS notebook_title,
                sub.subject_name,
                n.chapter, n.title, n.content, n.tags,
                n.is_hard, n.is_favorite, n.sort_order,
                n.created_at, n.updated_at
         FROM Notes n
         INNER JOIN Notebooks nb ON n.notebook_id = nb.notebook_id
         LEFT JOIN Subjects sub ON nb.subject_id = sub.subject_id
         WHERE n.student_id = @sid AND n.is_hard = 1
         ORDER BY n.updated_at DESC`,
        { sid }
    );
}

/**
 * Cập nhật ghi chú.
 */
async function capNhatGhiChu(noteId, data = {}) {
    if (!noteId) throw new Error("noteId là bắt buộc");

    const tags =
        data.tags && Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags || null;

    await executeQuery(
        `UPDATE Notes
         SET chapter = COALESCE(@ch, chapter),
             title = COALESCE(@title, title),
             content = COALESCE(@content, content),
             tags = COALESCE(@tags, tags),
             is_hard = COALESCE(@hard, is_hard),
             is_favorite = COALESCE(@fav, is_favorite),
             sort_order = COALESCE(@so, sort_order),
             updated_at = datetime('now')
         WHERE note_id = @nid`,
        {
            ch: data.chapter || null,
            title: data.title || null,
            content: data.content !== undefined ? data.content : null,
            tags,
            hard: data.isHard != null ? (data.isHard ? 1 : 0) : null,
            fav: data.isFavorite != null ? (data.isFavorite ? 1 : 0) : null,
            so: data.sortOrder != null ? data.sortOrder : null,
            nid: parseInt(noteId, 10),
        }
    );

    const res = await executeQuery(
        "SELECT * FROM Notes WHERE note_id = @nid",
        { nid: parseInt(noteId, 10) }
    );
    return res.length > 0 ? res[0] : null;
}

/**
 * Xóa ghi chú.
 */
async function xoaGhiChu(noteId) {
    if (!noteId) throw new Error("noteId là bắt buộc");
    await executeQuery("DELETE FROM Notes WHERE note_id = @nid", {
        nid: parseInt(noteId, 10),
    });
    return true;
}

/**
 * Tìm kiếm ghi chú toàn bộ sổ tay (fulltext search).
 */
async function timKiemGhiChu(studentId, searchTerm) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    if (!searchTerm) return [];

    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT n.note_id, n.notebook_id, n.student_id,
                nb.title AS notebook_title,
                sub.subject_name,
                n.chapter, n.title, n.content, n.tags,
                n.is_hard, n.is_favorite,
                n.created_at, n.updated_at
         FROM Notes n
         INNER JOIN Notebooks nb ON n.notebook_id = nb.notebook_id
         LEFT JOIN Subjects sub ON nb.subject_id = sub.subject_id
         WHERE n.student_id = @sid
           AND (n.title LIKE @q OR n.content LIKE @q OR n.tags LIKE @q OR n.chapter LIKE @q)
         ORDER BY n.updated_at DESC
         LIMIT 50`,
        { sid, q: `%${searchTerm}%` }
    );
}

// ===================================================================================
// 4. PB-30, PB-32: HỒ SƠ HỌC TẬP BỔ SUNG
// ===================================================================================

/**
 * Lấy bảng điểm chi tiết theo năm học.
 */
async function layBangDiemTheoNamHoc(studentId, academicYear) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    let filter = "WHERE g.student_id = @sid";
    const params = { sid };

    if (academicYear) {
        filter += " AND g.academic_year = @ay";
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

/**
 * Lấy lịch sử học lại (nhiều attempt_number cho cùng một môn).
 */
async function layLichSuHocLai(studentId) {
    if (!studentId) throw new Error("studentId là bắt buộc");
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

/**
 * Lấy tiến độ học tập tổng quan (phục vụ AI phân tích).
 */
async function layTienDoHocTap(studentId) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return null;

    const rows = await executeQuery(
        `SELECT
            s.student_id, s.student_code, s.full_name, s.major,
            s.enrollment_year, s.current_semester,

            -- Tín chỉ
            COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) AS total_passed_credits,
            COUNT(DISTINCT CASE WHEN g.is_passed = 1 THEN g.subject_id END) AS passed_subjects,
            COUNT(DISTINCT CASE WHEN g.is_passed = 0 THEN g.subject_id END) AS failed_subjects,
            COUNT(DISTINCT g.subject_id) AS total_subjects,

            -- GPA
            CASE
                WHEN COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) > 0
                THEN ROUND(
                    CAST(SUM(CASE WHEN g.is_passed = 1 THEN g.final_score * g.credits ELSE 0 END) AS REAL)
                    / SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 2)
                ELSE 0.0
            END AS gpa_10,

            -- Hoạt động gần đây
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

// ===================================================================================
// 5. PB-05, PB-06: ĐỒNG BỘ EDUX
// ===================================================================================

/**
 * Đồng bộ tài liệu EDUX (transaction an toàn, rollback nếu lỗi).
 */
async function dongBoEdux(studentId, documents = []) {
    if (!studentId) throw new Error("studentId là bắt buộc");

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error("Không tìm thấy sinh viên");

    const db = await getPool();

    // Tạo log đồng bộ
    await executeQuery(
        `INSERT INTO EduxSyncLog (student_id, sync_type, status)
         VALUES (@sid, 'FULL', 'IN_PROGRESS')`,
        { sid }
    );
    const syncLogRes = await executeQuery(
        "SELECT last_insert_rowid() AS sync_id"
    );
    const syncId = syncLogRes.length > 0 ? syncLogRes[0].sync_id : null;

    // Snapshot dữ liệu hiện tại (cho rollback)
    const existingDocs = await executeQuery(
        "SELECT * FROM EduxDocuments WHERE student_id = @sid",
        { sid }
    );
    const rollbackData = JSON.stringify(existingDocs);

    let syncedCount = 0;
    let failedCount = 0;
    const errors = [];

    try {
        db.run("BEGIN;");

        for (const doc of documents) {
            try {
                if (!doc.title) continue;

                const subjectId = doc.subjectId
                    ? parseInt(doc.subjectId, 10)
                    : null;

                await executeQuery(
                    `INSERT INTO EduxDocuments
                        (student_id, subject_id, external_id, title, description,
                         file_url, file_type, file_size, category,
                         semester, academic_year, uploaded_by, source, synced_at)
                     VALUES
                        (@sid, @subId, @extId, @title, @desc,
                         @url, @ft, @fs, @cat,
                         @sem, @ay, @ub, 'EDUX', datetime('now'))
                     ON CONFLICT(student_id, external_id) DO UPDATE SET
                         title = excluded.title,
                         description = excluded.description,
                         file_url = excluded.file_url,
                         file_type = excluded.file_type,
                         file_size = excluded.file_size,
                         category = COALESCE(excluded.category, EduxDocuments.category),
                         synced_at = datetime('now'),
                         is_deleted_on_source = 0,
                         updated_at = datetime('now')`,
                    {
                        sid,
                        subId: subjectId,
                        extId: doc.externalId || null,
                        title: doc.title,
                        desc: doc.description || null,
                        url: doc.fileUrl || null,
                        ft: doc.fileType || null,
                        fs: doc.fileSize || null,
                        cat: doc.category || "GENERAL",
                        sem: doc.semester || null,
                        ay: doc.academicYear || null,
                        ub: doc.uploadedBy || null,
                    }
                );
                syncedCount++;
            } catch (docErr) {
                failedCount++;
                errors.push(
                    `Lỗi tài liệu "${doc.title}": ${docErr.message}`
                );
            }
        }

        // Đánh dấu tài liệu bị xóa trên nguồn (không xóa khỏi local)
        if (documents.length > 0) {
            const externalIds = documents
                .map((d) => d.externalId)
                .filter(Boolean);
            if (externalIds.length > 0) {
                const placeholders = externalIds
                    .map((_, i) => `@eid${i}`)
                    .join(",");
                const eidParams = {};
                externalIds.forEach((eid, i) => {
                    eidParams[`eid${i}`] = eid;
                });

                // Đánh dấu tài liệu cũ không có trong đợt sync này
                await executeQuery(
                    `UPDATE EduxDocuments
                     SET is_deleted_on_source = 1, updated_at = datetime('now')
                     WHERE student_id = @sid
                       AND external_id IS NOT NULL
                       AND external_id NOT IN (${placeholders})`,
                    { sid, ...eidParams }
                );
            }
        }

        db.run("COMMIT;");

        // Cập nhật log
        await executeQuery(
            `UPDATE EduxSyncLog
             SET status = @st,
                 items_synced = @is,
                 items_failed = @if2,
                 completed_at = datetime('now'),
                 rollback_data = @rd,
                 error_message = @em
             WHERE sync_id = @sid2`,
            {
                st: failedCount > 0 ? "FAILED" : "SUCCESS",
                is: syncedCount,
                if2: failedCount,
                rd: rollbackData,
                em: errors.length > 0 ? errors.join("; ") : null,
                sid2: syncId,
            }
        );

        return {
            syncId,
            syncedCount,
            failedCount,
            errors,
            success: failedCount === 0,
        };
    } catch (err) {
        try {
            db.run("ROLLBACK;");
        } catch (_) {}

        // Cập nhật log lỗi
        if (syncId) {
            await executeQuery(
                `UPDATE EduxSyncLog
                 SET status = 'FAILED',
                     error_message = @em,
                     completed_at = datetime('now'),
                     rollback_data = @rd
                 WHERE sync_id = @sid2`,
                {
                    em: err.message,
                    rd: rollbackData,
                    sid2: syncId,
                }
            );
        }

        console.error("[EDUX] Đồng bộ EDUX thất bại, đã ROLLBACK:", err.message);
        throw err;
    }
}

/**
 * Rollback đồng bộ EDUX (khôi phục dữ liệu trước đồng bộ).
 */
async function rollbackEdux(syncId) {
    if (!syncId) throw new Error("syncId là bắt buộc");

    const logRows = await executeQuery(
        "SELECT * FROM EduxSyncLog WHERE sync_id = @sid",
        { sid: parseInt(syncId, 10) }
    );
    if (!logRows.length) throw new Error("Không tìm thấy log đồng bộ");

    const log = logRows[0];
    if (!log.rollback_data) throw new Error("Không có dữ liệu rollback");

    const db = await getPool();
    const oldDocs = JSON.parse(log.rollback_data);

    try {
        db.run("BEGIN;");

        // Xóa dữ liệu hiện tại
        await executeQuery(
            "DELETE FROM EduxDocuments WHERE student_id = @sid",
            { sid: log.student_id }
        );

        // Khôi phục dữ liệu cũ
        for (const doc of oldDocs) {
            await executeQuery(
                `INSERT INTO EduxDocuments
                    (document_id, student_id, subject_id, external_id, title, description,
                     file_url, file_type, file_size, category,
                     semester, academic_year, uploaded_by, source,
                     synced_at, is_deleted_on_source, created_at, updated_at)
                 VALUES
                    (@did, @sid, @subId, @extId, @title, @desc,
                     @url, @ft, @fs, @cat,
                     @sem, @ay, @ub, @src,
                     @sa, @ids, @ca, @ua)`,
                {
                    did: doc.document_id,
                    sid: doc.student_id,
                    subId: doc.subject_id,
                    extId: doc.external_id,
                    title: doc.title,
                    desc: doc.description,
                    url: doc.file_url,
                    ft: doc.file_type,
                    fs: doc.file_size,
                    cat: doc.category,
                    sem: doc.semester,
                    ay: doc.academic_year,
                    ub: doc.uploaded_by,
                    src: doc.source,
                    sa: doc.synced_at,
                    ids: doc.is_deleted_on_source,
                    ca: doc.created_at,
                    ua: doc.updated_at,
                }
            );
        }

        db.run("COMMIT;");

        // Đánh dấu log đã rollback
        await executeQuery(
            `UPDATE EduxSyncLog
             SET status = 'ROLLED_BACK'
             WHERE sync_id = @sid`,
            { sid: parseInt(syncId, 10) }
        );

        // Tạo log mới cho rollback
        await executeQuery(
            `INSERT INTO EduxSyncLog (student_id, sync_type, status, items_synced, completed_at)
             VALUES (@sid, 'ROLLBACK', 'SUCCESS', @cnt, datetime('now'))`,
            { sid: log.student_id, cnt: oldDocs.length }
        );

        return { success: true, restoredCount: oldDocs.length };
    } catch (err) {
        try {
            db.run("ROLLBACK;");
        } catch (_) {}
        console.error("[EDUX] Rollback thất bại:", err.message);
        throw err;
    }
}

/**
 * Lấy danh sách tài liệu EDUX.
 */
async function layTaiLieuEdux(studentId, filters = {}) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    let extraFilter = "";
    const params = { sid };

    if (filters.subjectId) {
        extraFilter += " AND d.subject_id = @subId";
        params.subId = parseInt(filters.subjectId, 10);
    }
    if (filters.category) {
        extraFilter += " AND d.category = @cat";
        params.cat = filters.category;
    }
    if (!filters.includeDeleted) {
        extraFilter += " AND d.is_deleted_on_source = 0";
    }

    return await executeQuery(
        `SELECT d.document_id, d.student_id, d.subject_id,
                sub.subject_code, sub.subject_name,
                d.external_id, d.title, d.description,
                d.file_url, d.file_type, d.file_size, d.category,
                d.semester, d.academic_year, d.uploaded_by,
                d.source, d.synced_at, d.is_deleted_on_source,
                d.created_at, d.updated_at
         FROM EduxDocuments d
         LEFT JOIN Subjects sub ON d.subject_id = sub.subject_id
         WHERE d.student_id = @sid ${extraFilter}
         ORDER BY d.synced_at DESC, d.title ASC`,
        params
    );
}

/**
 * Lấy log đồng bộ EDUX.
 */
async function layLogDongBoEdux(studentId, limit = 20) {
    if (!studentId) throw new Error("studentId là bắt buộc");
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(
        `SELECT sync_id, student_id, sync_type, status,
                items_synced, items_failed, error_message,
                started_at, completed_at
         FROM EduxSyncLog
         WHERE student_id = @sid
         ORDER BY started_at DESC
         LIMIT @lim`,
        { sid, lim: limit }
    );
}

// ===================================================================================
// EXPORT
// ===================================================================================

module.exports = {
    // PB-13: Buổi tự học
    layLichTuHocTheoKhoangThoiGian,
    layThongKeBuoiTuHoc,
    hoanThanhBuoiTuHoc,

    // PB-42: Pomodoro
    batDauPomodoro,
    capNhatPomodoro,
    ketThucPomodoro,
    layLichSuPomodoro,
    layThongKePomodoro,
    layPomodoroTheoNgay,

    // PB-38: Sổ tay & Ghi chú
    taoSoTay,
    layDanhSachSoTay,
    capNhatSoTay,
    xoaSoTay,
    themGhiChu,
    layGhiChuTheoSoTay,
    layGhiChuKho,
    capNhatGhiChu,
    xoaGhiChu,
    timKiemGhiChu,

    // PB-30, PB-32: Hồ sơ học tập bổ sung
    layBangDiemTheoNamHoc,
    layLichSuHocLai,
    layTienDoHocTap,

    // PB-05, PB-06: EDUX
    dongBoEdux,
    rollbackEdux,
    layTaiLieuEdux,
    layLogDongBoEdux,
};
