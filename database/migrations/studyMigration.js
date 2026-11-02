'use strict';

const fs = require('fs');
const path = require('path');
const { getPool } = require('../connection/db');

const STUDY_TABLES = ['PomodoroSessions', 'Notebooks', 'Notes', 'EduxDocuments', 'EduxSyncLog'];
const STUDY_COLUMNS = [
    ['Exams', [['semester', 'TEXT'], ['academic_year', 'TEXT']]],
    ['Grades', [['component_score', 'REAL'], ['exam_score', 'REAL']]]
];

function columnExists(db, tableName, columnName) {
    const stmt = db.prepare(`PRAGMA table_info('${tableName}')`);
    const columns = [];
    while (stmt.step()) {
        columns.push(stmt.getAsObject());
    }
    stmt.reset();
    stmt.free();
    return columns.some(c => c.name === columnName);
}

function tableExists(db, tableName) {
    const stmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    );
    stmt.bind([tableName]);
    const exists = stmt.step();
    stmt.reset();
    stmt.free();
    return exists;
}

async function runSprint2Migration(existingDb) {
    const db = existingDb || await getPool();
    const result = {
        alteredColumns: [],
        createdTables: [],
        createdIndexes: 0,
        createdTriggers: 0,
        errors: [],
        success: false,
    };

    try {
        db.run('BEGIN;');

        for (const [table, columns] of STUDY_COLUMNS) {
            if (!tableExists(db, table)) continue;
            for (const [column, type] of columns) {
                if (!columnExists(db, table, column)) {
                    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
                    result.alteredColumns.push(`${table}.${column}`);
                }
            }
        }

        const sqlPath = path.resolve(__dirname, 'schema/01_study_tools.sql');

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`Không tìm thấy file migration: ${sqlPath}`);
        }

        const migrationSql = fs.readFileSync(sqlPath, 'utf8');

        db.run('DROP TRIGGER IF EXISTS trg_Pomodoro_AutoCalc;');
        db.run(migrationSql);

        for (const table of STUDY_TABLES) {
            if (tableExists(db, table)) result.createdTables.push(table);
        }
        const counts = db.exec(`SELECT type, COUNT(*) FROM sqlite_master
            WHERE type IN ('index', 'trigger') AND tbl_name IN
                ('PomodoroSessions', 'Notebooks', 'Notes', 'EduxDocuments', 'EduxSyncLog')
            GROUP BY type`);
        for (const [type, count] of counts[0]?.values || []) {
            if (type === 'index') result.createdIndexes = count;
            if (type === 'trigger') result.createdTriggers = count;
        }

        db.run('COMMIT;');
        result.success = true;

        console.log('[MIGRATION] Sprint 2 migration hoàn tất:', {
            alteredColumns: result.alteredColumns.length,
            createdTables: result.createdTables.length,
            createdIndexes: result.createdIndexes,
            createdTriggers: result.createdTriggers,
        });

        return result;
    } catch (err) {
        try {
            db.run('ROLLBACK;');
        } catch (_) {}
        console.error(
            '[MIGRATION] Sprint 2 migration thất bại, đã ROLLBACK:',
            err.message
        );
        result.errors.push(err.message);
        result.success = false;
        throw err;
    }
}

async function isSprint2Migrated(existingDb) {
    const db = existingDb || await getPool();
    return (
        STUDY_TABLES.every(table => tableExists(db, table)) &&
        STUDY_COLUMNS.every(([table, columns]) => columns.every(([column]) => columnExists(db, table, column))) &&
        db.exec("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_Pomodoro_AutoCalc' AND sql LIKE '%NEW.total_focus_minutes > 0%'").length > 0
    );
}

async function ensureSprint2Migration(existingDb) {
    const migrated = await isSprint2Migrated(existingDb);
    if (migrated) {
        console.log(
            '[MIGRATION] Sprint 2 đã được migration trước đó, bỏ qua.'
        );
        return null;
    }
    return await runSprint2Migration(existingDb);
}

module.exports = {
    runSprint2Migration,
    isSprint2Migrated,
    ensureSprint2Migration,
};
