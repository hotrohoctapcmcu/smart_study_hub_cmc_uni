"use strict";

/**
 * constants.js — Hang so dia chi + phien luu tru cua cong IU.
 *
 * NHIEM VU: giu 3 hang so dung chung cho ca cum login.
 *
 * NGUON DU LIEU:
 *  - IU_URL ("https://iu.cmcu.edu.vn/congthongtin/Index.aspx"): trang portal
 *    chinh, trich tu luan sync trong
 *    thoiGianBieu/src/main/sync/browserLogin.js + index.js (MS_LOGIN_URL,
 *    luong SSO Microsoft 1 lan).
 *  - MS_LOGIN_URL ("https://www.office.com/"): trang dang nhap Microsoft de
 *    nguoi dung chon tai khoan truong khi phien cu het han.
 *  - CMC_PARTITION ("persist:cmc-portal"): ten partition Electron giu phien
 *    dang nhap (cookie, localStorage). Dong cua so van GIU session cho lan sau.
 */

const IU_URL = "https://iu.cmcu.edu.vn/congthongtin/Index.aspx";
const MS_LOGIN_URL = "https://www.office.com/";
const CMC_PARTITION = "persist:cmc-portal";

module.exports = { IU_URL, MS_LOGIN_URL, CMC_PARTITION };
