"use strict";

/**
 * electron/preload.js
 * ===================================================================================
 * PRELOAD CHO CỬA SỔ APP CHÍNH — CẦU NỐI AN TOÀN RA MAIN PROCESS
 * ===================================================================================
 * Chạy trong renderer (FE sandbox: contextIsolation + nodeIntegration=false).
 * Chỉ expose đúng 1 namespace `window.__uniStudyIU`, không lộ cookie:
 *   - isAvailable: true khi chạy trong Electron (có IPC), false khi mở web thuần.
 *   - loginIU(opts): mở cửa sổ SSO IU riêng, đăng nhập xong lưu phiên lên API.
 *   - pullIU(opts): kéo dữ liệu IU bằng phiên đã lưu, lưu DB qua API.
 *   - iuStatus(): trạng thái phiên IU trên server (không lộ cookie).
 *   - logoutIU(): xoá phiên IU (server + partition trình duyệt).
 *
 * Cookie cổng IU KHÔNG BAO GIỜ vào renderer — main process giữ và POST
 * thẳng tới API. Renderer chỉ nhận { ok, status/message }.
 * ===================================================================================
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__uniStudyOutlook", {
    connect: () => ipcRenderer.invoke("outlook:connect")
});

contextBridge.exposeInMainWorld("__uniStudyIU", {
    isAvailable: true,

    loginIU: (opts) => ipcRenderer.invoke("iu:login", opts || {}),

    pullIU: (opts) => ipcRenderer.invoke("iu:pull", opts || {}),

    iuStatus: () => ipcRenderer.invoke("iu:status"),

    logoutIU: () => ipcRenderer.invoke("iu:logout"),
});
