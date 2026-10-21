/**
 * database/sprint1Service.js
 * ===================================================================================
 * BACKEND SERVICE LAYER - SPRINT 1 (CHỨC NĂNG 1, 2, 3, 4, 9, 18)
 * ===================================================================================
 * Chạy trên SQLite (sql.js) thay vì SQL Server.
 * Giữ nguyên TÊN HÀM, THAM SỐ, GIÁ TRỊ TRẢ VỀ của code gốc.
 * Các stored procedure SQL Server được viết lại thành SQL thuần SQLite.
 * ===================================================================================
 */

const { getPool, executeQuery, executeProcedure, sql } = require('./connection/db');
const { saveIUData } = require('./functions/sync');

// Helper: lấy student_id từ userId (hoặc student_id trực tiếp)
async function layStudentId(userId) {
    const rows = await executeQuery(
        `SELECT student_id FROM Students WHERE user_id = @uid OR student_id = @uid`,
        { uid: parseInt(userId, 10) }
    );
    if (rows.length === 0) return null;
    return rows[0].student_id;
}

// Helper: chuyển parameter @name sang :name (executeQuery đã làm, nhưng đảm bảo an toàn)
function cleanParams(params) {
    const out = {};
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) out[k] = v;
    }
    return out;
}

// ===================================================================================
// 1. CHỨC NĂNG 18: HỒ SƠ HỌC TẬP CÁ NHÂN (PERSONAL ACADEMIC PROFILE)
// ===================================================================================

async function layHoSo(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return null;

    const rows = await executeQuery(`
        SELECT
            s.student_id,
            s.user_id,
            s.student_code,
            s.full_name,
            s.major,
            s.dob,
            s.enrollment_year,
            s.current_semester,
            s.phone,
            s.avatar_url,
            u.email,
            u.username,
            u.is_active,
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
        INNER JOIN Users u ON s.user_id = u.user_id
        LEFT JOIN Grades g ON s.student_id = g.student_id
        WHERE s.student_id = @sid
        GROUP BY s.student_id, s.user_id, s.student_code, s.full_name, s.major,
                 s.dob, s.enrollment_year, s.current_semester, s.phone, s.avatar_url,
                 u.email, u.username, u.is_active
    `, { sid: studentId });

    return rows.length > 0 ? rows[0] : null;
}

async function luuHoSo(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.studentCode || !data.fullName || !data.major) {
        throw new Error('studentCode, fullName và major là bắt buộc');
    }

    const studentId = await layStudentId(userId);

    // Cập nhật Users
    await executeQuery(
        `UPDATE Users SET full_name = @fn, updated_at = datetime('now') WHERE user_id = @uid`,
        { fn: data.fullName, uid: parseInt(userId, 10) }
    );

    if (studentId) {
        // Upsert vào Students
        await executeQuery(`
            UPDATE Students
            SET student_code = @sc, full_name = @fn, major = @mj,
                dob = COALESCE(@db, dob),
                enrollment_year = COALESCE(@ey, enrollment_year),
                current_semester = COALESCE(@cs, current_semester),
                phone = COALESCE(@ph, phone),
                avatar_url = COALESCE(@av, avatar_url),
                updated_at = datetime('now')
            WHERE student_id = @sid
        `, {
            sc: data.studentCode, fn: data.fullName, mj: data.major,
            db: data.dob || null, ey: data.enrollmentYear || null,
            cs: data.currentSemester || null, ph: data.phone || null,
            av: data.avatarUrl || null, sid: studentId
        });
    } else {
        await executeQuery(`
            INSERT INTO Students (user_id, student_code, full_name, major, dob, enrollment_year, current_semester, phone, avatar_url)
            VALUES (@uid, @sc, @fn, @mj, @db, @ey, @cs, @ph, @av)
        `, {
            uid: parseInt(userId, 10), sc: data.studentCode, fn: data.fullName, mj: data.major,
            db: data.dob || null, ey: data.enrollmentYear || null,
            cs: data.currentSemester || null, ph: data.phone || null,
            av: data.avatarUrl || null
        });
    }

    return await layHoSo(userId);
}

async function layBangDiem(userId, hocKy = null) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    if (hocKy) {
        return await executeQuery(`
            SELECT g.grade_id, g.student_id, g.subject_id,
                   sub.subject_code, sub.subject_name,
                   g.semester, g.academic_year, g.attempt_number,
                   g.credits, g.component_score, g.exam_score,
                   g.final_score, g.letter_grade, g.total_points, g.is_passed, g.source
            FROM Grades g
            INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
            WHERE g.student_id = @sid AND g.semester = @hk
            ORDER BY g.academic_year DESC, g.semester DESC, sub.subject_name ASC
        `, { sid: studentId, hk: hocKy });
    }

    return await executeQuery(`
        SELECT g.grade_id, g.student_id, g.subject_id,
               sub.subject_code, sub.subject_name,
               g.semester, g.academic_year, g.attempt_number,
               g.credits, g.component_score, g.exam_score,
               g.final_score, g.letter_grade, g.total_points, g.is_passed, g.source
        FROM Grades g
        INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
        WHERE g.student_id = @sid
        ORDER BY g.academic_year DESC, g.semester DESC, sub.subject_name ASC
    `, { sid: studentId });
}

async function layMonHocChuaDat(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT g.grade_id, g.subject_id,
               sub.subject_code, sub.subject_name,
               g.credits, g.final_score, g.letter_grade,
               g.semester, g.academic_year, g.attempt_number
        FROM Grades g
        INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
        WHERE g.student_id = @sid AND (g.is_passed = 0 OR g.letter_grade = 'F')
        ORDER BY g.academic_year DESC, g.semester DESC
    `, { sid: studentId });
}

async function layMonHocDaDat(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT g.grade_id, g.subject_id,
               sub.subject_code, sub.subject_name,
               g.credits, g.final_score, g.letter_grade,
               g.semester, g.academic_year
        FROM Grades g
        INNER JOIN Subjects sub ON g.subject_id = sub.subject_id
        WHERE g.student_id = @sid AND g.is_passed = 1
        ORDER BY g.academic_year DESC, g.semester DESC
    `, { sid: studentId });
}

