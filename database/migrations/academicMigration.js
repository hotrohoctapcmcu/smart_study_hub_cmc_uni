'use strict';

const { queryAll } = require('../shared/sqlite');

function migrateAcademicResults(db) {
    let definition = queryAll(db, "SELECT sql FROM sqlite_master WHERE type='table' AND name='Grades'")[0]?.sql;
    if (!definition) return;
    const columns = queryAll(db, 'PRAGMA table_info(Grades)').map(row => row.name);
    const foreignKeys = Number(db.exec('PRAGMA foreign_keys')[0]?.values[0]?.[0]) || 0;
    db.run('PRAGMA foreign_keys=OFF');
    db.run('BEGIN');
    try {
        if (!columns.includes('score_4')) db.run('ALTER TABLE Grades ADD COLUMN score_4 REAL CHECK(score_4 BETWEEN 0 AND 4)');
        if (!columns.includes('exam_attempt')) db.run('ALTER TABLE Grades ADD COLUMN exam_attempt INTEGER NOT NULL DEFAULT 1');
        definition = queryAll(db, "SELECT sql FROM sqlite_master WHERE type='table' AND name='Grades'")[0].sql;
        const needsPassFail = !definition.includes("'P'") || !definition.includes("'NP'");
        if (needsPassFail || /final_score\s+REAL\s+NOT NULL/i.test(definition)) {
            const objects = queryAll(db, "SELECT sql FROM sqlite_master WHERE tbl_name='Grades' AND type IN ('index','trigger') AND sql IS NOT NULL");
            const widened = definition.replace(/CHECK\s*\(\s*letter_grade\s+IN\s*\([^)]*\)\s*\)/i,
                "CHECK(letter_grade IN ('A+','A','B+','B','C+','C','D+','D','F','P','NP'))").replace(/final_score\s+REAL\s+NOT NULL/i, 'final_score REAL');
            if (widened === definition) throw new Error('Không nhận diện được ràng buộc điểm chữ Grades.');
            db.run(widened.replace(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`\[]?Grades["`\]]?/i, 'CREATE TABLE Grades_academic_upgrade'));
            const names = queryAll(db, 'PRAGMA table_info(Grades)').map(row => `"${row.name.replace(/"/g, '""')}"`).join(',');
            db.run(`INSERT INTO Grades_academic_upgrade(${names}) SELECT ${names} FROM Grades`);
            db.run('DROP TABLE Grades');
            db.run('ALTER TABLE Grades_academic_upgrade RENAME TO Grades');
            for (const object of objects) db.run(object.sql);
        }
        db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    finally { db.run(`PRAGMA foreign_keys=${foreignKeys}`); }
}

module.exports = { migrateAcademicResults };
