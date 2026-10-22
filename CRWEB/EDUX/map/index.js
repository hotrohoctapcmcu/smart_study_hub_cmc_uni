"use strict";

/**
 * Chuan hoa du lieu EDUX thanh JSON theo cau truc ung dung (datamau.json).
 *
 * Cac ham o day thuan tuy: nhan du lieu da lay tu `data/` va tra ve cau truc
 * moi, khong tu goi API.
 */

/**
 * Cau truc rong dung chung cho toan bo du lieu EDUX.
 */
function schemaRong() {
  return {
    EDUX: {
      diem_so_cac_mon: { lop_hoc_phan: [] },
      cac_hoc_phan: [],
      phan_hoi: {
        thong_bao_giang_vien: [],
        phan_hoi_chat_ai: [],
        phan_hoi_tro_giang: [],
        bao_loi_cau_hoi: [],
      },
      thong_ke: {
        danh_sach_bai_da_hoc: [],
        tien_do_hoc_tap: [],
        diem_tong_ket: [],
      },
    },
  };
}

/**
 * Khoa on dinh cho tung dau diem, vd "dau_diem_1".
 */
function khoaDauDiem(item, index) {
  const order = item?.order_no ?? index + 1;
  return `dau_diem_${order}`;
}

/**
 * Chuan hoa mot lop hoc phan kem nhom va diem nhom.
 *
 * @param {object} group Ban ghi tu /groups.
 * @param {object} chiTiet Ban ghi tu /groups/{id} (co students, teachers).
 * @param {Array<object>} nhom Danh sach da map tu data/diem.js (mapDiemNhom).
 */
function mapLopHocPhan(group, chiTiet, nhom = []) {
  const hocSinh = Array.isArray(chiTiet?.students) ? chiTiet.students : [];
  const giangVien = Array.isArray(chiTiet?.teachers) ? chiTiet.teachers : [];

  return {
    group_id: group?.id ?? chiTiet?.id ?? null,
    ten_mon: group?.name ?? chiTiet?.name ?? null,
    ma_lop: group?.subject_class_id ?? chiTiet?.subject_class_id ?? null,
    hoc_ky: group?.academic_semester ?? chiTiet?.academic_semester ?? null,
    nam_hoc: group?.academic_year ?? chiTiet?.academic_year ?? null,
    giang_vien: giangVien.map((giaoVien) => ({
      id: giaoVien.id ?? null,
      ten: giaoVien.name ?? null,
      email: giaoVien.email ?? null,
    })),
    thanh_vien_trong_lop: hocSinh.map((sinhVien) => ({
      id: sinhVien.id ?? null,
      ten: sinhVien.name ?? null,
      email: sinhVien.email ?? null,
    })),
    nhom_du_an: nhom.map((team) => ({
      team_id: team.team_id,
      ten_nhom: team.ten_nhom,
      chu_de: team.chu_de,
      link: team.link,
      thanh_vien: team.thanh_vien.map((thanhVien) => ({
        user_id: thanhVien.user_id,
        ten: thanhVien.ten,
        email: thanhVien.email,
        la_nhom_truong: thanhVien.la_nhom_truong,
      })),
      // datamau.json de trong tung dau diem; o day dien diem that theo
      // user_id cua tung thanh vien.
      diem_so: team.dau_diem.reduce((ketQua, dauDiem, index) => {
        ketQua[khoaDauDiem(dauDiem, index)] = {
          ten: dauDiem.ten,
          loai: dauDiem.loai,
          diem_cua_thanh_vien: Object.fromEntries(
            team.thanh_vien.map((thanhVien) => {
              const dong = thanhVien.diem.find((item) => item.dau_diem_id === dauDiem.id);
              return [thanhVien.user_id, dong?.diem ?? null];
            }),
          ),
        };
        return ketQua;
      }, {}),
    })),
  };
}

/**
 * Chuan hoa mot hoc phan kem chuong, slide va bai tap AI.
 *
 * @param {object} subject Ban ghi tu /subjects/joined.
 * @param {Array<object>} models Danh sach chuong tu /subjects/{id}/models.
 * @param {Record<string, Array<object>>} slideTheoChuong Slide theo model id.
 * @param {Record<string, Array<object>>} [baiTapTheoChuong] Cau hoi theo model id.
 */
function mapHocPhan(subject, models = [], slideTheoChuong = {}, baiTapTheoChuong = {}) {
  return {
    subject_id: subject?.id ?? null,
    ten_mon: subject?.name ?? null,
    ma_mon: subject?.subject_code ?? null,
    bai_giang_AI: {
      slide: models.flatMap((model) => (slideTheoChuong[model.id] ?? []).map((slide) => ({
        model_id: model.id,
        chuong: model.title ?? model.name ?? null,
        document_id: slide.id ?? null,
        so_thu_tu: slide.document_number ?? null,
        tieu_de: slide.title ?? null,
        loai: slide.item_type ?? null,
        trang_thai: slide.status ?? null,
        so_cau_da_qua: slide.pass_questions_count ?? null,
      }))),
      so_chuong: models.length,
    },
    bai_tap_AI: models.flatMap((model) => (baiTapTheoChuong[model.id] ?? []).map((cauHoi) => ({
      model_id: model.id,
      chuong: model.title ?? model.name ?? null,
      ...cauHoi,
    }))),
    // EDUX khong cong bo endpoint han nop trong ma nguon hien co.
    han_nop: [],
  };
}

