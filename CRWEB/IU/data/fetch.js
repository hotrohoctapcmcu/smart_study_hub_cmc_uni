"use strict";

/**
 * fetch.js — Ham lay tung nhom du lieu IU TRUC TIEP tu portal.
 *
 * NHIEM VU: moi ham truy van portal IU va tra ve du lieu MOI NHAT cua nhom do
 * trong RAM (object/array da map theo schema). KHONG doc cache/JSON cu/database,
 * KHONG ghi file. Endpoint/payload/param/map giu nguyen tu API cu.
 *
 * CACH DUNG (trong Electron, sau loginIU + laySession):
 *   const iu = require("../IU_VT"); // hoac require("./CRWEB/IU_VT")
 *   const tinTuc = await iu.layTinTuc(session, jar.cookie);
 *   const bangDiem = await iu.layBangDiem(session, cookie, { chuongTrinhId });
 *   const all = await iu.layTatCaIU(session, cookie, { ngayBatDau, ngayKetThuc });
 *   console.log(tinTuc, bangDiem, all.data);
 */

const { goiIU, layData } = require("./client");
const { schemaRong } = require("./schema");
const { collectExamSchedule } = require("../exam-calendar");
const {
    mapTinTuc,
    mapThongTinCaNhan,
    mapBangDiem,
    mapHocPhanNo,
    mapKetQuaDangKy,
    mapVanBang,
    mapDiemRenLuyen,
    mapChuongTrinhHoc,
    mapPhucKhao,
    mapLichHoc,
    mapLichThi,
} = require("./maps");

// Goi 1 endpoint, nem loi neu portal tra loi (de ham doc lap bao loi ro rang).
// Ban tong hop dung ban mem goiMem() rieng de gom thatBai thay vi nem.
async function goiThat(session, cookie, ten, patch, label) {
    const r = await goiIU(session, cookie, ten, patch);
    if (!r || r.ok === false || r.data == null) {
        const lyDo = !r ? "khong co response" : (`HTTP ${r.status} ${r.message || ""}`.trim());
        throw Object.assign(new Error(`${label || ten} that bai (${lyDo})`), { statusCode: r?.status || 502 });
    }
    return layData(r);
}

// Lay ID chuong trinh hoc (portal bat buoc chon dropdown truoc khi goi
// KetQuaHocTap/TichLuy/RenLuyen — diemhoc.js). Tra ve "" neu khong co.
async function layChuongTrinhId(session, cookie, opts = {}) {
    if (opts.chuongTrinhId) return opts.chuongTrinhId;
    const cth = await goiThat(session, cookie, "LayThongTinChuongTrinhHoc", {}, "LayThongTinChuongTrinhHoc");
    if (Array.isArray(cth) && cth[0]) {
        return cth[0].DAOTAO_TOCHUCCHUONGTRINH_ID || cth[0].ID || cth[0].DAOTAO_CHUONGTRINH_ID || "";
    }
    return "";
}

// --- Tung nhom doc lap (moi ham tu goi portal, khong dung cache) ---

async function layTinTuc(session, cookie) {
    const tin = await goiThat(session, cookie, "LayDSTinTuc_BangTin_NguoiDung", {
        strTuKhoa: "", strTuNgay: "", strDenNgay: "", strChuyenMuc_Id: "",
        strChung_UngDung_Id: (session && session.appId) || "", dTinQuanTrong: -1,
        strDaoTao_CoCauToChuc_Id: "", dHieuLuc: 1, pageIndex: 1, pageSize: 30,
    }, "Tin tuc");
    return mapTinTuc(Array.isArray(tin) ? tin : []);
}

async function layKetQuaHocTapTho(session, cookie, opts = {}) {
    const chuongTrinhId = opts.chuongTrinhId || await layChuongTrinhId(session, cookie, opts);
    return goiThat(session, cookie, "KetQuaHocTapCaNhan",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {},
        "KetQuaHocTapCaNhan");
}

async function layBangDiem(session, cookie, opts = {}) {
    const kq = await layKetQuaHocTapTho(session, cookie, opts);
    return mapBangDiem(kq.rsDiemKetThucHocPhan, kq.rsDiemThanhPhan);
}

async function layHocPhanNo(session, cookie, opts = {}) {
    const kq = await layKetQuaHocTapTho(session, cookie, opts);
    return mapHocPhanNo(kq.rsHocPhanChuaHoanThanh);
}

