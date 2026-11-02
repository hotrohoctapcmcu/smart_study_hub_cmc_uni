const { executeQuery } = require('../connection/db');
const { layStudentId, xoaTheoChuSoHuu, capNhatTrangThaiTheoChuSoHuu } = require('../shared/academic');

const THOI_KHOA_BIEU_SELECT = `
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
`;
const THOI_KHOA_BIEU_FROM = `
        FROM Timetables t
        INNER JOIN Students s ON t.student_id = s.student_id
        INNER JOIN Subjects sub ON t.subject_id = sub.subject_id
`;

function sqlDayOfWeek(dateStr) {
    const jsDay = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getUTCDay();
    return jsDay === 0 ? 8 : jsDay + 1;
}

async function layThoiKhoaBieu(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        ${THOI_KHOA_BIEU_SELECT},
               CASE WHEN date('now') BETWEEN t.start_date AND t.end_date THEN 1 ELSE 0 END AS is_currently_active
        ${THOI_KHOA_BIEU_FROM}
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
        ${THOI_KHOA_BIEU_SELECT}
        ${THOI_KHOA_BIEU_FROM}
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
        ${THOI_KHOA_BIEU_SELECT}
        ${THOI_KHOA_BIEU_FROM}
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
        ${THOI_KHOA_BIEU_SELECT}
        ${THOI_KHOA_BIEU_FROM}
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

async function xoaTietHoc(timetableId, studentId = null) {
    if (!timetableId) throw new Error('timetableId là bắt buộc');
    return (await xoaTheoChuSoHuu('Timetables', 'timetable_id', timetableId, studentId)) > 0;
}

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

    const coKhoangNgay = tuNgay && denNgay;
    return await executeQuery(`
        SELECT ss.schedule_id, ss.student_id, ss.subject_id,
               sub.subject_code, sub.subject_name,
               ss.title, ss.study_date, ss.start_time, ss.end_time,
               ss.duration_minutes, ss.is_ai_suggested, ss.status, ss.notes,
               ss.created_at
        FROM StudySchedules ss
        LEFT JOIN Subjects sub ON ss.subject_id = sub.subject_id
        WHERE ss.student_id = @sid
        ${coKhoangNgay ? 'AND date(ss.study_date) >= date(@tu) AND date(ss.study_date) <= date(@de)' : ''}
        ORDER BY ss.study_date ASC, ss.start_time ASC
    `, coKhoangNgay ? { sid, tu: tuNgay, de: denNgay } : { sid });
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

module.exports = {
    layThoiKhoaBieu,
    layThoiKhoaBieuTheoNgay,
    layThoiKhoaBieuTheoTuan,
    layThoiKhoaBieuTheoMon,
    themTietHoc,
    xoaTietHoc,
    kiemTraTrungLich,
    kiemTraXungDotLichTuHoc,
    xepLichTuHoc,
    layLichTuHoc,
    capNhatLichTuHoc,
    timKhoangTrongTuHoc,
    capNhatTrangThaiLichTuHoc,
    xoaLichTuHoc
};