async function layDanhSachMonHoc(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT sub.subject_id, sub.subject_code, sub.subject_name,
               sub.credits, sub.department,
               COALESCE(ss.status, 'PLANNED') AS status,
               ss.semester, ss.academic_year
        FROM Subjects sub
        LEFT JOIN StudentSubjects ss ON sub.subject_id = ss.subject_id AND ss.student_id = @sid
        WHERE sub.is_active = 1
        ORDER BY sub.subject_name ASC
    `, { sid: studentId });
}

async function dongBoHoSoIU(userId, dataIU) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!dataIU) throw new Error('dataIU là bắt buộc');
    return await saveIUData(userId, dataIU);
}

// ===================================================================================
// 2. CHỨC NĂNG 1: THỜI KHÓA BIỂU THÔNG MINH (SMART TIMETABLE)
// ===================================================================================

function sqlDayOfWeek(dateStr) {
    // JS getDay(): 0=CN, 1=T2, ..., 6=T7
    // Dự án: 2=T2, ..., 7=T7, 8=CN
    const jsDay = new Date(dateStr).getDay();
    return jsDay === 0 ? 8 : jsDay + 1;
}

async function layThoiKhoaBieu(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT t.timetable_id, t.student_id, s.student_code,
               s.full_name AS student_name,
               t.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               t.class_name, t.room, t.campus, t.day_of_week,
               CASE t.day_of_week
                   WHEN 2 THEN 'Thứ Hai' WHEN 3 THEN 'Thứ Ba' WHEN 4 THEN 'Thứ Tư'
                   WHEN 5 THEN 'Thứ Năm' WHEN 6 THEN 'Thứ Sáu' WHEN 7 THEN 'Thứ Bảy'
                   WHEN 8 THEN 'Chủ Nhật' ELSE 'Không xác định'
               END AS day_of_week_name,
               t.start_time, t.end_time, t.start_date, t.end_date,
               t.lecturer_name, t.semester, t.academic_year, t.source,
               CASE WHEN date('now') BETWEEN t.start_date AND t.end_date THEN 1 ELSE 0 END AS is_currently_active
        FROM Timetables t
        INNER JOIN Students s ON t.student_id = s.student_id
        INNER JOIN Subjects sub ON t.subject_id = sub.subject_id
        WHERE t.student_id = @sid
        ORDER BY t.day_of_week ASC, t.start_time ASC
    `, { sid: studentId });
}

async function layThoiKhoaBieuTheoNgay(userId, ngay) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!ngay) throw new Error('ngay là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    const dayOfWeek = sqlDayOfWeek(ngay);

    return await executeQuery(`
        SELECT t.timetable_id, t.student_id, s.student_code,
               s.full_name AS student_name,
               t.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               t.class_name, t.room, t.campus, t.day_of_week,
               CASE t.day_of_week
                   WHEN 2 THEN 'Thứ Hai' WHEN 3 THEN 'Thứ Ba' WHEN 4 THEN 'Thứ Tư'
                   WHEN 5 THEN 'Thứ Năm' WHEN 6 THEN 'Thứ Sáu' WHEN 7 THEN 'Thứ Bảy'
                   WHEN 8 THEN 'Chủ Nhật' ELSE 'Không xác định'
               END AS day_of_week_name,
               t.start_time, t.end_time, t.start_date, t.end_date,
               t.lecturer_name, t.semester, t.academic_year, t.source
        FROM Timetables t
        INNER JOIN Students s ON t.student_id = s.student_id
        INNER JOIN Subjects sub ON t.subject_id = sub.subject_id
        WHERE t.student_id = @sid
          AND t.day_of_week = @dow
          AND date(@ngay) BETWEEN date(t.start_date) AND date(t.end_date)
        ORDER BY t.start_time ASC
    `, { sid: studentId, dow: dayOfWeek, ngay });
}

async function layThoiKhoaBieuTheoTuan(userId, tuNgay, denNgay) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!tuNgay || !denNgay) throw new Error('tuNgay và denNgay là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT t.timetable_id, t.student_id, s.student_code,
               s.full_name AS student_name,
               t.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               t.class_name, t.room, t.campus, t.day_of_week,
               CASE t.day_of_week
                   WHEN 2 THEN 'Thứ Hai' WHEN 3 THEN 'Thứ Ba' WHEN 4 THEN 'Thứ Tư'
                   WHEN 5 THEN 'Thứ Năm' WHEN 6 THEN 'Thứ Sáu' WHEN 7 THEN 'Thứ Bảy'
                   WHEN 8 THEN 'Chủ Nhật' ELSE 'Không xác định'
               END AS day_of_week_name,
               t.start_time, t.end_time, t.start_date, t.end_date,
               t.lecturer_name, t.semester, t.academic_year, t.source
        FROM Timetables t
        INNER JOIN Students s ON t.student_id = s.student_id
        INNER JOIN Subjects sub ON t.subject_id = sub.subject_id
        WHERE t.student_id = @sid
          AND date(t.start_date) <= date(@den)
          AND date(t.end_date) >= date(@tu)
        ORDER BY t.day_of_week ASC, t.start_time ASC
    `, { sid: studentId, tu: tuNgay, den: denNgay });
}

async function layThoiKhoaBieuTheoMon(userId, subjectId) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!subjectId) throw new Error('subjectId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT t.timetable_id, t.student_id, s.student_code,
               s.full_name AS student_name,
               t.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               t.class_name, t.room, t.campus, t.day_of_week,
               CASE t.day_of_week
                   WHEN 2 THEN 'Thứ Hai' WHEN 3 THEN 'Thứ Ba' WHEN 4 THEN 'Thứ Tư'
                   WHEN 5 THEN 'Thứ Năm' WHEN 6 THEN 'Thứ Sáu' WHEN 7 THEN 'Thứ Bảy'
                   WHEN 8 THEN 'Chủ Nhật' ELSE 'Không xác định'
               END AS day_of_week_name,
               t.start_time, t.end_time, t.start_date, t.end_date,
               t.lecturer_name, t.semester, t.academic_year, t.source
        FROM Timetables t
        INNER JOIN Students s ON t.student_id = s.student_id
        INNER JOIN Subjects sub ON t.subject_id = sub.subject_id
        WHERE t.student_id = @sid AND t.subject_id = @sid2
        ORDER BY t.day_of_week ASC, t.start_time ASC
    `, { sid: studentId, sid2: parseInt(subjectId, 10) });
}

