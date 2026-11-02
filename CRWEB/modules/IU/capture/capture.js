"use strict";

/**
 * capture.js — Bat response API cua portal IU qua Chrome DevTools Protocol.
 *
 * NHIEM VU: attach CDP vao webContents cua cua so Electron da dang nhap,
 * bat cac response JSON (sinhvienapi), tu dong giai ma Data.B bang
 * ../crypto (giai_ma), tra ve danh sach { url, mime, len, decoded }.
 * Khong dang nhap (can cua so tu login/), khong dung payload (payload/).
 *
 * NGUON DU LIEU:
 *  - Ky thuat bat mang: Chrome DevTools Protocol "1.3", cac event
 *    Network.responseReceived / Network.loadingFinished / Network.getResponseBody
 *    — trich tu thoiGianBieu/src/main/sync/browserLogin.js (startNetworkCapture).
 *  - Bo loc SKIP_URL: bo quang cao/analytics/font/anh/css (google-analytics,
 *    doubleclick, .woff2, .png...).
 *  - Giai ma body: ham giai_ma() cua ../crypto (AD goc cua portal, key
 *    "AzzSystem" — nguon: portalSrc/loi/assets_js_crypto-js.js + pagination.js).
 *  - Dieu huong SPA hash: cac route nhu #diemhoc chi can loadURL la kich hoat
 *    API (kiem chung: portalSrc/loi/Index.aspx la SPA, menu bam vao hash).
 *
 * CACH DUNG:
 *   const { batRequestRoute } = require("./capture");
 *   const { loginIU, getIuWindow } = require("../login");
 *
 *   await loginIU({ keepOpen: true });
 *   const { responses } = await batRequestRoute(getIuWindow(),
 *     "https://iu.cmcu.edu.vn/congthongtin/Index.aspx#diemhoc", { waitMs: 20000 });
 *   // responses: [{ url, mime, len, decoded: string[] }]
 */

const { giai_ma } = require("../crypto");

const SKIP_URL = /google-analytics|googletagmanager|gstatic|fonts\.googleapis|doubleclick|facebook\.|\.woff2?|\.ttf|\.png|\.jpe?g|\.gif|\.svg|\.css|\.ico|\.map/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Bat moi response JSON khi dieu huong cua so toi 1 route (SPA hash).
 *
 * @param {BrowserWindow} win — cua so Electron da dang nhap (login/getIuWindow()).
 * @param {string} routeUrl — URL dieu huong toi (vd .../Index.aspx#diemhoc).
 *   Truyen null/"" de bat tren trang hien tai khong dieu huong.
 * @param {object} [opts]
 * @param {number} [opts.waitMs=15000] — thoi gian cho toi da sau dieu huong.
 * @param {number} [opts.idleMs=1200] — mang "ranh" khi khong response moi trong khoang nay.
 * @param {function} [opts.log] — ham log tien trinh (mac dinh im lang).
 * @returns {Promise<{ responses: Array<{url,mime,len,decoded}>, attached: boolean }>}
 */
async function batRequestRoute(win, routeUrl, { waitMs = 15000, idleMs = 1200, log = () => {} } = {}) {
    if (!win || win.isDestroyed()) {
        throw new Error("batRequestRoute can cua so Electron da dang nhap (loginIU truoc).");
    }
    const wc = win.webContents;
    const responses = [];
    const pending = {};

    try {
        wc.debugger.attach("1.3");
    } catch (e) {
        log("Không attach debugger được (có thể DevTools đang mở):", e && e.message);
        return { responses, attached: false };
    }
    const onMsg = async (_e, method, params) => {
        try {
            if (method === "Network.responseReceived") {
                const url = params.response && params.response.url;
                const mime = (params.response && params.response.mimeType) || "";
                if (url && !SKIP_URL.test(url) && (/sinhvienapi|json/i.test(url) || /json/i.test(mime))) {
                    pending[params.requestId] = { url, mime };
                }
            } else if (method === "Network.loadingFinished") {
                const meta = pending[params.requestId];
                if (!meta) return;
                delete pending[params.requestId];
                try {
                    const body = await wc.debugger.sendCommand("Network.getResponseBody", {
                        requestId: params.requestId,
                    });
                    const text = body.base64Encoded
                        ? Buffer.from(body.body, "base64").toString("utf8")
                        : body.body;
                    if (text && text.trim().length > 2) {
                        const decoded = giai_ma(text);
                        responses.push({ url: meta.url, mime: meta.mime, len: text.length, decoded });
                        log(`bắt API: ${meta.url.slice(0, 110)} (len=${text.length}, decoded=${decoded.length})`);
                    }
                } catch {
                    /* body đã bị xoá */
                }
            }
        } catch {
            /* ignore */
        }
    };
    wc.debugger.on("message", onMsg);
    try {
        await wc.debugger.sendCommand("Network.enable");
    } catch {
        /* ignore */
    }

    // Dieu huong (neu co route). #diemhoc la SPA hash — set hash kich hoat API.
    if (routeUrl) {
        log("điều hướng tới:", routeUrl);
        try {
            await new Promise((resolve) => {
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    wc.removeListener("did-stop-loading", onStop);
                    resolve();
                };
                const onStop = () => finish();
                const timer = setTimeout(finish, 18000);
                wc.on("did-stop-loading", onStop);
                wc.loadURL(routeUrl).catch(() => finish());
            });
        } catch {
            /* ignore */
        }
    }

    // Cho mang ranh: khong co response moi trong idleMs thi dung (toi da waitMs).
    const start = Date.now();
    let last = -1;
    let lastChange = Date.now();
    while (Date.now() - start < waitMs) {
        await sleep(250);
        if (responses.length !== last) {
            last = responses.length;
            lastChange = Date.now();
        } else if (Date.now() - lastChange >= idleMs) {
            break;
        }
    }

    // Don debugger (giu cua so + session).
    try {
        wc.debugger.removeListener("message", onMsg);
        wc.debugger.detach();
    } catch {
        /* ignore */
    }
    return { responses, attached: true };
}

module.exports = { batRequestRoute, SKIP_URL };
