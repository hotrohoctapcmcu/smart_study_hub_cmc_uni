/**
 * database/sprint2/index.js
 * ===================================================================================
 * CỔNG GIAO TIẾP DATABASE CHO SPRINT 2
 * ===================================================================================
 * Tiếp nối Sprint 1, bổ sung các chức năng Sprint 2:
 *   - PB-13: Buổi tự học (mở rộng StudySchedules)
 *   - PB-42: Lịch sử Pomodoro
 *   - PB-38: Sổ tay & Ghi chú
 *   - PB-30, PB-32: Hồ sơ học tập (bổ sung)
 *   - PB-05, PB-06: Đồng bộ EDUX
 *
 * Chạy migration tự động (idempotent) khi khởi tạo.
 * ===================================================================================
 */

"use strict";

const { getPool, closePool, sql, executeQuery } = require("../connection/db");
const { ensureSprint2Migration } = require("./sprint2Migration");
const sprint2Service = require("./sprint2Service");
const sprint2Integrity = require("./sprint2Integrity");

/**
 * Khởi tạo database Sprint 2 (chạy migration nếu cần) và trả ra toàn bộ hàm.
 * @returns {Promise<Object>} Đối tượng chứa toàn bộ hàm backend của Sprint 2
 */
async function ketNoiDatabaseSprint2() {
    // Đảm bảo database đã sẵn sàng
    await getPool();

    // Chạy migration Sprint 2 (tự động bỏ qua nếu đã chạy)
    const migrationResult = await ensureSprint2Migration();
    if (migrationResult) {
        console.log(
            "[SPRINT2] Migration hoàn tất:",
            `${migrationResult.createdTables.length} bảng mới,`,
            `${migrationResult.alteredColumns.length} cột bổ sung,`,
            `${migrationResult.createdIndexes} index,`,
            `${migrationResult.createdTriggers} trigger.`
        );
    } else {
        console.log("[SPRINT2] Database Sprint 2 đã sẵn sàng (migration trước đó).");
    }

    return {
        // ─── Kết nối cơ bản ──────────────────────────────────────────────
        sql,
        getPool,
        closePool,
        executeQuery,

        // ─── PB-13: BUỔI TỰ HỌC ────────────────────────────────────────
        layLichTuHocTheoKhoangThoiGian: sprint2Service.layLichTuHocTheoKhoangThoiGian,
        layThongKeBuoiTuHoc: sprint2Service.layThongKeBuoiTuHoc,
        hoanThanhBuoiTuHoc: sprint2Service.hoanThanhBuoiTuHoc,

        // ─── PB-42: LỊCH SỬ POMODORO ────────────────────────────────────
        batDauPomodoro: sprint2Service.batDauPomodoro,
        capNhatPomodoro: sprint2Service.capNhatPomodoro,
        ketThucPomodoro: sprint2Service.ketThucPomodoro,
        layLichSuPomodoro: sprint2Service.layLichSuPomodoro,
        layThongKePomodoro: sprint2Service.layThongKePomodoro,
        layPomodoroTheoNgay: sprint2Service.layPomodoroTheoNgay,

        // ─── PB-38: SỔ TAY & GHI CHÚ ───────────────────────────────────
        taoSoTay: sprint2Service.taoSoTay,
        layDanhSachSoTay: sprint2Service.layDanhSachSoTay,
        capNhatSoTay: sprint2Service.capNhatSoTay,
        xoaSoTay: sprint2Service.xoaSoTay,
        themGhiChu: sprint2Service.themGhiChu,
        layGhiChuTheoSoTay: sprint2Service.layGhiChuTheoSoTay,
        layGhiChuKho: sprint2Service.layGhiChuKho,
        capNhatGhiChu: sprint2Service.capNhatGhiChu,
        xoaGhiChu: sprint2Service.xoaGhiChu,
        timKiemGhiChu: sprint2Service.timKiemGhiChu,

        // ─── PB-30, PB-32: HỒ SƠ HỌC TẬP BỔ SUNG ─────────────────────
        layBangDiemTheoNamHoc: sprint2Service.layBangDiemTheoNamHoc,
        layLichSuHocLai: sprint2Service.layLichSuHocLai,
        layTienDoHocTap: sprint2Service.layTienDoHocTap,

        // ─── PB-05, PB-06: ĐỒNG BỘ EDUX ────────────────────────────────
        dongBoEdux: sprint2Service.dongBoEdux,
        rollbackEdux: sprint2Service.rollbackEdux,
        layTaiLieuEdux: sprint2Service.layTaiLieuEdux,
        layLogDongBoEdux: sprint2Service.layLogDongBoEdux,

        // ─── KIỂM TRA TOÀN VẸN ──────────────────────────────────────────
        kiemTraToanVen: sprint2Integrity.kiemTraToanVen,
        kiemTraCauTrucBang: sprint2Integrity.kiemTraCauTrucBang,
        kiemTraKhoaNgoai: sprint2Integrity.kiemTraKhoaNgoai,
        kiemTraDuLieuTrung: sprint2Integrity.kiemTraDuLieuTrung,
        kiemTraQuyenSoHuu: sprint2Integrity.kiemTraQuyenSoHuu,
        kiemTraKhaNangTruyVan: sprint2Integrity.kiemTraKhaNangTruyVan,
        kiemTraIndex: sprint2Integrity.kiemTraIndex,

        // ─── MIGRATION ──────────────────────────────────────────────────
        ensureSprint2Migration,
    };
}

// Gán trực tiếp để hỗ trợ mọi cú pháp import
Object.assign(ketNoiDatabaseSprint2, sprint2Service, sprint2Integrity);
ketNoiDatabaseSprint2.ketNoiDatabaseSprint2 = ketNoiDatabaseSprint2;
ketNoiDatabaseSprint2.closePool = closePool;

module.exports = ketNoiDatabaseSprint2;