async function themTietHoc(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.subjectId || !data.className || !data.room || !data.dayOfWeek || !data.startTime || !data.endTime) {
        throw new Error('subjectId, className, room, dayOfWeek, startTime, endTime là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Timetables (student_id, subject_id, class_name, room, campus,
                                day_of_week, start_time, end_time, start_date, end_date,
                                lecturer_name, semester, academic_year)
        VALUES (@sid, @subId, @cn, @rm, @cp, @dow, @st, @et, @sd, @ed, @ln, @sm, @ay)
    `, {
        sid: studentId, subId: parseInt(data.subjectId, 10),
        cn: data.className, rm: data.room, cp: data.campus || 'Cơ sở chính',
        dow: parseInt(data.dayOfWeek, 10),
        st: data.startTime, et: data.endTime,
        sd: data.startDate || '2026-09-01', ed: data.endDate || '2026-12-31',
        ln: data.lecturerName || null, sm: data.semester || null, ay: data.academicYear || null
    });
    const idRes = await executeQuery('SELECT last_insert_rowid() AS timetable_id');

    return idRes.length > 0 ? idRes[0] : null;
}

async function xoaTietHoc(timetableId) {
    if (!timetableId) throw new Error('timetableId là bắt buộc');
    await executeQuery('DELETE FROM Timetables WHERE timetable_id = @tid', {
        tid: parseInt(timetableId, 10)
    });
    return true;
}

// ===================================================================================
// 3. CHỨC NĂNG 2: AI XẾP LỊCH TỰ HỌC & CẢNH BÁO TRÙNG (SCHEDULING & CONFLICT ALERT)
// ===================================================================================

async function kiemTraTrungLich(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT t1.student_id,
               t1.timetable_id AS timetable_1_id,
               sub1.subject_code AS subject_1_code,
               sub1.subject_name AS subject_1_name,
               t1.class_name AS class_1_name,
               t1.day_of_week,
               CASE t1.day_of_week
                   WHEN 2 THEN 'Thứ Hai' WHEN 3 THEN 'Thứ Ba' WHEN 4 THEN 'Thứ Tư'
                   WHEN 5 THEN 'Thứ Năm' WHEN 6 THEN 'Thứ Sáu' WHEN 7 THEN 'Thứ Bảy'
                   WHEN 8 THEN 'Chủ Nhật' ELSE 'Không xác định'
               END AS day_name,
               t1.start_time AS t1_start, t1.end_time AS t1_end, t1.room AS room_1,
               t2.timetable_id AS timetable_2_id,
               sub2.subject_code AS subject_2_code,
               sub2.subject_name AS subject_2_name,
               t2.class_name AS class_2_name,
               t2.start_time AS t2_start, t2.end_time AS t2_end, t2.room AS room_2
        FROM Timetables t1
        INNER JOIN Timetables t2
            ON t1.student_id = t2.student_id
           AND t1.timetable_id < t2.timetable_id
           AND t1.day_of_week = t2.day_of_week
           AND t1.start_time < t2.end_time
           AND t1.end_time > t2.start_time
           AND t1.start_date <= t2.end_date
           AND t1.end_date >= t2.start_date
        INNER JOIN Subjects sub1 ON t1.subject_id = sub1.subject_id
        INNER JOIN Subjects sub2 ON t2.subject_id = sub2.subject_id
        WHERE t1.student_id = @sid
    `, { sid: studentId });
}

async function kiemTraXungDotLichTuHoc(userId, studyDate, startTime, endTime, excludeScheduleId = null) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!studyDate || !startTime || !endTime) throw new Error('studyDate, startTime và endTime là bắt buộc');

    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    const dayOfWeek = sqlDayOfWeek(studyDate);

    const conflicts = [];

    // 1. Xung đột với TKB chính khóa
    const tkbConflicts = await executeQuery(`
        SELECT 'TIMETABLE' AS conflict_type,
               t.timetable_id AS conflict_id,
               sub.subject_name AS title,
               t.room AS location,
               t.start_time, t.end_time
        FROM Timetables t
        INNER JOIN Subjects sub ON t.subject_id = sub.subject_id
        WHERE t.student_id = @sid
          AND t.day_of_week = @dow
          AND date(@sd) BETWEEN date(t.start_date) AND date(t.end_date)
          AND t.start_time < @et AND t.end_time > @st
    `, { sid: studentId, dow: dayOfWeek, sd: studyDate, st: startTime, et: endTime });
    conflicts.push(...tkbConflicts);

    // 2. Xung đột với lịch tự học khác
    const studyConflicts = await executeQuery(`
        SELECT 'STUDY_SCHEDULE' AS conflict_type,
               ss.schedule_id AS conflict_id,
               ss.title,
               'Bàn tự học' AS location,
               ss.start_time, ss.end_time
        FROM StudySchedules ss
        WHERE ss.student_id = @sid
          AND ss.study_date = @sd
          AND ss.status != 'CANCELLED'
          AND (@ex IS NULL OR ss.schedule_id != @ex)
          AND ss.start_time < @et AND ss.end_time > @st
    `, { sid: studentId, sd: studyDate, st: startTime, et: endTime, ex: excludeScheduleId ? parseInt(excludeScheduleId, 10) : null });
    conflicts.push(...studyConflicts);

    return conflicts;
}

