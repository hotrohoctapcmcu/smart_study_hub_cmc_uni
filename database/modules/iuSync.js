'use strict';

const {
    executeQuery,
    getPool,
    beginTransaction,
    commitTransaction,
    rollbackTransaction
} = require('../connection/db');

const VALID_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];

async function saveIUData(studentCode, dataIU) {
    if (!studentCode) throw new Error('studentCode là bắt buộc');
    if (!dataIU) throw new Error('dataIU là bắt buộc');

    const maSinhVien = String(studentCode).trim();
    if (!maSinhVien) {
        throw new Error('studentCode không hợp lệ: cần mã số sinh viên (VD: ITIU21001)');
    }

    const result = {
        student: false,
        gradesCount: 0,
        timetableCount: 0,
        examsCount: 0,
        subjectsCount: 0
    };

    await getPool();

    try {
        await beginTransaction();

        const studentId = await syncIUProfile(maSinhVien, dataIU);
        result.student = true;

        await syncIUGrades(studentId, dataIU, result);
        await syncIUTimetable(studentId, dataIU, result);
        await syncIUExams(studentId, dataIU, result);

        await commitTransaction();
        console.log('[SYNC] Đồng bộ IU hoàn tất:', result);
        return result;
    } catch (err) {
        await rollbackTransaction();
        console.error('[SYNC] Lỗi đồng bộ IU, đã rollback:', err.message);
        throw err;
    }
}

async function syncIUProfile(maSinhVien, dataIU) {
    const code = maSinhVien;
    const dob = dataIU.ngay_thang_nam_sinh
        ? convertDate(dataIU.ngay_thang_nam_sinh)
        : null;
    const fullName = dataIU.ho_ten || 'Sinh viên';
    const major = dataIU.ten_nganh_hoc || 'Công nghệ thông tin';

    await executeQuery(
        `INSERT INTO Students (student_code, full_name, major, dob, enrollment_year, current_semester)
         VALUES (@code, @fn, @mj, @db, @ey, @cs)
         ON CONFLICT(student_code) DO UPDATE SET
             full_name        = excluded.full_name,
             major            = excluded.major,
             dob              = COALESCE(excluded.dob, Students.dob),
             enrollment_year  = COALESCE(excluded.enrollment_year, Students.enrollment_year),
             current_semester = COALESCE(excluded.current_semester, Students.current_semester),
             updated_at       = datetime('now')`,
        {
            code,
            fn: fullName,
            mj: major,
            db: dob,
            ey: 2023,
            cs: 'Học kỳ 1 - 2026'
        }
    );

    const studentRows = await executeQuery(
        'SELECT student_id FROM Students WHERE student_code = @code LIMIT 1',
        { code }
    );

    if (!studentRows.length) {
        throw new Error(`Không lấy được student_id sau khi upsert (student_code=${code})`);
    }

    return studentRows[0].student_id;
}

async function syncIUGrades(studentId, dataIU, result) {
    if (!dataIU.bang_diem || typeof dataIU.bang_diem !== 'object' || Array.isArray(dataIU.bang_diem)) return;

    for (const [kyKey, monList] of Object.entries(dataIU.bang_diem)) {
        if (!monList || typeof monList !== 'object' || Array.isArray(monList)) {
            continue;
        }

        for (const [tenMon, chiTiet] of Object.entries(monList)) {
            if (!chiTiet || typeof chiTiet !== 'object') continue;

            const cleanName = tenMon.replace(/_/g, ' ').trim();
            if (!cleanName) continue;
            const credits = Number(chiTiet.so_tin_chi) || 3;
            const rawScore = chiTiet.diem_tong_ket;
            const finalScore =
                rawScore === '' || rawScore === null || rawScore === undefined
                    ? null
                    : Number(rawScore);

            const rawLetter = String(chiTiet.diem_chu ?? '').trim().toUpperCase();
            const letter = VALID_GRADES.includes(rawLetter) ? rawLetter : null;

            const isPassed =
                String(chiTiet.trang_thai || '').trim().toLowerCase() === 'dat' ? 1 : 0;

            if (finalScore !== null && !Number.isFinite(finalScore)) {
                console.warn(`[SYNC] Điểm số không hợp lệ: ${cleanName}`, rawScore);
            }

            if (!letter) {
                console.warn(
                    `[SYNC] Bỏ qua điểm môn "${cleanName}", kỳ "${kyKey}": ` +
                    `điểm chữ IU không hợp lệ ${JSON.stringify(rawLetter)}`
                );
                continue;
            }

            if (finalScore !== null && !Number.isFinite(finalScore)) continue;

            const subjectId = await upsertSubjectByName(cleanName, credits, chiTiet.ma_mon || null);
            if (!subjectId) continue;

            if (subjectId > 0 && !(await subjectExisted(cleanName))) {
                result.subjectsCount++;
            }

            const exist = await executeQuery(
                `SELECT 1 FROM Grades
                 WHERE student_id = @sid AND subject_id = @subId
                   AND semester = @sem AND academic_year = @ay LIMIT 1`,
                { sid: studentId, subId: subjectId, sem: kyKey, ay: '' }
            );

            if (exist.length) {
                await executeQuery(
                    `UPDATE Grades
                     SET final_score = @fs, letter_grade = @lg,
                         is_passed = @ip, updated_at = datetime('now')
                     WHERE student_id = @sid AND subject_id = @subId
                       AND semester = @sem AND academic_year = @ay`,
                    { sid: studentId, subId: subjectId, sem: kyKey, ay: '', fs: finalScore, lg: letter, ip: isPassed }
                );
            } else {
                await executeQuery(
                    `INSERT INTO Grades
                         (student_id, subject_id, semester, academic_year,
                          credits, final_score, letter_grade, is_passed, source)
                     VALUES (@sid, @subId, @sem, @ay, @cr, @fs, @lg, @ip, 'IU')`,
                    { sid: studentId, subId: subjectId, sem: kyKey, ay: '', cr: credits, fs: finalScore, lg: letter, ip: isPassed }
                );
            }

            result.gradesCount++;
        }
    }
}

