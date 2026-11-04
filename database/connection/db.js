const fs = require('fs');
const path = require('path');

const SQL = require('sql.js');
const { bindParams, queryAll } = require('../shared/sqlite');
const { migrateSchema } = require('../migrations/legacyMigration');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const separator = trimmed.indexOf('=');
            if (separator <= 0) continue;
            const key = trimmed.slice(0, separator).trim();
            if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1).trim();
        }
    } catch (_) {}
}

const DB_FILE = process.env.DB_PATH || path.resolve(__dirname, '../../data/unistudy.db');

let wasmBinary = null;
try {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    if (fs.existsSync(wasmPath)) {
        wasmBinary = fs.readFileSync(wasmPath);
    }
} catch (_) {}

let _db = null;
let _persistTimer = null;

let _txDepth = 0;

function persistNow(force = false) {
    if (!_db || (_txDepth > 0 && !force)) return;
    try {
        const dbDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
    } catch (err) {
        console.error('[DB] Không ghi được file SQLite:', err.message);
    } finally {

        batKhoaNgoai();
    }
}

function batKhoaNgoai() {
    if (!_db) return;
    try {
        _db.run('PRAGMA foreign_keys = ON;');
    } catch (_) {}
}

function schedulePersist() {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        persistNow();
    }, 50);
    if (typeof _persistTimer.unref === 'function') _persistTimer.unref();
}

async function beginTransaction() {
    const db = await getPool();
    db.run('BEGIN;');
    _txDepth++;
}

async function commitTransaction() {
    const db = await getPool();
    try {
        db.run('COMMIT;');
    } finally {
        _txDepth = Math.max(0, _txDepth - 1);
        if (_txDepth === 0) persistNow();
    }
}

async function rollbackTransaction() {
    const db = await getPool();
    try {
        db.run('ROLLBACK;');
    } catch (_) {

    } finally {
        _txDepth = Math.max(0, _txDepth - 1);
        if (_txDepth === 0) persistNow();
    }
}

async function withTransaction(fn) {
    await beginTransaction();
    try {
        const result = await fn();
        await commitTransaction();
        return result;
    } catch (err) {
        await rollbackTransaction();
        throw err;
    }
}

process.once('exit', () => {
    if (_persistTimer) {
        clearTimeout(_persistTimer);
        _persistTimer = null;
    }
    persistNow(true);
});
process.once('SIGINT', () => persistNow(true));
process.once('SIGTERM', () => persistNow(true));

async function getPool() {
    if (_db) return _db;

    try {

        const dbDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const engine = await (wasmBinary ? SQL({ wasmBinary }) : SQL());
        const db = openDatabase(engine);

        db.run('PRAGMA foreign_keys = ON;');

        runSchema(db);

        migrateSchema(db);
        require('../migrations/curriculumMigration').migrateCurriculum(db);

        await require('../migrations/studyMigration').ensureSprint2Migration(db);
        require('../migrations/workspaceMigration').migrateWorkspace(db);
        require('../migrations/aiMigration').migrateSprint3(db);
        require('../migrations/learningMigration').migrateLearning(db);

        _db = db;

        persistNow();
        console.log(`[DB] SQLite đã sẵn sàng → ${DB_FILE}`);
        return _db;
    } catch (err) {
        _db = null;
        throw err;
    }
}

function openDatabase(engine) {
    if (!fs.existsSync(DB_FILE)) return new engine.Database();

    const db = new engine.Database(fs.readFileSync(DB_FILE));
    try {
        const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='Students';");
        if (tables?.length) return db;
    } catch (_) {}
    return new engine.Database();
}

function runSchema(db) {
    const schemaPath = path.resolve(__dirname, '../schema/00_sqlite_init.sql');
    if (!fs.existsSync(schemaPath)) {
        console.warn('[DB] Không tìm thấy file schema SQLite, bỏ qua tạo bảng.');
        return;
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    db.run('PRAGMA foreign_keys = OFF;');

    const statements = schemaSql
        .split(/\r?\n/)
        .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('/*') && !line.trim().startsWith('*/'))
        .join('\n')
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const stmt of statements) {
        try {
            db.run(stmt);
        } catch (e) {

            console.warn('[DB] Bỏ qua câu lệnh schema:', e.message);
        }
    }

    db.run('PRAGMA foreign_keys = ON;');

    persistNow();
}

async function closePool() {
    if (!_db) return;
    try {
        fs.writeFileSync(DB_FILE, _db.export());
    } catch (_) {}
    _db.close();
    _db = null;
    console.log('[DB] Đã đóng và lưu SQLite.');
}

async function executeQuery(queryStr, params = {}) {
    const db = await getPool();

    const sqlText = queryStr.replace(/@(\w+)/g, ':$1');

    const stmt = db.prepare(sqlText);

    const boundParams = bindParams(params);

    if (Object.keys(boundParams).length > 0) {
        stmt.bind(boundParams);
    }

    stmt.getColumnNames();
    const rows = [];
    try {
        while (stmt.step()) rows.push(stmt.getAsObject());
    } finally {
        stmt.free();
    }

    if (/^\s*(insert|update|delete|replace|create|drop|alter|vacuum|pragma\s+(?!foreign_keys|journal_mode))/i.test(sqlText)) {
        schedulePersist();
    }

    return rows;
}

async function executeProcedure(procedureName, params = {}) {
    const db = await getPool();

    const match = procedureName.match(/sp_Sprint1_(.+)/);
    if (!match) {
        throw new Error(`Không hỗ trợ procedure: ${procedureName}`);
    }
    if (typeof db._execProc === 'function') {
        return await db._execProc(match[1], params);
    }

    throw new Error(`Chưa triển khai procedure: ${procedureName}`);
}

const sql = {
    Int: 'INTEGER',
    BigInt: 'INTEGER',
    Decimal: 'REAL',
    NVarChar: () => 'TEXT',
    VarChar: () => 'TEXT',
    DateTime2: 'TEXT',
    Bit: 'INTEGER',
    Float: 'REAL',
    Real: 'REAL',
    MAX: 'TEXT',
    TINYINT: 'INTEGER',
    DATE: 'TEXT',
    TIME: 'TEXT'
};

module.exports = {
    getPool,
    closePool,
    executeQuery,
    executeProcedure,
    withTransaction,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    batKhoaNgoai,
    sql
};
