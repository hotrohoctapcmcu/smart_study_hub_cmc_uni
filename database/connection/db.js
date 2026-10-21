/**
 * database/connection/db.js
 * ===================================================================================
 * MODULE KẾT NỐI DATABASE — DÙNG CHUNG CHO TOÀN DỰ ÁN
 * ===================================================================================
 * Chuyển từ SQL Server sang SQLite (sql.js) để máy khách chạy luôn,
 * không cần cài SQL Server, không cần cấu hình phức tạp.
 *
 * Dữ liệu được lưu trong file SQLite (mặc định: data/unistudy.db),
 * tạo tự động khi chạy lần đầu.
 *
 * Cung cấp:
 *   - getPool()        → Khởi tạo / lấy database connection (singleton)
 *   - closePool()      → Lưu và đóng database
 *   - executeQuery()   → Chạy câu SQL với tham số (an toàn SQL Injection)
 *   - executeProcedure()→ Ánh xạ tên stored procedure sang hàm JS (SQLite không có SP)
 *   - sql              → Object compatibility (giữ nguyên cú pháp gọi cũ)
 * ===================================================================================
 */

const fs = require('fs');
const path = require('path');

const SQL = require('sql.js');

// ─── Tự động nạp cấu hình từ .env ở thư mục gốc ──────────────────────────────
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    try {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const k = trimmed.slice(0, eqIdx).trim();
                    const v = trimmed.slice(eqIdx + 1).trim();
                    if (!process.env[k]) process.env[k] = v;
                }
            }
        });
    } catch (_) {}
}

// ─── Đường dẫn file SQLite ───────────────────────────────────────────────────
const DB_FILE = process.env.DB_PATH || path.resolve(__dirname, '../../data/unistudy.db');

// ─── Tự động tìm nạp file wasm của sql.js ────────────────────────────────────
let wasmBinary = null;
try {
    const wasmPath = path.resolve(__dirname, '../../../node_modules/sql.js/dist/sql-wasm.wasm');
    if (fs.existsSync(wasmPath)) {
        wasmBinary = fs.readFileSync(wasmPath);
    }
} catch (_) {}

// ─── Cấu hình SQLite (giữ nguyên tên trường để tương thích với code cũ) ──────
const dbConfig = {
    filePath: DB_FILE,
    wasmBinary
};

let _db = null;
let _persistTimer = null;

/**
 * Ghi database (đang nằm trong RAM của sql.js) xuống file .db ngay lập tức.
 * sql.js KHÔNG tự ghi file — nếu chỉ export lúc closePool() thì file
 * data/unistudy.db sẽ không bao giờ xuất hiện khi app đang chạy, và mất sạch
 * dữ liệu nếu app bị kill / crash. Vì vậy mọi thao tác ghi đều được persist.
 */
function persistNow() {
    if (!_db) return;
    try {
        const dbDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
    } catch (err) {
        console.error('[DB] Không ghi được file SQLite:', err.message);
    }
}

/**
 * Lên lịch persist (gộp nhiều lần ghi liên tiếp trong ~50ms thành 1 lần ghi file).
 */
function schedulePersist() {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        persistNow();
    }, 50);
    if (typeof _persistTimer.unref === 'function') _persistTimer.unref();
}

// Đảm bảo dữ liệu được ghi ra file khi tiến trình thoát (kể cả bị kill mềm).
process.once('exit', () => {
    if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
    persistNow();
});
process.once('SIGINT', () => { persistNow(); });
process.once('SIGTERM', () => { persistNow(); });

/**
 * Chạy câu query trả về mảng rows (dùng nội bộ cho db.js).
 * sql.js dùng stmt.bind() + stmt.step() + stmt.getAsObject().
 * @param {Database} db
 * @param {string} sqlText
 * @param {Object} params
 * @returns {Array}
 */
/**
 * Chuẩn hóa khóa tham số truyền vào stmt.bind() cho sql.js.
 * sql.js yêu cầu tên tham số có tiền tố ':' (ví dụ ':uid'), trong khi
 * phần còn lại của dự án viết tham số không dấu (ví dụ 'uid') và câu SQL
 * đã được chuẩn hóa '@uid' → ':uid' ở executeQuery.
 * @param {Object} params
 * @returns {Object}
 */
function bindParams(params) {
    const bound = {};
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null) {
            bound[':' + k] = v;
        }
    }
    return bound;
}

function queryAll(db, sqlText, params = {}) {
    const stmt = db.prepare(sqlText);
    const bound = bindParams(params);
    if (Object.keys(bound).length > 0) {
        stmt.bind(bound);
    }
    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.reset();
    stmt.free();
    return rows;
}

/**
 * Khởi tạo hoặc trả về database connection đang hoạt động.
 * @returns {Promise<Database>}
 */