async function layHoSoSinhVien(session, cookie, opts = {}) {
    const chuongTrinhId = opts.chuongTrinhId || await layChuongTrinhId(session, cookie, opts).catch(() => "");
    let kq = null;
    try {
        kq = await goiThat(session, cookie, "KetQuaHocTapCaNhan",
            chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {},
            "KetQuaHocTapCaNhan");
    } catch { kq = null; }
    let coBan = mapThongTinCaNhan(kq ? kq.rsThongTinNguoiHoc : null, null);
    // Ho so chi tiet (module SV_Custom, profile hoso.js getDetail_SinhVien).
    try {
        const ct = await goiThat(session, cookie, "LayThongTinChiTietHoSo", {}, "LayThongTinChiTietHoSo");
        const arr = Array.isArray(ct) ? ct : [];
        if (arr.length) coBan = mapThongTinCaNhan(kq ? kq.rsThongTinNguoiHoc : null, arr);
    } catch { /* giu ban co ban */ }
    // Tab thong tin du phong (can kq goc).
    if (kq) {
        try {
            const tab = await goiThat(session, cookie, "LayDSTabThongTinNguoiHoc",
                chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {},
                "LayDSTabThongTinNguoiHoc");
            if (tab) coBan = mapThongTinCaNhan(kq.rsThongTinNguoiHoc, Array.isArray(tab) ? tab : []);
        } catch { /* giu ban hien tai */ }
    }
    return coBan;
}

async function layKetQuaDangKy(session, cookie, opts = {}) {
    const hkDk = await goiThat(session, cookie, "LayDSThoiGianLichHoc", {}, "LayDSThoiGianLichHoc");
    const hkDkId = (hkDk && hkDk[0] && hkDk[0].ID) || opts.thoiGianId || "";
    if (!hkDkId) return [];
    const dk = await goiThat(session, cookie, "LayKetQuaDangKyHocCaNhan",
        { strDaoTao_ThoiGianDaoTao_Id: hkDkId }, "LayKetQuaDangKyHocCaNhan");
    if (dk && dk.rsKetQuaDangKy) return mapKetQuaDangKy(dk.rsKetQuaDangKy);
    return [];
}

async function layVanBang(session, cookie) {
    const vb = await goiThat(session, cookie, "LayDSTN_KetQua_CongNhan_VB", {}, "Van bang");
    return mapVanBang(Array.isArray(vb) ? vb : []);
}

async function layDiemRenLuyen(session, cookie, opts = {}) {
    const chuongTrinhId = opts.chuongTrinhId || await layChuongTrinhId(session, cookie, opts);
    const rl = await goiThat(session, cookie, "LayKQRenLuyenCaNhan",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {},
        "LayKQRenLuyenCaNhan");
    return mapDiemRenLuyen(rl);
}

async function layChuongTrinhHoc(session, cookie, opts = {}) {
    const cth = await goiThat(session, cookie, "LayThongTinChuongTrinhHoc", {}, "LayThongTinChuongTrinhHoc");
    const chuongTrinhId = opts.chuongTrinhId ||
        (Array.isArray(cth) && cth[0] &&
            (cth[0].DAOTAO_TOCHUCCHUONGTRINH_ID || cth[0].ID || cth[0].DAOTAO_CHUONGTRINH_ID)) || "";
    const tichLuy = await goiThat(session, cookie, "LayKetQuaTichLuyTheoKhoi",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {},
        "LayKetQuaTichLuyTheoKhoi");
    return mapChuongTrinhHoc(Array.isArray(cth) ? cth : [], tichLuy ? tichLuy.rsChiTiet : []);
}

async function layLichHoc(session, cookie, opts = {}) {
    if (!opts.ngayBatDau || !opts.ngayKetThuc) {
        throw new Error("layLichHoc can { ngayBatDau, ngayKetThuc } (VD 05/10/2026).");
    }
    const lh = await goiThat(session, cookie, "LayDSLichCaNhan", {
        strNgayBatDau: opts.ngayBatDau, strNgayKetThuc: opts.ngayKetThuc,
    }, "LayDSLichCaNhan");
    return mapLichHoc(Array.isArray(lh) ? lh : []);
}

async function layLichThi(session, cookie, opts = {}) {
    const result = await collectExamSchedule(
        (endpoint, patch) => goiThat(session, cookie, endpoint, patch), mapLichThi, opts
    );
    return result.exams;
}