async function xepLichTuHoc(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.title || !data.studyDate || !data.startTime || !data.endTime) {
        throw new Error('title, studyDate, startTime và endTime là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy sinh viên');

    // Kiểm tra xung đột nếu không ép buộc
    if (data.forceSave !== 1) {
        const conflicts = await kiemTraXungDotLichTuHoc(
            userId, data.studyDate, data.startTime, data.endTime, null
        );
        if (conflicts.length > 0) {
            throw new Error('Khung giờ tự học bị trùng với lịch học chính khóa hoặc lịch tự học khác.');
        }
    }

    // Tính duration
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

    await executeQuery(`
        INSERT INTO StudySchedules (student_id, subject_id, title, study_date,
                                    start_time, end_time, duration_minutes,
                                    is_ai_suggested, status, notes)
        VALUES (@sid, @subId, @title, @sd, @st, @et, @dur, @ais, 'PLANNED', @nt)
    `, {
        sid: studentId,
        subId: data.subjectId ? parseInt(data.subjectId, 10) : null,
        title: data.title, sd: data.studyDate,
        st: data.startTime, et: data.endTime,
        dur: durationMinutes,
        ais: data.isAiSuggested ? 1 : 0,
        nt: data.notes || null
    });
    const idRes = await executeQuery('SELECT last_insert_rowid() AS schedule_id');

    return idRes.length > 0 ? idRes[0] : null;
}

async function layLichTuHoc(userId, tuNgay = null, denNgay = null) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    if (tuNgay && denNgay) {
        return await executeQuery(`
            SELECT ss.schedule_id, ss.student_id, ss.subject_id,
                   sub.subject_code, sub.subject_name,
                   ss.title, ss.study_date, ss.start_time, ss.end_time,
                   ss.duration_minutes, ss.is_ai_suggested, ss.status, ss.notes,
                   ss.created_at
            FROM StudySchedules ss
            LEFT JOIN Subjects sub ON ss.subject_id = sub.subject_id
            WHERE ss.student_id = @sid
              AND date(ss.study_date) >= date(@tu)
              AND date(ss.study_date) <= date(@de)
            ORDER BY ss.study_date ASC, ss.start_time ASC
        `, { sid: studentId, tu: tuNgay, de: denNgay });
    }

    return await executeQuery(`
        SELECT ss.schedule_id, ss.student_id, ss.subject_id,
               sub.subject_code, sub.subject_name,
               ss.title, ss.study_date, ss.start_time, ss.end_time,
               ss.duration_minutes, ss.is_ai_suggested, ss.status, ss.notes,
               ss.created_at
        FROM StudySchedules ss
        LEFT JOIN Subjects sub ON ss.subject_id = sub.subject_id
        WHERE ss.student_id = @sid
        ORDER BY ss.study_date ASC, ss.start_time ASC
    `, { sid: studentId });
}

