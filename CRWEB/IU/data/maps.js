"use strict";

/**
 * maps.js — Map field tho portal IU -> schema Smart Study Hub { IU: {...} }.
 *
 * NHIEM VU: cac ham map thuan tuy (khong goi mang, khong database).
 * Chuyen nguyen ven tu API/maps cu (bao toan endpoint/field/param).
 * NGUON FIELD: xem comment dau API/index.js cu.
 */

const s = (v) => (v == null ? "" : String(v));
const n = (v, dflt = 0) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : dflt;
};
const hhmm = (g, p) => {
    if (g == null || p == null) return "";
    const gg = String(g).padStart(2, "0");
    const pp = String(p).padStart(2, "0");
    return `${gg}:${pp}`;
};

function mapTinTuc(rows) {
    return (rows || []).map((e) => ({
        loai: s(e.CHUYENMUC_TEN || e.LOAI || ""),
        tieu_de: s(e.TIEUDE || ""),
        noi_dung: s(e.NOIDUNG || e.TOMTAT || ""),
        thoi_gian: s(e.NGAYTAO_DD_MM_YYYY || e.NGAYBATDAU || e.NGAYTAO || ""),
    }));
}

function mapThongTinCaNhan(rs, tab) {
    const r = (rs && rs[0]) || {};
    const t = (tab && tab[0]) || {};
    const hoTen = s(r.QLSV_NGUOIHOC_HODEM || t.HODEM || "") +
        (r.QLSV_NGUOIHOC_HODEM || t.HODEM ? " " : "") +
        s(r.QLSV_NGUOIHOC_TEN || t.TEN || "");
    return {
        ma_sinh_vien: s(r.QLSV_NGUOIHOC_MASO || t.MASO || ""),
        ho_ten: hoTen.trim(),
        ngay_sinh: s(r.QLSV_NGUOIHOC_NGAYSINH || t.QLSV_NGUOIHOC_NGAYSINH || ""),
        gioi_tinh: s(r.QLSV_NGUOIHOC_GIOITINH || t.GIOITINH || ""),
        email: s(r.EMAIL || t.EMAIL || r.QLSV_NGUOIHOC_EMAIL || ""),
        so_dien_thoai: s(r.DIENTHOAI || t.DIENTHOAI || r.QLSV_NGUOIHOC_DIENTHOAI || ""),
        lop: s(r.DAOTAO_LOPQUANLY_TEN || t.LOP || ""),
        nganh: s(r.NGANH || t.NGANH || ""),
        khoa: s(r.KHOA || t.KHOA || r.MANGANH || t.MANGANH || ""),
    };
}

function mapBangDiem(rsDiem, rsThanhPhan) {
    const tp = rsThanhPhan || [];
    return (rsDiem || []).map((e) => {
        const ct = tp.filter((x) =>
            String(x.DAOTAO_HOCPHAN_ID) === String(e.DAOTAO_HOCPHAN_ID) &&
            String(x.LANHOC) === String(e.LANHOC) &&
            String(x.LANTHI) === String(e.LANTHI));
        const lay = (kw) => {
            const f = ct.find((x) => new RegExp(kw, "i").test(s(x.DIEM_THANHPHANDIEM_TEN)));
            return f ? n(f.DIEM) : 0;
        };
        return {
            ma_mon: s(e.DAOTAO_HOCPHAN_MA || ""),
            ten_hoc_phan: s(e.DAOTAO_HOCPHAN_TEN || ""),
            so_tin_chi: n(e.DAOTAO_HOCPHAN_HOCTRINH),
            diem_he_10: n(e.DIEM),
            diem_he_4: n(e.DIEMQUYDOI),
            diem_chu: s(e.DIEMQUYDOI_TEN || ""),
            hoc_ky: s(e.HOCKY || e.HOC_KY || ""),
            nam_hoc: s(e.NAMHOC || e.NAM_HOC || ""),
            xep_loai: s(e.DANHGIA_TEN || ""),
            chi_tiet_diem: {
                chuyen_can: lay("chuy.n.c.n|chuyencan|cc$"),
                bai_tap: lay("b.i.t.p|baitap|bt$"),
                giua_ky: lay("gi.a.k|giuaky|gk$"),
                cuoi_ky: lay("cu.i.k|cuoiky|cu.i.thi|ck$|thi.k.t.th.c"),
            },
        };
    });
}

function mapHocPhanNo(rows) {
    return (rows || []).map((e) => ({
        ma_mon: s(e.DAOTAO_HOCPHAN_MA || ""),
        ten_mon: s(e.DAOTAO_HOCPHAN_TEN || ""),
        so_tin_chi: n(e.DAOTAO_HOCPHAN_HOCTRINH),
        hoc_ky: s(e.HOCKY || ""),
        nam_hoc: s(e.NAMHOC || e.THOIGIAN || ""),
    }));
}

function mapKetQuaDangKy(rows) {
    return (rows || []).map((e) => ({
        ma_mon: s(e.DANGKY_LOPHOCPHAN_MA || e.DAOTAO_HOCPHAN_MA || ""),
        ten_mon: s(e.DANGKY_LOPHOCPHAN_TEN || e.DAOTAO_HOCPHAN_TEN || ""),
        so_tin_chi: n(e.DAOTAO_HOCPHAN_HOCTRINH),
        trang_thai: s(e.TRANGTHAI_TEN || e.TRANGTHAI || e.KIEUHOC_TEN || "Đã đăng ký"),
    }));
}

