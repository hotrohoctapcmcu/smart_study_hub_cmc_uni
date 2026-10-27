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

const {
    getPool,
    executeQuery,
    executeProcedure,
    withTransaction,
    sql
} = require('./connection/db');
const { saveIUData } = require('./functions/sync');

// Helper: lấy student_id từ tham số đầu vào (chấp nhận student_id nguyên hoặc student_code)
//
// Ứng dụng chỉ có MỘT hồ sơ sinh viên (xem API/shared/nguoiDung.js), nhưng
// NGUOI_DUNG_ID là hằng số cấu hình (mặc định 1) trong khi student_id là
// AUTOINCREMENT. Hai giá trị này lệch nhau ngay khi bảng Students được tạo lại
// hoặc dòng cũ bị xoá (vd đồng bộ IU lần đầu tạo id = 7). Khi đó mọi endpoint
// trả rỗng dù dữ liệu vẫn còn trong DB.
// Vì vậy: nếu không khớp id/student_code, rơi về hồ sơ duy nhất đang có.
async function layStudentId(studentId) {
    const parsed = parseInt(studentId, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
        const rows = await executeQuery(
            'SELECT student_id FROM Students WHERE student_id = @sid LIMIT 1',
            { sid: parsed }
        );
        if (rows.length > 0) return rows[0].student_id;
    }
    // Thử tìm theo student_code nếu không phải số hợp lệ
    const rows = await executeQuery(
        'SELECT student_id FROM Students WHERE student_code = @code LIMIT 1',
        { code: String(studentId) }
    );
    if (rows.length > 0) return rows[0].student_id;

    // Fallback: hệ thống một-hồ-sơ — dùng hồ sơ duy nhất nếu có.
    const duyNhat = await executeQuery(
        'SELECT student_id FROM Students ORDER BY student_id LIMIT 1'
    );
    return duyNhat.length > 0 ? duyNhat[0].student_id : null;
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

    if (sid) {
        // Cập nhật bản ghi đã có
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
        `, {
            sc: data.studentCode, fn: data.fullName, mj: data.major,
            db: data.dob || null, ey: data.enrollmentYear || null,
            cs: data.currentSemester || null, ph: data.phone || null,
            av: data.avatarUrl || null, em: data.email || null,
            sid
        });
    } else {
        // Tạo mới sinh viên
        await executeQuery(`
            INSERT INTO Students (student_code, full_name, major, dob, enrollment_year, current_semester, phone, avatar_url, email)
            VALUES (@sc, @fn, @mj, @db, @ey, @cs, @ph, @av, @em)
        `, {
            sc: data.studentCode, fn: data.fullName, mj: data.major,
            db: data.dob || null, ey: data.enrollmentYear || null,
            cs: data.currentSemester || null, ph: data.phone || null,
            av: data.avatarUrl || null, em: data.email || null
        });
    }

    return await layHoSo(data.studentCode);
}

async function layBangDiem(studentId, hocKy = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
        `, { sid, hk: hocKy });
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
    `, { sid });
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

// ===================================================================================
// 2. CHỨC NĂNG 1: THỜI KHÓA BIỂU THÔNG MINH (SMART TIMETABLE)
// ===================================================================================

function sqlDayOfWeek(dateStr) {
    // JS getDay(): 0=CN, 1=T2, ..., 6=T7
    // Dự án: 2=T2, ..., 7=T7, 8=CN
    const jsDay = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getUTCDay();
    return jsDay === 0 ? 8 : jsDay + 1;
}

async function layThoiKhoaBieu(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid });
}

async function layThoiKhoaBieuTheoNgay(studentId, ngay) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!ngay) throw new Error('ngay là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid, dow: dayOfWeek, ngay });
}

async function layThoiKhoaBieuTheoTuan(studentId, tuNgay, denNgay) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!tuNgay || !denNgay) throw new Error('tuNgay và denNgay là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid, tu: tuNgay, den: denNgay });
}

async function layThoiKhoaBieuTheoMon(studentId, subjectId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!subjectId) throw new Error('subjectId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid, sid2: parseInt(subjectId, 10) });
}

async function themTietHoc(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.subjectId || !data.className || !data.room || !data.dayOfWeek || !data.startTime || !data.endTime) {
        throw new Error('subjectId, className, room, dayOfWeek, startTime, endTime là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Timetables (student_id, subject_id, class_name, room, campus,
                                day_of_week, start_time, end_time, start_date, end_date,
                                lecturer_name, semester, academic_year)
        VALUES (@sid, @subId, @cn, @rm, @cp, @dow, @st, @et, @sd, @ed, @ln, @sm, @ay)
    `, {
        sid, subId: parseInt(data.subjectId, 10),
        cn: data.className, rm: data.room, cp: data.campus || 'Cơ sở chính',
        dow: parseInt(data.dayOfWeek, 10),
        st: data.startTime, et: data.endTime,
        sd: data.startDate || '2026-09-01', ed: data.endDate || '2026-12-31',
        ln: data.lecturerName || null, sm: data.semester || null, ay: data.academicYear || null
    });
    const idRes = await executeQuery('SELECT last_insert_rowid() AS timetable_id');

    return idRes.length > 0 ? idRes[0] : null;
}

/**
 * Chuẩn hoá mức ưu tiên về đúng enum của cột Assignments.priority.
 *
 * Frontend dùng nhãn tiếng Việt ("Cao", "Trung bình", "Thấp") còn DB dùng
 * LOW/MEDIUM/HIGH/URGENT. Nhận cả hai để không phụ thuộc bên nào đổi trước.
 * Giá trị lạ rơi về MEDIUM thay vì làm hỏng CHECK constraint.
 *
 * @param {string} giaTri
 * @returns {'LOW'|'MEDIUM'|'HIGH'|'URGENT'}
 */
