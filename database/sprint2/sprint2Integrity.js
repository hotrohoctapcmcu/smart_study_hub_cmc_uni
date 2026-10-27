/**
 * database/sprint2/sprint2Integrity.js
 * ===================================================================================
 * SPRINT 2 — KIỂM TRA TÍNH TOÀN VẸN DỮ LIỆU
 * ===================================================================================
 * Module chuyên kiểm tra:
 *   1. Ràng buộc khóa ngoại (orphan records).
 *   2. Dữ liệu trùng lặp không hợp lệ.
 *   3. Quyền sở hữu dữ liệu theo tài khoản (student_id).
 *   4. Khả năng truy vấn dữ liệu cho AI, bản đồ thời gian, tiến độ.
 *   5. Kiểm tra cấu trúc bảng so với Sprint 2 schema.
 *   6. Hỗ trợ rollback và báo cáo.
 *
 * Sử dụng: gọi `kiemTraToanVen()` để chạy tất cả kiểm tra và nhận báo cáo.
 * ===================================================================================
 */

"use strict";

const { getPool, executeQuery } = require("../connection/db");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getTableColumns(db, tableName) {
    const stmt = db.prepare(`PRAGMA table_info('${tableName}')`);
    const columns = [];
    while (stmt.step()) {
        columns.push(stmt.getAsObject());
    }
    stmt.reset();
    stmt.free();
    return columns;
}

function getIndexes(db, tableName) {
    const stmt = db.prepare(`PRAGMA index_list('${tableName}')`);
    const indexes = [];
    while (stmt.step()) {
        indexes.push(stmt.getAsObject());
    }
    stmt.reset();
    stmt.free();
    return indexes;
}

// ===================================================================================
// KIỂM TRA 1: CẤU TRÚC BẢNG
// ===================================================================================

async function kiemTraCauTrucBang() {
    const db = await getPool();
    const report = { passed: [], failed: [], warnings: [] };

    // Bảng Sprint 1 bắt buộc
    const sprint1Tables = [
        "Students", "Subjects", "StudentSubjects", "Grades",
        "Timetables", "StudySchedules", "Assignments", "Checklists",
        "Reminders", "Exams", "ExamStudyPlans",
    ];

    // Bảng Sprint 2 bắt buộc
    const sprint2Tables = [
        "PomodoroSessions", "Notebooks", "Notes",
        "EduxDocuments", "EduxSyncLog",
    ];

    for (const tbl of sprint1Tables) {
        if (tableExists(db, tbl)) {
            report.passed.push(`[CẤU TRÚC] Bảng Sprint 1 "${tbl}" ✓ tồn tại`);
        } else {
            report.failed.push(
                `[CẤU TRÚC] Bảng Sprint 1 "${tbl}" ✗ THIẾU — cần chạy migration Sprint 1`
            );
        }
    }

    for (const tbl of sprint2Tables) {
        if (tableExists(db, tbl)) {
            report.passed.push(`[CẤU TRÚC] Bảng Sprint 2 "${tbl}" ✓ tồn tại`);
        } else {
            report.failed.push(
                `[CẤU TRÚC] Bảng Sprint 2 "${tbl}" ✗ THIẾU — chạy ensureSprint2Migration()`
            );
        }
    }

    // Kiểm tra cột bổ sung trên Exams
    if (tableExists(db, "Exams")) {
        const cols = getTableColumns(db, "Exams");
        const colNames = cols.map((c) => c.name);

        if (colNames.includes("semester")) {
            report.passed.push('[CẤU TRÚC] Exams.semester ✓');
        } else {
            report.warnings.push(
                '[CẤU TRÚC] Exams.semester ⚠ thiếu — chạy migration để bổ sung'
            );
        }

        if (colNames.includes("academic_year")) {
            report.passed.push('[CẤU TRÚC] Exams.academic_year ✓');
        } else {
            report.warnings.push(
                '[CẤU TRÚC] Exams.academic_year ⚠ thiếu — chạy migration để bổ sung'
            );
        }
    }

    // Kiểm tra Grades có đủ component_score, exam_score
    if (tableExists(db, "Grades")) {
        const cols = getTableColumns(db, "Grades").map((c) => c.name);
        ["component_score", "exam_score"].forEach((col) => {
            if (cols.includes(col)) {
                report.passed.push(`[CẤU TRÚC] Grades.${col} ✓`);
            } else {
                report.warnings.push(
                    `[CẤU TRÚC] Grades.${col} ⚠ thiếu`
                );
            }
        });
    }

    return report;
}