async function syncIUTimetable(studentId, dataIU, result) {
    if (!Array.isArray(dataIU.tkb)) return;

    const rangeFrom = convertDate(dataIU.tkb_range?.from);
    const rangeTo = convertDate(dataIU.tkb_range?.to);
    const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(rangeFrom || '') && /^\d{4}-\d{2}-\d{2}$/.test(rangeTo || '') && rangeFrom <= rangeTo;
    await executeQuery(
        'DELETE FROM Timetables WHERE student_id = @sid AND source = \'IU\'' +
            (hasRange ? ' AND start_date <= @toDate AND end_date >= @fromDate' : ''),
        hasRange ? { sid: studentId, fromDate: rangeFrom, toDate: rangeTo } : { sid: studentId }
    );

    for (const t of dataIU.tkb) {
        if (!t || typeof t !== 'object') continue;

        const subjectName = (t.ten_mon || '').replace(/_/g, ' ').trim();
        const subjectCode = t.ma_mon || null;

        const subjectId = await upsertSubjectByCodeOrName(subjectCode, subjectName);
        if (!subjectId) continue;

        await executeQuery(
            `INSERT INTO Timetables (
                 student_id, subject_id, class_name, room, campus,
                 day_of_week, start_time, end_time, start_date, end_date,
                 lecturer_name, semester, academic_year, source
             ) VALUES (
                 @sid, @subId, @cn, @rm, @cp,
                 @dow, @st, @et, @sd, @ed, @ln, @sem, @ay, 'IU'
             )`,
            {
                sid: studentId,
                subId: subjectId,
                cn: t.ten_lop || 'Lớp học phần',
                rm: t.phong || 'A101',
                cp: t.co_so || 'Cơ sở chính',
                dow: Number(t.thu) || 2,
                st: t.gio_bat_dau || '07:30',
                et: t.gio_ket_thuc || '09:30',
                sd: convertDate(t.ngay_bat_dau) || '2026-09-01',
                ed: convertDate(t.ngay_ket_thuc) || '2026-12-31',
                ln: t.giang_vien || null,
                sem: t.hoc_ky || null,
                ay: t.nam_hoc || null
            }
        );

        result.timetableCount++;
    }
}

async function syncIUExams(studentId, dataIU, result) {
    if (!Array.isArray(dataIU.lich_thi)) return;

    await executeQuery(
        'DELETE FROM Exams WHERE student_id = @sid AND source = \'IU\'',
        { sid: studentId }
    );

    for (const lt of dataIU.lich_thi) {
        if (!lt || typeof lt !== 'object') continue;

        const subjectName = (lt.ten_mon || '').replace(/_/g, ' ').trim();
        const subjectCode = lt.ma_mon || null;

        const subjectId = await upsertSubjectByCodeOrName(subjectCode, subjectName);
        if (!subjectId) continue;

        const ngayThi = convertDate(lt.ngay_thi);
        if (!ngayThi || !/^\d{4}-\d{2}-\d{2}$/.test(ngayThi)) {
            console.warn(
                `[SYNC] Bỏ qua lịch thi môn "${subjectName}": thiếu ngày thi hợp lệ ` +
                `(${JSON.stringify(lt.ngay_thi)})`
            );
            continue;
        }

        const gioThi = String(lt.gio_thi || '').split('-')[0].trim();
        if (!/^\d{1,2}:\d{2}$/.test(gioThi)) {
            console.warn(
                `[SYNC] Bỏ qua lịch thi môn "${subjectName}": giờ thi không hợp lệ ` +
                `(${JSON.stringify(lt.gio_thi)})`
            );
            continue;
        }

        const phut = Number(lt.thoi_luong) > 0
            ? Number(lt.thoi_luong)
            : (() => {
                const ketThuc = String(lt.gio_ket_thuc || '').trim();
                if (!/^\d{1,2}:\d{2}$/.test(ketThuc)) return 90;
                const [h1, m1] = gioThi.split(':').map(Number);
                const [h2, m2] = ketThuc.split(':').map(Number);
                const chenh = (h2 * 60 + m2) - (h1 * 60 + m1);
                return chenh > 0 ? chenh : 90;
            })();

        await executeQuery(
            `INSERT OR IGNORE INTO Exams (
                 student_id, subject_id, exam_name, exam_date, exam_time,
                 duration_minutes, room, campus, exam_format, source
             ) VALUES (
                 @sid, @subId, @name, @ed, @et,
                 @dur, @rm, @cp, @ef, 'IU'
             )`,
            {
                sid: studentId,
                subId: subjectId,
                name: 'Thi kết thúc học phần',
                ed: ngayThi,
                et: gioThi,
                dur: phut,
                rm: lt.phong_thi || 'Chưa xếp phòng',
                cp: lt.co_so || 'Cơ sở chính',
                ef: lt.hinh_thuc_thi || 'Tự luận'
            }
        );

        result.examsCount++;
    }
}

