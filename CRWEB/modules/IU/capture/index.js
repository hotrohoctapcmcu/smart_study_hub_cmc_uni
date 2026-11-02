"use strict";

/**
 * index.js — CUM BAT REQUEST (capture): tong ket va xuat ham bat API.
 * Noi khac dung:
 *   const { batRequestRoute } = require("../capture");
 *
 * NHIEM VU CUA CUM: giu dung 1 viec — bat cac response API cua portal IU
 * tren cua so Electron da dang nhap (Chrome DevTools Protocol), tu dong
 * giai ma Data.B va tra ve du lieu doc duoc. Khong dang nhap (login/),
 * khong dung payload (payload/), khong tu ma hoa (crypto/).
 *
 * CAU TRUC FILE:
 *   capture.js  batRequestRoute(win, routeUrl, opts) — attach CDP, dieu huong
 *               route, thu response JSON, giai ma, doi mang ranh, tra ket qua.
 *   index.js    File nay — tong ket + xuat ham.
 *
 * NGUON DU LIEU (chi tiet trong comment dau capture.js):
 *  - Ky thuat CDP trich tu thoiGianBieu/src/main/sync/browserLogin.js.
 *  - Giai ma dung ../crypto (ham AD goc cua portal, key "AzzSystem" — nguon
 *    portalSrc/loi/assets_js_crypto-js.js va pagination.js).
 *
 * CACH DUNG:
 *   const { loginIU, getIuWindow } = require("../login");
 *   const { batRequestRoute } = require("../capture");
 *
 *   await loginIU({ keepOpen: true });
 *   const { responses, attached } = await batRequestRoute(getIuWindow(),
 *     "https://iu.cmcu.edu.vn/congthongtin/Index.aspx#diemhoc",
 *     { waitMs: 20000, log: console.log });
 *   // responses: [{ url, mime, len, decoded: string[] }]
 *   //   decoded: mang chuoi JSON da giai (giai_ma cua ../crypto)
 *   // attached=false: khong attach duoc CDP (DevTools dang mo) -> responses rong.
 *
 * TEST MAU TRONG CUM:
 *   test-diemhoc.js — demo tron vong login -> bat #diemhoc -> tom tat diem.
 *   test-giaima.js  — vi du giai ma 1 payload B mau (chay node thuong duoc).
 */

const { batRequestRoute, SKIP_URL } = require("./capture");

module.exports = { batRequestRoute, SKIP_URL };
