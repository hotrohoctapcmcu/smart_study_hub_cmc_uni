"use strict";

/**
 * electron/iu-bridge.js
 * ===================================================================================
 * CẦU NỐI ĐỒNG BỘ IU TRONG ELECTRON MAIN PROCESS
 * ===================================================================================
 * Luồng tự động (không copy cookie tay):
 *   1. iu:login  — mở cửa sổ SSO IU riêng (partition persist:cmc-portal, giữ
 *      phiên như IU vẫn làm) bằng loginIU({ keepOpen:false }). Login xong
 *      đọc cookie (readIuCookies) + laySession(win) từ edu.system, POST thẳng
 *      /api/v1/sync/iu/session về API. Đóng cửa sổ IU sau khi xong.
 *   2. iu:pull   — gọi POST /api/v1/sync/iu/pull (server tự dùng cookie đã lưu
 *      kéo IU + lưu DB). Bridge không chạm vào dữ liệu, chỉ chuyển tiếp
 *      kết quả về renderer.
 *   3. iu:status — GET /api/v1/sync/iu/status (không lộ cookie).
 *   4. iu:logout — DELETE /api/v1/sync/iu/session + logoutIU() xoá partition.
 *
 * Cookie cổng IU chỉ tồn tại trong main process và API server, KHÔNG BAO GIỜ
 * đi qua renderer (FE sandbox). Renderer chỉ nhận { ok, ... } gọn nhẹ.
 *
 * Đăng ký: require("./electron/iu-bridge") trong electron-main.js SAU khi
 * require("./index") (để API server đã listen). Không làm gì khi chạy bằng
 * `node` (không có Electron): các handler đơn giản không được đăng ký.
 * ===================================================================================
 */

const API_BASE = process.env.API_BASE || "http://localhost:3001";

function getElectron() {
    try {
        // eslint-disable-next-line global-require
        const e = require("electron");
        if (e && typeof e === "object" && e.ipcMain && e.BrowserWindow) return e;
    } catch { /* không phải Electron main */ }
    return null;
}

async function postJson(path, body) {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
    });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) {
        const msg = (json && (json.message || json.error)) || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}

async function getJson(path) {
    const res = await fetch(`${API_BASE}/api/v1${path}`);
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) {
        const msg = (json && (json.message || json.error)) || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}

async function deleteJson(path) {
    const res = await fetch(`${API_BASE}/api/v1${path}`, { method: "DELETE" });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) {
        const msg = (json && (json.message || json.error)) || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}

function registerIuBridge() {
    const electron = getElectron();
    if (!electron) return false; // chạy node thường: không đăng ký

    const { ipcMain } = electron;
    // eslint-disable-next-line global-require
    const { loginIU, logoutIU, getIuWindow } = require("../CRWEB/IU/login");
    // eslint-disable-next-line global-require
    const { readIuCookies } = require("../CRWEB/IU/login/cookies");
    // eslint-disable-next-line global-require
    const { laySession } = require("../CRWEB/IU/payload");

    // Mở cửa sổ SSO IU, login xong lưu phiên lên API rồi đóng cửa sổ.
    ipcMain.handle("iu:login", async (_event, opts = {}) => {
        const timeoutMs = Number(opts.timeoutMs) || 180000;
        // keepOpen:false — xong là đóng cửa sổ IU, phiên giữ trong partition.
        const jar = await loginIU({ timeoutMs, keepOpen: false });
        if (!jar || jar.count === 0) {
            throw new Error("Đăng nhập thành công nhưng không lấy được cookie IU.");
        }
        const win = getIuWindow();
        const session = win ? await laySession(win) : null;
        if (!session) {
            throw new Error("Mất cửa sổ IU sau khi login, không đọc được phiên.");
        }
        await postJson("/sync/iu/session", { session, cookie: jar.cookie });
        return { ok: true, cookieCount: jar.count, hasSession: true };
    });

    // Kéo dữ liệu IU bằng phiên đã lưu (server làm, bridge chỉ chuyển tiếp).
    ipcMain.handle("iu:pull", async (_event, opts = {}) => {
        const json = await postJson("/sync/iu/pull", {
            ngayBatDau: opts.ngayBatDau,
            ngayKetThuc: opts.ngayKetThuc,
            luuDb: opts.luuDb !== false,
        });
        const saved = (json && json.savedDb) || {};
        return {
            ok: true,
            message: (json && json.message) || "",
            timetableCount: saved.timetableCount || 0,
            examsCount: saved.examsCount || 0,
            gradesCount: saved.gradesCount || 0,
            thatBai: json.thatBai || [],
        };
    });

    ipcMain.handle("iu:status", async () => {
        const json = await getJson("/sync/iu/status");
        return { ok: true, connected: !!(json && json.connected), status: json };
    });

    ipcMain.handle("iu:logout", async () => {
        try { await deleteJson("/sync/iu/session"); } catch { /* đã xoá hoặc chưa có */ }
        try { await logoutIU(); } catch { /* ignore */ }
        return { ok: true };
    });

    return true;
}

module.exports = { registerIuBridge };
