const { executeQuery, withTransaction } = require('../connection/db');
const { layStudentId, chuanHoaMucUuTien, xoaTheoChuSoHuu, nhacNhoDaTonTai } = require('../shared/academic');

async function layDanhSachDeadline(studentId, trangThai = null) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

    return await executeQuery(`
        SELECT a.assignment_id, a.student_id, a.subject_id,
               sub.subject_code, sub.subject_name,
               a.title, a.description, a.assigned_at, a.deadline,
               a.status, a.priority, a.submission_url, a.source, a.external_id,
               a.completed_at, a.created_at, a.tags
        FROM Assignments a
        INNER JOIN Subjects sub ON a.subject_id = sub.subject_id
        WHERE a.student_id = @sid ${trangThai ? 'AND a.status = @st' : ''}
        ORDER BY a.deadline ASC
    `, trangThai ? { sid, st: trangThai } : { sid });
}

async function layDeadlineSapToi(studentId, soNgay = 3) {
    if (!studentId) throw new Error('studentId là bắt buộc');
    const sid = await layStudentId(studentId);
    if (!sid) return [];

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

    if (newId) {
        const dl = new Date(data.deadline);
        const now = new Date();

        const tiers = [
            { tier: '3_DAYS',   hours: -72,  msg: 'Bài tập sẽ đến hạn sau 3 ngày nữa. Hãy kiểm tra tiến độ ngay!' },
            { tier: '24_HOURS', hours: -24,  msg: 'Chỉ còn 24 giờ nữa là hết hạn nộp bài. Vui lòng nộp bài sớm để tránh nghẽn mạng!' },
            { tier: '1_HOUR',   hours: -1,   msg: 'Thời hạn nộp bài sẽ đóng trong 1 giờ tới!' }
        ];

        for (const { tier, hours, msg } of tiers) {
            const remindTime = new Date(dl.getTime() + hours * 60 * 60 * 1000);
            if (remindTime <= now) continue;
            if (await nhacNhoDaTonTai(sid, 'ASSIGNMENT', newId, tier)) continue;

            await executeQuery(`
                INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
                VALUES (@sid, 'ASSIGNMENT', @aid, @title, @msg, @tier, @rt, 'APP')
            `, {
                sid, aid: newId,
                title: `Nhắc nhở: Sắp đến hạn bài tập: ${data.title}`,
                msg,
                tier,
                rt: remindTime.toISOString()
            });
        }
    }

    return newId ? { assignment_id: newId } : null;
}

async function capNhatTheoChuSoHuu(sqlText, params, studentId) {
    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return null;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    const rows = await executeQuery(`${sqlText} RETURNING *`, params);
    return rows.length > 0 ? rows[0] : null;
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

    const sqlText = `
        UPDATE Assignments
        SET title = COALESCE(@tl, title),
            description = COALESCE(@ds, description),
            deadline = COALESCE(@dl, deadline),
            priority = COALESCE(@pr, priority),
            updated_at = datetime('now')
        WHERE assignment_id = @aid`;

    return capNhatTheoChuSoHuu(sqlText, params, studentId);
}

async function capNhatTrangThaiBaiTap(assignmentId, trangThai, studentId = null) {
    if (!assignmentId || !trangThai) throw new Error('assignmentId và trangThai là bắt buộc');

    const params = { st: trangThai, aid: parseInt(assignmentId, 10) };
    const sqlText = `
        UPDATE Assignments
        SET status = @st,
            completed_at = CASE WHEN @st = 'COMPLETED' THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        WHERE assignment_id = @aid`;

    return capNhatTheoChuSoHuu(sqlText, params, studentId);
}

async function xoaBaiTap(assignmentId, studentId = null) {
    if (!assignmentId) throw new Error('assignmentId là bắt buộc');
    const aid = parseInt(assignmentId, 10);

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

    const sqlText = `
        UPDATE Checklists
        SET title = COALESCE(@tl, title),
            description = COALESCE(@ds, description),
            priority = COALESCE(@pr, priority),
            deadline = COALESCE(@dl, deadline),
            updated_at = datetime('now')
        WHERE checklist_id = @cid`;

    return capNhatTheoChuSoHuu(sqlText, params, studentId);
}

async function hoanThanhChecklist(checklistId, isCompleted = true, studentId = null) {
    if (!checklistId) throw new Error('checklistId là bắt buộc');

    const params = { ic: isCompleted ? 1 : 0, cid: parseInt(checklistId, 10) };
    const sqlText = `
        UPDATE Checklists
        SET is_completed = @ic,
            completed_at = CASE WHEN @ic = 1 THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        WHERE checklist_id = @cid`;

    return capNhatTheoChuSoHuu(sqlText, params, studentId);
}

async function xoaChecklist(checklistId, studentId = null) {
    const id = Number(checklistId);
    if (!Number.isInteger(id) || id <= 0) {
        throw Object.assign(new Error('checklistId phải là số nguyên dương.'), { statusCode: 400 });
    }
    return (await xoaTheoChuSoHuu('Checklists', 'checklist_id', id, studentId)) > 0;
}

module.exports = {
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
    xoaChecklist
};