function mapVanBang(rows) {
    return (rows || []).map((e) => ({
        ten_chung_chi: s(e.PHANLOAI_TEN || e.TEN || "Chứng chỉ quốc phòng an ninh"),
        trang_thai: s(e.XEPLOAI_TEN || e.TRANGTHAI_TEN || ""),
        ngay_cap: s(e.NGAYCAP || e.NGAY || ""),
    }));
}

function mapDiemRenLuyen(data) {
    const rows = (data && (data.rsKy || data.rsNam || data.rsToanKhoa)) || [];
    return rows.map((e) => ({
        hoc_ky: s(e.HOCKY || e.KY || ""),
        nam_hoc: s(e.NAMHOC || e.NAM || e.THOIGIAN_HIENTHI || ""),
        diem: n(e.DIEM),
        chi_tiet: {
            y_thuc_hoc_tap: n(e.DIEM_YTHUC || e.YTHUC),
            chap_hanh_noi_quy: n(e.DIEM_NOIQUY || e.NOIQUY),
            hoat_dong: n(e.DIEM_HOATDONG || e.HOATDONG),
            cong_dong: n(e.DIEM_CONGDONG || e.CONGDONG),
            khac: n(e.DIEM_KHAC || e.KHAC),
        },
    }));
}

function mapChuongTrinhHoc(rows, tichLuy) {
    const src = (rows && rows.length ? rows : tichLuy) || [];
    const theoKy = {};
    for (const e of src) {
        const key = `${s(e.NAMHOC || "")}|${s(e.HOCKY || "")}`;
        if (!theoKy[key]) {
            theoKy[key] = {
                hoc_ky: s(e.HOCKY || ""),
                nam_hoc: s(e.NAMHOC || ""),
                hoc_phan: [],
            };
        }
        theoKy[key].hoc_phan.push({
            ma_mon: s(e.DAOTAO_HOCPHAN_MA || ""),
            ten_mon: s(e.DAOTAO_HOCPHAN_TEN || ""),
            so_tin_chi: n(e.DAOTAO_HOCPHAN_HOCTRINH),
            loai_hoc_phan: s(e.TENKHOI || e.LOAIHOCPHAN_TEN || ""),
            trang_thai: s(e.DANHGIA_TEN || (e.KETQUA === 1 ? "Hoàn thành" : "")),
        });
    }
    return Object.values(theoKy);
}

function mapPhucKhao(rows) {
    return (rows || []).map((e) => ({
        hoc_ky: s(e.HOCKY || e.THOIGIAN || ""),
        nam_hoc: s(e.NAMHOC || e.THOIGIAN || ""),
        ma_mon: s(e.DAOTAO_HOCPHAN_MA || e.MAHOCPHAN || ""),
        ten_mon: s(e.DAOTAO_HOCPHAN_TEN || e.TENHOCPHAN || ""),
        ly_do: s(e.LYDODANGKY || e.LYDO || ""),
        ngay_dang_ky: s(e.NGAYDANGKYPHUCKHAO || e.NGAYDANGKY || ""),
        trang_thai: s(e.TINHTRANG_TEN || e.TRANGTHAI_TEN || (e.NGAYDANGKYPHUCKHAO ? "Đã đăng ký" : "Chưa đăng ký")),
    }));
}

function mapLichHoc(rows) {
    return (rows || []).map((e) => ({
        thu: s(e.THU || ""),
        ngay: s(e.NGAYHOC || ""),
        thoi_gian_bat_dau: hhmm(e.GIOBATDAU, e.PHUTBATDAU),
        thoi_gian_ket_thuc: hhmm(e.GIOKETTHUC, e.PHUTKETTHUC),
        ma_mon: s(e.DAOTAO_HOCPHAN_MA || ""),
        ten_mon: s(e.TENHOCPHAN || ""),
        phong: s(e.PHONGHOC_TEN || e.PHONGHOC_MA || ""),
        giang_vien: s(e.GIANGVIEN || ""),
        hinh_thuc: s(e.THUOCTINH_TEN || e.PHANLOAI || ""),
    }));
}

function mapLichThi(rows) {
    return (rows || []).map((e) => ({
        ma_mon: s(e.MAHOCPHAN || e.DAOTAO_HOCPHAN_MA || ""),
        ten_mon: s(e.TENHOCPHAN || e.DAOTAO_HOCPHAN_TEN || ""),
        ngay_thi: s(e.NGAYHOC || e.NGAYTHI || ""),
        gio_thi: hhmm(e.GIOBATDAU, e.PHUTBATDAU) +
            (e.GIOKETTHUC != null ? ` - ${hhmm(e.GIOKETTHUC, e.PHUTKETTHUC)}` : ""),
        phong_thi: s(e.PHONGHOC_TEN || e.PHONGTHI_TEN || e.PHONGHOC_MA || ""),
        hinh_thuc_thi: s(e.HINHTHUCTHI_TEN || e.HINHTHUC || ""),
    }));
}

module.exports = {
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
};
