"use strict";

/**
 * index.js — Cum DUNG PAYLOAD (payload).
 * Tong ket va xuat cac ham tra endpoint + lay session + dung payload.
 *
 * NHIEM VU:
 * Bien session va ten endpoint thanh object payload dang thuong,
 * chua ma hoa. Ma hoa thuoc crypto/, dang nhap thuoc login/.
 *
 * NGUON DU LIEU:
 * - endpoints.js va endpoint_map.txt:
 *   Danh sach endpoint trich tu cac tep JavaScript trong portalSrc/modules.
 * - session.js:
 *   Lay edu.system tu trang IU da dang nhap.
 * - build.js:
 *   Tao payload theo cau truc cua tung endpoint.
 * - payload.mau.json:
 *   Du lieu mau dung de doi chieu.
 *
 * CACH DUNG:
 *   const { getIuWindow } = require("../login");
 *   const {
 *       laySession,
 *       buildPayload,
 *       setPayload,
 *       layUrl
 *   } = require("../payload");
 *   const { ma_hoa } = require("../crypto");
 *
 *   const session = await laySession(getIuWindow());
 *   let p = buildPayload(session, "KetQuaHocTapCaNhan");
 *   p = setPayload(p, {
 *       strDaoTao_ChuongTrinh_Id: "ID_CT"
 *   });
 *
 *   const body = new URLSearchParams({
 *       A: ma_hoa(p)
 *   });
 *
 *   const res = await fetch(layUrl(p), {
 *       method: "POST",
 *       headers: {
 *           Cookie: jar.cookie,
 *           "Content-Type": "application/x-www-form-urlencoded"
 *       },
 *       body
 *   });
 */

const { traEndpoint, lietKeEndpoint } = require("./endpoints");
const { laySession } = require("./session");
const {
    buildPayload,
    setPayload,
    layUrl
} = require("./build");

module.exports = {
    traEndpoint,
    lietKeEndpoint,
    laySession,
    buildPayload,
    setPayload,
    layUrl
};