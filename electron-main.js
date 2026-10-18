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
} catch { }

const FE_URL = "http://localhost:8080";
const RETRY_DELAY = 800;
const MAX_ATTEMPTS = 40;

let mainWindow = null;
let attempts = 0;
let timer = null;

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
            sandbox: true
        }
    });

    mainWindow.once("ready-to-show", () => mainWindow?.show());

    mainWindow.webContents.on("did-fail-load", (_, __, ___, ____, isMainFrame) => {
        if (isMainFrame !== false) loadApp();
    });

    mainWindow.webContents.on("did-finish-load", () => {
        attempts = 0;
        clearTimeout(timer);
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