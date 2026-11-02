const { executeQuery } = require('../connection/db');
const { layStudentId, xoaTheoChuSoHuu, nhacNhoDaTonTai } = require('../shared/academic');

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

    for (const { tier, hours, msg } of tiers) {
        const remindTime = new Date(dl.getTime() + hours * 60 * 60 * 1000);
        if (remindTime <= now) continue;
        const tid = parseInt(targetId, 10);
        if (await nhacNhoDaTonTai(sid, targetType, tid, tier)) continue;

        await executeQuery(`
            INSERT OR IGNORE INTO Reminders (student_id, target_type, target_id, title, message, tier, remind_time, channel)
            VALUES (@sid, @tt, @tid, @title, @msg, @tier, @rt, @ch)
        `, {
            sid, tt: targetType, tid,
            title, msg, tier, rt: remindTime.toISOString(), ch: channel
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

    const changed = await executeQuery(`${sqlText} RETURNING reminder_id`, params);
    return changed.length > 0;
}

async function xoaNhacNho(reminderId, studentId = null) {
    if (!reminderId) throw new Error('reminderId là bắt buộc');
    return (await xoaTheoChuSoHuu('Reminders', 'reminder_id', reminderId, studentId)) > 0;
}

module.exports = {
    layDanhSachNhacNho,
    taoNhacNho,
    taoNhacNhoDaTang,
    layNhacNhoDenHanChuaGui,
    danhDauDaGuiNhacNho,
    xoaNhacNho
};
