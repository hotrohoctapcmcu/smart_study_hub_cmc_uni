"use strict";

/**
 * index.js — Cum MA HOA / GIAI MA (crypto).
 * Tong ket va xuat cac ham ma hoa request + giai ma response cua portal IU.
 *
 * NHIEM VU CUA CUM: giu dung 1 nhiem vu — chuyen doi giua text thuong va
 * chuoi ma hoa XOR-base64 cua portal. Khong login, khong dung payload,
 * khong goi mang.
 *
 * NGUON DU LIEU (chi tiet trong tung file):
 *  - crypto/keys.js: 4 key ("AzzSystem", "A", "AzzS", "31415926535").
 *    Nguon: ham AE/AD cuoi portalSrc/loi/assets_js_crypto-js.js,
 *      ham AFG trong portalSrc/loi/pagination.js (iM = "AzzSystem"),
 *      chuoi AXYZCLRVN() trong portalSrc/loi/Index.aspx.
 *  - crypto/encode.js: ham AE goc + cach portal goi trong makeRequest
 *    (portalSrc/loi/Core_systemroot.js): { A: AE(JSON, suffix) }.
 *  - crypto/decode.js: ham AD goc + cach portal giai response
 *    (AD(Data.B, iM)). Vi du that: test cu giai ra rsChiTiet 63 mon.
 *
 * CACH DUNG:
 *   const { ma_hoa, giai_ma, giai_ma_request, APIS_KEYS } = require("./crypto");
 *   // hoac: require("../crypto") neu goi tu folder khac trong IU/
 *
 *   // Ma hoa payload truoc khi POST (key = suffix trong action):
 *   const A = ma_hoa({ action: "SV_ThongTin_MH/CiQ1EDQgCS4iFSAxAiAPKSAv", ... });
 *   await fetch(url, { method: "POST", headers: { Cookie: jar.cookie },
 *     body: new URLSearchParams({ A }) });
 *
 *   // Giai response tra ve:
 *   const blocks = giai_ma(await res.text());
 *   const data = JSON.parse(blocks[0]);
 *
 *   // Giai nguoc field "A" de debug (can biet suffix endpoint):
 *   const obj = giai_ma_request(A, "SV_ThongTin_MH/CiQ1EDQgCS4iFSAxAiAPKSAv");
 */

const { APIS_KEYS, IM_MAC_DINH } = require("./keys");
const { ma_hoa } = require("./encode");
const { giai_ma_request, giai_ma } = require("./decode");

module.exports = { APIS_KEYS, IM_MAC_DINH, ma_hoa, giai_ma_request, giai_ma };
