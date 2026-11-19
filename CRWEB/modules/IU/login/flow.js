"use strict";

/**
 * flow.js — Luồng điều phối đăng nhập IU (SSO Microsoft) + đăng xuất.
 *
 * NHIEM VU: ghep cac module nho (window/cookies/pagescript/constants) thanh
 * 2 ham cong khai loginIU() va logoutIU(). Chi dieu phoi, khong tu doc cookie,
 * khong tu mo cua so (nho cac module kia lam).
 *
 * NGUON DU LIEU:
 *  - Luong SSO trich tu thoiGianBieu/src/main/sync/index.js (MS_LOGIN_URL,
 *    SSO Microsoft 1 lan) va browserLogin.js (openCmc, portalAuthState).
 *  - Cac ham phu: window.js (openLoginWindow/loadAndWait/portalAuthState/
 *    waitForPortalAuth/safeGetURL/destroyWindow/sleep), cookies.js
 *    (readIuCookies/clearSession), pagescript.js (clickMsSignInScript),
 *    constants.js (IU_URL).
 *  - Phan loai host (isMsLoginHost/isSignedInHost/isCmcHost) doi chieu voi
 *    cac domain that: login.microsoftonline.com, office.com, iu.cmcu.edu.vn.
 *
 * CACH DUNG:
 *   const { loginIU, logoutIU } = require("./flow");
 *   const jar = await loginIU({ keepOpen: true, timeoutMs: 300000 });
 *   // jar = { map, cookie, count, url }
 */

const { IU_URL, IU_ORIGIN, portalFromUrl } = require("./constants");
const { clickMsSignInScript } = require("./pagescript");
const {
    getIuWindow,
    openLoginWindow,
    destroyWindow,
    loadAndWait,
    portalAuthState,
    waitForPortalAuth,
    safeGetURL,
    sleep,
} = require("./window");
const { readIuCookies, clearSession } = require("./cookies");

function hostOf(url) {
    try {
        return new URL(url).host.toLowerCase();
    } catch {
        return "";
    }
}
function isSignedInHost(host) {
    return /(^|\.)office\.com$|(^|\.)office365\.com$|(^|\.)microsoft365\.com$|(^|\.)cloud\.microsoft$|(^|\.)outlook\.office\.com$|(^|\.)my(applications|apps)\.microsoft\.com$|(^|\.)portal\.office\.com$/i.test(host);
}
// Bấm thử nút SSO trong trang (nếu portal render nút). Không ném lỗi.
async function tryClickSso(win) {
    await sleep(700);
    if (!safeGetURL(win, "").startsWith(IU_ORIGIN + "/")) return false;
    await win.webContents
        .executeJavaScript(`(${clickMsSignInScript.toString()})()`, true)
        .catch(() => false);
}

function readWindowCookies(win) {
    const portal = portalFromUrl(safeGetURL(win, ""));
    return portal ? readIuCookies(portal) : { map: {}, cookie: "", count: 0 };
}

/**
 * Đăng nhập IU bằng tài khoản Microsoft của trường, trả về cookie.
 *
 * Luồng:
 *  1. Đã đăng nhập từ trước (session persist còn) -> mở ẨN IU, SSO im lặng, trả cookie ngay.
 *  2. Chưa đăng nhập -> hiện trang đăng nhập của IU và mở SSO Microsoft.
 *
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=180000] — thời gian chờ người dùng đăng nhập.
 * @param {boolean} [opts.hidden] — true: ép mở ẩn; mặc định tự quyết (đã login -> ẩn).
 * @param {boolean} [opts.keepOpen=false] — true: giữ cửa sổ hiện sau khi xong.
 * @returns {Promise<{ map: Record<string,string>, cookie: string, count: number, url: string }>}
 *   - map: cookie dạng object { TEN: GIATRI }.
 *   - cookie: chuỗi header dùng ngay cho fetch: "a=b; c=d".
 *   - count: số cookie lấy được. count = 0 nghĩa là chưa đăng nhập được.
 */