// ===================================================================================
// KIỂM TRA 2: RÀNG BUỘC KHÓA NGOẠI (ORPHAN RECORDS)
// ===================================================================================

async function kiemTraKhoaNgoai() {
    const report = { passed: [], failed: [], warnings: [] };

    // Danh sách FK cần kiểm tra: [bảng_con, cột_FK, bảng_cha, cột_PK]
    const fkChecks = [
        ["Grades", "student_id", "Students", "student_id"],
        ["Grades", "subject_id", "Subjects", "subject_id"],
        ["Timetables", "student_id", "Students", "student_id"],
        ["Timetables", "subject_id", "Subjects", "subject_id"],
        ["StudySchedules", "student_id", "Students", "student_id"],
        ["Assignments", "student_id", "Students", "student_id"],
        ["Assignments", "subject_id", "Subjects", "subject_id"],
        ["Checklists", "student_id", "Students", "student_id"],
        ["Reminders", "student_id", "Students", "student_id"],
        ["Exams", "student_id", "Students", "student_id"],
        ["Exams", "subject_id", "Subjects", "subject_id"],
        ["ExamStudyPlans", "student_id", "Students", "student_id"],
        ["ExamStudyPlans", "exam_id", "Exams", "exam_id"],
        ["PomodoroSessions", "student_id", "Students", "student_id"],
        ["Notebooks", "student_id", "Students", "student_id"],
        ["Notes", "notebook_id", "Notebooks", "notebook_id"],
        ["Notes", "student_id", "Students", "student_id"],
        ["EduxDocuments", "student_id", "Students", "student_id"],
        ["EduxSyncLog", "student_id", "Students", "student_id"],
    ];

    for (const [childTable, childCol, parentTable, parentCol] of fkChecks) {
        try {
            const orphans = await executeQuery(
                `SELECT COUNT(1) AS cnt FROM ${childTable} c
                 WHERE c.${childCol} IS NOT NULL
                   AND c.${childCol} NOT IN (SELECT ${parentCol} FROM ${parentTable})`
            );

            const count = orphans.length > 0 ? orphans[0].cnt : 0;

            if (count === 0) {
                report.passed.push(
                    `[FK] ${childTable}.${childCol} → ${parentTable}.${parentCol} ✓ (0 orphan)`
                );
            } else {
                report.failed.push(
                    `[FK] ${childTable}.${childCol} → ${parentTable}.${parentCol} ✗ ${count} bản ghi mồ côi!`
                );
            }
        } catch (e) {
            // Bảng chưa tồn tại
            report.warnings.push(
                `[FK] ${childTable}.${childCol} ⚠ Không thể kiểm tra (${e.message})`
            );
        }
    }

    return report;
}

// ===================================================================================
// KIỂM TRA 3: DỮ LIỆU TRÙNG LẶP
// ===================================================================================