function chuanHoaMucUuTien(giaTri) {
    const raw = String(giaTri == null ? '' : giaTri).trim().toLowerCase();
    if (!raw) return 'MEDIUM';

    if (raw === 'urgent' || raw === 'khẩn cấp' || raw === 'khan cap') return 'URGENT';
    if (raw === 'high' || raw === 'cao') return 'HIGH';
    if (raw === 'low' || raw === 'thấp' || raw === 'thap') return 'LOW';
    if (raw === 'medium' || raw === 'trung bình' || raw === 'trung binh') return 'MEDIUM';

    return 'MEDIUM';
}

/**
 * Xóa một dòng thuộc về sinh viên hiện tại.
 *
 * Mọi thao tác xóa/sửa đều phải giới hạn theo student_id: id trên URL do client
 * gửi lên, nếu không lọc chủ sở hữu thì một request có thể sửa/xóa dữ liệu của
 * hồ sơ khác (IDOR). Khi caller không truyền studentId (tương thích code cũ),
 * giữ nguyên hành vi cũ.
 *
 * @param {string} table - tên bảng (whitelist bên dưới)
 * @param {string} idColumn - cột khóa chính
 * @param {number|string} id
 * @param {number|string|null} studentId
 * @returns {Promise<number>} số dòng bị ảnh hưởng
 */
const BANG_CHU_SO_HUU = new Set([
    'Timetables', 'StudySchedules', 'Assignments', 'Checklists',
    'Reminders', 'Exams', 'ExamStudyPlans'
]);

async function xoaTheoChuSoHuu(table, idColumn, id, studentId) {
    if (!BANG_CHU_SO_HUU.has(table)) {
        throw new Error(`Bảng không hỗ trợ xóa theo chủ sở hữu: ${table}`);
    }

    const params = { id: parseInt(id, 10) };
    let sqlText = `DELETE FROM ${table} WHERE ${idColumn} = @id`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return 0;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    const changed = await executeQuery('SELECT changes() AS so_dong');
    return changed.length ? Number(changed[0].so_dong) || 0 : 0;
}

/**
 * Cập nhật một cột trạng thái của dòng thuộc sinh viên hiện tại.
 * Trả về số dòng bị ảnh hưởng để caller biết bản ghi có tồn tại hay không.
 */
async function capNhatTrangThaiTheoChuSoHuu(table, idColumn, id, cot, giaTri, studentId) {
    if (!BANG_CHU_SO_HUU.has(table)) {
        throw new Error(`Bảng không hỗ trợ cập nhật theo chủ sở hữu: ${table}`);
    }

    const params = { id: parseInt(id, 10), gt: giaTri };
    let sqlText = `UPDATE ${table} SET ${cot} = @gt, updated_at = datetime('now') WHERE ${idColumn} = @id`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return 0;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    const changed = await executeQuery('SELECT changes() AS so_dong');
    return changed.length ? Number(changed[0].so_dong) || 0 : 0;
}

async function xoaTietHoc(timetableId, studentId = null) {
    if (!timetableId) throw new Error('timetableId là bắt buộc');
    await xoaTheoChuSoHuu('Timetables', 'timetable_id', timetableId, studentId);
    return true;
}

// ===================================================================================
// 3. CHỨC NĂNG 2: AI XẾP LỊCH TỰ HỌC & CẢNH BÁO TRÙNG (SCHEDULING & CONFLICT ALERT)
// ===================================================================================

function loiLichTuHoc(message, statusCode = 400) {
    return Object.assign(new Error(message), { statusCode });
}

let hangDoiGhiLichTuHoc = Promise.resolve();

function ghiLichTuHocTuanTu(thaoTac) {
    const ketQua = hangDoiGhiLichTuHoc.then(thaoTac, thaoTac);
    hangDoiGhiLichTuHoc = ketQua.then(() => undefined, () => undefined);
    return ketQua;
}

function kiemTraNgayTuHoc(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw loiLichTuHoc('studyDate phải có định dạng YYYY-MM-DD.');
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1000 || date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw loiLichTuHoc('studyDate không phải ngày hợp lệ.');
    }
}

function doiGioThanhPhut(value, fieldName) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw loiLichTuHoc(`${fieldName} phải có định dạng HH:mm hợp lệ.`);
    }
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
}

function chuanHoaLichTuHoc(data, current = null) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw loiLichTuHoc('Dữ liệu lịch tự học phải là một object.');
    }
    const allowedFields = new Set([
        'title', 'studyDate', 'startTime', 'endTime', 'subjectId', 'notes', 'isAiSuggested'
    ]);
    const unknownField = Object.keys(data).find(field => !allowedFields.has(field));
    if (unknownField) throw loiLichTuHoc(`Trường ${unknownField} không được hỗ trợ.`);

    const title = data.title === undefined ? current?.title : data.title;
    const studyDate = data.studyDate === undefined ? current?.study_date : data.studyDate;
    const startTime = data.startTime === undefined ? current?.start_time : data.startTime;
    const endTime = data.endTime === undefined ? current?.end_time : data.endTime;

    if (typeof title !== 'string' || !title.trim()) {
        throw loiLichTuHoc('title không được để trống.');
    }
    if (title.trim().length > 200) {
        throw loiLichTuHoc('title không được vượt quá 200 ký tự.');
    }
    kiemTraNgayTuHoc(studyDate);

    const startMinutes = doiGioThanhPhut(startTime, 'startTime');
    const endMinutes = doiGioThanhPhut(endTime, 'endTime');
    if (endMinutes <= startMinutes) {
        throw loiLichTuHoc('endTime phải sau startTime trong cùng ngày.');
    }

    const subjectId = data.subjectId === undefined
        ? current?.subject_id ?? null
        : data.subjectId === null || data.subjectId === ''
            ? null
            : Number(data.subjectId);
    if (subjectId !== null && (!Number.isInteger(subjectId) || subjectId <= 0)) {
        throw loiLichTuHoc('subjectId phải là số nguyên dương hoặc null.');
    }

    const notes = data.notes === undefined ? current?.notes ?? null : data.notes;
    if (notes !== null && typeof notes !== 'string') {
        throw loiLichTuHoc('notes phải là chuỗi hoặc null.');
    }
    if (notes && notes.length > 2000) {
        throw loiLichTuHoc('notes không được vượt quá 2.000 ký tự.');
    }
    if (data.isAiSuggested !== undefined
        && ![true, false, 0, 1].includes(data.isAiSuggested)) {
        throw loiLichTuHoc('isAiSuggested phải là boolean.');
    }

    return {
        title: title.trim(),
        studyDate,
        startTime,
        endTime,
        subjectId,
        notes,
        durationMinutes: endMinutes - startMinutes
    };
}

