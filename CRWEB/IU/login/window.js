"use strict";

/**
 * window.js — Quan ly cua so Electron dung cho dang nhap IU.
 *
 * NHIEM VU: mo/tao dung mot cua so BrowserWindow (dung chung bien iuWindow),
 * doi trang tai xong, kiem tra da dang nhap portal chua. Khong goi mang,
 * khong doc cookie (nam o cookies.js), khong dieu phoi luong login (flow.js).
 *
 * NGUON DU LIEU:
 *  - CMC_PARTITION, IU_URL: login/constants.js.
 *  - portalAuthStateScript: login/pagescript.js (chay trong trang).
 *  - Luong mo cua so + doi tai trich tu
 *    thoiGianBieu/src/main/sync/browserLogin.js (openCmc, loadAndWait,
 *    waitForPortalAuth) va sync/index.js (SSO Microsoft 1 lan).
 *  - require("electron") phai chay trong Electron MAIN process; neu thieu
 *    module thi nem loi code LOGIN_NO_ELECTRON.
 *
 * CACH DUNG:
 *   const w = require("./window");
 *   const win = w.openLoginWindow();        // mo (hoac tai dung) cua so
 *   const ok = await w.waitForPortalAuth(win, 120000);
 *   const cur = w.getIuWindow();            // lay lai cua so dang mo (hoac null)
 */

const { IU_URL, CMC_PARTITION } = require("./constants");
const { portalAuthStateScript, msLoginErrorScript } = require("./pagescript");

// UA Chrome thật để Microsoft/IU không chặn Electron (Electron mặc định gửi
// "Electron/..." trong UA, một số trang SSO từ chối -> trang trắng).
const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

let iuWindow = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getElectron() {
    let mod = null;
    try {
        // eslint-disable-next-line global-require
        mod = require("electron");
    } catch {
        mod = null;
    }
    // Chạy bằng `node index` (thay vì `npx electron .`): require("electron")
    // KHÔNG throw mà trả về chuỗi đường dẫn file binary -> không có API.
    if (!mod || typeof mod !== "object" || !mod.BrowserWindow || !mod.app || !mod.session) {
        throw Object.assign(
            new Error("loginIU() phải chạy trong Electron MAIN process. Hãy chạy bằng `npx electron .` (trong thư mục hotrohoctap), không chạy bằng `node index`."),
            { code: "LOGIN_NO_ELECTRON" }
        );
    }
    return mod;
}

// Lay cua so dang mo (null neu chua mo hoac da bi huy).
function getIuWindow() {
    return iuWindow && !iuWindow.isDestroyed() ? iuWindow : null;
}

// Mo (hoac tai dung) cua so dang nhap. opts.hidden=true -> mo an.
// Fix màn hình trắng: tạo ẩn + tải URL ngay, chỉ show khi trang ready-to-show.
function openLoginWindow(url, opts = {}) {
    const { BrowserWindow } = getElectron();
    if (iuWindow && !iuWindow.isDestroyed()) {
        if (url) iuWindow.loadURL(url).catch(() => {});
        if (!opts.hidden) { iuWindow.show(); iuWindow.focus(); }
        return iuWindow;
    }
    iuWindow = new BrowserWindow({
        width: 1180,
        height: 860,
        show: false, // luôn tạo ẩn, show sau khi trang sẵn sàng (tránh trắng)
        backgroundColor: "#ffffff",
        title: "Đăng nhập IU (Microsoft)",
        autoHideMenuBar: true,
        webPreferences: {
            partition: CMC_PARTITION, // persist: đóng cửa sổ vẫn GIỮ phiên đăng nhập
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
        },
    });
    // UA Chrome thật: Microsoft/IU có thể chặn UA "Electron/..." -> trang trắng.
    try { iuWindow.webContents.setUserAgent(CHROME_UA); } catch { /* ignore */ }
    iuWindow.once("ready-to-show", () => {
        if (!opts.hidden && iuWindow && !iuWindow.isDestroyed()) {
            iuWindow.show();
            iuWindow.focus();
        }
    });
    iuWindow.on("closed", () => { iuWindow = null; });
    if (url) {
        iuWindow.loadURL(url).catch(() => {});
    } else {
        // Tải trang trắng hợp lệ để cửa sổ không treo ở about:blank.
        iuWindow.loadURL("about:blank").catch(() => {});
    }
    if (!opts.hidden) iuWindow.focus();
    return iuWindow;
}

// Huy cua so (dung khi logout) va xoa bien noi bo.
function destroyWindow() {
    if (iuWindow && !iuWindow.isDestroyed()) {
        try { iuWindow.destroy(); } catch { /* ignore */ }
    }
    iuWindow = null;
}

// Nạp URL và đợi trang tải xong (did-stop-loading) hoặc hết timeout.
// Fix màn hình trắng: lắng nghe cả did-fail-load để log lỗi + retry 1 lần,
// thay vì treo trắng mãi không biết lý do.
function loadAndWait(win, url, timeout = 25000) {
    return new Promise((resolve) => {
        let done = false;
        const wc = win.webContents;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            wc.removeListener("did-stop-loading", onStop);
            wc.removeListener("did-fail-load", onFail);
            setTimeout(resolve, 700); // chờ thêm XHR sau khi tải xong
        };
        const onStop = () => finish();
        const onFail = (_e, code, desc, failedURL) => {
            // -3 = ABORTED (thường do redirect SSO, bỏ qua); lỗi khác thì log.
            if (code !== -3) {
                console.error(`[IU] Tải trang thất bại: ${desc} (code=${code}) url=${failedURL}`);
            }
            finish();
        };
        const timer = setTimeout(() => {
            console.error(`[IU] Hết timeout ${timeout}ms khi tải: ${url} (URL hiện tại: ${safeGetURL(win, "?")})`);
            finish();
        }, timeout);
        wc.on("did-stop-loading", onStop);
        wc.on("did-fail-load", onFail);
        console.log(`[IU] Đang tải: ${url}`);
        wc.loadURL(url).catch((e) => {
            console.error(`[IU] loadURL lỗi: ${(e && e.message) || e}`);
            finish();
        });
    });
}

// Kiem tra trang hien tai da dang nhap portal chua (chay script trong trang).
async function portalAuthState(win) {
    try {
        return !!(await win.webContents.executeJavaScript(
            `(${portalAuthStateScript.toString()})()`,
            true
        ));
    } catch {
        return false;
    }
}

// Kiem tra trang loi dang nhap Microsoft (AADSTS50020 = sai tai khoan).
// Tra ve "" neu khong loi, hoac ma loi ("AADSTS50020" / "WRONG_TENANT").
async function msLoginError(win) {
    try {
        const code = await win.webContents.executeJavaScript(
            `(${msLoginErrorScript.toString()})()`,
            true
        );
        return String(code || "");
    } catch {
        return "";
    }
}

// Cho toi khi dang nhap portal thanh cong (hoac het timeout -> false).
async function waitForPortalAuth(win, timeout = 120000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (win.isDestroyed()) return false;
        if (await portalAuthState(win)) return true;
        await sleep(650);
    }
    return false;
}

// Lay URL hien tai cua cua so (an toan, khong nem loi).
function safeGetURL(win, fallback = IU_URL) {
    try { return win.webContents.getURL(); } catch { return fallback; }
}

module.exports = {
    getElectron,
    getIuWindow,
    openLoginWindow,
    destroyWindow,
    loadAndWait,
    portalAuthState,
    waitForPortalAuth,
    safeGetURL,
    sleep,
};
