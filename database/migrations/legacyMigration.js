'use strict';

const { queryAll } = require('../shared/sqlite');

function migrateSchema(db) {

    try {
        db.run(`
            DELETE FROM Reminders
            WHERE reminder_id NOT IN (
                SELECT MIN(reminder_id)
                FROM Reminders
                GROUP BY student_id, target_type, target_id, tier
            );
        `);
        db.run(`
            CREATE UNIQUE INDEX IF NOT EXISTS UX_Reminders_Student_Target_Tier
            ON Reminders (student_id, target_type, target_id, tier);
        `);
    } catch (err) {
        console.error('[DB] Không thể thiết lập chống trùng nhắc nhở:', err.message);
    }

    themCotNeuThieu(db, 'Assignments', 'priority', "TEXT NOT NULL DEFAULT 'MEDIUM'");

    migrateEduxAssignments(db);

    for (const [column, definition] of [
        ['subject_ext_id', 'TEXT'],
        ['model_id', 'TEXT'],
        ['chapter', 'TEXT'],
        ['highest_score', 'INTEGER'],
        ['doc_done', 'INTEGER NOT NULL DEFAULT 0'],
        ['doc_total', 'INTEGER NOT NULL DEFAULT 0'],
        ['is_hidden', 'INTEGER NOT NULL DEFAULT 0']
    ]) {
        themCotNeuThieu(db, 'EduxAssignments', column, definition);
    }

    try {
        const cols = queryAll(db, 'PRAGMA table_info("Students");').map(c => c.name);
        if (!cols.length) return;

        const coUserCu = cols.includes('user_id');
        const thieuEmail = !cols.includes('email');
        if (!coUserCu && !thieuEmail) return;

        const coEmailCu = cols.includes('email');

        db.run('PRAGMA foreign_keys = OFF;');
        db.run('BEGIN;');
        try {
            db.run(`CREATE TABLE Students_new (
                student_id       INTEGER PRIMARY KEY AUTOINCREMENT,
                student_code     TEXT    NOT NULL UNIQUE,
                full_name        TEXT    NOT NULL,
                major            TEXT    NOT NULL,
                dob              TEXT,
                enrollment_year  INTEGER,
                current_semester TEXT,
                phone            TEXT,
                avatar_url       TEXT,
                email            TEXT,
                created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
            );`);

            db.run(`INSERT INTO Students_new
                        (student_id, student_code, full_name, major, dob,
                         enrollment_year, current_semester, phone, avatar_url,
                         email, created_at, updated_at)
                    SELECT student_id, student_code, full_name, major, dob,
                           enrollment_year, current_semester, phone, avatar_url,
                           ${coEmailCu ? 'email' : 'NULL'},
                           ${cols.includes('created_at') ? "created_at" : "datetime('now')"},
                           ${cols.includes('updated_at') ? "updated_at" : "datetime('now')"}
                    FROM Students;`);

            db.run('DROP TABLE Students;');
            db.run('ALTER TABLE Students_new RENAME TO Students;');
            db.run('COMMIT;');
            console.log('[DB] Đã nâng cấp bảng Students: bỏ user_id, thêm email.');
        } catch (err) {
            try { db.run('ROLLBACK;'); } catch (_) { }
            console.error('[DB] Nâng cấp bảng Students thất bại:', err.message);
        } finally {
            db.run('PRAGMA foreign_keys = ON;');
        }
    } catch (err) {
        console.error('[DB] Không kiểm tra được schema Students:', err.message);
    }
}

function migrateEduxAssignments(db) {
    try {
        const cols = queryAll(db, 'PRAGMA table_info("EduxAssignments");').map(c => c.name);
        if (!cols.length || cols.includes('user_id')) return;

        const pick = (name, fallback) => cols.includes(name) ? name : fallback;
        const userId = cols.includes('student_id') ? 'student_id' : 'NULL';

        db.run('PRAGMA foreign_keys = OFF;');
        db.run('BEGIN;');
        try {
            db.run(`CREATE TABLE EduxAssignments_new (
                edux_id        INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL,
                external_id    TEXT    NOT NULL,
                title          TEXT    NOT NULL,
                subject_name   TEXT,
                subject_ext_id TEXT,
                model_id       TEXT,
                chapter        TEXT,
                description    TEXT,
                status         TEXT    NOT NULL DEFAULT 'Chưa làm',
                priority       TEXT    NOT NULL DEFAULT 'MEDIUM'
                                       CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
                highest_score  INTEGER,
                doc_done       INTEGER NOT NULL DEFAULT 0,
                doc_total      INTEGER NOT NULL DEFAULT 0,
                is_hidden      INTEGER NOT NULL DEFAULT 0,
                synced_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
                UNIQUE (user_id, external_id)
            );`);

            db.run(`INSERT INTO EduxAssignments_new
                        (edux_id, user_id, external_id, title, subject_name,
                         subject_ext_id, model_id, chapter, description, status,
                         priority, highest_score, doc_done, doc_total, is_hidden, synced_at,
                         created_at, updated_at)
                    SELECT ${pick('edux_id', 'NULL')},
                           ${userId},
                           external_id,
                           title,
                           ${pick('subject_name', 'NULL')},
                           ${pick('subject_ext_id', 'NULL')},
                           ${pick('model_id', 'NULL')},
                           ${pick('chapter', 'NULL')},
                           ${pick('description', 'NULL')},
                           ${pick('status', "'Chưa làm'")},
                           ${pick('priority', "'MEDIUM'")},
                           ${pick('highest_score', 'NULL')},
                           ${pick('doc_done', '0')},
                           ${pick('doc_total', '0')},
                           ${pick('is_hidden', '0')},
                           ${pick('synced_at', "datetime('now')")},
                           ${pick('created_at', "datetime('now')")},
                           ${pick('updated_at', "datetime('now')")}
                    FROM EduxAssignments;`);

            db.run('DROP TABLE EduxAssignments;');
            db.run('ALTER TABLE EduxAssignments_new RENAME TO EduxAssignments;');
            db.run('COMMIT;');
            console.log('[DB] Đã nâng cấp bảng EduxAssignments: student_id → user_id.');
        } catch (err) {
            try { db.run('ROLLBACK;'); } catch (_) { }
            console.error('[DB] Nâng cấp bảng EduxAssignments thất bại:', err.message);
        } finally {
            db.run('PRAGMA foreign_keys = ON;');
        }
    } catch (err) {
        console.error('[DB] Không kiểm tra được schema EduxAssignments:', err.message);
    }
}

function themCotNeuThieu(db, table, column, definition) {
    try {
        const cols = queryAll(db, `PRAGMA table_info("${table}");`).map(c => c.name);
        if (!cols.length || cols.includes(column)) return;

        db.run(`ALTER TABLE "${table}" ADD COLUMN ${column} ${definition};`);
        console.log(`[DB] Đã thêm cột ${table}.${column}.`);
    } catch (err) {
        console.error(`[DB] Không thêm được cột ${table}.${column}:`, err.message);
    }
}

module.exports = { migrateSchema };
