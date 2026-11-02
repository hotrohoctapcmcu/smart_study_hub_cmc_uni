const { executeQuery } = require('../connection/db');

async function layStudentId(studentId) {
    const parsed = parseInt(studentId, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
        const rows = await executeQuery(
            'SELECT student_id FROM Students WHERE student_id = @sid LIMIT 1',
            { sid: parsed }
        );
        if (rows.length > 0) return rows[0].student_id;
    }

    const rows = await executeQuery(
        'SELECT student_id FROM Students WHERE student_code = @code LIMIT 1',
        { code: String(studentId) }
    );
    if (rows.length > 0) return rows[0].student_id;

    const duyNhat = await executeQuery(
        'SELECT student_id FROM Students ORDER BY student_id LIMIT 1'
    );
    return duyNhat.length > 0 ? duyNhat[0].student_id : null;
}

function chuanHoaMucUuTien(giaTri) {
    const raw = String(giaTri == null ? '' : giaTri).trim().toLowerCase();
    if (raw === 'urgent' || raw === 'khẩn cấp' || raw === 'khan cap') return 'URGENT';
    if (raw === 'high' || raw === 'cao') return 'HIGH';
    if (raw === 'low' || raw === 'thấp' || raw === 'thap') return 'LOW';
    return 'MEDIUM';
}

const BANG_CHU_SO_HUU = new Set([
    'Timetables', 'StudySchedules', 'Assignments', 'Checklists',
    'Reminders', 'Exams', 'ExamStudyPlans'
]);

async function xoaTheoChuSoHuu(table, idColumn, id, studentId) {
    if (!BANG_CHU_SO_HUU.has(table)) {
        throw new Error(`Bảng không hỗ trợ xóa theo chủ sở hữu: ${table}`);
    }

    return executeOwnedChange(
        `DELETE FROM ${table} WHERE ${idColumn} = @id`,
        idColumn, { id: parseInt(id, 10) }, studentId
    );
}

async function capNhatTrangThaiTheoChuSoHuu(table, idColumn, id, cot, giaTri, studentId) {
    if (!BANG_CHU_SO_HUU.has(table)) {
        throw new Error(`Bảng không hỗ trợ cập nhật theo chủ sở hữu: ${table}`);
    }

    return executeOwnedChange(
        `UPDATE ${table} SET ${cot} = @gt, updated_at = datetime('now') WHERE ${idColumn} = @id`,
        idColumn, { id: parseInt(id, 10), gt: giaTri }, studentId
    );
}

async function executeOwnedChange(sqlText, idColumn, params, studentId) {
    if (studentId) {
        const sid = await layStudentId(studentId);
        if (!sid) return 0;
        sqlText += ' AND student_id = @sid';
        params.sid = sid;
    }

    const changed = await executeQuery(`${sqlText} RETURNING ${idColumn}`, params);
    return changed.length;
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

module.exports = {
    layStudentId,
    chuanHoaMucUuTien,
    xoaTheoChuSoHuu,
    capNhatTrangThaiTheoChuSoHuu,
    nhacNhoDaTonTai
};