async function kiemTraMonHocTonTai(subjectId) {
    if (subjectId === null) return;
    const rows = await executeQuery(
        'SELECT subject_id FROM Subjects WHERE subject_id = @subjectId LIMIT 1',
        { subjectId }
    );
    if (!rows.length) throw loiLichTuHoc('Không tìm thấy môn học được chọn.');
}

async function kiemTraTrungLich(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid });
}

async function kiemTraXungDotLichTuHoc(studentId, studyDate, startTime, endTime, excludeScheduleId = null) {
    if (!studentId) throw loiLichTuHoc('studentId là bắt buộc.');
    if (!studyDate || !startTime || !endTime) {
        throw loiLichTuHoc('studyDate, startTime và endTime là bắt buộc.');
    }

    kiemTraNgayTuHoc(studyDate);
    const startMinutes = doiGioThanhPhut(startTime, 'startTime');
    const endMinutes = doiGioThanhPhut(endTime, 'endTime');
    if (endMinutes <= startMinutes) throw loiLichTuHoc('endTime phải sau startTime trong cùng ngày.');

    let excludedId = null;
    if (excludeScheduleId !== null && excludeScheduleId !== undefined && excludeScheduleId !== '') {
        excludedId = Number(excludeScheduleId);
        if (!Number.isInteger(excludedId) || excludedId <= 0) {
            throw loiLichTuHoc('excludeScheduleId phải là số nguyên dương.');
        }
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw loiLichTuHoc('Không tìm thấy hồ sơ sinh viên.', 404);

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
    `, { sid, dow: dayOfWeek, sd: studyDate, st: startTime, et: endTime });
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
    `, { sid, sd: studyDate, st: startTime, et: endTime, ex: excludedId });
    conflicts.push(...studyConflicts);

    return conflicts;
}

async function xepLichTuHoc(studentId, data = {}) {
    if (!studentId) throw loiLichTuHoc('studentId là bắt buộc.');
    const schedule = chuanHoaLichTuHoc(data);

    return ghiLichTuHocTuanTu(async () => {
        const sid = await layStudentId(studentId);
        if (!sid) throw loiLichTuHoc('Không tìm thấy hồ sơ sinh viên.', 404);
        await kiemTraMonHocTonTai(schedule.subjectId);

        const conflicts = await kiemTraXungDotLichTuHoc(
            studentId, schedule.studyDate, schedule.startTime, schedule.endTime
        );
        if (conflicts.length > 0) {
            throw loiLichTuHoc('Khung giờ tự học bị trùng với lịch học chính khóa hoặc lịch tự học khác.', 409);
        }

        await executeQuery(`
            INSERT INTO StudySchedules (student_id, subject_id, title, study_date,
                                        start_time, end_time, duration_minutes,
                                        is_ai_suggested, status, notes)
            VALUES (@sid, @subId, @title, @sd, @st, @et, @dur, @ais, 'PLANNED', @nt)
        `, {
            sid,
            subId: schedule.subjectId,
            title: schedule.title, sd: schedule.studyDate,
            st: schedule.startTime, et: schedule.endTime,
            dur: schedule.durationMinutes,
            ais: data.isAiSuggested ? 1 : 0,
            nt: schedule.notes
        });
        const idRes = await executeQuery('SELECT last_insert_rowid() AS schedule_id');

        return idRes.length > 0 ? idRes[0] : null;
    });
}

/**
 * Cập nhật một buổi tự học đã có (giờ/ngày/tiêu đề...).
 *
 * Trước đây FE sửa lịch tự học chỉ đổi state cục bộ nên thay đổi mất khi tải
 * lại; endpoint này là đường ghi thật xuống DB. Vẫn kiểm tra xung đột như lúc
 * tạo, và bỏ qua chính bản ghi đang sửa.
 *
 * @param {string} studentId
 * @param {number|string} scheduleId
 * @param {Object} data - { title?, studyDate?, startTime?, endTime?, subjectId?, notes?, isAiSuggested? }
 */
