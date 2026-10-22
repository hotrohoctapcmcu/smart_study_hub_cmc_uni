"use strict";

/**
 * EDUX — module lay du lieu hoc tap tu cong EDUX (edux.cmcu.edu.vn).
 *
 * Cau truc:
 *   login/    dang nhap, cookie, phien
 *   request/  goi API va xu ly phan hoi
 *   data/     diem, hoc phan, bai tap, thong bao, thong ke
 *   map/      chuan hoa du lieu tho thanh JSON theo datamau.json
 *   utils/    ham tien ich dung chung
 */

const login = require("./login");
const request = require("./request");
const data = require("./data");
const map = require("./map");

/**
 * Lay toan bo du lieu EDUX va chuan hoa theo cau truc datamau.json.
 *
 * @param {{
 *   subjectId?: string,
 *   baiTap?: boolean,
 *   chatAI?: boolean,
 *   concurrency?: number,
 * }} [options]
 *   baiTap: goi /exam/start cho tung chuong (tao phien lam bai moi tren EDUX).
 *   chatAI: quet lich su phan hoi ChatAI (rat nhieu request).
 * @returns {Promise<{EDUX: object}>}
 */
async function layData(options = {}) {
  const { subjectId, baiTap = false, chatAI = false, concurrency = 8 } = options;
  const chung = { concurrency };

  const [subjects, groups] = await Promise.all([
    data.layHocPhan(chung),
    data.layLopHocPhan(chung),
  ]);

  // Lop hoc phan: chi tiet + nhom + diem nhom.
  const lopHocPhan = [];
  for (const group of groups) {
    const chiTiet = await data.layChiTietLopHocPhan(group.id, chung);
    const nhom = await data.layDiemNhom(group.id, chung);
    lopHocPhan.push(map.mapLopHocPhan(group, chiTiet, nhom));
  }

  // Hoc phan: chuong, slide, (tuy chon) bai tap AI.
  const hocPhan = [];
  for (const subject of subjects) {
    const models = await data.layChuongTrinhHoc(subject.id, chung);
    const slideTheoChuong = {};
    for (const model of models) {
      slideTheoChuong[model.id] = await data.laySlide(model.id, chung);
    }

    const baiTapTheoChuong = {};
    if (baiTap) {
      for (const model of models) {
        if (!model.exist_exam) continue;
        const ketQua = await data.layBaiTap(model.id, chung);
        baiTapTheoChuong[model.id] = ketQua.cau_hoi;
      }
    }

    hocPhan.push(map.mapHocPhan(subject, models, slideTheoChuong, baiTapTheoChuong));
  }

  // Phan hoi.
  const [thongBao, troGiang, baoLoi] = await Promise.all([
    data.layThongBaoGiangVien(chung),
    data.layPhanHoiTroGiang(chung),
    data.layBaoLoiCauHoi(chung),
  ]);
  const chatAIItems = chatAI ? await data.layPhanHoiChatAI(chung) : [];

  // Thong ke.
  const thongKe = await data.layThongKe({ ...chung, subjectId });

  return map.mapEDUX({
    lopHocPhan,
    hocPhan,
    phanHoi: { thongBao, chatAI: chatAIItems, troGiang, baoLoi },
    thongKe: map.mapThongKe(thongKe.hoc_phan),
  });
}

module.exports = {
  // login/ — dang nhap, cookie, phien
  loginEdux: login.loginEdux,
  logoutEdux: login.logoutEdux,
  layCookie: login.layCookie,
  docCookie: login.docCookie,
  luuCookie: login.luuCookie,
  COOKIE_FILE: login.COOKIE_FILE,

  // request/ — goi API EDUX
  goiEdux: request.goiEdux,
  thuLanLuot: request.thuLanLuot,
  API_BASE: login.API_BASE,

  // data/hocPhan.js
  layHocPhan: data.layHocPhan,
  layChuongTrinhHoc: data.layChuongTrinhHoc,
  layLopHocPhan: data.layLopHocPhan,
  layChiTietLopHocPhan: data.layChiTietLopHocPhan,
  layNhom: data.layNhom,
  laySlide: data.laySlide,

  // data/diem.js
  layDiemHocPhan: data.layDiemHocPhan,
  layDiemNhom: data.layDiemNhom,
  layBangDiem: data.layBangDiem,
  mapDiemNhom: data.mapDiemNhom,

  // data/baiTap.js
  layBaiTap: data.layBaiTap,
  mapExamData: data.mapExamData,

  // data/thongBao.js
  layThongBaoGiangVien: data.layThongBaoGiangVien,
  layPhanHoiTroGiang: data.layPhanHoiTroGiang,
  layBaoLoiCauHoi: data.layBaoLoiCauHoi,
  layPhanHoiChatAI: data.layPhanHoiChatAI,

  // data/thongKe.js
  layThongKe: data.layThongKe,
  parseTienDo: data.parseTienDo,

  // map/ — chuan hoa theo datamau.json
  schemaRong: map.schemaRong,
  mapLopHocPhan: map.mapLopHocPhan,
  mapHocPhan: map.mapHocPhan,
  mapPhanHoi: map.mapPhanHoi,
  mapThongKe: map.mapThongKe,
  mapEDUX: map.mapEDUX,

  // tong hop
  layData,

  // xuat nguyen cum khi can dung rieng
  login_module: login,
  request_module: request,
  data_module: data,
  map_module: map,
};