async function kiemTraDuLieuTrung() {
    const report = { passed: [], failed: [], warnings: [] };

    // 3a. Trùng student_code
    try {
        const dups = await executeQuery(
            `SELECT student_code, COUNT(1) AS cnt
             FROM Students GROUP BY student_code HAVING cnt > 1`
        );
        if (dups.length === 0) {
            report.passed.push("[TRÙNG] Students.student_code ✓ duy nhất");
        } else {
            report.failed.push(
                `[TRÙNG] Students.student_code ✗ ${dups.length} mã SV trùng: ${dups.map((d) => d.student_code).join(", ")}`
            );
        }
    } catch (_) {}

    // 3b. Trùng subject_code
    try {
        const dups = await executeQuery(
            `SELECT subject_code, COUNT(1) AS cnt
             FROM Subjects GROUP BY subject_code HAVING cnt > 1`
        );
        if (dups.length === 0) {
            report.passed.push("[TRÙNG] Subjects.subject_code ✓ duy nhất");
        } else {
            report.failed.push(
                `[TRÙNG] Subjects.subject_code ✗ ${dups.length} mã môn trùng`
            );
        }
    } catch (_) {}

    // 3c. Trùng bản ghi Grades (cùng student, subject, semester, year, attempt)
    try {
        const dups = await executeQuery(
            `SELECT student_id, subject_id, semester, academic_year, attempt_number,
                    COUNT(1) AS cnt
             FROM Grades
             GROUP BY student_id, subject_id, semester, academic_year, attempt_number
             HAVING cnt > 1`
        );
        if (dups.length === 0) {
            report.passed.push("[TRÙNG] Grades ✓ không có bản ghi trùng");
        } else {
            report.failed.push(
                `[TRÙNG] Grades ✗ ${dups.length} nhóm bản ghi trùng`
            );
        }
    } catch (_) {}

    // 3d. Trùng notebook (cùng student + subject + title)
    try {
        const dups = await executeQuery(
            `SELECT student_id, subject_id, title, COUNT(1) AS cnt
             FROM Notebooks
             GROUP BY student_id, subject_id, title
             HAVING cnt > 1`
        );
        if (dups.length === 0) {
            report.passed.push("[TRÙNG] Notebooks ✓ không có sổ tay trùng");
        } else {
            report.warnings.push(
                `[TRÙNG] Notebooks ⚠ ${dups.length} sổ tay trùng tên (có thể chấp nhận)`
            );
        }
    } catch (_) {}

    return report;
}

// ===================================================================================
// KIỂM TRA 4: QUYỀN SỞ HỮU DỮ LIỆU
// ===================================================================================

async function kiemTraQuyenSoHuu() {
    const report = { passed: [], failed: [], warnings: [] };

    // Kiểm tra Notes luôn thuộc Notebook của cùng student
    try {
        const crossOwner = await executeQuery(
            `SELECT n.note_id, n.student_id AS note_owner, nb.student_id AS notebook_owner
             FROM Notes n
             INNER JOIN Notebooks nb ON n.notebook_id = nb.notebook_id
             WHERE n.student_id != nb.student_id`
        );
        if (crossOwner.length === 0) {
            report.passed.push(
                "[SỞ HỮU] Notes.student_id ↔ Notebooks.student_id ✓ nhất quán"
            );
        } else {
            report.failed.push(
                `[SỞ HỮU] ✗ ${crossOwner.length} ghi chú thuộc notebook của người khác!`
            );
        }
    } catch (_) {
        report.warnings.push("[SỞ HỮU] Chưa kiểm tra được Notes (bảng chưa tồn tại?)");
    }

    // Kiểm tra PomodoroSessions liên kết đúng StudySchedules của cùng student
    try {
        const crossOwner = await executeQuery(
            `SELECT p.session_id, p.student_id AS pomodoro_owner,
                    ss.student_id AS schedule_owner
             FROM PomodoroSessions p
             INNER JOIN StudySchedules ss ON p.schedule_id = ss.schedule_id
             WHERE p.student_id != ss.student_id`
        );
        if (crossOwner.length === 0) {
            report.passed.push(
                "[SỞ HỮU] Pomodoro ↔ StudySchedule ✓ nhất quán"
            );
        } else {
            report.failed.push(
                `[SỞ HỮU] ✗ ${crossOwner.length} phiên Pomodoro liên kết sai schedule!`
            );
        }
    } catch (_) {
        report.warnings.push("[SỞ HỮU] Chưa kiểm tra được Pomodoro (bảng chưa tồn tại?)");
    }

    return report;
}

// ===================================================================================
// KIỂM TRA 5: KHẢ NĂNG TRUY VẤN CHO AI / TIMELINE / TIẾN ĐỘ
// ===================================================================================

