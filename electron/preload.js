"use strict";

/**
 * electron/preload.js
 * ===================================================================================
 * PRELOAD CHO CỬA SỔ APP CHÍNH — CẦU NỐI AN TOÀN RA MAIN PROCESS
 * ===================================================================================
 * Chạy trong renderer (FE sandbox: contextIsolation + nodeIntegration=false).
 * Expose ba namespace __uniStudySync, __uniStudyOutlook và __uniStudyIU.
 * Namespace IU không lộ cookie và cung cấp:
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

function subscribeConnectionProgress(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('sync:connection-progress', listener);
    return () => ipcRenderer.removeListener('sync:connection-progress', listener);
}

contextBridge.exposeInMainWorld("__uniStudySync", {
    onConnectionProgress: subscribeConnectionProgress,
    onProgress: subscribeConnectionProgress,
    connectAll: (options) => ipcRenderer.invoke("sync:connect-all", options || {})
});

contextBridge.exposeInMainWorld("__uniStudyOutlook", {
    connect: () => ipcRenderer.invoke("outlook:connect")
});

contextBridge.exposeInMainWorld("__uniStudyIU", {
    isAvailable: true,

    loginIU: (opts) => ipcRenderer.invoke("iu:login", opts || {}),

    pullIU: (opts) => ipcRenderer.invoke("iu:pull", opts || {}),

    iuStatus: () => ipcRenderer.invoke("iu:status"),

    restoreIU: () => ipcRenderer.invoke("iu:restore"),

    logoutIU: () => ipcRenderer.invoke("iu:logout"),
});
