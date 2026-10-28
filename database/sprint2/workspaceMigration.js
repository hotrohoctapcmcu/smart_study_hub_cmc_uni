'use strict';

// Additive upgrade for the UI/API flows; existing Sprint 1/2 records are retained.
function migrateWorkspace(db) {
    const additions = {
        EduxDocuments: { tags: "TEXT NOT NULL DEFAULT '[]'", subject_label: 'TEXT', storage_key: 'TEXT', original_name: 'TEXT', mime_type: 'TEXT', is_textbook: 'INTEGER NOT NULL DEFAULT 0' },
        Notes: { client_id: 'TEXT', subject_label: 'TEXT', document_id: 'INTEGER REFERENCES EduxDocuments(document_id) ON DELETE SET NULL' },
        PomodoroSessions: { client_id: 'TEXT', actual_study_seconds: 'INTEGER', focus_segments: 'TEXT' },
        Assignments: { tags: "TEXT NOT NULL DEFAULT '[]'" },
        EduxAssignments: { tags: "TEXT NOT NULL DEFAULT '[]'", deadline: 'TEXT' }
    };
    db.run('BEGIN');
    try {
        for (const [table, columns] of Object.entries(additions)) {
            const existing = db.exec(`PRAGMA table_info("${table}")`)[0]?.values.map(row => row[1]) || [];
            for (const [column, definition] of Object.entries(columns)) {
                if (!existing.includes(column)) db.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
            }
        }
        db.run(`
            CREATE UNIQUE INDEX IF NOT EXISTS UX_Notes_Client ON Notes(student_id, client_id);
            CREATE UNIQUE INDEX IF NOT EXISTS UX_Pomodoro_Client ON PomodoroSessions(student_id, client_id);
            CREATE TABLE IF NOT EXISTS SchoolEmails (
                email_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                external_id TEXT NOT NULL,
                mailbox TEXT NOT NULL DEFAULT '',
                payload TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                task_id INTEGER REFERENCES Assignments(assignment_id) ON DELETE SET NULL,
                exam_id INTEGER REFERENCES Exams(exam_id) ON DELETE SET NULL,
                synced_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, mailbox, external_id)
            );
        `);
        db.run('COMMIT');
    } catch (error) {
        db.run('ROLLBACK');
        throw error;
    }
}

module.exports = { migrateWorkspace };
