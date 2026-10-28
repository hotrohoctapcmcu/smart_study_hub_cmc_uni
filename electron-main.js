"use strict";

const electron = require("electron");

if (!electron?.app || !electron?.BrowserWindow) {
    console.error("Hãy chạy bằng npm start.");
    process.exit(1);
}

const { app, BrowserWindow, shell } = electron;
const path = require("path");

require("./index");

try {
    require("./electron/iu-bridge").registerIuBridge();
    require("./electron/outlook-bridge").registerOutlookBridge();
} catch { }

const FE_URL = "http://localhost:8080";
const RETRY_DELAY = 800;
const MAX_ATTEMPTS = 40;

let mainWindow = null;
let attempts = 0;
let timer = null;

/**
 * Cố định giao diện ở đúng 100%: chặn mọi thay đổi zoom
 * (Ctrl +/-/0, Ctrl + lăn chuột, pinch-to-zoom) và xoá mức zoom đã lưu.
 * Chromium lưu zoom theo origin nên nếu người dùng lỡ thu nhỏ một lần,
 * lần mở sau toàn bộ UI vẫn bị thu nhỏ và dồn về một góc.
 */
function lockZoom(win) {
    if (!win || win.isDestroyed()) return;
    const wc = win.webContents;
    try {
        wc.setZoomMode("disabled");
        wc.setZoomFactor(1);
        const limits = wc.setVisualZoomLevelLimits(1, 1);
        if (limits && typeof limits.catch === "function") limits.catch(() => { });
    } catch { /* Electron cũ hơn: bỏ qua, zoomFactor vẫn giữ 100% */ }
}

function loadApp() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.loadURL(FE_URL).catch(() => {
        if (attempts++ >= MAX_ATTEMPTS) {
            console.error(`Không thể tải ${FE_URL}`);
            return;
        }

        clearTimeout(timer);
        timer = setTimeout(loadApp, RETRY_DELAY);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1380,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        backgroundColor: "#ffffff",
        title: "UniStudy CMC",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "electron", "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // Luôn khởi động ở 100%, không kế thừa zoom đã lưu của lần chạy trước
            zoomFactor: 1.0
        }
    });

    lockZoom(mainWindow);

    mainWindow.once("ready-to-show", () => mainWindow?.show());

    mainWindow.webContents.on("did-fail-load", (_, __, ___, ____, isMainFrame) => {
        if (isMainFrame !== false) loadApp();
    });

    mainWindow.webContents.on("did-finish-load", () => {
        attempts = 0;
        clearTimeout(timer);
        // Ép lại 100% sau mỗi lần tải/nạp lại trang
        lockZoom(mainWindow);
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(FE_URL)) return { action: "allow" };
        shell.openExternal(url).catch(() => { });
        return { action: "deny" };
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
        clearTimeout(timer);
    });

    loadApp();
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
});
