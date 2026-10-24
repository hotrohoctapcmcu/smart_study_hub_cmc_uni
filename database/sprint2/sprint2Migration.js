/**
 * database/sprint2/sprint2Migration.js
 * ===================================================================================
 * SPRINT 2 — MODULE MIGRATION
 * ===================================================================================
 * Chạy migration an toàn cho Sprint 2:
 *   - Kiểm tra cột thiếu trên bảng hiện tại (Exams, Grades).
 *   - Tạo bảng mới (PomodoroSessions, Notebooks, Notes, EduxDocuments, EduxSyncLog).
 *   - Không làm mất dữ liệu cũ.
 *   - Hỗ trợ rollback nếu migration thất bại.
 * ===================================================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { getPool, executeQuery } = require("../connection/db");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Kiểm tra một cột đã tồn tại trong bảng chưa.
 * @param {Database} db - sql.js database instance
 * @param {string} tableName
 * @param {string} columnName
 * @returns {boolean}
 */
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

/**
 * Kiểm tra một bảng đã tồn tại chưa.
 * @param {Database} db
 * @param {string} tableName
 * @returns {boolean}
 */
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

// ─── Migration chính ────────────────────────────────────────────────────────

/**
 * Chạy toàn bộ migration Sprint 2.
 * Bọc trong transaction: nếu lỗi giữa chừng sẽ ROLLBACK toàn bộ.
 *
 * @returns {Promise<Object>} Kết quả migration
 */
async function runSprint2Migration() {
    const db = await getPool();
    const result = {
        alteredColumns: [],
        createdTables: [],
        createdIndexes: 0,
        createdTriggers: 0,
        errors: [],
        success: false,
    };

    try {
        db.run("BEGIN;");

        // ────────────────────────────────────────────────────────────────
        // BƯỚC 1: Bổ sung cột thiếu cho bảng Exams (PB-30, PB-32)
        // ────────────────────────────────────────────────────────────────
        if (tableExists(db, "Exams")) {
            if (!columnExists(db, "Exams", "semester")) {
                db.run("ALTER TABLE Exams ADD COLUMN semester TEXT;");
                result.alteredColumns.push("Exams.semester");
            }
            if (!columnExists(db, "Exams", "academic_year")) {
                db.run("ALTER TABLE Exams ADD COLUMN academic_year TEXT;");
                result.alteredColumns.push("Exams.academic_year");
            }
        }

        // ────────────────────────────────────────────────────────────────
        // BƯỚC 2: Bổ sung cột cho bảng Grades (đảm bảo đủ)
        // ────────────────────────────────────────────────────────────────
        if (tableExists(db, "Grades")) {
            if (!columnExists(db, "Grades", "component_score")) {
                db.run("ALTER TABLE Grades ADD COLUMN component_score REAL;");
                result.alteredColumns.push("Grades.component_score");
            }
            if (!columnExists(db, "Grades", "exam_score")) {
                db.run("ALTER TABLE Grades ADD COLUMN exam_score REAL;");
                result.alteredColumns.push("Grades.exam_score");
            }
        }

        // ────────────────────────────────────────────────────────────────
        // BƯỚC 3: Chạy file SQL migration tạo bảng mới
        // ────────────────────────────────────────────────────────────────
        const sqlPath = path.resolve(
            __dirname,
            "schema/01_sprint2_migration.sql"
        );

        if (!fs.existsSync(sqlPath)) {
            throw new Error(
                `Không tìm thấy file migration: ${sqlPath}`
            );
        }

        const migrationSql = fs.readFileSync(sqlPath, "utf8");

        // Thực thi toàn bộ script migration (chứa CREATE TABLE, INDEX và TRIGGER)
        db.run(migrationSql);

        // Thu thập thống kê các bảng, index, trigger sau migration
        const tables = [
            "PomodoroSessions",
            "Notebooks",
            "Notes",
            "EduxDocuments",
            "EduxSyncLog",
        ];
        for (const tbl of tables) {
            if (tableExists(db, tbl)) result.createdTables.push(tbl);
        }

        db.run("COMMIT;");
        result.success = true;

        console.log("[MIGRATION] Sprint 2 migration hoàn tất:", {
            alteredColumns: result.alteredColumns.length,
            createdTables: result.createdTables.length,
            createdIndexes: result.createdIndexes,
            createdTriggers: result.createdTriggers,
        });

        return result;
    } catch (err) {
        try {
            db.run("ROLLBACK;");
        } catch (_) {}
        console.error(
            "[MIGRATION] Sprint 2 migration thất bại, đã ROLLBACK:",
            err.message
        );
        result.errors.push(err.message);
        result.success = false;
        throw err;
    }
}

/**
 * Kiểm tra xem Sprint 2 migration đã được chạy chưa.
 * @returns {Promise<boolean>}
 */
async function isSprint2Migrated() {
    const db = await getPool();
    return (
        tableExists(db, "PomodoroSessions") &&
        tableExists(db, "Notebooks") &&
        tableExists(db, "Notes") &&
        tableExists(db, "EduxDocuments") &&
        tableExists(db, "EduxSyncLog")
    );
}

/**
 * Chạy migration nếu chưa chạy (idempotent).
 * @returns {Promise<Object|null>}
 */
async function ensureSprint2Migration() {
    const migrated = await isSprint2Migrated();
    if (migrated) {
        console.log(
            "[MIGRATION] Sprint 2 đã được migration trước đó, bỏ qua."
        );
        return null;
    }
    return await runSprint2Migration();
}

module.exports = {
    runSprint2Migration,
    isSprint2Migrated,
    ensureSprint2Migration,
};
