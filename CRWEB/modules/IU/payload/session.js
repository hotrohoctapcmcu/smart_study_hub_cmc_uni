"use strict";

/**
 * session.js — Tu lay ID phien sau khi login.
 *
 * NHIEM VU: 1 ham duy nhat laySession(win) -> { userId, chucNangId,
 * nguoiHocId, iM, appId, tokenJWT }. Khong dung payload, khong ma hoa, khong goi mang.
 *
 * NGUON DU LIEU (bien edu.system tren trang web da login):
 *  - userId     <- edu.system.userId            (server cap luc login)
 *  - chucNangId <- edu.system.strChucNang_Id    (man hinh dang mo)
 *  - iM         <- edu.system.iM                 (mac dinh "AzzSystem")
 *  - appId      <- edu.system.appId
 *  - tokenJWT   <- edu.system.tokenJWT          (server cap luc login,
 *      portal gui kem header "Authorization: Bearer <tokenJWT>" trong moi
 *      makeRequest — thieu la API tra 401. Nguon: ham makeRequest trong
 *      portalSrc/loi/Core_systemroot.js:
 *        h = "Bearer " + s.tokenJWT; s.tokenJWT && (m.headers = { Authorization: h }))
 *  Luong goc: ham AFG() trong portalSrc/loi/pagination.js gan cac bien nay
 *  sau khi giai chuoi AXYZCLRVN() (portalSrc/loi/Index.aspx).
 *  Cach lay thu cong (node thuong, khong co Electron): mo trang IU, bam F12,
 *  go edu.system.userId va edu.system.strChucNang_Id.
 *
 * CACH DUNG (trong Electron, sau loginIU):
 *   const { getIuWindow } = require("../login");
 *   const { laySession } = require("../payload"); // hoac require("./session")
 *   const session = await laySession(getIuWindow());
 */

const { IM_MAC_DINH } = require("../crypto");

async function laySession(win) {
    // BrowserWindow cua Electron — doc truc tiep tu trang web.
    if (win && win.webContents && typeof win.webContents.executeJavaScript === "function") {
        const raw = await win.webContents.executeJavaScript(
            "(() => { try { return JSON.stringify({ " +
            "userId: (window.edu && edu.system && edu.system.userId) || '', " +
            "chucNangId: (window.edu && edu.system && edu.system.strChucNang_Id) || '', " +
            "iM: (window.edu && edu.system && edu.system.iM) || '', " +
            "appId: (window.edu && edu.system && edu.system.appId) || '', " +
            "tokenJWT: (window.edu && edu.system && edu.system.tokenJWT) || '' " +
            "}); } catch (e) { return JSON.stringify({ error: String((e && e.message) || e) }); } })()",
            true
        );
        const s = JSON.parse(raw);
        if (s.error) {
            throw new Error("Khong doc duoc edu.system: " + s.error);
        }
        if (!s.userId) {
            throw new Error(
                "Trang IU chua login xong (edu.system.userId rong). " +
                "Hay doi loginIU() xong han goi laySession()."
            );
        }
        return {
            userId: s.userId,
            chucNangId: s.chucNangId || "",
            nguoiHocId: s.userId, // tu xem cua minh
            iM: s.iM || IM_MAC_DINH,
            appId: s.appId || "",
            tokenJWT: s.tokenJWT || "", // gui header Authorization: Bearer ...
        };
    }
    // Khong co Electron — khong tu lay duoc, huong dan lay tay.
    throw new Error(
        "laySession can BrowserWindow Electron (getIuWindow() sau loginIU()). " +
        "Neu chay node thuong: mo trang IU (F12) go " +
        "`edu.system.userId` va `edu.system.strChucNang_Id` roi tu tao " +
        "{ userId, chucNangId } truyen vao buildPayload()."
    );
}

module.exports = { laySession };