async function capNhatLichTuHoc(studentId, scheduleId, data = {}) {
    if (!studentId) throw loiLichTuHoc('studentId là bắt buộc.');
    const id = Number(scheduleId);
    if (!Number.isInteger(id) || id <= 0) throw loiLichTuHoc('scheduleId phải là số nguyên dương.');
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        throw loiLichTuHoc('Cần cung cấp ít nhất một trường để cập nhật.');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw loiLichTuHoc('Không tìm thấy hồ sơ sinh viên.', 404);

    const hienTai = await executeQuery(
        'SELECT * FROM StudySchedules WHERE schedule_id = @id AND student_id = @sid LIMIT 1',
        { id, sid }
    );
    if (hienTai.length === 0) return null;
    const cu = hienTai[0];
    const schedule = chuanHoaLichTuHoc(data, cu);

    return ghiLichTuHocTuanTu(async () => {
        await kiemTraMonHocTonTai(schedule.subjectId);
        const conflicts = await kiemTraXungDotLichTuHoc(
            studentId, schedule.studyDate, schedule.startTime, schedule.endTime, id
        );
        if (conflicts.length > 0) {
            throw loiLichTuHoc('Khung giờ tự học bị trùng với lịch học chính khóa hoặc lịch tự học khác.', 409);
        }

        await executeQuery(`
            UPDATE StudySchedules
            SET title = @title,
                subject_id = @subId,
                study_date = @sd,
                start_time = @st,
                end_time = @et,
                duration_minutes = @dur,
                notes = @nt,
                is_ai_suggested = @isAiSuggested,
                updated_at = datetime('now')
            WHERE schedule_id = @id AND student_id = @sid
        `, {
            title: schedule.title,
            subId: schedule.subjectId,
            sd: schedule.studyDate,
            st: schedule.startTime,
            et: schedule.endTime,
            dur: schedule.durationMinutes,
            nt: schedule.notes,
            isAiSuggested: data.isAiSuggested === undefined
                ? Number(cu.is_ai_suggested) || 0
                : data.isAiSuggested ? 1 : 0,
            id,
            sid
        });

        const res = await executeQuery(
            'SELECT * FROM StudySchedules WHERE schedule_id = @id AND student_id = @sid',
            { id, sid }
        );
        return res.length > 0 ? res[0] : null;
    });
}

async function layLichTuHoc(studentId, tuNgay = null, denNgay = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
        `, { sid, tu: tuNgay, de: denNgay });
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
    `, { sid });
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

async function capNhatTrangThaiLichTuHoc(scheduleId, status, studentId = null) {
    const id = Number(scheduleId);
    if (!Number.isInteger(id) || id <= 0) throw loiLichTuHoc('scheduleId phải là số nguyên dương.');
    if (!['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
        throw loiLichTuHoc('status không hợp lệ.');
    }
    const soDong = await capNhatTrangThaiTheoChuSoHuu(
        'StudySchedules', 'schedule_id', id, 'status', status, studentId
    );
    return soDong > 0;
}

async function xoaLichTuHoc(scheduleId, studentId = null) {
    const id = Number(scheduleId);
    if (!Number.isInteger(id) || id <= 0) throw loiLichTuHoc('scheduleId phải là số nguyên dương.');
    return (await xoaTheoChuSoHuu('StudySchedules', 'schedule_id', id, studentId)) > 0;
}

// ===================================================================================
// 4. CHỨC NĂNG 3: QUẢN LÝ DEADLINE VÀ CHECKLIST (DEADLINE & CHECKLIST)
// ===================================================================================

async function layDanhSachDeadline(studentId, trangThai = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    if (trangThai) {
        return await executeQuery(`
            SELECT a.assignment_id, a.student_id, a.subject_id,
                   sub.subject_code, sub.subject_name,
                   a.title, a.description, a.assigned_at, a.deadline,
                   a.status, a.priority, a.submission_url, a.source, a.external_id,
                   a.completed_at, a.created_at
            FROM Assignments a
            INNER JOIN Subjects sub ON a.subject_id = sub.subject_id
            WHERE a.student_id = @sid AND a.status = @st
            ORDER BY a.deadline ASC
        `, { sid, st: trangThai });
    }

    return await executeQuery(`
        SELECT a.assignment_id, a.student_id, a.subject_id,
               sub.subject_code, sub.subject_name,
               a.title, a.description, a.assigned_at, a.deadline,
               a.status, a.priority, a.submission_url, a.source, a.external_id,
               a.completed_at, a.created_at
        FROM Assignments a
        INNER JOIN Subjects sub ON a.subject_id = sub.subject_id
        WHERE a.student_id = @sid
        ORDER BY a.deadline ASC
    `, { sid });
}

async function layDeadlineSapToi(studentId, soNgay = 3) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    // SQLite chỉ nhận modifier dạng '+3 days' (không có khoảng trắng sau dấu).
    // Trước đây truyền '+ 3 days' nên date('now', ...) trả NULL và truy vấn
    // luôn rỗng — "Deadline sắp tới" không bao giờ hiện dù có bài đúng hạn.
    const soNgayHopLe = Number.isFinite(Number(soNgay)) && Number(soNgay) >= 0
        ? Math.floor(Number(soNgay))
        : 3;

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
    `, { sid, d: `+${soNgayHopLe} days` });
}

async function nhacNhoDaTonTai(studentId, targetType, targetId, tier) {
    const rows = await executeQuery(`
        SELECT 1
        FROM Reminders
        WHERE student_id = @sid
          AND target_type = @targetType
          AND target_id = @targetId
          AND tier = @tier
        LIMIT 1
    `, { sid: studentId, targetType, targetId, tier });
    return rows.length > 0;
}

async function themBaiTap(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.subjectId || !data.title || !data.deadline) {
        throw new Error('subjectId, title và deadline là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Assignments (student_id, subject_id, title, description,
                                 assigned_at, deadline, status, priority,
                                 submission_url, source, external_id)
        VALUES (@sid, @subId, @title, @desc, datetime('now'), @dl, 'PENDING', @pr,
                @url, @src, @ext)
    `, {
        sid,
        subId: parseInt(data.subjectId, 10),
        title: data.title,
        desc: data.description || null,
        dl: data.deadline instanceof Date ? data.deadline.toISOString() : data.deadline,
        pr: chuanHoaMucUuTien(data.priority),
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
            if (remindTime <= now) continue;
            if (await nhacNhoDaTonTai(sid, 'ASSIGNMENT', newId, t.tier)) continue;

            await executeQuery(`
                INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                VALUES (@sid, 'ASSIGNMENT', @aid, @title, @msg, @tier, @rt, 'APP')
            `, {
                sid, aid: newId,
                title: `Nhắc nhở: Sắp đến hạn bài tập: ${data.title}`,
                msg: t.msg,
                tier: t.tier,
                rt: remindTime.toISOString()
            });
        }
    }

    return newId ? { assignment_id: newId } : null;
}