async function layPhucKhao(session, cookie, opts = {}) {
    let hkId = opts.thoiGianId || "";
    try {
        const tgPk = await goiThat(session, cookie, "LayThoiGian", {}, "LayThoiGian");
        if (tgPk && tgPk[0] && tgPk[0].ID) hkId = tgPk[0].ID;
    } catch { /* fallback duoi */ }
    if (!hkId) {
        try {
            const hkThi = await goiThat(session, cookie, "LayDSThoiGianLichThi", {}, "LayDSThoiGianLichThi");
            if (hkThi && hkThi[0] && hkThi[0].ID) hkId = hkThi[0].ID;
        } catch { /* de trong */ }
    }
    const pk = await goiThat(session, cookie, "LayDSThiPhucKhaoCaNhan",
        hkId ? { strDaoTao_ThoiGianDaoTao_Id: hkId } : {},
        "LayDSThiPhucKhaoCaNhan");
    if (pk) return mapPhucKhao(Array.isArray(pk) ? pk : (pk.rsDanhSach || []));
    return [];
}

// --- Ham tong hop (goi truc tiep tung endpoint, KHONG luu DB) ---

/**
 * Lay tat ca du lieu IU theo schema { IU: {...} }, tra truc tiep trong RAM.
 * @param {object} session — tu laySession(win) (can userId/chucNangId/tokenJWT/appId).
 * @param {string} cookie — jar.cookie tu loginIU().
 * @param {object} [opts] — { thoiGianId, chuongTrinhId, ngayBatDau, ngayKetThuc, log }
 * @returns {Promise<{ data: { IU: {...} }, thatBai: string[] }>}
 */
