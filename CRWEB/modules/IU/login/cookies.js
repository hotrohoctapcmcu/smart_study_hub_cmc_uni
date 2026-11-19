"use strict";

/**
 * cookies.js — Đọc cookie phiên IU từ partition Electron.
 *
 * NHIEM VU: duy nhat 1 viec — doc toan bo cookie cua portal tu session
 * persist va tra ve dang dung duoc cho fetch. Khong mo cua so, khong login.
 *
 * NGUON DU LIEU:
 *  - CMC_PARTITION, IU_URL: login/constants.js.
 *  - getElectron(): login/window.js (can Electron MAIN process).
 *  - Luong doc cookie trich tu
 *    thoiGianBieu/src/main/sync/browserLogin.js (extractCookieMap / readCookies).
 *  - Doc cookie theo URL cua ung dung sinh vien hoac cong ASPX cu.
 *
 * CACH DUNG:
 *   const { readIuCookies } = require("./cookies");
 *   const jar = await readIuCookies(); // { map, cookie, count }
 *   fetch(url, { headers: { Cookie: jar.cookie } });
 */

const { STUDENT_API_URL, LEGACY_IU_URL, CMC_PARTITION } = require("./constants");
const { getElectron } = require("./window");

// Đọc toàn bộ cookie IU từ session persist -> { map, cookie, count }
async function readIuCookies(portal = "sinhvien") {
    const { session } = getElectron();
    const ses = session.fromPartition(CMC_PARTITION);
    const url = portal === "legacy" ? LEGACY_IU_URL : STUDENT_API_URL;
    const list = await ses.cookies.get({ url }).catch(() => []);
    list.sort((a, b) => (b.path || "").length - (a.path || "").length);
    const map = Object.fromEntries(list.slice().reverse().map(({ name, value }) => [name, value]));
    const cookie = list.map(({ name, value }) => `${name}=${value}`).join("; ");
    return { map, cookie, count: list.length };
}

// Xoa sach storage cua partition (cookie, localStorage...) — dung khi logout.
async function clearSession() {
    try {
        const { session } = getElectron();
        const ses = session.fromPartition(CMC_PARTITION);
        await ses.clearStorageData();
        try { await ses.clearCache(); } catch { /* ignore */ }
    } catch { /* ignore */ }
}

module.exports = { readIuCookies, clearSession };
