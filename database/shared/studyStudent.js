'use strict';

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
    return rows.length > 0 ? rows[0].student_id : null;
}

module.exports = { layStudentId };
