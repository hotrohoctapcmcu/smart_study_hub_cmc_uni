"use strict";

/**
 * CRWEB/IU/index.js — DIEM TRUY CAP DUY NHAT cua toan bo chuc nang IU.
 * Ben ngoai chi can:
 *   const iu = require("./CRWEB/IU");
 *
 * Gom 5 cum, moi cum 1 nhiem vu:
 *   login/    Dang nhap portal IU bang SSO Microsoft (Electron), tra cookie.
 *   payload/  Lay ID phien + dung object payload request (chua ma hoa).
 *   crypto/   Ma hoa request (AE) va giai ma response (AD) cua portal.
 *   capture/  Bat response API tu cua so da dang nhap (Chrome DevTools Protocol).
 *   data/     Goi portal IU TRUC TIEP + map ve schema { IU: {...} } (khong database).
 *
 * Moi ham data/* truy van portal va tra du lieu MOI NHAT trong RAM
 * (object/array) — khong cache, khong JSON cu, khong database.
 * Chi luu file khi test chu dong ghi (VD fs.writeFileSync trong test).
 */

const login = require("./login");
const payload = require("./payload");
const crypto = require("./crypto");
const capture = require("./capture");
const data = require("./data");

module.exports = {
    // login/ — dang nhap SSO, cookie, cua so
    loginIU: login.loginIU,
    logoutIU: login.logoutIU,
    getIuWindow: login.getIuWindow,

    // payload/ — session, dung payload, endpoint, URL
    laySession: payload.laySession,
    buildPayload: payload.buildPayload,
    setPayload: payload.setPayload,
    traEndpoint: payload.traEndpoint,
    lietKeEndpoint: payload.lietKeEndpoint,
    layUrl: payload.layUrl,

    // crypto/ — ma hoa / giai ma dung chuan portal
    ma_hoa: crypto.ma_hoa,
    giai_ma: crypto.giai_ma,
    giai_ma_request: crypto.giai_ma_request,
    APIS_KEYS: crypto.APIS_KEYS,
    IM_MAC_DINH: crypto.IM_MAC_DINH,

    // capture/ — bat response qua CDP tren cua so da login
    batRequestRoute: capture.batRequestRoute,

    // data/ — goi portal truc tiep + map (khong database)
    goiIU: data.goiIU,
    layData: data.layData,
    schemaRong: data.schemaRong,
    layChuongTrinhId: data.layChuongTrinhId,
    layTinTuc: data.layTinTuc,
    layKetQuaHocTapTho: data.layKetQuaHocTapTho,
    layBangDiem: data.layBangDiem,
    layHocPhanNo: data.layHocPhanNo,
    layHoSoSinhVien: data.layHoSoSinhVien,
    layKetQuaDangKy: data.layKetQuaDangKy,
    layVanBang: data.layVanBang,
    layDiemRenLuyen: data.layDiemRenLuyen,
    layChuongTrinhHoc: data.layChuongTrinhHoc,
    layLichHoc: data.layLichHoc,
    layLichThi: data.layLichThi,
    layPhucKhao: data.layPhucKhao,
    layTatCaIU: data.layTatCaIU,
    // map thuan tuy tung nhom (dung khi chi can map lai du lieu tho):
    mapTinTuc: data.mapTinTuc,
    mapThongTinCaNhan: data.mapThongTinCaNhan,
    mapBangDiem: data.mapBangDiem,
    mapHocPhanNo: data.mapHocPhanNo,
    mapKetQuaDangKy: data.mapKetQuaDangKy,
    mapVanBang: data.mapVanBang,
    mapDiemRenLuyen: data.mapDiemRenLuyen,
    mapChuongTrinhHoc: data.mapChuongTrinhHoc,
    mapPhucKhao: data.mapPhucKhao,
    mapLichHoc: data.mapLichHoc,
    mapLichThi: data.mapLichThi,

    // xuat nguyen cum neu can dung rieng
    login_module: login,
    payload_module: payload,
    crypto_module: crypto,
    capture_module: capture,
    data_module: data,
};