async function timKhoangTrongTuHoc(userId, ngay, thoiLuongPhut = 60) {
    if (!userId || !ngay) throw new Error('userId và ngay là bắt buộc');

    const tkbToday = await layThoiKhoaBieuTheoNgay(userId, ngay);
    const studyToday = await layLichTuHoc(userId, ngay, ngay);

    const formatTime = val => {
        if (!val) return '00:00';
        if (typeof val === 'string') return val.substring(0, 5);
        if (val instanceof Date) {
            return val.toISOString().substring(11, 16);
        }
        return String(val).substring(0, 5);
    };

    const busySlots = [];
    for (const t of tkbToday) {
        busySlots.push({ start: formatTime(t.start_time), end: formatTime(t.end_time) });
    }
    for (const s of studyToday) {
        if (s.status !== 'CANCELLED') {
            busySlots.push({ start: formatTime(s.start_time), end: formatTime(s.end_time) });
        }
    }

    busySlots.sort((a, b) => a.start.localeCompare(b.start));

    const dayStart = '07:00';
    const dayEnd = '22:00';

    const toMinutes = str => {
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    };
    const toTimeString = min => {
        const h = Math.floor(min / 60).toString().padStart(2, '0');
        const m = (min % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const freeSlots = [];
    let currentMin = toMinutes(dayStart);

    for (const slot of busySlots) {
        const slotStartMin = toMinutes(slot.start);
        const slotEndMin = toMinutes(slot.end);

        if (slotStartMin > currentMin) {
            const gap = slotStartMin - currentMin;
            if (gap >= thoiLuongPhut) {
                freeSlots.push({
                    start_time: toTimeString(currentMin),
                    end_time: toTimeString(slotStartMin),
                    duration_minutes: gap
                });
            }
        }
        if (slotEndMin > currentMin) {
            currentMin = slotEndMin;
        }
    }

    const dayEndMin = toMinutes(dayEnd);
    if (dayEndMin > currentMin) {
        const gap = dayEndMin - currentMin;
        if (gap >= thoiLuongPhut) {
            freeSlots.push({
                start_time: toTimeString(currentMin),
                end_time: toTimeString(dayEndMin),
                duration_minutes: gap
            });
        }
    }

    return freeSlots;
}

async function capNhatTrangThaiLichTuHoc(scheduleId, status) {
    if (!scheduleId || !status) throw new Error('scheduleId và status là bắt buộc');
    await executeQuery(`
        UPDATE StudySchedules
        SET status = @st, updated_at = datetime('now')
        WHERE schedule_id = @sid
    `, { st: status, sid: parseInt(scheduleId, 10) });
    return true;
}

async function xoaLichTuHoc(scheduleId) {
    if (!scheduleId) throw new Error('scheduleId là bắt buộc');
    await executeQuery('DELETE FROM StudySchedules WHERE schedule_id = @sid', {
        sid: parseInt(scheduleId, 10)
    });
    return true;
}

// ===================================================================================
// 4. CHỨC NĂNG 3: QUẢN LÝ DEADLINE VÀ CHECKLIST (DEADLINE & CHECKLIST)
// ===================================================================================

async function layDanhSachDeadline(userId, trangThai = null) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    if (trangThai) {
        return await executeQuery(`
            SELECT a.assignment_id, a.student_id, a.subject_id,
                   sub.subject_code, sub.subject_name,
                   a.title, a.description, a.assigned_at, a.deadline,
                   a.status, a.submission_url, a.source, a.external_id,
                   a.completed_at, a.created_at
            FROM Assignments a
            INNER JOIN Subjects sub ON a.subject_id = sub.subject_id
            WHERE a.student_id = @sid AND a.status = @st
            ORDER BY a.deadline ASC
        `, { sid: studentId, st: trangThai });
    }

    return await executeQuery(`
        SELECT a.assignment_id, a.student_id, a.subject_id,
               sub.subject_code, sub.subject_name,
               a.title, a.description, a.assigned_at, a.deadline,
               a.status, a.submission_url, a.source, a.external_id,
               a.completed_at, a.created_at
        FROM Assignments a
        INNER JOIN Subjects sub ON a.subject_id = sub.subject_id
        WHERE a.student_id = @sid
        ORDER BY a.deadline ASC
    `, { sid: studentId });
}

async function layDeadlineSapToi(userId, soNgay = 3) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT a.assignment_id, a.subject_id,
               sub.subject_code, sub.subject_name,
               a.title, a.deadline, a.status,
               CAST((julianday(a.deadline) - julianday('now')) * 24 AS INTEGER) AS hours_remaining
        FROM Assignments a
        INNER JOIN Subjects sub ON a.subject_id = sub.subject_id
        WHERE a.student_id = @sid
          AND a.status IN ('PENDING', 'IN_PROGRESS')
          AND date(a.deadline) BETWEEN date('now') AND date('now', @d)
        ORDER BY a.deadline ASC
    `, { sid: studentId, d: `+ ${soNgay} days` });
}

async function themBaiTap(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.subjectId || !data.title || !data.deadline) {
        throw new Error('subjectId, title và deadline là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Assignments (student_id, subject_id, title, description,
                                 assigned_at, deadline, status, submission_url, source, external_id)
        VALUES (@sid, @subId, @title, @desc, datetime('now'), @dl, 'PENDING', @url, @src, @ext)
    `, {
        sid: studentId,
        subId: parseInt(data.subjectId, 10),
        title: data.title,
        desc: data.description || null,
        dl: data.deadline instanceof Date ? data.deadline.toISOString() : data.deadline,
        url: data.submissionUrl || null,
        src: data.source || 'SYSTEM',
        ext: data.externalId || null
    });

    const idRes = await executeQuery('SELECT last_insert_rowid() AS assignment_id');
    const newId = idRes.length > 0 ? idRes[0].assignment_id : null;

    // Tự sinh nhắc nhờ đa tầng (thay thế trigger trg_Sprint1_Assignments_AutoReminders)
    if (newId) {
        const dl = new Date(data.deadline);
        const now = new Date();

        const tiers = [
            { tier: '3_DAYS',   hours: -72,  msg: 'Bài tập sẽ đến hạn sau 3 ngày nữa. Hãy kiểm tra tiến độ ngay!' },
            { tier: '24_HOURS', hours: -24,  msg: 'Chỉ còn 24 giờ nữa là hết hạn nộp bài. Vui lòng nộp bài sớm để tránh nghẽn mạng!' },
            { tier: '1_HOUR',   hours: -1,   msg: 'Thời hạn nộp bài sẽ đóng trong 1 giờ tới!' }
        ];

        for (const t of tiers) {
            const remindTime = new Date(dl.getTime() + t.hours * 60 * 60 * 1000);
            if (remindTime > now) {
                await executeQuery(`
                    INSERT INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                    VALUES (@sid, 'ASSIGNMENT', @aid, @title, @msg, @tier, @rt, 'APP')
                `, {
                    sid: studentId, aid: newId,
                    title: `Nhắc nhở: Sắp đến hạn bài tập: ${data.title}`,
                    msg: t.msg,
                    tier: t.tier,
                    rt: remindTime.toISOString()
                });
            }
        }
    }

    return newId ? { assignment_id: newId } : null;
}

