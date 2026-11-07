"use strict";

const electron = require("electron");

if (!electron?.app || !electron?.BrowserWindow) {
    console.error("Hãy chạy bằng npm start.");
    process.exit(1);
}

const { app, BrowserWindow, shell } = electron;
const path = require("path");
const { APP_ORIGIN, isAppUrl } = require('./app-origin');
const APP_ID = "vn.cmcu.smartstudyhub";
const APP_TITLE = "Smart Study Hub - CMC University";
const APP_ICON = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "assets"), "branding",
    process.platform === "win32" ? "smart-study-hub.ico" : "smart-study-hub.png");

if (process.platform === "win32") app.setAppUserModelId(APP_ID);

if (app.isPackaged) require("./runtime").configurePackagedRuntime(app);
electron.protocol.registerSchemesAsPrivileged([{
    scheme: 'studyhub', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

const APP_URL = APP_ORIGIN + '/';
let runtime = null;
let starting = true;
let pendingReset = null;
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

    mainWindow.loadURL(APP_URL).catch(() => {
        if (attempts++ >= MAX_ATTEMPTS) {
            console.error(`Không thể tải ${APP_URL}`);
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
        title: APP_TITLE,
        icon: APP_ICON,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // Luôn khởi động ở 100%, không kế thừa zoom đã lưu của lần chạy trước
            zoomFactor: 1.0
        }
    });

    if (process.platform === "win32") {
        mainWindow.setAppDetails({
            appId: APP_ID,
            appIconPath: APP_ICON,
            relaunchDisplayName: APP_TITLE,
            relaunchCommand: app.isPackaged ? `"${process.execPath}"` :
                `"${process.execPath}" "${path.resolve(__dirname, "..")}"`
        });
    }

    lockZoom(mainWindow);

    mainWindow.once("ready-to-show", () => {
        if (process.env.SMART_STUDY_TEST_WINDOW !== 'hidden') mainWindow?.show();
    });

    mainWindow.webContents.on("did-fail-load", (_, __, ___, ____, isMainFrame) => {
        if (isMainFrame !== false) loadApp();
    });

    mainWindow.webContents.on("did-finish-load", async () => {
        attempts = 0;
        clearTimeout(timer);
        // Ép lại 100% sau mỗi lần tải/nạp lại trang
        lockZoom(mainWindow);
        if (pendingReset) {
            try {
                const id = await mainWindow.webContents.executeJavaScript("localStorage.getItem('__studyhub_last_reset__')");
                if (id === pendingReset.id) {
                    require('./data-management').completeReset(app, id);
                    pendingReset = null;
                }
            } catch (error) { console.error('[Data reset]', error.message); }
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isAppUrl(url)) return { action: "allow" };
        shell.openExternal(url).catch(() => { });
        return { action: "deny" };
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
        clearTimeout(timer);
    });

    loadApp();
}

async function startApplication() {
    pendingReset = await require('./data-management').applyPendingReset(electron);
    const legacyStorage = await require('./storage-migration').readLegacyStorage(electron, {
        resetScript: pendingReset ? require('./data-management').resetStorageScript(pendingReset) : null
    });
    runtime = await require('./desktop').createDesktopRuntime({ legacyStorage, pendingReset });
    electron.protocol.handle('studyhub', runtime.handle);
    const transport = { fetchImpl: runtime.fetch, apiBase: APP_ORIGIN };
    require("./bridges/iu").registerIuBridge(transport);
    require("./bridges/outlook").registerOutlookBridge();
    require("./bridges/sync").registerSyncBridge(transport);
    require('./data-management').registerDataBridge({ electron });
    createWindow();
    starting = false;
}

const primary = !app.isPackaged || app.requestSingleInstanceLock();
if (!primary) {
    app.quit();
} else {
    app.whenReady().then(startApplication).catch(error => {
        console.error('[Startup]', error);
        if (process.env.SMART_STUDY_TEST_WINDOW !== 'hidden') electron.dialog?.showErrorBox('Smart Study Hub', 'Không thể khởi động ứng dụng. ' + error.message);
        app.quit();
    });
    app.on('second-instance', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show(); mainWindow.focus();
    });
}
app.on('before-quit', () => runtime?.close());
app.on("window-all-closed", () => { if (!starting) app.quit(); });
app.on("activate", () => {
    if (!starting && runtime && !BrowserWindow.getAllWindows().length) createWindow();
});