async function performLogin(opts = {}) {
    const timeoutMs = Number(opts.timeoutMs) || 180000;
    // Mở cửa sổ ẨN trước, tải IU ngay để tránh trắng (show sau khi sẵn sàng).
    const win = openLoginWindow(null, { hidden: true });
    console.log("[IU] Đã mở cửa sổ, URL hiện tại:", safeGetURL(win, "(đang tải)"));

    // Gắn phím tắt DevTools (F12 / Ctrl+Shift+I) để debug khi trắng màn hình.
    try {
        win.webContents.on("before-input-event", (_event, input) => {
            if (input.key === "F12" || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === "i")) {
                win.webContents.toggleDevTools();
            }
        });
    } catch { /* ignore */ }

    // Đã ở sẵn IU và còn phiên -> trả cookie luôn.
    if (await portalAuthState(win)) {
        const jar = await readWindowCookies(win);
        if (jar.count > 0) {
            if (!opts.keepOpen && win && !win.isDestroyed()) win.hide();
            return { ...jar, url: safeGetURL(win) };
        }
    }

    // Mở IU ẩn để thử SSO im lặng bằng phiên Microsoft cũ.
    await loadAndWait(win, IU_URL, 8000);
    if (await portalAuthState(win)) {
        const jar = await readWindowCookies(win);
        if (jar.count > 0) {
            if (!opts.keepOpen && !win.isDestroyed()) win.hide();
            return { ...jar, url: safeGetURL(win) };
        }
    }

    // Chưa vào được -> cần người dùng đăng nhập Microsoft.
    const hidden = opts.hidden === true; // mặc định HIỆN để người dùng thao tác
    if (!hidden) { win.show(); win.focus(); }
    // Thử tự bấm nút SSO (nếu trang portal render nút), rồi chờ người dùng làm nốt.
    await tryClickSso(win);

    const started = Date.now();
    let authed = false;
    while (Date.now() - started < timeoutMs) {
        if (win.isDestroyed()) {
            throw Object.assign(new Error("Bạn đã đóng cửa sổ trước khi đăng nhập xong."), { code: "LOGIN_CLOSED" });
        }
        // Microsoft đã xong (tới office.com) mà chưa sang IU -> tự đưa sang IU.
        const url = safeGetURL(win, "");
        const host = hostOf(url);
        if (isSignedInHost(host)) {
            await loadAndWait(win, IU_URL);
            await tryClickSso(win);
        }
        if (await portalAuthState(win)) { authed = true; break; }
        await sleep(800);
    }
    if (!authed) {
        throw Object.assign(
            new Error("Hết thời gian chờ đăng nhập IU. Hãy kết nối lại và hoàn tất đăng nhập Microsoft."),
            { code: "LOGIN_TIMEOUT" }
        );
    }

    // Vào được IU -> chốt SSO lần cuối rồi đọc cookie.
    await waitForPortalAuth(win, 15000);
    const jar = await readWindowCookies(win);
    if (!opts.keepOpen && !win.isDestroyed()) win.hide(); // ẩn đi, GIỮ session cho lần sau
    return { ...jar, url: safeGetURL(win) };
}

/**
 * Đăng xuất IU: đóng cửa sổ + XOÁ session CMC (cookie, localStorage...).
 * Lần sau gọi loginIU() sẽ phải đăng nhập Microsoft lại.
 */
let pendingLogin = null;
function loginIU(opts = {}) {
    if (pendingLogin) return pendingLogin;
    const cancelledError = code => Object.assign(new Error(code === 'LOGIN_TIMEOUT'
        ? 'Hết thời gian chờ đăng nhập IU.' : 'Đã hủy đăng nhập IU.'), { code });
    if (opts.signal?.aborted) return Promise.reject(cancelledError('LOGIN_CANCELLED'));
    const requestedTimeout = Number(opts.timeoutMs);
    const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
        ? Math.min(requestedTimeout, 180000) : 180000;
    let timer, onAbort;
    const cancelled = new Promise((_, reject) => {
        const stop = code => {
            // Keep the persistent Microsoft partition, but stop stale navigation.
            destroyWindow();
            reject(cancelledError(code));
        };
        timer = setTimeout(() => stop('LOGIN_TIMEOUT'), timeoutMs);
        onAbort = () => stop('LOGIN_CANCELLED');
        opts.signal?.addEventListener('abort', onAbort, { once: true });
    });
    pendingLogin = Promise.race([performLogin(opts), cancelled]).finally(() => {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', onAbort);
        pendingLogin = null;
    });
    return pendingLogin;
}

async function logoutIU() {
    destroyWindow();
    await clearSession();
    return true;
}

module.exports = { loginIU, logoutIU, getIuWindow };
