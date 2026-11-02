const { executeQuery, withTransaction } = require('../connection/db');
const { layStudentId, xoaTheoChuSoHuu, capNhatTrangThaiTheoChuSoHuu } = require('../shared/academic');

const LICH_THI_SELECT = `
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
`;

async function layLichThi(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        ${LICH_THI_SELECT}
        ORDER BY e.exam_date ASC, e.exam_time ASC
    `, { sid });
}

async function layLichThiSapToi(studentId) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        ${LICH_THI_SELECT}
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

        for (const { tier, hours, msg } of tiers) {
            const remindTime = new Date(examDateTime.getTime() + hours * 60 * 60 * 1000);
            if (remindTime > now) {
                await executeQuery(`
                    INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                    VALUES (@sid, 'EXAM', @eid, @title, @msg, @tier, @rt, 'APP')
                `, {
                    sid, eid: newId,
                    title: `Nhắc thi: ${tier === '7_DAYS' ? 'Còn 7 ngày nữa thi môn ' : tier === '3_DAYS' ? 'Cảnh báo thi: Còn 3 ngày nữa thi môn ' : 'KHẨN: Ngày mai thi môn '}${subjectName}`,
                    msg,
                    tier,
                    rt: remindTime.toISOString()
                });
            }
        }
    }

    return newId ? { exam_id: newId } : null;
}

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

    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return false;
        const soHuu = await executeQuery(
            'SELECT 1 FROM Exams WHERE exam_id = @id AND student_id = @sid LIMIT 1',
            { id: eid, sid }
        );
        if (soHuu.length === 0) return false;
    }

    return withTransaction(async () => {
        await executeQuery("DELETE FROM Reminders WHERE target_type = 'EXAM' AND target_id = @id", {
            id: eid
        });
        await executeQuery('DELETE FROM ExamStudyPlans WHERE exam_id = @id', { id: eid });
        const deleted = await executeQuery('DELETE FROM Exams WHERE exam_id = @id RETURNING exam_id', { id: eid });
        return deleted.length > 0;
    });
}

async function layKeHoachOnThi(studentId, examId = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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
        WHERE esp.student_id = @sid ${examId ? 'AND esp.exam_id = @eid' : ''}
        ORDER BY esp.start_date ASC
    `, examId ? { sid, eid: parseInt(examId, 10) } : { sid });
}

async function taoKeHoachOnThi(studentId, data = {}) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    if (!data.examId || !data.phaseTitle || !data.startDate || !data.endDate) {
        throw new Error('examId, phaseTitle, startDate, endDate là bắt buộc');
    }

    const sid = await layStudentId(studentId);
    if (!sid) throw new Error('Không tìm thấy sinh viên');

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
    return (await xoaTheoChuSoHuu('ExamStudyPlans', 'plan_id', planId, studentId)) > 0;
}

module.exports = {
    layLichThi,
    layLichThiSapToi,
    themLichThi,
    capNhatLichThi,
    xoaLichThi,
    layKeHoachOnThi,
    taoKeHoachOnThi,
    capNhatTrangThaiKeHoachOnThi,
    xoaKeHoachOnThi
};
