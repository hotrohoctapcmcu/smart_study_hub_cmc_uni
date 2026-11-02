"use strict";

/**
 * electron/bridges/iu.js
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
 * Đăng ký: require("./bridges/iu") trong electron/main.js SAU khi
 * require("../index") (khởi động API và nạp cấu hình). Không làm gì khi chạy bằng
 * `node` (không có Electron): các handler đơn giản không được đăng ký.
 * ===================================================================================
 */

const API_BASE = process.env.API_BASE || "http://localhost:3001";
let connectIuHandler = null;

function connectIU(options = {}) {
    if (!connectIuHandler) throw new Error('Cầu nối IU chưa sẵn sàng.');
    return connectIuHandler(options);
}

function getElectron() {
    try {
        // eslint-disable-next-line global-require
        const e = require("electron");
        if (e && typeof e === "object" && e.ipcMain && e.BrowserWindow) return e;
    } catch { /* không phải Electron main */ }
    return null;
}

async function postJson(path, body, signal) {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        ...(signal ? { signal } : {}),
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
    const { loginIU, logoutIU, getIuWindow } = require("../../CRWEB/modules/IU/login");
    // eslint-disable-next-line global-require
    const { readIuCookies } = require("../../CRWEB/modules/IU/login/cookies");
    // eslint-disable-next-line global-require
    const { laySession } = require("../../CRWEB/modules/IU/payload");
    const { openLoginWindow, loadAndWait, waitForPortalAuth } = require('../../CRWEB/modules/IU/login/window');
    const { IU_URL } = require('../../CRWEB/modules/IU/login/constants');
    let restoring = null;

    // Rehydrate RAM API session after app restart using only the already saved
    // Electron partition. Authentication requiring user input stays explicit.
    ipcMain.handle('iu:restore', async () => {
        if (restoring) return restoring;
        restoring = (async () => {
            const current = await getJson('/sync/iu/status');
            if (current?.connected) return { ok: true, connected: true, restored: false };
            const existing = getIuWindow();
            if (existing?.isVisible()) return { ok: true, connected: false, reason: 'login_in_progress' };
            const previous = await readIuCookies();
            if (!previous.count) return { ok: true, connected: false, reason: 'session_required' };
            const win = existing || openLoginWindow(null, { hidden: true });
            try {
                await loadAndWait(win, IU_URL, 20000);
                if (!await waitForPortalAuth(win, 5000)) return { ok: true, connected: false, reason: 'session_required' };
                const session = await laySession(win);
                const jar = await readIuCookies();
                if (!jar.count) return { ok: true, connected: false, reason: 'session_required' };
                await postJson('/sync/iu/session', { session, cookie: jar.cookie });
                return { ok: true, connected: true, restored: true };
            } finally {
                // A background restoration window must not keep the app alive
                // after its main window closes. Explicit login windows are owned
                // by the existing login flow.
                if (!existing && !win.isDestroyed() && !win.isVisible()) win.destroy();
            }
        })();
        try { return await restoring; }
        finally { restoring = null; }
    });

    // Mở cửa sổ SSO IU, login xong lưu phiên lên API rồi đóng cửa sổ.
    connectIuHandler = async (opts = {}) => {
        const requestedTimeout = Number(opts.timeoutMs);
        const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
            ? Math.min(requestedTimeout, 180000) : 180000;
        const controller = new AbortController();
        const cancelledError = code => Object.assign(new Error(code === 'LOGIN_TIMEOUT'
            ? 'Hết thời gian chờ kết nối IU.' : 'Đã hủy kết nối IU.'), { code });
        let timer, onAbort;
        const stopped = new Promise((_, reject) => {
            const stop = code => {
                // Settle before aborting native tasks so the useful reason wins.
                reject(cancelledError(code));
                controller.abort();
                try {
                    const win = getIuWindow();
                    if (win && !win.isDestroyed()) win.destroy();
                } catch { /* window may already have closed */ }
            };
            onAbort = () => stop('LOGIN_CANCELLED');
            opts.signal?.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(() => stop('LOGIN_TIMEOUT'), timeoutMs);
            if (opts.signal?.aborted) onAbort();
        });
        const checkCancelled = () => {
            if (controller.signal.aborted) throw cancelledError('LOGIN_CANCELLED');
        };
        const connect = async () => {
            checkCancelled();
            if (restoring) { try { await restoring; } catch { /* continue with explicit sign-in */ } }
            checkCancelled();
            // keepOpen:false — xong là đóng cửa sổ IU, phiên giữ trong partition.
            const jar = await loginIU({ timeoutMs, signal: controller.signal, keepOpen: false });
            checkCancelled();
            if (!jar || jar.count === 0) {
                throw new Error("Đăng nhập thành công nhưng không lấy được cookie IU.");
            }
            const win = getIuWindow();
            const session = win ? await laySession(win) : null;
            checkCancelled();
            if (!session) {
                throw new Error("Mất cửa sổ IU sau khi login, không đọc được phiên.");
            }
            await postJson("/sync/iu/session", { session, cookie: jar.cookie }, controller.signal);
            checkCancelled();
            return { ok: true, cookieCount: jar.count, hasSession: true };
        };
        try { return await Promise.race([connect(), stopped]); }
        finally {
            clearTimeout(timer);
            opts.signal?.removeEventListener('abort', onAbort);
        }
    };
    ipcMain.handle("iu:login", (_event, opts = {}) => connectIU(opts));

    // Kéo dữ liệu IU bằng phiên đã lưu (server làm, bridge chỉ chuyển tiếp).
    ipcMain.handle("iu:pull", async (_event, opts = {}) => {
        const json = await postJson("/sync/iu/pull", {
            ngayBatDau: opts.ngayBatDau,
            ngayKetThuc: opts.ngayKetThuc,
            soNgayLichThi: opts.soNgayLichThi,
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

module.exports = { registerIuBridge, connectIU };
