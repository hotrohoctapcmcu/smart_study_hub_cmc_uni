"use strict";

/**
 * index.js — CUM LOGIN: tong ket va xuat ham dang nhap IU.
 * Day la file DUY NHAT noi khac dung de goi dang nhap:
 *   const { loginIU, logoutIU, getIuWindow } = require("../login");
 *
 * NHIEM VU CUA CUM: giu dung 1 viec — dang nhap portal IU bang SSO Microsoft
 * trong Electron, tra ve cookie phien. Ma hoa/giai ma nam o ../crypto,
 * dung payload nam o ../payload, bat request nam o ../capture.
 *
 * CAU TRUC FILE (moi file 1 nhiem vu):
 *   constants.js  Hang so: IU_URL, MS_LOGIN_URL, CMC_PARTITION.
 *   pagescript.js 2 doan script chay TRONG trang web (bam nut SSO, kiem tra
 *                 da login chua). Viet ES5 vi day vao executeJavaScript.
 *   window.js     Mo/tai dung 1 cua so BrowserWindow, doi trang tai xong,
 *                 kiem tra auth state, huy cua so.
 *   cookies.js    Doc cookie phien tu partition persist -> { map, cookie,
 *                 count }; xoa storage khi logout.
 *   flow.js       Dieu phoi luong SSO: loginIU() / logoutIU().
 *   index.js      File nay — tong ket + xuat ham cuoi cung.
 *
 * NGUON DU LIEU (chi tiet trong comment dau moi file):
 *   - Luong SSO Microsoft + mo cua so + doc cookie trich tu luan sync cua ung
 *     dung thoiGianBieu: src/main/sync/browserLogin.js va src/main/sync/index.js.
 *   - Dia chi portal, nut "Sign in using Microsoft", man hinh Logout: doi chieu
 *     voi source that cua portal trong portalSrc/loi/Index.aspx va
 *     portalSrc/loi/pagination.js (ham AFG).
 *
 * CACH DUNG DAY DU (Electron main process):
 *   const { app } = require("electron");
 *   const { loginIU, logoutIU, getIuWindow } = require("../login");
 *
 *   app.whenReady().then(async () => {
 *     // 1. Dang nhap (phien cu con -> im lang; het -> cua so HIEN cho chon TK)
 *     const jar = await loginIU({ keepOpen: true, timeoutMs: 300000 });
 *     // jar = { map, cookie, count, url }
 *     //   map   : { TEN_COOKIE: GIA_TRI }
 *     //   cookie: "a=b; c=d" — gan thang vao header fetch
 *     //   count : so cookie (0 = chua login duoc)
 *     //   url   : URL cua so hien tai
 *
 *     // 2. Goi API IU bang cookie (payload + ma hoa xem ../payload, ../crypto)
 *     const res = await fetch("https://iu.cmcu.edu.vn/...",
 *       { headers: { Cookie: jar.cookie } });
 *
 *     // 3. Lay cua so (de laySession hoac bat request — xem ../payload, ../capture)
 *     const win = getIuWindow();
 *
 *     // 4. Dang xuat: dong cua so + xoa sach phien (lan sau phai login lai)
 *     await logoutIU();
 *   });
 *
 * MA LOI (field .code cua Error):
 *   LOGIN_NO_ELECTRON — goi ngoai Electron main process.
 *   LOGIN_CLOSED      — nguoi dung dong cua so giua chung.
 *   LOGIN_TIMEOUT     — het timeoutMs ma chua dang nhap xong (cua so van mo
 *                       de dang nhap tiep, goi lai loginIU() la noi phien).
 */

const { loginIU, logoutIU, getIuWindow } = require("./flow");
const { IU_URL, MS_LOGIN_URL, CMC_PARTITION } = require("./constants");

module.exports = { loginIU, logoutIU, getIuWindow, IU_URL, MS_LOGIN_URL, CMC_PARTITION };
