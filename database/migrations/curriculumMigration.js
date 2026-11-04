'use strict';

function migrateCurriculum(db) {
    db.run(`CREATE TABLE IF NOT EXISTS StudentPrograms (
        student_id INTEGER NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
        program_id TEXT NOT NULL,
        program_name TEXT,
        total_credits REAL CHECK(total_credits > 0),
        total_credits_source TEXT,
        knowledge_blocks_json TEXT,
        is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0,1)),
        curriculum_synced_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(student_id, program_id)
    )`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS UX_StudentPrograms_Current
        ON StudentPrograms(student_id) WHERE is_current = 1`);
    db.run(`CREATE TABLE IF NOT EXISTS CurriculumSubjects (
        student_id INTEGER NOT NULL,
        program_id TEXT NOT NULL,
        subject_id INTEGER NOT NULL REFERENCES Subjects(subject_id) ON DELETE CASCADE,
        credits REAL CHECK(credits >= 0),
        block_code TEXT,
        block_name TEXT,
        portal_status TEXT,
        semester TEXT,
        academic_year TEXT,
        PRIMARY KEY(student_id, program_id, subject_id),
        FOREIGN KEY(student_id, program_id) REFERENCES StudentPrograms(student_id, program_id) ON DELETE CASCADE
    )`);
}

module.exports = { migrateCurriculum };