async function layTatCaIU(session, cookie, opts = {}) {
    const log = opts.log || (() => {});
    const out = schemaRong();
    const thatBai = [];

    const goi = async (ten, patch, label) => {
        try {
            const r = await goiIU(session, cookie, ten, patch);
            if (!r || r.ok === false || r.data == null) {
                const lyDo = (!r ? "khong co response" :
                    (`HTTP ${r.status} ${r.message || ""}`.trim()));
                thatBai.push(`${ten}: ${lyDo}`);
                log(`[API] TRANG ${label || ten} (${lyDo})`);
                return null;
            }
            log(`[API] OK ${label || ten}`);
            return layData(r);
        } catch (e) {
            thatBai.push(`${ten}: ${(e && e.message) || e}`);
            log(`[API] LOI ${ten}: ${(e && e.message) || e}`);
            return null;
        }
    };

    // 0. Chuong trinh hoc TRUOC TIEN — portal (diemhoc.js) bat buoc chon
    // dropSearch_ChuongTrinh roi moi goi KetQuaHocTap/TichLuy/RenLuyen.
    const cth = await goi("LayThongTinChuongTrinhHoc", {});
    const chuongTrinhId = opts.chuongTrinhId ||
        (Array.isArray(cth) && cth[0] &&
            (cth[0].DAOTAO_TOCHUCCHUONGTRINH_ID || cth[0].ID || cth[0].DAOTAO_CHUONGTRINH_ID)) || "";
    if (chuongTrinhId) log(`[API] chuong trinh: ${chuongTrinhId}`);

    // 1. Tin tuc.
    const tin = await goi("LayDSTinTuc_BangTin_NguoiDung", {
        strTuKhoa: "", strTuNgay: "", strDenNgay: "", strChuyenMuc_Id: "",
        strChung_UngDung_Id: (session && session.appId) || "", dTinQuanTrong: -1,
        strDaoTao_CoCauToChuc_Id: "", dHieuLuc: 1, pageIndex: 1, pageSize: 30,
    });
    if (tin) out.IU.tin_tuc = mapTinTuc(Array.isArray(tin) ? tin : []);

    // 2. Ket qua hoc tap ca nhan (ho so + bang diem + no).
    const kq = await goi("KetQuaHocTapCaNhan",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {});
    if (kq) {
        out.IU.ho_so_sinh_vien.thong_tin_ca_nhan =
            mapThongTinCaNhan(kq.rsThongTinNguoiHoc, null);
        out.IU.goc_hoc_tap.tra_cuu_diem.bang_diem =
            mapBangDiem(kq.rsDiemKetThucHocPhan, kq.rsDiemThanhPhan);
        out.IU.goc_hoc_tap.tra_cuu_diem.hoc_phan_no =
            mapHocPhanNo(kq.rsHocPhanChuaHoanThanh);
    }

    // 3. Ket qua dang ky hoc (dropdown hoc ky truoc, chi tiet sau).
    const hkDk = await goi("LayDSThoiGianLichHoc", {});
    const hkDkId = (hkDk && hkDk[0] && hkDk[0].ID) || opts.thoiGianId || "";
    if (hkDkId) {
        const dk = await goi("LayKetQuaDangKyHocCaNhan",
            { strDaoTao_ThoiGianDaoTao_Id: hkDkId });
        if (dk && dk.rsKetQuaDangKy) {
            out.IU.goc_hoc_tap.tra_cuu_diem.ket_qua_dang_ky =
                mapKetQuaDangKy(dk.rsKetQuaDangKy);
        }
    }

    // 4. Van bang / chung chi.
    const vb = await goi("LayDSTN_KetQua_CongNhan_VB", {});
    if (vb) {
        out.IU.goc_hoc_tap.tra_cuu_diem.van_bang_chung_chi =
            mapVanBang(Array.isArray(vb) ? vb : []);
    }

    // 5. Diem ren luyen.
    const rl = await goi("LayKQRenLuyenCaNhan",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {});
    if (rl) out.IU.goc_hoc_tap.diem_ren_luyen = mapDiemRenLuyen(rl);

    // 6. Chuong trinh hoc tap (+ tich luy theo khoi du phong).
    const tichLuy = await goi("LayKetQuaTichLuyTheoKhoi",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {});
    out.IU.goc_hoc_tap.chuong_trinh_hoc_tap = mapChuongTrinhHoc(
        Array.isArray(cth) ? cth : [],
        tichLuy ? tichLuy.rsChiTiet : []);

    // 7. Ho so chi tiet (chinh + tab du phong).
    const ctHoSo = await goi("LayThongTinChiTietHoSo", {});
    if (ctHoSo) {
        const arr = Array.isArray(ctHoSo) ? ctHoSo : [];
        if (arr.length) {
            out.IU.ho_so_sinh_vien.thong_tin_ca_nhan =
                mapThongTinCaNhan(kq ? kq.rsThongTinNguoiHoc : null, arr);
        }
    }
    const tab = await goi("LayDSTabThongTinNguoiHoc",
        chuongTrinhId ? { strDaoTao_ChuongTrinh_Id: chuongTrinhId } : {});
    if (tab && kq) {
        const arr = Array.isArray(tab) ? tab : [];
        out.IU.ho_so_sinh_vien.thong_tin_ca_nhan =
            mapThongTinCaNhan(kq.rsThongTinNguoiHoc, arr);
    }

    // 8. Lich hoc ca nhan theo tuan.
    if (opts.ngayBatDau && opts.ngayKetThuc) {
        const lh = await goi("LayDSLichCaNhan", {
            strNgayBatDau: opts.ngayBatDau, strNgayKetThuc: opts.ngayKetThuc,
        });
        if (lh) out.IU.lich_hoc.chi_tiet_thoi_khoa_bieu = mapLichHoc(Array.isArray(lh) ? lh : []);
    }

    // 9. Lịch thi: từ hôm nay đến tối đa 70 ngày sau, độc lập khoảng TKB.
    try {
        const result = await collectExamSchedule(
            (endpoint, patch) => goiThat(session, cookie, endpoint, patch), mapLichThi, opts
        );
        out.IU.lich_thi = { chi_tiet_lich_thi: result.exams, fetched: true, range: result.range };
        log('[API] Lịch thi: ' + result.exams.length + ' kỳ thi trong ' + result.range.days + ' ngày tới');
    } catch (error) {
        out.IU.lich_thi.fetched = false;
        thatBai.push('Lịch thi: ' + error.message);
    }

    // 10. Phuc khao (LayThoiGian truoc roi LayDSThiPhucKhaoCaNhan).
    const tgPk = await goi("LayThoiGian", {});
    let hkPkId = (tgPk && tgPk[0] && tgPk[0].ID) || opts.thoiGianId || "";
    if (!hkPkId) {
        const terms = await goi("LayDSThoiGianLichThi", {});
        hkPkId = (terms && terms[0] && terms[0].ID) || "";
    }
    const pk = await goi("LayDSThiPhucKhaoCaNhan",
        hkPkId ? { strDaoTao_ThoiGianDaoTao_Id: hkPkId } : {});
    if (pk) {
        out.IU.goc_hoc_tap.dang_ky_xin_phuc_khao =
            mapPhucKhao(Array.isArray(pk) ? pk : (pk.rsDanhSach || []));
    }

    // KHONG luu DB — tra truc tiep object + danh sach loi.
    log(`[API] Hoan tat (loi: ${thatBai.length})`);
    return { data: out, thatBai };
}

module.exports = {
    layChuongTrinhId,
    layTinTuc,
    layKetQuaHocTapTho,
    layBangDiem,
    layHocPhanNo,
    layHoSoSinhVien,
    layKetQuaDangKy,
    layVanBang,
    layDiemRenLuyen,
    layChuongTrinhHoc,
    layLichHoc,
    layLichThi,
    layPhucKhao,
    layTatCaIU,
};
