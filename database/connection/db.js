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

// Số transaction đang mở. sql.js không cho đọc trạng thái transaction, mà
// export() trong lúc transaction đang mở sẽ ÂM THẦM ROLLBACK nó (dữ liệu đã ghi
// biến mất, câu COMMIT sau đó ném "cannot commit - no transaction is active").
// Vì vậy phải chặn persist khi còn transaction chưa đóng.
let _txDepth = 0;

/**
 * Ghi database (đang nằm trong RAM của sql.js) xuống file .db ngay lập tức.
 * sql.js KHÔNG tự ghi file — nếu chỉ export lúc closePool() thì file
 * data/unistudy.db sẽ không bao giờ xuất hiện khi app đang chạy, và mất sạch
 * dữ liệu nếu app bị kill / crash. Vì vậy mọi thao tác ghi đều được persist.
 *
 * BỎ QUA khi đang có transaction mở: export() lúc đó sẽ rollback transaction
 * đang chạy. Persist sẽ được gọi lại ngay sau COMMIT/ROLLBACK.
 *
 * @param {boolean} [force] - ghi kể cả khi transaction đang mở (chỉ dùng lúc thoát tiến trình,
 *                            chấp nhận mất phần chưa commit để cứu phần đã commit).
 */
function persistNow(force = false) {
    if (!_db) return;
    if (_txDepth > 0 && !force) return;
    try {
        const dbDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
    } catch (err) {
        console.error('[DB] Không ghi được file SQLite:', err.message);
    } finally {
        // export() của sql.js tạo lại handle nội bộ và TẮT foreign_keys.
        // Nếu không bật lại, mọi ràng buộc khóa ngoại biến mất sau lần persist
        // đầu tiên (dữ liệu mồ côi, xóa nhầm bản ghi của người khác...).
        batKhoaNgoai();
    }
}

/**
 * Bật lại ràng buộc khóa ngoại cho connection đang mở.
 * Gọi sau mỗi lần export() và ở cuối quá trình khởi tạo schema.
 */