async function capNhatBaiTap(assignmentId, data = {}, studentId = null) {
    if (!assignmentId) throw new Error('assignmentId là bắt buộc');

    const params = {
        tl: data.title || null,
        ds: data.description || null,
        dl: data.deadline instanceof Date ? data.deadline.toISOString() : (data.deadline || null),
        pr: data.priority !== undefined ? chuanHoaMucUuTien(data.priority) : null,
        aid: parseInt(assignmentId, 10)
    };

    let sqlText = `
        UPDATE Assignments
        SET title = COALESCE(@tl, title),
            description = COALESCE(@ds, description),
            deadline = COALESCE(@dl, deadline),
            priority = COALESCE(@pr, priority),
            updated_at = datetime('now')
        WHERE assignment_id = @aid`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return null;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    const res = await executeQuery('SELECT * FROM Assignments WHERE assignment_id = @id', {
        id: parseInt(assignmentId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function capNhatTrangThaiBaiTap(assignmentId, trangThai, studentId = null) {
    if (!assignmentId || !trangThai) throw new Error('assignmentId và trangThai là bắt buộc');

    const params = { st: trangThai, aid: parseInt(assignmentId, 10) };
    let sqlText = `
        UPDATE Assignments
        SET status = @st,
            completed_at = CASE WHEN @st = 'COMPLETED' THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        WHERE assignment_id = @aid`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return null;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    const res = await executeQuery('SELECT * FROM Assignments WHERE assignment_id = @id', {
        id: parseInt(assignmentId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

/**
 * Xóa bài tập kèm dữ liệu phụ thuộc.
 *
 * Checklists.assignment_id có khóa ngoại ON DELETE NO ACTION, nên phải xóa
 * checklist con TRƯỚC khi xóa Assignments — nếu không SQLite chặn bằng
 * "FOREIGN KEY constraint failed" và người dùng không xóa được bài tập nào
 * đã có checklist.
 */
async function xoaBaiTap(assignmentId, studentId = null) {
    if (!assignmentId) throw new Error('assignmentId là bắt buộc');
    const aid = parseInt(assignmentId, 10);

    // Kiểm tra chủ sở hữu TRƯỚC khi xóa dữ liệu con, để không đụng tới
    // checklist của bài tập thuộc hồ sơ khác.
    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) {
            throw Object.assign(new Error('Không tìm thấy hồ sơ người dùng.'), { statusCode: 404 });
        }
        const soHuu = await executeQuery(
            'SELECT 1 FROM Assignments WHERE assignment_id = @id AND student_id = @sid LIMIT 1',
            { id: aid, sid }
        );
        if (soHuu.length === 0) {
            const tonTai = await executeQuery(
                'SELECT 1 FROM Assignments WHERE assignment_id = @id LIMIT 1',
                { id: aid }
            );
            if (tonTai.length > 0) {
                throw Object.assign(new Error('Bạn không có quyền xóa bài tập này.'), { statusCode: 403 });
            }
            throw Object.assign(new Error('Không tìm thấy bài tập.'), { statusCode: 404 });
        }
    }

    // Ba câu xóa phải cùng thành công hoặc cùng hủy, nếu không sẽ còn
    // checklist/reminder mồ côi trỏ tới bài tập đã bị xóa.
    await withTransaction(async () => {
        await executeQuery("DELETE FROM Reminders WHERE target_type = 'ASSIGNMENT' AND target_id = @id", {
            id: aid
        });
        await executeQuery('DELETE FROM Checklists WHERE assignment_id = @id', { id: aid });
        await executeQuery('DELETE FROM Assignments WHERE assignment_id = @id', { id: aid });
    });
    return true;
}

async function layChecklist(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid });
}

async function themChecklist(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.title) throw new Error('title là bắt buộc');

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Checklists (student_id, subject_id, assignment_id, title, description, priority, deadline)
        VALUES (@sid, @subId, @asgId, @title, @desc, @pr, @dl)
    `, {
        sid,
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

async function capNhatChecklist(checklistId, data = {}, studentId = null) {
    if (!checklistId) throw new Error('checklistId là bắt buộc');

    const params = {
        tl: data.title || null,
        ds: data.description || null,
        pr: data.priority || null,
        dl: data.deadline || null,
        cid: parseInt(checklistId, 10)
    };

    let sqlText = `
        UPDATE Checklists
        SET title = COALESCE(@tl, title),
            description = COALESCE(@ds, description),
            priority = COALESCE(@pr, priority),
            deadline = COALESCE(@dl, deadline),
            updated_at = datetime('now')
        WHERE checklist_id = @cid`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return null;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    const res = await executeQuery('SELECT * FROM Checklists WHERE checklist_id = @id', {
        id: parseInt(checklistId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function hoanThanhChecklist(checklistId, isCompleted = true, studentId = null) {
    if (!checklistId) throw new Error('checklistId là bắt buộc');

    const params = { ic: isCompleted ? 1 : 0, cid: parseInt(checklistId, 10) };
    let sqlText = `
        UPDATE Checklists
        SET is_completed = @ic,
            completed_at = CASE WHEN @ic = 1 THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        WHERE checklist_id = @cid`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return null;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    const res = await executeQuery('SELECT * FROM Checklists WHERE checklist_id = @id', {
        id: parseInt(checklistId, 10)
    });
    return res.length > 0 ? res[0] : null;
}

async function xoaChecklist(checklistId, studentId = null) {
    const id = Number(checklistId);
    if (!Number.isInteger(id) || id <= 0) {
        throw Object.assign(new Error('checklistId phải là số nguyên dương.'), { statusCode: 400 });
    }
    return (await xoaTheoChuSoHuu('Checklists', 'checklist_id', id, studentId)) > 0;
}

// ===================================================================================
// 5. CHỨC NĂNG 4: NHẮC NHỞ THÔNG MINH ĐA TẦNG (MULTI-TIER SMART REMINDERS)
// ===================================================================================

async function layDanhSachNhacNho(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        SELECT r.reminder_id, r.student_id, r.target_type, r.target_id,
               r.title, r.message, r.tier, r.remind_time,
               r.is_sent, r.sent_at, r.channel, r.created_at
        FROM Reminders r
        WHERE r.student_id = @sid
        ORDER BY r.remind_time ASC
    `, { sid });
}

async function taoNhacNho(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.targetType || !data.targetId || !data.title || !data.remindTime) {
        throw new Error('targetType, targetId, title và remindTime là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy thông tin sinh viên');

    await executeQuery(`
        INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
        VALUES (@sid, @tt, @tid, @title, @msg, @tier, @rt, @ch)
    `, {
        sid,
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

async function taoNhacNhoDaTang(studentId, targetType, targetId, title, deadline, channel = 'APP') {
    if (!studentId || !targetType || !targetId || !title || !deadline) {
        throw new Error('studentId, targetType, targetId, title, deadline là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy thông tin sinh viên');

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
        if (remindTime <= now) continue;
        const tid = parseInt(targetId, 10);
        if (await nhacNhoDaTonTai(sid, targetType, tid, t.tier)) continue;

        await executeQuery(`
            INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
            VALUES (@sid, @tt, @tid, @title, @msg, @tier, @rt, @ch)
        `, {
            sid, tt: targetType, tid,
            title, msg: t.msg, tier: t.tier, rt: remindTime.toISOString(), ch: channel
        });
        const changed = await executeQuery('SELECT changes() AS so_dong');
        createdCount += changed.length ? Number(changed[0].so_dong) || 0 : 0;
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

async function danhDauDaGuiNhacNho(reminderId, studentId = null) {
    if (!reminderId) throw new Error('reminderId là bắt buộc');

    const params = { rid: parseInt(reminderId, 10) };
    let sqlText = `
        UPDATE Reminders
        SET is_sent = 1, sent_at = datetime('now')
        WHERE reminder_id = @rid`;

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return false;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    await executeQuery(sqlText, params);
    return true;
}

async function xoaNhacNho(reminderId, studentId = null) {
    if (!reminderId) throw new Error('reminderId là bắt buộc');
    await xoaTheoChuSoHuu('Reminders', 'reminder_id', reminderId, studentId);
    return true;
}

// ===================================================================================
// 6. CHỨC NĂNG 9: QUẢN LÝ LỊCH THI VÀ KẾ HOẠCH ÔN THI (EXAM & STUDY PLANS)
// ===================================================================================

async function layLichThi(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid });
}

async function layLichThiSapToi(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
    `, { sid });
}

async function themLichThi(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.subjectId || !data.examDate || !data.examTime || !data.room) {
        throw new Error('subjectId, examDate, examTime và room là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    await executeQuery(`
        INSERT INTO Exams (student_id, subject_id, exam_name, exam_date, exam_time,
                           duration_minutes, room, campus, exam_format, identification_number)
        VALUES (@sid, @subId, @en, @ed, @et, @dur, @rm, @cp, @ef, @idn)
    `, {
        sid,
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
                    INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                    VALUES (@sid, 'EXAM', @eid, @title, @msg, @tier, @rt, 'APP')
                `, {
                    sid, eid: newId,
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

/**
 * Cập nhật một kỳ thi đã có. FE trước đây sửa kỳ thi chỉ trong state cục bộ.
 */
async function capNhatLichThi(studentId, examId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!examId) throw new Error('examId là bắt buộc');

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

    const id = parseInt(examId, 10);
    const hienTai = await executeQuery(
        'SELECT * FROM Exams WHERE exam_id = @id AND student_id = @sid LIMIT 1',
        { id, sid }
    );
    if (hienTai.length === 0) return null;
    const cu = hienTai[0];

    await executeQuery(`
        UPDATE Exams
        SET subject_id = COALESCE(@subId, subject_id),
            exam_name = COALESCE(@name, exam_name),
            exam_date = COALESCE(@ed, exam_date),
            exam_time = COALESCE(@et, exam_time),
            duration_minutes = COALESCE(@dur, duration_minutes),
            room = COALESCE(@rm, room),
            campus = COALESCE(@cp, campus),
            exam_format = COALESCE(@ef, exam_format),
            identification_number = COALESCE(@idn, identification_number),
            updated_at = datetime('now')
        WHERE exam_id = @id AND student_id = @sid
    `, {
        subId: data.subjectId ? parseInt(data.subjectId, 10) : null,
        name: data.examName || null,
        ed: data.examDate || null,
        et: data.examTime || null,
        dur: data.durationMinutes ? parseInt(data.durationMinutes, 10) : null,
        rm: data.room || null,
        cp: data.campus || null,
        ef: data.examFormat || null,
        idn: data.identificationNumber || null,
        id,
        sid
    });

    const res = await executeQuery('SELECT * FROM Exams WHERE exam_id = @id', { id });
    return res.length > 0 ? res[0] : null;
}

async function xoaLichThi(examId, studentId = null) {
    if (!examId) throw new Error('examId là bắt buộc');
    const eid = parseInt(examId, 10);

    // ExamStudyPlans.exam_id là ON DELETE NO ACTION -> phải xóa kế hoạch ôn thi
    // trước, nếu không SQLite chặn xóa kỳ thi đã có kế hoạch.
    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return true;
        const soHuu = await executeQuery(
            'SELECT 1 FROM Exams WHERE exam_id = @id AND student_id = @sid LIMIT 1',
            { id: eid, sid }
        );
        if (soHuu.length === 0) return true;
    }

    await withTransaction(async () => {
        await executeQuery("DELETE FROM Reminders WHERE target_type = 'EXAM' AND target_id = @id", {
            id: eid
        });
        await executeQuery('DELETE FROM ExamStudyPlans WHERE exam_id = @id', { id: eid });
        await executeQuery('DELETE FROM Exams WHERE exam_id = @id', { id: eid });
    });
    return true;
}

async function layKeHoachOnThi(studentId, examId = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
        `, { sid, eid: parseInt(examId, 10) });
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
    `, { sid });
}

async function taoKeHoachOnThi(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.examId || !data.phaseTitle || !data.startDate || !data.endDate) {
        throw new Error('examId, phaseTitle, startDate, endDate là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

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
        sid,
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

async function capNhatTrangThaiKeHoachOnThi(planId, status, studentId = null) {
    if (!planId || !status) throw new Error('planId và status là bắt buộc');
    const soDong = await capNhatTrangThaiTheoChuSoHuu(
        'ExamStudyPlans', 'plan_id', planId, 'status', status, studentId
    );
    return soDong > 0;
}

async function xoaKeHoachOnThi(planId, studentId = null) {
    if (!planId) throw new Error('planId là bắt buộc');
    await xoaTheoChuSoHuu('ExamStudyPlans', 'plan_id', planId, studentId);
    return true;
}

// ===================================================================================
// 7. ĐỒNG BỘ EDUX — BÀI TẬP AI LƯU XUỐNG SQLITE
// ===================================================================================
//
// Trước đây /sync/edux/pull chỉ lưu kết quả vào Map trong RAM
// (API/shared/edux-session.js), nên tắt app là mất sạch và mở lại không thấy
// bài tập nào trong DB. Các hàm dưới đây ghi hẳn xuống bảng EduxAssignments.

const NHAN_TRANG_THAI_EDUX = {
    'Hoàn thành': 'COMPLETED',
    'Đang làm': 'IN_PROGRESS',
    'Chưa làm': 'PENDING'
};

/**
 * Lưu (upsert) danh sách bài tập EDUX của một sinh viên.
 *
 * Ghi theo khóa tự nhiên (student_id, external_id) nên đồng bộ nhiều lần
 * không sinh bản ghi trùng. Bài tập không còn trên EDUX sẽ bị xoá — trừ khi
 * người dùng đã đổi trạng thái trên app (khi đó vẫn giữ để không mất tiến độ).
 *
 * @param {string|number} userId - NGUOI_DUNG_ID của ứng dụng (không phải student_id)
 * @param {Array<object>} assignments - mảng từ mapBaiTap()
 * @returns {Promise<{saved: number, removed: number}>}
 */
async function luuBaiTapEDUX(userId, assignments) {
    if (!userId) throw new Error('userId là bắt buộc');
    if (!Array.isArray(assignments)) throw new Error('assignments phải là mảng');

    // EDUX không phụ thuộc hồ sơ IU: người dùng có thể đồng bộ EDUX trước khi
    // có Students, nên khóa theo user ứng dụng chứ không tra student_id.
    const uid = String(userId);

    let saved = 0;
    let removed = 0;

    await withTransaction(async () => {
        const giuLai = [];

        for (const item of assignments) {
            if (!item || !item.id) continue;

            const tienDo = item.progress || {};
            const docDone = Number(tienDo.daHoc) || 0;
            const docTotal = Number(tienDo.tongSo) || 0;
            const diemCaoNhat = Number.isFinite(Number(item.highestScore)) && item.highestScore !== null
                ? Number(item.highestScore)
                : null;

            await executeQuery(`
                INSERT INTO EduxAssignments (
                    user_id, external_id, title, subject_name, subject_ext_id,
                    model_id, chapter, description, status, priority,
                    highest_score, doc_done, doc_total, synced_at
                ) VALUES (
                    @uid, @ext, @title, @subName, @subId,
                    @modelId, @chapter, @desc, @status, @priority,
                    @score, @docDone, @docTotal, datetime('now')
                )
                ON CONFLICT(user_id, external_id) DO UPDATE SET
                    title         = excluded.title,
                    subject_name  = excluded.subject_name,
                    subject_ext_id= excluded.subject_ext_id,
                    model_id      = excluded.model_id,
                    chapter       = excluded.chapter,
                    description   = excluded.description,
                    status        = excluded.status,
                    priority      = excluded.priority,
                    highest_score = excluded.highest_score,
                    doc_done      = excluded.doc_done,
                    doc_total     = excluded.doc_total,
                    synced_at     = datetime('now'),
                    updated_at    = datetime('now')
            `, {
                uid,
                ext: String(item.id),
                title: item.title || 'Bài tập EDUX',
                subName: item.subject || null,
                subId: item.subjectId ? String(item.subjectId) : null,
                modelId: item.modelId ? String(item.modelId) : null,
                chapter: item.chapter || null,
                desc: item.description || null,
                status: item.status || 'Chưa làm',
                priority: chuanHoaMucUuTien(item.priority),
                score: diemCaoNhat,
                docDone,
                docTotal
            });

            giuLai.push(String(item.id));
            saved++;
        }

        // Xoá bài EDUX không còn trên cổng trường.
        const hienCo = await executeQuery(
            'SELECT external_id FROM EduxAssignments WHERE user_id = @uid',
            { uid }
        );
        for (const row of hienCo) {
            if (giuLai.includes(row.external_id)) continue;
            await executeQuery(
                'DELETE FROM EduxAssignments WHERE user_id = @uid AND external_id = @ext',
                { uid, ext: row.external_id }
            );
            removed++;
        }
    });

    return { saved, removed };
}

/**
 * Đọc bài tập EDUX đã lưu trong DB, chuẩn hoá về đúng shape task của frontend
 * (giống mapBaiTap của API/shared/edux-client.js) để FE hiển thị được ngay cả
 * khi không có phiên EDUX trong RAM (vd mở lại app).
 *
 * @param {string|number} userId - NGUOI_DUNG_ID của ứng dụng (không phải student_id)
 * @param {{subjectId?: string}} [opts]
 * @returns {Promise<Array<object>>}
 */
async function layBaiTapEDUX(userId, opts = {}) {
    if (!userId) throw new Error('userId là bắt buộc');

    const uid = String(userId);
    const params = { uid };
    let sqlText = 'SELECT * FROM EduxAssignments WHERE user_id = @uid';
    if (!opts.includeHidden) sqlText += ' AND is_hidden = 0';

    if (opts.subjectId) {
        sqlText += ' AND subject_ext_id = @subId';
        params.subId = String(opts.subjectId);
    }

    sqlText += ' ORDER BY subject_name ASC, chapter ASC, title ASC';

    const rows = await executeQuery(sqlText, params);

    return rows.map(row => ({
        id: row.external_id,
        title: row.title,
        subject: row.subject_name || 'Học phần EDUX',
        subjectId: row.subject_ext_id,
        modelId: row.model_id,
        chapter: row.chapter,
        due: null, // EDUX không công bố hạn nộp
        status: row.status,
        priority: row.priority === 'HIGH' ? 'Cao'
            : row.priority === 'LOW' ? 'Thấp'
            : row.priority === 'URGENT' ? 'Khẩn cấp'
            : 'Trung bình',
        description: row.description || '',
        progress: { daHoc: row.doc_done, tongSo: row.doc_total },
        highestScore: row.highest_score,
        source: 'EDUX',
        isLocalDraft: false,
        syncedAt: row.synced_at,
        ...(opts.includeHidden && { isHidden: Number(row.is_hidden) === 1 })
    }));
}

/** Ẩn bài tập EDUX theo người dùng để các lần đồng bộ sau không làm hiện lại. */
async function anBaiTapEDUX(userId, externalId) {
    if (!userId || !externalId) throw new Error('userId và externalId là bắt buộc');

    const uid = String(userId);
    const ext = String(externalId);
    const rows = await executeQuery(
        'SELECT 1 FROM EduxAssignments WHERE user_id = @uid AND external_id = @ext LIMIT 1',
        { uid, ext }
    );
    if (rows.length === 0) return false;

    await executeQuery(`
        UPDATE EduxAssignments
        SET is_hidden = 1, updated_at = datetime('now')
        WHERE user_id = @uid AND external_id = @ext
    `, { uid, ext });
    return true;
}

/**
 * Cập nhật trạng thái một bài tập EDUX (người dùng tick trên app).
 * Không gọi EDUX — chỉ ghi trạng thái nội bộ.
 */
async function capNhatTrangThaiBaiTapEDUX(userId, externalId, trangThai) {
    if (!userId || !externalId) throw new Error('userId và externalId là bắt buộc');

    const uid = String(userId);

    await executeQuery(`
        UPDATE EduxAssignments
        SET status = @st, updated_at = datetime('now')
        WHERE user_id = @uid AND external_id = @ext
    `, { st: trangThai || 'Chưa làm', uid, ext: String(externalId) });

    const res = await executeQuery(
        'SELECT * FROM EduxAssignments WHERE user_id = @uid AND external_id = @ext',
        { uid, ext: String(externalId) }
    );
    return res.length > 0 ? res[0] : null;
}

/**
 * Xoá toàn bộ bài tập EDUX của sinh viên (logout EDUX / ngắt kết nối).
 */
async function xoaBaiTapEDUX(userId) {
    if (!userId) throw new Error('userId là bắt buộc');
    const uid = String(userId);

    const truoc = await executeQuery(
        'SELECT COUNT(*) AS so_luong FROM EduxAssignments WHERE user_id = @uid',
        { uid }
    );
    await executeQuery('DELETE FROM EduxAssignments WHERE user_id = @uid', { uid });
    return truoc.length ? Number(truoc[0].so_luong) || 0 : 0;
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
    capNhatLichTuHoc,
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
    capNhatLichThi,
    xoaLichThi,
    layKeHoachOnThi,
    taoKeHoachOnThi,
    capNhatTrangThaiKeHoachOnThi,
    xoaKeHoachOnThi,

    // Đồng bộ EDUX — bài tập AI lưu xuống SQLite
    luuBaiTapEDUX,
    layBaiTapEDUX,
    anBaiTapEDUX,
    capNhatTrangThaiBaiTapEDUX,
    xoaBaiTapEDUX
};