function laMaTuSinh(code) {
    return /^(SUB|MON)_\d+$/.test(String(code || '').trim());
}

async function nangCapMaMon(subjectId, maThat) {
    const code = String(maThat || '').trim();
    if (!subjectId || !code) return;

    const hienTai = await executeQuery(
        'SELECT subject_code FROM Subjects WHERE subject_id = @id LIMIT 1',
        { id: subjectId }
    );
    if (!hienTai.length) return;
    if (!laMaTuSinh(hienTai[0].subject_code)) return;

    const trung = await executeQuery(
        'SELECT 1 FROM Subjects WHERE subject_code = @code AND subject_id <> @id LIMIT 1',
        { code, id: subjectId }
    );
    if (trung.length) return;

    await executeQuery(
        'UPDATE Subjects SET subject_code = @code WHERE subject_id = @id',
        { code, id: subjectId }
    );
}

async function subjectExisted(subjectName) {
    const rows = await executeQuery(
        'SELECT 1 FROM Subjects WHERE subject_name = @name LIMIT 1',
        { name: subjectName }
    );
    return rows.length > 0;
}

async function upsertSubjectByName(subjectName, credits, subjectCode) {
    const rows = await executeQuery(
        'SELECT subject_id FROM Subjects WHERE subject_name = @name LIMIT 1',
        { name: subjectName }
    );

    if (rows.length) {
        await nangCapMaMon(rows[0].subject_id, subjectCode);
        return rows[0].subject_id;
    }

    const code = subjectCode || ('SUB_' + Math.abs(hashCode(subjectName)));
    await executeQuery(
        `INSERT INTO Subjects (subject_code, subject_name, credits)
         VALUES (@code, @name, @credits)
         ON CONFLICT(subject_code) DO NOTHING`,
        { code, name: subjectName, credits: credits || 3 }
    );

    const idRows = await executeQuery(
        'SELECT subject_id FROM Subjects WHERE subject_name = @name LIMIT 1',
        { name: subjectName }
    );

    return idRows.length ? idRows[0].subject_id : null;
}

async function upsertSubjectByCodeOrName(subjectCode, subjectName) {
    if (!subjectCode && !subjectName) return null;

    let rows = [];
    if (subjectCode) {
        rows = await executeQuery(
            'SELECT subject_id FROM Subjects WHERE subject_code = @code LIMIT 1',
            { code: subjectCode }
        );
    }
    if (!rows.length && subjectName) {
        rows = await executeQuery(
            'SELECT subject_id FROM Subjects WHERE subject_name = @name LIMIT 1',
            { name: subjectName }
        );
    }

    if (rows.length) {
        await nangCapMaMon(rows[0].subject_id, subjectCode);
        return rows[0].subject_id;
    }

    const code = subjectCode || ('MON_' + Math.abs(hashCode(subjectName)));
    await executeQuery(
        `INSERT INTO Subjects (subject_code, subject_name, credits)
         VALUES (@code, @name, 3)
         ON CONFLICT(subject_code) DO NOTHING`,
        { code, name: subjectName || code }
    );

    const idRows = await executeQuery(
        'SELECT subject_id FROM Subjects WHERE subject_code = @code LIMIT 1',
        { code }
    );

    return idRows.length ? idRows[0].subject_id : null;
}

function convertDate(dateStr) {
    if (!dateStr) return null;
    const value = String(dateStr).trim();
    const parts = value.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        if (/^\d{1,2}$/.test(day) && /^\d{1,2}$/.test(month) && /^\d{4}$/.test(year)) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
    return value;
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

module.exports = { saveIUData };
