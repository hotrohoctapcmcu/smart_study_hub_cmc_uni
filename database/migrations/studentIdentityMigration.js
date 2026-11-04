'use strict';

const { queryAll } = require('../shared/sqlite');
const { enrollmentYearFromCode } = require('../shared/student-identity');

function migrateStudentEnrollmentYears(db) {
    const columns = queryAll(db, 'PRAGMA table_info(Students)').map(row => row.name);
    if (!columns.includes('student_code') || !columns.includes('enrollment_year')) return;
    const students = queryAll(db, 'SELECT student_code, enrollment_year FROM Students');
    db.run('SAVEPOINT student_enrollment_years');
    try {
        for (const student of students) {
            const year = enrollmentYearFromCode(student.student_code);
            if (year !== null && Number(student.enrollment_year) !== year) {
                db.run('UPDATE Students SET enrollment_year = ? WHERE student_code = ?', [year, student.student_code]);
            }
        }
        db.run('RELEASE student_enrollment_years');
    } catch (error) {
        db.run('ROLLBACK TO student_enrollment_years');
        db.run('RELEASE student_enrollment_years');
        throw error;
    }
}

module.exports = { migrateStudentEnrollmentYears };