async function kiemTraKhaNangTruyVan() {
    const report = { passed: [], failed: [], warnings: [] };

    const db = await getPool();

    // 5a. Query tiến độ học tập (GPA, tín chỉ)
    try {
        await executeQuery(
            `SELECT s.student_id, s.student_code,
                    COALESCE(SUM(CASE WHEN g.is_passed = 1 THEN g.credits ELSE 0 END), 0) AS total_credits
             FROM Students s
             LEFT JOIN Grades g ON s.student_id = g.student_id
             GROUP BY s.student_id
             LIMIT 1`
        );
        report.passed.push("[TRUY VẤN] Tiến độ GPA/tín chỉ ✓ query thành công");
    } catch (e) {
        report.failed.push(`[TRUY VẤN] Tiến độ GPA ✗ lỗi: ${e.message}`);
    }

    // 5b. Query timeline (lịch học + tự học + Pomodoro)
    try {
        if (tableExists(db, "PomodoroSessions")) {
            await executeQuery(
                `SELECT 'study' AS type, study_date AS event_date, title, start_time, end_time
                 FROM StudySchedules WHERE student_id = 1
                 UNION ALL
                 SELECT 'pomodoro' AS type, session_date AS event_date,
                        'Pomodoro' AS title, started_at AS start_time, ended_at AS end_time
                 FROM PomodoroSessions WHERE student_id = 1
                 ORDER BY event_date DESC LIMIT 5`
            );
            report.passed.push("[TRUY VẤN] Timeline tự học + Pomodoro ✓");
        }
    } catch (e) {
        report.warnings.push(`[TRUY VẤN] Timeline ⚠ ${e.message}`);
    }

    // 5c. Query tìm kiếm ghi chú
    try {
        if (tableExists(db, "Notes")) {
            await executeQuery(
                `SELECT n.note_id, n.title, n.content, n.tags
                 FROM Notes n WHERE n.title LIKE '%test%' LIMIT 1`
            );
            report.passed.push("[TRUY VẤN] Tìm kiếm ghi chú ✓");
        }
    } catch (e) {
        report.warnings.push(`[TRUY VẤN] Tìm kiếm ghi chú ⚠ ${e.message}`);
    }

    // 5d. Query lịch thi + kế hoạch ôn thi
    try {
        await executeQuery(
            `SELECT e.exam_id, e.exam_date, e.exam_time,
                    sub.subject_name,
                    (SELECT COUNT(1) FROM ExamStudyPlans esp WHERE esp.exam_id = e.exam_id) AS plans_count
             FROM Exams e
             INNER JOIN Subjects sub ON e.subject_id = sub.subject_id
             LIMIT 1`
        );
        report.passed.push("[TRUY VẤN] Lịch thi + kế hoạch ôn thi ✓");
    } catch (e) {
        report.warnings.push(`[TRUY VẤN] Lịch thi ⚠ ${e.message}`);
    }

    // 5e. Query tài liệu EDUX
    try {
        if (tableExists(db, "EduxDocuments")) {
            await executeQuery(
                `SELECT d.document_id, d.title, d.category,
                        sub.subject_name
                 FROM EduxDocuments d
                 LEFT JOIN Subjects sub ON d.subject_id = sub.subject_id
                 LIMIT 1`
            );
            report.passed.push("[TRUY VẤN] Tài liệu EDUX ✓");
        }
    } catch (e) {
        report.warnings.push(`[TRUY VẤN] EDUX ⚠ ${e.message}`);
    }

    return report;
}

// ===================================================================================
// KIỂM TRA 6: INDEX HIỆU NĂNG
// ===================================================================================