/**
 * Chuan hoa nhom phan hoi.
 *
 * @param {{thongBao?: Array, chatAI?: Array, troGiang?: Array, baoLoi?: Array}} nguon
 */
function mapPhanHoi(nguon = {}) {
  return {
    thong_bao_giang_vien: (nguon.thongBao ?? []).map((item) => ({
      hoc_phan: item.hoc_phan ?? "",
      tieu_de: item.tieu_de ?? "",
      noi_dung: item.noi_dung ?? "",
      nguoi_gui: item.nguoi_gui ?? "",
      thoi_gian: item.thoi_gian ?? "",
    })),
    phan_hoi_chat_ai: (nguon.chatAI ?? []).map((item) => ({
      hoc_phan: item.hoc_phan ?? "",
      cau_hoi: item.noi_dung ?? "",
      cau_tra_loi: item.phan_hoi ?? "",
      ly_do: item.ly_do ?? "",
      thoi_gian: item.thoi_gian ?? "",
    })),
    phan_hoi_tro_giang: (nguon.troGiang ?? []).map((item) => ({
      hoc_phan: item.hoc_phan ?? "",
      van_de: item.noi_dung ?? "",
      phan_hoi: item.phan_hoi ?? "",
      tro_giang: item.tro_giang ?? "",
      loai_van_de: item.loai_van_de ?? "",
      thoi_gian: item.thoi_gian ?? "",
    })),
    bao_loi_cau_hoi: (nguon.baoLoi ?? []).map((item) => ({
      hoc_phan: item.hoc_phan ?? "",
      cau_hoi: item.cau_hoi ?? "",
      noi_dung_loi: item.noi_dung_loi ?? "",
      trang_thai: item.trang_thai ?? "",
      thoi_gian: item.thoi_gian ?? "",
    })),
  };
}

/**
 * Chuan hoa bao cao thong ke tu data/thongKe.js.
 *
 * `diem_he_10`, `diem_he_4`, `diem_chu` de null vi EDUX chi tra
 * `highest_score` cua bai tap AI, khong tra diem tong ket hoc phan.
 */
function mapThongKe(baoCaos = []) {
  const danhSachBaiDaHoc = [];
  const tienDoHocTap = [];
  const diemTongKet = [];

  for (const hocPhan of baoCaos) {
    tienDoHocTap.push({
      hoc_phan: hocPhan.ten_hoc_phan ?? "",
      tong_so_bai: hocPhan.tien_do_hoc_tap.tong_so,
      da_hoan_thanh: hocPhan.tien_do_hoc_tap.da_hoc,
      phan_tram: hocPhan.tien_do_hoc_tap.phan_tram,
    });

    for (const bai of hocPhan.tat_ca_bai ?? []) {
      if (bai.trang_thai === "da_hoan_thanh") {
        danhSachBaiDaHoc.push({
          hoc_phan: hocPhan.ten_hoc_phan ?? "",
          chuong: bai.chuong ?? "",
          bai: bai.bai ?? "",
          trang_thai: bai.trang_thai,
        });
      }
      if (bai.diem_cao_nhat !== null && bai.diem_cao_nhat !== undefined) {
        diemTongKet.push({
          hoc_ky: null,
          hoc_phan: hocPhan.ten_hoc_phan ?? "",
          chuong: bai.bai ?? "",
          diem_he_10: null,
          diem_he_4: null,
          diem_chu: null,
          diem_cao_nhat_bai_tap: bai.diem_cao_nhat,
        });
      }
    }
  }

  return { danh_sach_bai_da_hoc: danhSachBaiDaHoc, tien_do_hoc_tap: tienDoHocTap, diem_tong_ket: diemTongKet };
}

/**
 * Ghep tat ca phan da chuan hoa thanh cau truc EDUX day du.
 *
 * @param {{lopHocPhan?: Array, hocPhan?: Array, phanHoi?: object, thongKe?: object}} nguon
 */
function mapEDUX(nguon = {}) {
  const schema = schemaRong();
  schema.EDUX.diem_so_cac_mon.lop_hoc_phan = nguon.lopHocPhan ?? [];
  schema.EDUX.cac_hoc_phan = nguon.hocPhan ?? [];
  schema.EDUX.phan_hoi = mapPhanHoi(nguon.phanHoi);
  schema.EDUX.thong_ke = nguon.thongKe ?? schema.EDUX.thong_ke;
  return schema;
}

module.exports = {
  schemaRong,
  mapLopHocPhan,
  mapHocPhan,
  mapPhanHoi,
  mapThongKe,
  mapEDUX,
};
