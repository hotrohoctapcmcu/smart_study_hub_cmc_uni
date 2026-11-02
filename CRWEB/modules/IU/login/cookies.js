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
 *  - Doc 2 lan: theo url "https://cmcu.edu.vn" va theo IU_URL, gop lai khử
 *    trùng theo (name|domain|path) — phong khi cookie set theo host con.
 *
 * CACH DUNG:
 *   const { readIuCookies } = require("./cookies");
 *   const jar = await readIuCookies(); // { map, cookie, count }
 *   fetch(url, { headers: { Cookie: jar.cookie } });
 */

const { IU_URL, CMC_PARTITION } = require("./constants");
const { getElectron } = require("./window");

// Đọc toàn bộ cookie IU từ session persist -> { map, cookie, count }
async function readIuCookies() {
    const { session } = getElectron();
    const ses = session.fromPartition(CMC_PARTITION);
    let list = [];
    try {
        list = await ses.cookies.get({ url: "https://cmcu.edu.vn" });
    } catch {
        list = [];
    }
    // Bổ sung cookie của đúng host IU (phòng khi cookie set theo host con).
    try {
        const extra = await ses.cookies.get({ url: IU_URL });
        const seen = new Set(list.map((c) => c.name + "|" + c.domain + "|" + c.path));
        for (const c of extra) {
            if (!seen.has(c.name + "|" + c.domain + "|" + c.path)) list.push(c);
        }
    } catch {
        /* ignore */
    }
    const map = {};
    for (const c of list) map[c.name] = c.value;
    const cookie = Object.entries(map).map(([k, v]) => `${k}=${v}`).join("; ");
    return { map, cookie, count: Object.keys(map).length };
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