async function capNhatBaiTap(assignmentId, data = {}) {
    if (!assignmentId) throw new Error('assignmentId là bắt buộc');
    await executeQuery(`
        UPDATE Assignments
        SET title = COALESCE(@tl, title),
            description = COALESCE(@ds, description),
            deadline = COALESCE(@dl, deadline),
            updated_at = datetime('now')
        WHERE assignment_id = @aid
    `, {
        tl: data.title || null, ds: data.description || null,
        dl: data.deadline instanceof Date ? data.deadline.toISOString() : (data.deadline || null),
        aid: parseInt(assignmentId, 10)
    });
    const res = await executeQuery('SELECT * FROM Assignments WHERE assignment_id = @id', {
        id: parseInt(assignmentId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function capNhatTrangThaiBaiTap(assignmentId, trangThai) {
    if (!assignmentId || !trangThai) throw new Error('assignmentId và trangThai là bắt buộc');
    await executeQuery(`
        UPDATE Assignments
        SET status = @st,
            completed_at = CASE WHEN @st = 'COMPLETED' THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        WHERE assignment_id = @aid
    `, { st: trangThai, aid: parseInt(assignmentId, 10) });
    const res = await executeQuery('SELECT * FROM Assignments WHERE assignment_id = @id', {
        id: parseInt(assignmentId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function xoaBaiTap(assignmentId) {
    if (!assignmentId) throw new Error('assignmentId là bắt buộc');
    await executeQuery("DELETE FROM Reminders WHERE target_type = 'ASSIGNMENT' AND target_id = @id", {
        id: parseInt(assignmentId, 10)
    });
    await executeQuery('DELETE FROM Assignments WHERE assignment_id = @id', {
        id: parseInt(assignmentId, 10)
    });
    return true;
}

async function layChecklist(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT c.checklist_id, c.student_id, c.subject_id,
               sub.subject_code, sub.subject_name,
               c.assignment_id, c.title, c.description,
               c.priority, c.deadline, c.is_completed,
               c.completed_at, c.created_at
        FROM Checklists c
        LEFT JOIN Subjects sub ON c.subject_id = sub.subject_id
        WHERE c.student_id = @sid
        ORDER BY c.is_completed ASC,
                 CASE c.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END ASC,
                 c.deadline ASC
    `, { sid: studentId });
}

async function themChecklist(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.title) throw new Error('title là bắt buộc');

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Checklists (student_id, subject_id, assignment_id, title, description, priority, deadline)
        VALUES (@sid, @subId, @asgId, @title, @desc, @pr, @dl)
    `, {
        sid: studentId,
        subId: data.subjectId ? parseInt(data.subjectId, 10) : null,
        asgId: data.assignmentId ? parseInt(data.assignmentId, 10) : null,
        title: data.title,
        desc: data.description || null,
        pr: data.priority || 'MEDIUM',
        dl: data.deadline instanceof Date ? data.deadline.toISOString() : (data.deadline || null)
    });

    const idRes = await executeQuery('SELECT last_insert_rowid() AS checklist_id');

    return idRes.length > 0 ? idRes[0] : null;
}

async function capNhatChecklist(checklistId, data = {}) {
    if (!checklistId) throw new Error('checklistId là bắt buộc');
    await executeQuery(`
        UPDATE Checklists
        SET title = COALESCE(@tl, title),
            description = COALESCE(@ds, description),
            priority = COALESCE(@pr, priority),
            deadline = COALESCE(@dl, deadline),
            updated_at = datetime('now')
        WHERE checklist_id = @cid
    `, {
        tl: data.title || null, ds: data.description || null,
        pr: data.priority || null, dl: data.deadline || null,
        cid: parseInt(checklistId, 10)
    });
    const res = await executeQuery('SELECT * FROM Checklists WHERE checklist_id = @id', {
        id: parseInt(checklistId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function hoanThanhChecklist(checklistId, isCompleted = true) {
    if (!checklistId) throw new Error('checklistId là bắt buộc');
    await executeQuery(`
        UPDATE Checklists
        SET is_completed = @ic,
            completed_at = CASE WHEN @ic = 1 THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        WHERE checklist_id = @cid
    `, { ic: isCompleted ? 1 : 0, cid: parseInt(checklistId, 10) });
    const res = await executeQuery('SELECT * FROM Checklists WHERE checklist_id = @id', {
        id: parseInt(checklistId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function xoaChecklist(checklistId) {
    if (!checklistId) throw new Error('checklistId là bắt buộc');
    await executeQuery('DELETE FROM Checklists WHERE checklist_id = @cid', {
        cid: parseInt(checklistId, 10)
    });
    return true;
}

// ===================================================================================
// 5. CHỨC NĂNG 4: NHẮC NHỞ THÔNG MINH ĐA TẦNG (MULTI-TIER SMART REMINDERS)
// ===================================================================================

async function layDanhSachNhacNho(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT r.reminder_id, r.student_id, r.target_type, r.target_id,
               r.title, r.message, r.tier, r.remind_time,
               r.is_sent, r.sent_at, r.channel, r.created_at
        FROM Reminders r
        WHERE r.student_id = @sid
        ORDER BY r.remind_time ASC
    `, { sid: studentId });
}

async function taoNhacNho(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.targetType || !data.targetId || !data.title || !data.remindTime) {
        throw new Error('targetType, targetId, title và remindTime là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy thông tin sinh viên');

    await executeQuery(`
        INSERT INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
        VALUES (@sid, @tt, @tid, @title, @msg, @tier, @rt, @ch)
    `, {
        sid: studentId,
        tt: data.targetType,
        tid: parseInt(data.targetId, 10),
        title: data.title,
        msg: data.message || null,
        tier: data.tier || 'CUSTOM',
        rt: data.remindTime instanceof Date ? data.remindTime.toISOString() : data.remindTime,
        ch: data.channel || 'APP'
    });

    const idRes = await executeQuery('SELECT last_insert_rowid() AS reminder_id');

    return idRes.length > 0 ? idRes[0] : null;
}

async function taoNhacNhoDaTang(userId, targetType, targetId, title, deadline, channel = 'APP') {
    if (!userId || !targetType || !targetId || !title || !deadline) {
        throw new Error('userId, targetType, targetId, title, deadline là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy thông tin sinh viên');

    const dl = new Date(deadline);
    const now = new Date();

    const tiers = [
        { tier: '7_DAYS',   hours: -7 * 24, msg: 'Còn 7 ngày nữa là đến hạn!' },
        { tier: '3_DAYS',   hours: -3 * 24, msg: 'Còn 3 ngày nữa là đến hạn, hãy tập trung hoàn thành!' },
        { tier: '24_HOURS', hours: -24,     msg: 'Chỉ còn 24 giờ! Kiểm tra và nộp bài ngay!' },
        { tier: '1_HOUR',   hours: -1,      msg: 'Hạn chót trong 1 giờ tới!' }
    ];

    let createdCount = 0;

    for (const t of tiers) {
        const remindTime = new Date(dl.getTime() + t.hours * 60 * 60 * 1000);
        if (remindTime > now) {
            await executeQuery(`
                INSERT INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                VALUES (@sid, @tt, @tid, @title, @msg, @tier, @rt, @ch)
            `, {
                sid: studentId, tt: targetType, tid: parseInt(targetId, 10),
                title, msg: t.msg, tier: t.tier, rt: remindTime.toISOString(), ch: channel
            });
            createdCount++;
        }
    }

    return { created_count: createdCount };
}

async function layNhacNhoDenHanChuaGui() {
    return await executeQuery(`
        SELECT r.reminder_id, r.student_id, s.student_code,
               s.full_name AS student_name,
               r.target_type, r.target_id, r.title, r.message,
               r.tier, r.remind_time, r.channel
        FROM Reminders r
        INNER JOIN Students s ON r.student_id = s.student_id
        WHERE r.is_sent = 0
          AND datetime(r.remind_time) <= datetime('now')
        ORDER BY r.remind_time ASC
    `);
}

async function danhDauDaGuiNhacNho(reminderId) {
    if (!reminderId) throw new Error('reminderId là bắt buộc');
    await executeQuery(`
        UPDATE Reminders
        SET is_sent = 1, sent_at = datetime('now')
        WHERE reminder_id = @rid
    `, { rid: parseInt(reminderId, 10) });
    return true;
}

async function xoaNhacNho(reminderId) {
    if (!reminderId) throw new Error('reminderId là bắt buộc');
    await executeQuery('DELETE FROM Reminders WHERE reminder_id = @rid', {
        rid: parseInt(reminderId, 10)
    });
    return true;
}

// ===================================================================================
// 6. CHỨC NĂNG 9: QUẢN LÝ LỊCH THI VÀ KẾ HOẠCH ÔN THI (EXAM & STUDY PLANS)
// ===================================================================================

async function layLichThi(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT e.exam_id, e.student_id, s.student_code, s.full_name AS student_name,
               e.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               e.exam_name, e.exam_date, e.exam_time, e.duration_minutes,
               e.room, e.campus, e.exam_format, e.identification_number, e.source,
               CAST(julianday(e.exam_date) - julianday('now') AS INTEGER) AS days_remaining,
               CASE
                   WHEN date(e.exam_date) > date('now') THEN 'UPCOMING'
                   WHEN date(e.exam_date) = date('now') THEN 'TODAY'
                   ELSE 'PAST'
               END AS exam_status,
               (SELECT COUNT(1) FROM ExamStudyPlans esp WHERE esp.exam_id = e.exam_id) AS study_plans_count
        FROM Exams e
        INNER JOIN Students s ON e.student_id = s.student_id
        INNER JOIN Subjects sub ON e.subject_id = sub.subject_id
        WHERE e.student_id = @sid
        ORDER BY e.exam_date ASC, e.exam_time ASC
    `, { sid: studentId });
}

async function layLichThiSapToi(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    return await executeQuery(`
        SELECT e.exam_id, e.student_id, s.student_code, s.full_name AS student_name,
               e.subject_id, sub.subject_code, sub.subject_name, sub.credits,
               e.exam_name, e.exam_date, e.exam_time, e.duration_minutes,
               e.room, e.campus, e.exam_format, e.identification_number, e.source,
               CAST(julianday(e.exam_date) - julianday('now') AS INTEGER) AS days_remaining,
               CASE
                   WHEN date(e.exam_date) > date('now') THEN 'UPCOMING'
                   WHEN date(e.exam_date) = date('now') THEN 'TODAY'
                   ELSE 'PAST'
               END AS exam_status,
               (SELECT COUNT(1) FROM ExamStudyPlans esp WHERE esp.exam_id = e.exam_id) AS study_plans_count
        FROM Exams e
        INNER JOIN Students s ON e.student_id = s.student_id
        INNER JOIN Subjects sub ON e.subject_id = sub.subject_id
        WHERE e.student_id = @sid
          AND date(e.exam_date) >= date('now')
        ORDER BY e.exam_date ASC, e.exam_time ASC
    `, { sid: studentId });
}

async function themLichThi(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.subjectId || !data.examDate || !data.examTime || !data.room) {
        throw new Error('subjectId, examDate, examTime và room là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Exams (student_id, subject_id, exam_name, exam_date, exam_time,
                           duration_minutes, room, campus, exam_format, identification_number)
        VALUES (@sid, @subId, @en, @ed, @et, @dur, @rm, @cp, @ef, @idn)
    `, {
        sid: studentId,
        subId: parseInt(data.subjectId, 10),
        en: data.examName || 'Thi kết thúc học phần',
        ed: data.examDate, et: data.examTime,
        dur: data.durationMinutes ? parseInt(data.durationMinutes, 10) : 90,
        rm: data.room, cp: data.campus || 'Cơ sở 1',
        ef: data.examFormat || 'Tự luận', idn: data.identificationNumber || null
    });

    const idRes = await executeQuery('SELECT last_insert_rowid() AS exam_id');
    const newId = idRes.length > 0 ? idRes[0].exam_id : null;

    // Tự sinh nhắc nhở đa tầng (thay thế trigger trg_Sprint1_Exams_AutoReminders)
    if (newId) {
        const subRes = await executeQuery('SELECT subject_name FROM Subjects WHERE subject_id = @sid2', {
            sid2: parseInt(data.subjectId, 10)
        });
        const subjectName = subRes.length > 0 ? subRes[0].subject_name : '';

        const examDateTime = new Date(`${data.examDate}T${data.examTime}`);
        const now = new Date();

        const tiers = [
            { tier: '7_DAYS',   hours: -7 * 24, msg: `Kỳ thi môn ${subjectName} sẽ diễn ra vào ngày ${data.examDate}. Hãy bắt đầu giai đoạn ôn tổng kết!` },
            { tier: '3_DAYS',   hours: -3 * 24, msg: `Địa điểm: Phòng ${data.room} (${data.campus || 'Cơ sở 1'}). Chuẩn bị thẻ sinh viên và dụng cụ thi!` },
            { tier: '24_HOURS', hours: -24,     msg: `Giờ thi: ${data.examTime}, Phòng ${data.room}. Ngủ sớm giữ sức khỏe!` }
        ];

        for (const t of tiers) {
            const remindTime = new Date(examDateTime.getTime() + t.hours * 60 * 60 * 1000);
            if (remindTime > now) {
                await executeQuery(`
                    INSERT INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                    VALUES (@sid, 'EXAM', @eid, @title, @msg, @tier, @rt, 'APP')
                `, {
                    sid: studentId, eid: newId,
                    title: `Nhắc thi: ${t.tier === '7_DAYS' ? 'Còn 7 ngày nữa thi môn ' : t.tier === '3_DAYS' ? 'Cảnh báo thi: Còn 3 ngày nữa thi môn ' : 'KHẨN: Ngày mai thi môn '}${subjectName}`,
                    msg: t.msg,
                    tier: t.tier,
                    rt: remindTime.toISOString()
                });
            }
        }
    }

    return newId ? { exam_id: newId } : null;
}

async function xoaLichThi(examId) {
    if (!examId) throw new Error('examId là bắt buộc');
    await executeQuery("DELETE FROM Reminders WHERE target_type = 'EXAM' AND target_id = @id", {
        id: parseInt(examId, 10)
    });
    await executeQuery('DELETE FROM ExamStudyPlans WHERE exam_id = @id', {
        id: parseInt(examId, 10)
    });
    await executeQuery('DELETE FROM Exams WHERE exam_id = @id', {
        id: parseInt(examId, 10)
    });
    return true;
}

async function layKeHoachOnThi(userId, examId = null) {
    if (!userId) throw new Error('userId là bắt buộc');
    const studentId = await layStudentId(userId);
    if (!studentId) return [];

    if (examId) {
        return await executeQuery(`
            SELECT esp.plan_id, esp.student_id, esp.exam_id,
                   e.exam_name, e.exam_date,
                   esp.subject_id, sub.subject_code, sub.subject_name,
                   esp.phase_title, esp.target_description,
                   esp.start_date, esp.end_date, esp.priority, esp.status, esp.notes,
                   esp.created_at
            FROM ExamStudyPlans esp
            INNER JOIN Exams e ON esp.exam_id = e.exam_id
            INNER JOIN Subjects sub ON esp.subject_id = sub.subject_id
            WHERE esp.student_id = @sid AND esp.exam_id = @eid
            ORDER BY esp.start_date ASC
        `, { sid: studentId, eid: parseInt(examId, 10) });
    }

    return await executeQuery(`
        SELECT esp.plan_id, esp.student_id, esp.exam_id,
               e.exam_name, e.exam_date,
               esp.subject_id, sub.subject_code, sub.subject_name,
               esp.phase_title, esp.target_description,
               esp.start_date, esp.end_date, esp.priority, esp.status, esp.notes,
               esp.created_at
        FROM ExamStudyPlans esp
        INNER JOIN Exams e ON esp.exam_id = e.exam_id
        INNER JOIN Subjects sub ON esp.subject_id = sub.subject_id
        WHERE esp.student_id = @sid
        ORDER BY esp.start_date ASC
    `, { sid: studentId });
}

async function taoKeHoachOnThi(userId, data = {}) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!data.examId || !data.phaseTitle || !data.startDate || !data.endDate) {
        throw new Error('examId, phaseTitle, startDate, endDate là bắt buộc');
    }

    const studentId = await layStudentId(userId);
    if (!studentId) throw new Error('Không tìm thấy sinh viên');

    // Lấy subject_id từ Exams
    const examRes = await executeQuery('SELECT subject_id FROM Exams WHERE exam_id = @eid', {
        eid: parseInt(data.examId, 10)
    });
    const subjectId = examRes.length > 0 ? examRes[0].subject_id : null;

    await executeQuery(`
        INSERT INTO ExamStudyPlans (student_id, exam_id, subject_id, phase_title,
                                    target_description, start_date, end_date, priority, status, notes)
        VALUES (@sid, @eid, @subId, @pt, @td, @sd, @ed, @pr, 'PLANNED', @nt)
    `, {
        sid: studentId,
        eid: parseInt(data.examId, 10),
        subId: subjectId,
        pt: data.phaseTitle,
        td: data.targetDescription || null,
        sd: data.startDate, ed: data.endDate,
        pr: data.priority || 'HIGH',
        nt: data.notes || null
    });

    const idRes = await executeQuery('SELECT last_insert_rowid() AS plan_id');

    return idRes.length > 0 ? idRes[0] : null;
}

async function capNhatTrangThaiKeHoachOnThi(planId, status) {
    if (!planId || !status) throw new Error('planId và status là bắt buộc');
    await executeQuery(`
        UPDATE ExamStudyPlans
        SET status = @st, updated_at = datetime('now')
        WHERE plan_id = @pid
    `, { st: status, pid: parseInt(planId, 10) });
    return true;
}

async function xoaKeHoachOnThi(planId) {
    if (!planId) throw new Error('planId là bắt buộc');
    await executeQuery('DELETE FROM ExamStudyPlans WHERE plan_id = @pid', {
        pid: parseInt(planId, 10)
    });
    return true;
}

module.exports = {
    // Chức năng 18: Hồ sơ học tập cá nhân
    layHoSo,
    luuHoSo,
    layBangDiem,
    layMonHocChuaDat,
    layMonHocDaDat,
    layDanhSachMonHoc,
    dongBoHoSoIU,

    // Chức năng 1: Thời khóa biểu thông minh
    layThoiKhoaBieu,
    layThoiKhoaBieuTheoNgay,
    layThoiKhoaBieuTheoTuan,
    layThoiKhoaBieuTheoMon,
    themTietHoc,
    xoaTietHoc,

    // Chức năng 2: AI xếp lịch tự học & cảnh báo trùng
    kiemTraTrungLich,
    kiemTraXungDotLichTuHoc,
    xepLichTuHoc,
    layLichTuHoc,
    timKhoangTrongTuHoc,
    capNhatTrangThaiLichTuHoc,
    xoaLichTuHoc,

    // Chức năng 3: Quản lý Deadline và Checklist
    layDanhSachDeadline,
    layDeadlineSapToi,
    themBaiTap,
    capNhatBaiTap,
    capNhatTrangThaiBaiTap,
    xoaBaiTap,
    layChecklist,
    themChecklist,
    capNhatChecklist,
    hoanThanhChecklist,
    xoaChecklist,

    // Chức năng 4: Nhắc nhở thông minh đa tầng
    layDanhSachNhacNho,
    taoNhacNho,
    taoNhacNhoDaTang,
    layNhacNhoDenHanChuaGui,
    danhDauDaGuiNhacNho,
    xoaNhacNho,

    // Chức năng 9: Quản lý lịch thi và kế hoạch ôn thi
    layLichThi,
    layLichThiSapToi,
    themLichThi,
    xoaLichThi,
    layKeHoachOnThi,
    taoKeHoachOnThi,
    capNhatTrangThaiKeHoachOnThi,
    xoaKeHoachOnThi
};
