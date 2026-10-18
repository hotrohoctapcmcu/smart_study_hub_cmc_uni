"use strict";

/**
 * build.js — Dung object payload request (dang thuong, chua ma hoa).
 *
 * NHIEM VU:
 *  - buildPayload(session, tenEndpoint) -> object payload CUNG (goi 1 lan).
 *  - setPayload(payload, patch) -> object MOI voi gia tri sua doi.
 *  Chi dung object thuong + tra cuu endpoint; viec ma hoa nam o crypto/.
 *
 * NGUON DU LIEU:
 *  - Danh sach field cua moi endpoint trich dung theo module diemhoc trong
 *    portalSrc/loi/diemhoc.js. Vi du KetQuaHocTapCaNhan gui:
 *      action, func, iM, strChucNang_Id (= edu.system.strChucNang_Id),
 *      strQLSV_NguoiHoc_Id, strDaoTao_ChuongTrinh_Id (dropdown),
 *      strNguoiThucHien_Id (= edu.system.userId).
 *  - Quy tac dien ID: strNguoiThucHien_Id/strNguoiDung_Id <- session.userId,
 *    strChucNang_Id <- session.chucNangId,
 *    strQLSV_NguoiHoc_Id <- session.nguoiHocId (mac dinh = userId),
 *    strDaoTao_ChuongTrinh_Id <- session.chuongTrinhId (de "" neu chua chon),
 *    field la de "" — dien sau bang setPayload().
 *
 * CACH DUNG:
 *   const { buildPayload, setPayload } = require("./build");
 *   let p = buildPayload(session, "KetQuaHocTapCaNhan"); // 1 lan
 *   p = setPayload(p, { strDaoTao_ChuongTrinh_Id: "ID_CT" }); // moi khi doi
 */

const { IM_MAC_DINH } = require("../crypto");
const { traEndpoint } = require("./endpoints");

// Field cua tung endpoint (trich tu diemhoc.js). Endpoint khac khong co trong
// danh sach van dung duoc — chi gom action/func/iM, tu them field bang setPayload().
const THAM_SO_MAC_DINH = {
    KetQuaHocTapCaNhan: ["strChucNang_Id", "strQLSV_NguoiHoc_Id", "strDaoTao_ChuongTrinh_Id", "strNguoiThucHien_Id"],
    LayKetQuaTichLuyTheoKhoi: ["strQLSV_NguoiHoc_Id", "strDaoTao_ChuongTrinh_Id"],
    LayThongTinChuongTrinhHoc: ["strChucNang_Id", "strQLSV_NguoiHoc_Id", "strNguoiThucHien_Id"],
    LayKetQuaDangKyHocCaNhan: ["strNguoiThucHien_Id", "strQLSV_NguoiHoc_Id", "strDaoTao_ThoiGianDaoTao_Id"],
    LayDSThoiGianLichHoc: ["strNguoiThucHien_Id", "strQLSV_NguoiHoc_Id"],
    LayDSDiemThanhPhanTheoTKHP: ["strDiem_NguoiHoc_TongKet_Id"],
    LayDSQDCaNhan: ["strNguoiDung_Id"],
    LayDSTN_KetQua_CongNhan_VB: ["strNguoiDung_Id"],
    LatKetQuaDiemQuaTrinh: ["strNguoiThucHien_Id", "strQLSV_NguoiHoc_Id", "strDaoTao_LopHocPhan_Id"],
    LayDSKetQuaXuLyHocVu: ["strQLSV_NguoiHoc_Id", "strDaoTao_ChuongTrinh_Id", "strNguoiThucHien_Id"],
    LayKQRenLuyenCaNhan: ["strQLSV_NguoiHoc_Id", "strDaoTao_ChuongTrinh_Id", "strNguoiThucHien_Id"],
    // -- Bo sung cho Smart Study Hub (schema IU cua nguoi dung) --
    // Tin tuc dashboard: index.html/ApisCongSinhVien dashboard.js getList_TinTuc.
    // (portal gui them strDaoTao_CoCauToChuc_Id/dHieuLuc/pageIndex/pageSize).
    LayDSTinTuc_BangTin_NguoiDung: ["strTuKhoa", "strTuNgay", "strDenNgay", "strNguoiThucHien_Id", "strChuyenMuc_Id", "strChung_UngDung_Id", "dTinQuanTrong", "strDaoTao_CoCauToChuc_Id", "dHieuLuc", "pageIndex", "pageSize"],
    // Ho so sinh vien (profile/hoso.js viewForm_SinhVien + LayDSTabThongTinNguoiHoc).
    LayDSTabThongTinNguoiHoc: ["strChucNang_Id", "strQLSV_NguoiHoc_Id", "strDaoTao_ChuongTrinh_Id", "strNguoiThucHien_Id"],
    // Lich hoc ca nhan theo tuan (thoikhoabieu lichgiang.js getList_TuanHienTai).
    LayDSLichCaNhan: ["strQLSV_NguoiHoc_Id", "strNgayBatDau", "strNgayKetThuc"],
    // Lich thi: hoc ky -> hoc phan -> chi tiet (thoikhoabieu lichthi.js).
    // Luu y: lichthi.js dung 2 suffix khac nhau cho 2 buoc:
    //  - LayDSHocPhanLichThi -> suffix ...DSgiKRUpKAPP (module SV_ThongTin_MH),
    //  - LayDSLichThi_KeHoachThi -> suffix ...FSkoHgokCS4gIikVKSgP (default)
    //    hoac ...FSkoHgokCS4gIikVKSgeDSgiKRI0 (khi init truyen strHam)
    //    kem strDaoTao_HocPhan_Id tu dropdown hoc phan.
    LayDSThoiGianLichThi: ["strNguoiThucHien_Id"],
    LayDSHocPhanLichThi: ["strDaoTao_ThoiGianDaoTao_Id", "strTHI_DotThi_Id", "strDiem_ThanhPhanDiem_Id", "strNguoiThucHien_Id"],
    LayDSLichThi_KeHoachThi: ["strQLSV_NguoiHoc_Id", "strDaoTao_ThoiGianDaoTao_Id", "strDaoTao_HocPhan_Id"],
    LayTTLichThi: ["strQLSV_NguoiHoc_Id", "strNgayDangChon"],
    // Phuc khao (hoctap phuckhao.js).
    LayDSThiPhucKhaoCaNhan: ["strNguoiThucHien_Id", "strDaoTao_ThoiGianDaoTao_Id", "strQLSV_NguoiHoc_Id"],
    LayDSLichSuPhucKhao: ["strThi_DanhSachThi_TuiBai_Id"],
    LayThoiGian: ["strNguoiThucHien_Id", "strQLSV_NguoiHoc_Id"],
    // Ho so chi tiet (profile hoso.js getDetail_SinhVien — module SV_Custom).
    LayThongTinChiTietHoSo: ["strId"],
};

