'use strict';

const todayInVietnam = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value))
        && new Date(value).toISOString().slice(0, 10) === value;
}
const shiftDate = (value, days) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);

async function ensureSyncState(query) {
    await query(`CREATE TABLE IF NOT EXISTS TimetableSyncState (
        student_id INTEGER PRIMARY KEY REFERENCES Students(student_id) ON DELETE CASCADE,
        status TEXT NOT NULL, message TEXT NOT NULL, last_attempt_at TEXT NOT NULL,
        last_success_at TEXT, range_from TEXT, range_to TEXT
    )`);
}

async function syncTimetable({ studentId, data, query, upsertSubject, convertDate }) {
    await ensureSyncState(query);
    const from = convertDate(data.tkb_range?.from), to = convertDate(data.tkb_range?.to);
    const hasRange = validDate(from) && validDate(to) && from <= to;
    const saveState = async (status, message, count = 0) => {
        const success = status === 'updated';
        await query(`INSERT INTO TimetableSyncState(student_id,status,message,last_attempt_at,last_success_at,range_from,range_to)
            VALUES(@sid,@status,@message,@now,@success,@fromDate,@toDate)
            ON CONFLICT(student_id) DO UPDATE SET status=excluded.status,message=excluded.message,
                last_attempt_at=excluded.last_attempt_at,
                last_success_at=COALESCE(excluded.last_success_at,TimetableSyncState.last_success_at),
                range_from=excluded.range_from,range_to=excluded.range_to`, {
            sid: studentId, status, message, now: new Date().toISOString(),
            success: success ? new Date().toISOString() : null, fromDate: hasRange ? from : null, toDate: hasRange ? to : null
        });
        return { status, message, count, preserved: !success };
    };
    if (!Array.isArray(data.tkb)) return saveState('unavailable', 'Chưa lấy được lịch IU. Giữ nguyên thời khóa biểu đã lưu.');
    if (!data.tkb.length) return saveState('empty', 'IU chưa cung cấp lịch trong khoảng đã chọn. Giữ bản đã lưu; lịch học kỳ cũ vẫn xem lại được.');
    const rows = data.tkb.map(row => ({ ...row,
        from: convertDate(row?.ngay_bat_dau), to: convertDate(row?.ngay_ket_thuc),
        start: String(row?.gio_bat_dau || ''), end: String(row?.gio_ket_thuc || ''),
        hoc_ky: String(row?.hoc_ky || '').trim(), nam_hoc: String(row?.nam_hoc || '').trim()
    }));
    const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (rows.some(row => !validDate(row.from) || !validDate(row.to) || row.from > row.to
        || !validTime(row.start) || !validTime(row.end) || row.start >= row.end
        || !Number.isInteger(Number(row.thu)) || Number(row.thu) < 2 || Number(row.thu) > 8
        || !(row.ma_mon || String(row.ten_mon || '').trim())
        || hasRange && (row.from < from || row.to > to))) {
        return saveState('invalid', 'Lịch IU thiếu hoặc sai ngày/giờ. Chưa thay lịch đã lưu; hãy đồng bộ lại.');
    }

    for (const row of rows) {
        row.subjectId = await upsertSubject(row.ma_mon || null, String(row.ten_mon || '').replace(/_/g, ' ').trim());
    }

    const today = todayInVietnam();
    // Replace only verified future dates in the returned terms. Past lessons
    // and other terms remain history, even if IU no longer returns them.
    if (hasRange && to >= today) {
        const replaceFrom = from > today ? from : today;
        const terms = new Set(rows.filter(row => row.hoc_ky && row.nam_hoc).map(row => `${row.hoc_ky}|${row.nam_hoc}`));
        const old = await query("SELECT * FROM Timetables WHERE student_id=@sid AND source='IU' AND start_date<=@toDate AND end_date>=@fromDate", {
            sid: studentId, fromDate: replaceFrom, toDate: to
        });
        for (const row of old) {
            if (row.semester && row.academic_year && (!terms.size || !terms.has(`${row.semester}|${row.academic_year}`))) continue;
            // Legacy data may not identify its term. Refresh only matching
            // subjects/classes, never erase another unidentified semester.
            if ((!row.semester || !row.academic_year) && !rows.some(incoming => !incoming.hoc_ky && !incoming.nam_hoc
                && incoming.subjectId === row.subject_id && (incoming.ten_lop || 'Lớp học phần') === row.class_name)) continue;
            if (row.start_date < replaceFrom) {
                await query('UPDATE Timetables SET end_date=@end WHERE timetable_id=@id', { end: shiftDate(replaceFrom, -1), id: row.timetable_id });
                if (row.end_date > to) {
                    await query(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,lecturer_name,semester,academic_year,source)
                        VALUES(@sid,@sub,@name,@room,@campus,@dow,@start,@end,@fromDate,@toDate,@lecturer,@semester,@year,'IU')`, {
                        sid: studentId, sub: row.subject_id, name: row.class_name, room: row.room, campus: row.campus,
                        dow: row.day_of_week, start: row.start_time, end: row.end_time, fromDate: shiftDate(to, 1), toDate: row.end_date,
                        lecturer: row.lecturer_name, semester: row.semester, year: row.academic_year
                    });
                }
            } else if (row.end_date > to) {
                await query('UPDATE Timetables SET start_date=@start WHERE timetable_id=@id', { start: shiftDate(to, 1), id: row.timetable_id });
            } else await query('DELETE FROM Timetables WHERE timetable_id=@id', { id: row.timetable_id });
        }
    }

    for (const row of rows) {
        // Clip recurring rows crossing today; the old historical segment is
        // already retained. IU's normal single-day lessons need no clipping.
        const startDate = hasRange && row.from < today && row.to >= today ? today : row.from;
        const params = {
            sid: studentId, sub: row.subjectId, name: row.ten_lop || 'Lớp học phần', room: row.phong || 'Chưa xếp phòng',
            campus: row.co_so || 'Cơ sở chính', dow: Number(row.thu), start: row.start, end: row.end,
            fromDate: startDate, toDate: row.to, lecturer: row.giang_vien || null,
            semester: row.hoc_ky || null, year: row.nam_hoc || null
        };
        const existing = await query(`SELECT timetable_id FROM Timetables WHERE student_id=@sid AND subject_id=@sub AND source='IU'
            AND start_date<=@fromDate AND end_date>=@toDate AND start_time=@start AND end_time=@end AND day_of_week=@dow
            AND class_name=@name AND (@semester IS NULL OR COALESCE(semester,'')='' OR semester=@semester)
            AND (@year IS NULL OR COALESCE(academic_year,'')='' OR academic_year=@year) LIMIT 1`, params);
        if (existing.length) {
            await query('UPDATE Timetables SET room=@room,campus=@campus,lecturer_name=@lecturer,semester=COALESCE(@semester,semester),academic_year=COALESCE(@year,academic_year),updated_at=datetime(\'now\') WHERE timetable_id=@id', { ...params, id: existing[0].timetable_id });
        } else {
            await query(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,lecturer_name,semester,academic_year,source)
                VALUES(@sid,@sub,@name,@room,@campus,@dow,@start,@end,@fromDate,@toDate,@lecturer,@semester,@year,'IU')`, params);
        }
    }
    return saveState('updated', 'Đã cập nhật lịch mới. Lịch đã qua và dữ liệu cá nhân được giữ để xem lại.', rows.length);
}

module.exports = { ensureSyncState, syncTimetable };
