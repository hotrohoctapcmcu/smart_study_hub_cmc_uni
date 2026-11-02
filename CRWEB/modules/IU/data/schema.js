"use strict";

/**
 * schema.js — Khung object rong { IU: {...} } cua Smart Study Hub.
 *
 * NHIEM VU: giu 1 ham schemaRong() tra ve khung du lieu dung schema nguoi dung.
 * KHONG doc/ghi file, KHONG database — chi tao object trong RAM de ham tong hop
 * dien dan du lieu moi lay tu portal vao. (Chuyen tu database/schemaRong cu,
 * bo toan bo fs/path/DB_FILE/luuHoSo/layHoSo.)
 */

function schemaRong() {
    return {
        IU: {
            tin_tuc: [],
            ho_so_sinh_vien: {
                thong_tin_ca_nhan: {
                    ma_sinh_vien: "",
                    ho_ten: "",
                    ngay_sinh: "",
                    gioi_tinh: "",
                    email: "",
                    so_dien_thoai: "",
                    lop: "",
                    nganh: "",
                    khoa: "",
                },
            },
            goc_hoc_tap: {
                tra_cuu_diem: {
                    bang_diem: [],
                    hoc_phan_no: [],
                    ket_qua_dang_ky: [],
                    van_bang_chung_chi: [],
                },
                diem_ren_luyen: [],
                chuong_trinh_hoc_tap: [],
                dang_ky_xin_phuc_khao: [],
            },
            lich_hoc: { chi_tiet_thoi_khoa_bieu: [] },
            lich_thi: { chi_tiet_lich_thi: [] },
        },
    };
}

module.exports = { schemaRong };