async function getPool() {
    if (_db) return _db;

    try {
        // Tạo thư mục chứa database nếu chưa có
        const dbDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Tải WASM nếu chưa nạp
        let SQLPromise;
        if (wasmBinary) {
            SQLPromise = SQL({ wasmBinary });
        } else {
            SQLPromise = SQL();
        }

        const SQLobj = await SQLPromise;

        // Mở hoặc tạo database từ file
        let db;
        if (fs.existsSync(DB_FILE)) {
            const fileBuffer = fs.readFileSync(DB_FILE);
            db = new SQLobj.Database(fileBuffer);

            // Nếu database cũ không có bảng Users (trống/lỗi), tạo database mới từ đầu
            try {
                const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='Users';");
                if (!tables || tables.length === 0) {
                    db = new SQLobj.Database();
                }
            } catch (_) {
                db = new SQLobj.Database();
            }
        } else {
            db = new SQLobj.Database();
        }

        // Kích hoạt khóa ngoại
        db.run('PRAGMA foreign_keys = ON;');

        // Kiểm tra xem database đã có dữ liệu seed chưa;
        // nếu bảng quan trọng nào trống thì chạy schema khởi tạo (tạo bảng + dữ liệu mẫu).
        // CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE đảm bảo an toàn, không xóa dữ liệu thật.
        let needSchema = false;
        try {
            const checks = ['Users', 'Students', 'Subjects'];
            for (const tbl of checks) {
                const rows = queryAll(db, `SELECT 1 FROM ${tbl} LIMIT 1;`);
                if (rows.length === 0) { needSchema = true; break; }
            }
        } catch (_) {
            needSchema = true;
        }
        if (needSchema) {
            runSchema(db);
        }

        _db = db;
        // Tạo file .db ngay từ lần chạy đầu (không đợi tới lúc tắt app).
        persistNow();
        console.log(`[DB] SQLite đã sẵn sàng → ${DB_FILE}`);
        return _db;
    } catch (err) {
        _db = null;
        throw err;
    }
}

/**
 * Chạy toàn bộ schema khởi tạo cho database SQLite mới.
 * Tách từng câu lệnh theo dấu ';' và chạy riêng lẻ, bỏ qua lỗi nếu bảng đã tồn tại.
 * @param {Database} db - sql.js database instance
 */
function runSchema(db) {
    const schemaPath = path.resolve(__dirname, '../../database/schema/00_sqlite_init.sql');
    if (!fs.existsSync(schemaPath)) {
        console.warn('[DB] Không tìm thấy file schema SQLite, bỏ qua tạo bảng.');
        return;
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Tắt khóa ngoại khi chèn dữ liệu seed để tránh lỗi thứ tự bảng
    db.run('PRAGMA foreign_keys = OFF;');

    // Tách từng câu lệnh SQL (bỏ comment dòng bắt đầu bằng --)
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
            // Bỏ qua lỗi nếu bảng đã tồn tại (CREATE TABLE IF NOT EXISTS đã xử lý phần lớn)
            console.warn('[DB] Bỏ qua câu lệnh schema:', e.message);
        }
    }

    // Bật lại khóa ngoại
    db.run('PRAGMA foreign_keys = ON;');
    // Ghi ngay schema + dữ liệu seed ra file .db.
    persistNow();
}

/**
 * Đóng và lưu database xuống file
 */
async function closePool() {
    if (_db) {
        try {
            const data = _db.export();
            fs.writeFileSync(DB_FILE, data);
        } catch (_) {}
        _db.close();
        _db = null;
        console.log('[DB] Đã đóng và lưu SQLite.');
    }
}

/**
 * Chuẩn bị tham số cho câu SQL (giữ nguyên signature cũ).
 * @param {*} val
 */
function autoType(val) {
    return val;
}

/**
 * Chạy câu SQL tham số trên SQLite.
 * Tham số dạng named: @name trong câu lệnh sẽ được chuyển thành :name.
 * @param {string} queryStr
 * @param {Object} params - { key: value }
 * @returns {Promise<Array>}
 */
async function executeQuery(queryStr, params = {}) {
    const db = await getPool();

    // Chuyển tham số @name → :name (SQLite named parameter)
    let sqlText = queryStr.replace(/@(\w+)/g, ':$1');

    const stmt = db.prepare(sqlText);

    // Xử lý params (sql.js yêu cầu khóa có tiền tố ':')
    const boundParams = bindParams(params);

    if (Object.keys(boundParams).length > 0) {
        stmt.bind(boundParams);
    }

    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.reset();
    stmt.free();

    // Câu lệnh ghi (INSERT/UPDATE/DELETE/REPLACE/DDL) → ghi file .db ngay,
    // để dữ liệu không chỉ nằm trong RAM và file data/unistudy.db luôn tồn tại.
    if (/^\s*(insert|update|delete|replace|create|drop|alter|vacuum|pragma\s+(?!foreign_keys|journal_mode))/i.test(sqlText)) {
        schedulePersist();
    }

    return rows;
}

/**
 * Ánh xạ tên stored procedure sang hàm JS (SQLite không có stored procedure).
 * Giữ nguyên signature để code cũ không bị lỗi.
 * @param {string} procedureName
 * @param {Object} params
 * @returns {Promise<Array>}
 */
async function executeProcedure(procedureName, params = {}) {
    const db = await getPool();

    // Tên procedure có dạng dbo.sp_Sprint1_Xxx → lấy phần sau sp_Sprint1_
    const match = procedureName.match(/sp_Sprint1_(.+)/);
    if (!match) {
        throw new Error(`Không hỗ trợ procedure: ${procedureName}`);
    }
    const shortName = match[1];

    // Ánh xạ sang các hàm xử lý trong sprint1Service (được inject vào db object)
    if (typeof db._execProc === 'function') {
        return await db._execProc(shortName, params);
    }

    throw new Error(`Chưa triển khai procedure: ${procedureName}`);
}

/**
 * Object sql compatibility (giữ nguyên cú pháp gọi cũ trong sprint1Service).
 * Các giá trị này không thực sự dùng cho sql.js nhưng tránh lỗi undefined.
 */
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

module.exports = { getPool, closePool, executeQuery, executeProcedure, sql };