// Dung payload CUNG sau login.
// session = { userId, chucNangId, nguoiHocId?, chuongTrinhId? } (tu laySession).
function buildPayload(session, tenEndpoint) {
    const ep = traEndpoint(tenEndpoint);
    const ss = session || {};
    const nguoiHocId = ss.nguoiHocId || ss.userId || "";
    const payload = {
        action: ep.module + "/" + ep.suffix,
        func: ep.func,
        iM: IM_MAC_DINH,
    };
    const fields = THAM_SO_MAC_DINH[tenEndpoint] || [];
    for (const f of fields) {
        if (f === "strNguoiThucHien_Id" || f === "strNguoiDung_Id") payload[f] = ss.userId || "";
        else if (f === "strChucNang_Id") payload[f] = ss.chucNangId || "";
        else if (f === "strQLSV_NguoiHoc_Id") payload[f] = nguoiHocId;
        else if (f === "strDaoTao_ChuongTrinh_Id") payload[f] = ss.chuongTrinhId || "";
        else if (f === "strId") payload[f] = ss.userId || "";
        else if (f === "dHieuLuc" || f === "pageIndex") payload[f] = 1;
        else if (f === "pageSize") payload[f] = 30;
        else if (f === "dTinQuanTrong") payload[f] = -1;
        else payload[f] = "";
    }

    // QUAN TRONG: portal (Core_systemroot.js makeRequest) luon tu gan 2 field nay
    // cho MOI request neu chua co:
    //   d.strChucNang_Id || (d.strChucNang_Id = edu.system.strChucNang_Id)
    //   d.strNguoiThucHien_Id || (d.strNguoiThucHien_Id = edu.system.userId)
    // Thieu chung -> cum sinhvienapi tra 401 (HTML) du cookie/token con han,
    // khien TKB / lich thi / bang diem / ho so deu rong.
    if (!payload.strChucNang_Id) payload.strChucNang_Id = ss.chucNangId || "";
    if (!payload.strNguoiThucHien_Id) payload.strNguoiThucHien_Id = ss.userId || "";

    return payload;
}

// Sua gia tri thay doi — tra object moi, khong sua object cu.
// Vd: p = setPayload(p, { strDaoTao_ThoiGianDaoTao_Id: "ID_HK_MOI" });
function setPayload(payload, patch) {
    return Object.assign({}, payload, patch);
}

// URL day du de POST. Portal chon cum theo tien to truoc dau "_" cua module
// (ham makeRequest trong portalSrc/loi/Core_systemroot.js + bang Init_API
// trong portalSrc/loi/Config.js):
//   SV -> sinhvienapi, TS -> quanlytuyensinhapi, XLHV -> xulyhocvuapi,
//   CMS -> cmsapi, TC -> taichinhapi, DKH -> dangkyhocapi ...
// Truoc day mac dinh moi endpoint ve sinhvienapi nen TS_TinTuc_MH /
// XLHV_TP_PhucKhao_MH bi 404.
const CUM_API_THEO_TIEN_TO = {
    SV: "sinhvienapi",
    TS: "quanlytuyensinhapi",
    XLHV: "xulyhocvuapi",
    CMS: "cmsapi",
    TC: "taichinhapi",
    DKH: "dangkyhocapi",
    KHCT: "kehoachchuongtrinhapi",
    D: "quanlydiemapi",
    TP: "thiphachapi",
    TT: "tintucapi",
    TN: "totnghiepapi",
};
function layUrl(payload, cumApi) {
    if (cumApi) return "https://iu.cmcu.edu.vn/" + cumApi + "/api/" + payload.action;
    const action = String((payload && payload.action) || "");
    const module = action.includes("/") ? action.slice(0, action.indexOf("/")) : action;
    const tienTo = module.includes("_") ? module.slice(0, module.indexOf("_")) : module;
    const cum = CUM_API_THEO_TIEN_TO[tienTo] || "sinhvienapi";
    return "https://iu.cmcu.edu.vn/" + cum + "/api/" + action;
}

module.exports = { buildPayload, setPayload, layUrl };
