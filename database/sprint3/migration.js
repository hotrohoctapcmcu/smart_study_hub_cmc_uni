'use strict';

// Additive migration: existing Sprint 1/2 data is preserved.
function migrateSprint3(db) {
    db.run(`
        CREATE TABLE IF NOT EXISTS AiConversations (
            conversation_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            messages_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(user_id, conversation_id)
        );
        CREATE TABLE IF NOT EXISTS AiQuizzes (
            quiz_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            topic TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            questions_json TEXT NOT NULL,
            answers_json TEXT,
            result_json TEXT,
            created_at TEXT NOT NULL,
            submitted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS IX_AiQuizzes_User ON AiQuizzes(user_id, created_at);
        CREATE TABLE IF NOT EXISTS AiWeaknessReports (
            report_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            evidence_hash TEXT NOT NULL,
            advice_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS IX_AiWeaknessReports_User ON AiWeaknessReports(user_id, created_at);
        CREATE TABLE IF NOT EXISTS AiLeaveDrafts (
            draft_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            fields_json TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS AiExamConfirmations (
            user_id INTEGER NOT NULL,
            request_id TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            result_json TEXT NOT NULL,
            PRIMARY KEY(user_id, request_id)
        );
    `);
}

module.exports = { migrateSprint3 };
