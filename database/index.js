/**
 * database/index.js
 * ===================================================================================
 * CỔNG GIAO TIẾP DATABASE CHO SPRINT 1 (CHỨC NĂNG 1, 2, 3, 4, 9, 18)
 * ===================================================================================
 * Chuyển sang SQLite (sql.js): máy khách chạy luôn, không cần cài SQL Server,
 * không cần cấu hình phức tạp, không dùng dữ liệu giả (mock).
 *
 * Dữ liệu thật được lưu trong file SQLite (mặc định: data/unistudy.db),
 * tạo tự động khi chạy lần đầu.
 * ===================================================================================
 */

const {
    getPool,
    closePool,
    sql,
    executeQuery,
    executeProcedure,
    withTransaction
} = require('./connection/db');
const sprint1Service = require('./sprint1Service');
const sprint2Service = require('./sprint2/sprint2Service');
const sprint2Integrity = require('./sprint2/sprint2Integrity');

/**
 * Hàm kết nối tới Database và trả ra danh sách toàn bộ các hàm được sử dụng trong Sprint 1
 * @returns {Promise<Object>} Đối tượng chứa toàn bộ các hàm backend của Sprint 1 theo chức năng
 */
async function ketNoiDatabase() {
    // Luôn khởi tạo SQLite tự động, không cần SQL Server, không báo lỗi kết nối.
    await getPool();

    console.log('[DB] Đã khởi tạo cơ sở dữ liệu SQLite thành công (Chế độ LIVE DB).');

    // Return theo từng chức năng của Sprint 1 (giữ nguyên tên hàm, tham số, giá trị trả về):
    return {
        ...sprint2Service,
        ...sprint2Integrity,
        // Kết nối cơ bản
        sql,
        getPool,
        closePool,
        executeQuery,
        executeProcedure,
        withTransaction,

        // ─── CHỨC NĂNG 18: HỒ SƠ HỌC TẬP CÁ NHÂN ──────────────────────
        layHoSo: sprint1Service.layHoSo,
        luuHoSo: sprint1Service.luuHoSo,
        layBangDiem: sprint1Service.layBangDiem,
        layMonHocChuaDat: sprint1Service.layMonHocChuaDat,
        layMonHocDaDat: sprint1Service.layMonHocDaDat,
        layDanhSachMonHoc: sprint1Service.layDanhSachMonHoc,
        dongBoHoSoIU: sprint1Service.dongBoHoSoIU,

        // ─── CHỨC NĂNG 1: THỜI KHÓA BIỂU THÔNG MINH ────────────────────
        layThoiKhoaBieu: sprint1Service.layThoiKhoaBieu,
        layThoiKhoaBieuTheoNgay: sprint1Service.layThoiKhoaBieuTheoNgay,
        layThoiKhoaBieuTheoTuan: sprint1Service.layThoiKhoaBieuTheoTuan,
        layThoiKhoaBieuTheoMon: sprint1Service.layThoiKhoaBieuTheoMon,
        themTietHoc: sprint1Service.themTietHoc,
        xoaTietHoc: sprint1Service.xoaTietHoc,

        // ─── CHỨC NĂNG 2: AI XẾP LỊCH TỰ HỌC & CẢNH BÁO TRÙNG ─────────
        kiemTraTrungLich: sprint1Service.kiemTraTrungLich,
        kiemTraXungDotLichTuHoc: sprint1Service.kiemTraXungDotLichTuHoc,
        xepLichTuHoc: sprint1Service.xepLichTuHoc,
        layLichTuHoc: sprint1Service.layLichTuHoc,
        capNhatLichTuHoc: sprint1Service.capNhatLichTuHoc,
        timKhoangTrongTuHoc: sprint1Service.timKhoangTrongTuHoc,
        capNhatTrangThaiLichTuHoc: sprint1Service.capNhatTrangThaiLichTuHoc,
        xoaLichTuHoc: sprint1Service.xoaLichTuHoc,

        // ─── CHỨC NĂNG 3: QUẢN LÝ DEADLINE VÀ CHECKLIST ───────────────
        layDanhSachDeadline: sprint1Service.layDanhSachDeadline,
        layDeadlineSapToi: sprint1Service.layDeadlineSapToi,
        themBaiTap: sprint1Service.themBaiTap,
        capNhatBaiTap: sprint1Service.capNhatBaiTap,
        capNhatTrangThaiBaiTap: sprint1Service.capNhatTrangThaiBaiTap,
        xoaBaiTap: sprint1Service.xoaBaiTap,
        layChecklist: sprint1Service.layChecklist,
        themChecklist: sprint1Service.themChecklist,
        capNhatChecklist: sprint1Service.capNhatChecklist,
        hoanThanhChecklist: sprint1Service.hoanThanhChecklist,
        xoaChecklist: sprint1Service.xoaChecklist,

        // ─── CHỨC NĂNG 4: NHẮC NHỞ THÔNG MINH ĐA TẦNG ────────────────
        layDanhSachNhacNho: sprint1Service.layDanhSachNhacNho,
        taoNhacNho: sprint1Service.taoNhacNho,
        taoNhacNhoDaTang: sprint1Service.taoNhacNhoDaTang,
        layNhacNhoDenHanChuaGui: sprint1Service.layNhacNhoDenHanChuaGui,
        danhDauDaGuiNhacNho: sprint1Service.danhDauDaGuiNhacNho,
        xoaNhacNho: sprint1Service.xoaNhacNho,

        // ─── CHỨC NĂNG 9: QUẢN LÝ LỊCH THI VÀ KẾ HOẠCH ÔN THI ─────────
        layLichThi: sprint1Service.layLichThi,
        layLichThiSapToi: sprint1Service.layLichThiSapToi,
        themLichThi: sprint1Service.themLichThi,
        capNhatLichThi: sprint1Service.capNhatLichThi,
        xoaLichThi: sprint1Service.xoaLichThi,
        layKeHoachOnThi: sprint1Service.layKeHoachOnThi,
        taoKeHoachOnThi: sprint1Service.taoKeHoachOnThi,
        capNhatTrangThaiKeHoachOnThi: sprint1Service.capNhatTrangThaiKeHoachOnThi,
        xoaKeHoachOnThi: sprint1Service.xoaKeHoachOnThi,

        // ─── ĐỒNG BỘ EDUX (BÀI TẬP AI LƯU XUỐNG SQLITE) ────────────────
        luuBaiTapEDUX: sprint1Service.luuBaiTapEDUX,
        layBaiTapEDUX: sprint1Service.layBaiTapEDUX,
        anBaiTapEDUX: sprint1Service.anBaiTapEDUX,
        capNhatTrangThaiBaiTapEDUX: sprint1Service.capNhatTrangThaiBaiTapEDUX,
        xoaBaiTapEDUX: sprint1Service.xoaBaiTapEDUX

        
    };
}

// Gán trực tiếp các hàm vào function ketNoiDatabase để hỗ trợ mọi cú pháp import
Object.assign(ketNoiDatabase, sprint1Service, sprint2Service, sprint2Integrity);
ketNoiDatabase.ketNoiDatabase = ketNoiDatabase;
ketNoiDatabase.closePool = closePool;

module.exports = ketNoiDatabase;