async function kiemTraIndex() {
    const db = await getPool();
    const report = { passed: [], failed: [], warnings: [] };

    const expectedIndexes = {
        Students: ["IX_Students_StudentCode"],
        Grades: ["IX_Grades_Student_Semester"],
        Timetables: ["IX_Timetables_Student_Day"],
        StudySchedules: ["IX_StudySchedules_Student_Date"],
        Assignments: ["IX_Assignments_Student_Deadline"],
        Reminders: ["IX_Reminders_Pending"],
        Exams: ["IX_Exams_Student_Date"],
        PomodoroSessions: [
            "IX_Pomodoro_Student_Date",
            "IX_Pomodoro_Student_Status",
        ],
        Notebooks: ["IX_Notebooks_Student"],
        Notes: [
            "IX_Notes_Notebook",
            "IX_Notes_Student",
            "IX_Notes_Hard",
        ],
        EduxDocuments: [
            "IX_Edux_Student_Subject",
            "IX_Edux_External",
        ],
    };

    for (const [table, expectedIdxList] of Object.entries(expectedIndexes)) {
        if (!tableExists(db, table)) continue;

        const actualIndexes = getIndexes(db, table).map((i) => i.name);

        for (const idx of expectedIdxList) {
            if (actualIndexes.includes(idx)) {
                report.passed.push(`[INDEX] ${table}.${idx} ✓`);
            } else {
                report.warnings.push(
                    `[INDEX] ${table}.${idx} ⚠ chưa tạo — hiệu năng có thể bị ảnh hưởng`
                );
            }
        }
    }

    return report;
}

// ===================================================================================
// BÁO CÁO TỔNG HỢP
// ===================================================================================

/**
 * Chạy tất cả kiểm tra toàn vẹn dữ liệu và trả về báo cáo chi tiết.
 * @returns {Promise<Object>} Báo cáo tổng hợp
 */
async function kiemTraToanVen() {
    console.log("[INTEGRITY] Bắt đầu kiểm tra tính toàn vẹn dữ liệu...\n");

    const results = {
        timestamp: new Date().toISOString(),
        checks: {},
        summary: { passed: 0, failed: 0, warnings: 0 },
    };

    // 1. Cấu trúc bảng
    const cauTruc = await kiemTraCauTrucBang();
    results.checks.cauTrucBang = cauTruc;

    // 2. Khóa ngoại
    const khoaNgoai = await kiemTraKhoaNgoai();
    results.checks.khoaNgoai = khoaNgoai;

    // 3. Dữ liệu trùng
    const duLieuTrung = await kiemTraDuLieuTrung();
    results.checks.duLieuTrung = duLieuTrung;

    // 4. Quyền sở hữu
    const quyenSoHuu = await kiemTraQuyenSoHuu();
    results.checks.quyenSoHuu = quyenSoHuu;

    // 5. Khả năng truy vấn
    const truyVan = await kiemTraKhaNangTruyVan();
    results.checks.khaNangTruyVan = truyVan;

    // 6. Index
    const indexes = await kiemTraIndex();
    results.checks.indexes = indexes;

    // Tổng hợp
    for (const check of Object.values(results.checks)) {
        results.summary.passed += check.passed.length;
        results.summary.failed += check.failed.length;
        results.summary.warnings += check.warnings.length;
    }

    // In báo cáo
    console.log("═══════════════════════════════════════════════════════");
    console.log("    BÁO CÁO KIỂM TRA TÍNH TOÀN VẸN DỮ LIỆU");
    console.log("    Sprint 2 — " + results.timestamp);
    console.log("═══════════════════════════════════════════════════════\n");

    for (const [name, check] of Object.entries(results.checks)) {
        console.log(`─── ${name.toUpperCase()} ───`);
        check.passed.forEach((msg) => console.log(`  ✅ ${msg}`));
        check.warnings.forEach((msg) => console.log(`  ⚠️  ${msg}`));
        check.failed.forEach((msg) => console.log(`  ❌ ${msg}`));
        console.log("");
    }

    console.log("───────────────────────────────────────────────────────");
    console.log(
        `  TỔNG KẾT: ✅ ${results.summary.passed} passed | ⚠️  ${results.summary.warnings} warnings | ❌ ${results.summary.failed} failed`
    );
    console.log("───────────────────────────────────────────────────────\n");

    return results;
}

module.exports = {
    kiemTraToanVen,
    kiemTraCauTrucBang,
    kiemTraKhoaNgoai,
    kiemTraDuLieuTrung,
    kiemTraQuyenSoHuu,
    kiemTraKhaNangTruyVan,
    kiemTraIndex,
};