function batKhoaNgoai() {
    if (!_db) return;
    try { _db.run('PRAGMA foreign_keys = ON;'); } catch (_) { /* bỏ qua */ }
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

/**
 * Mở một transaction. Phải gọi commitTransaction() hoặc rollbackTransaction()
 * để đóng; nếu không, persist sẽ bị chặn (xem persistNow).
 */
async function beginTransaction() {
    const db = await getPool();
    db.run('BEGIN;');
    _txDepth++;
}

/**
 * Commit transaction đang mở và ghi dữ liệu ra file.
 */
async function commitTransaction() {
    const db = await getPool();
    try {
        db.run('COMMIT;');
    } finally {
        _txDepth = Math.max(0, _txDepth - 1);
        if (_txDepth === 0) persistNow();
    }
}

/**
 * Rollback transaction đang mở (bỏ toàn bộ thay đổi chưa commit).
 * Bỏ qua an toàn nếu transaction đã đóng vì lý do khác.
 */
async function rollbackTransaction() {
    const db = await getPool();
    try {
        db.run('ROLLBACK;');
    } catch (_) {
        // Transaction đã đóng sẵn — không còn gì để rollback.
    } finally {
        _txDepth = Math.max(0, _txDepth - 1);
        if (_txDepth === 0) persistNow();
    }
}

/**
 * Bọc một nhóm thao tác ghi trong 1 transaction SQLite.
 * Mọi lỗi giữa chừng đều rollback toàn bộ, và dữ liệu được persist đúng một
 * lần sau khi transaction đóng (kể cả khi bên trong có await dài — lúc đó
 * timer persist sẽ thấy _txDepth > 0 và bỏ qua thay vì phá transaction).
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
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

// Đảm bảo dữ liệu được ghi ra file khi tiến trình thoát (kể cả bị kill mềm).
// force=true: lúc này không còn cơ hội chạy tiếp, thà mất phần chưa commit
// còn hơn mất toàn bộ file.
process.once('exit', () => {
    if (_persistTimer) { clearTimeout(_persistTimer); _persistTimer = null; }
    persistNow(true);
});
process.once('SIGINT', () => { persistNow(true); });
process.once('SIGTERM', () => { persistNow(true); });

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
                const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='Students';");
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

        // Luôn chạy schema: toàn bộ câu lệnh đều là CREATE TABLE/INDEX IF NOT EXISTS
        // nên an toàn với DB đã có dữ liệu, và đảm bảo bảng mới thêm sau này
        // (vd EduxAssignments) xuất hiện trên file .db cũ.
        // Trước đây chỉ chạy khi Students/Subjects trống, nên nâng cấp phiên bản
        // xong vẫn thiếu bảng và mọi truy vấn mới đều "no such table".
        runSchema(db);

        // Nâng cấp cấu trúc cũ (file .db tạo từ schema trước đây) lên schema hiện tại.
        migrateSchema(db);

        // Cùng một kết nối và transaction migration, trước khi nhận request.
        await require('../sprint2/sprint2Migration').ensureSprint2Migration(db);

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
 * Đưa file .db cũ về đúng schema hiện tại.
 *
 * `CREATE TABLE IF NOT EXISTS` KHÔNG sửa được bảng đã tồn tại, nên file .db
 * tạo từ schema cũ vẫn giữ cột `Students.user_id NOT NULL`. Cột này không còn
 * được ghi ở bất kỳ đâu (hệ thống bỏ bảng Users) nên mọi lần upsert hồ sơ đều
 * vi phạm NOT NULL và đồng bộ IU thất bại.
 *
 * Cách xử lý: dựng bảng mới theo schema hiện tại, copy dữ liệu cũ sang
 * (giữ nguyên student_id để không phá khóa ngoại), rồi thay thế bảng cũ.
 * Chỉ chạy khi phát hiện cột di sản — không đụng gì tới database đúng schema.
 *
 * @param {Database} db - sql.js database instance
 */
function migrateSchema(db) {
    // Dọn các bản ghi trùng lịch sử trước khi áp dụng unique index cho DB cũ.
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

    // Các cột bổ sung sau này — thêm bằng ALTER TABLE vì CREATE TABLE IF NOT EXISTS
    // không đụng tới bảng đã tồn tại. Chạy TRƯỚC khối Students bên dưới: khối đó
    // return sớm khi bảng Students đã đúng schema, nếu đặt sau sẽ không bao giờ chạy.
    themCotNeuThieu(db, 'Assignments', 'priority', "TEXT NOT NULL DEFAULT 'MEDIUM'");

    // Chạy TRƯỚC khối Students vì khối đó return sớm khi bảng Students đã đúng schema.
    migrateEduxAssignments(db);

    // Cột phụ có thể thiếu ở file .db tạo từ schema cũ trước khi có bảng này.
    themCotNeuThieu(db, 'EduxAssignments', 'subject_ext_id', 'TEXT');
    themCotNeuThieu(db, 'EduxAssignments', 'model_id', 'TEXT');
    themCotNeuThieu(db, 'EduxAssignments', 'chapter', 'TEXT');
    themCotNeuThieu(db, 'EduxAssignments', 'highest_score', 'INTEGER');
    themCotNeuThieu(db, 'EduxAssignments', 'doc_done', 'INTEGER NOT NULL DEFAULT 0');
    themCotNeuThieu(db, 'EduxAssignments', 'doc_total', 'INTEGER NOT NULL DEFAULT 0');
    themCotNeuThieu(db, 'EduxAssignments', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');

    try {
        const cols = queryAll(db, 'PRAGMA table_info("Students");').map(c => c.name);
        if (!cols.length) return; // chưa có bảng — runSchema đã lo

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

/**
 * Đưa bảng EduxAssignments (file .db tạo từ schema cũ) về đúng schema hiện tại.
 *
 * Schema cũ khóa bài tập EDUX theo `student_id`; schema hiện tại khóa theo
 * `user_id` (NGUOI_DUNG_ID) vì EDUX không phụ thuộc hồ sơ IU. Nhưng
 * `CREATE TABLE IF NOT EXISTS` không sửa được bảng đã tồn tại, nên file .db cũ
 * vẫn thiếu cột user_id và mọi truy vấn bài tập EDUX đều "no such column: user_id"
 * (GET /api/v1/tasks/edux trả 500).
 *
 * Cách xử lý: dựng bảng mới theo schema hiện tại, copy dữ liệu cũ sang
 * (student_id → user_id, giữ nguyên edux_id để không đổi khóa), rồi thay thế
 * bảng cũ. Chỉ chạy khi phát hiện bảng di sản — không đụng gì tới database
 * đúng schema.
 *
 * @param {Database} db - sql.js database instance
 */
function migrateEduxAssignments(db) {
    try {
        const cols = queryAll(db, 'PRAGMA table_info("EduxAssignments");').map(c => c.name);
        if (!cols.length) return;             // bảng chưa có — runSchema đã tạo đúng schema
        if (cols.includes('user_id')) return; // đã đúng schema hiện tại

        // Bảng cũ có thể thiếu vài cột phụ — cột nào không có thì dùng giá trị mặc định.
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

/**
 * Thêm cột vào bảng nếu file .db cũ chưa có cột đó.
 * @param {Database} db
 * @param {string} table
 * @param {string} column
 * @param {string} definition - phần định nghĩa cột trong ALTER TABLE
 */
function themCotNeuThieu(db, table, column, definition) {
    try {
        const cols = queryAll(db, `PRAGMA table_info("${table}");`).map(c => c.name);
        if (!cols.length) return; // bảng chưa tồn tại — runSchema sẽ tạo đúng cấu trúc
        if (cols.includes(column)) return;

        db.run(`ALTER TABLE "${table}" ADD COLUMN ${column} ${definition};`);
        console.log(`[DB] Đã thêm cột ${table}.${column}.`);
    } catch (err) {
        console.error(`[DB] Không thêm được cột ${table}.${column}:`, err.message);
    }
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
