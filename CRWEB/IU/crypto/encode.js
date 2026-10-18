"use strict";

/**
 * encode.js — Ma hoa request theo dung ham AE() goc cua portal IU.
 *
 * NHIEM VU: 1 ham duy nhat ma_hoa(payload) -> chuoi field "A" de POST.
 *
 * NGUON DU LIEU:
 *  - Cong thuc goc: function AE(r, t) o cuoi file
 *      portalSrc/loi/assets_js_crypto-js.js
 *    AE(text, key) = XOR tung charCode cua text voi key (lap lai) roi base64.
 *  - Cach portal goi (ham makeRequest trong
 *      portalSrc/loi/Core_systemroot.js):
 *      d = { A: AE(JSON.stringify(params), <suffix sau dau "/" cua action>) }
 *    Tuc key ma hoa chinh la doan suffix trong URL endpoint.
 *    Vi du: action "SV_ThongTin_MH/DSA4CiQ1EDQgFSgiKQ00OBUpJC4KKS4o"
 *      -> key = "DSA4CiQ1EDQgFSgiKQ00OBUpJC4KKS4o".
 *  - Kiem chung: ma_hoa(payload mau trong payload/payload.mau.json) cho ra chuoi
 *    khop tung ky tu voi field "A" that bat duoc tu trinh duyet.
 *
 * LUU Y KY THUAT: phai XOR tren charCode cua chuoi (nhu code duoi), KHONG XOR
 * tren byte Buffer tho — sai voi ky tu da byte nhu tieng Viet.
 */

// Ma hoa object payload thanh field "A" de POST.
function ma_hoa(payload) {
    const text = JSON.stringify(payload);
    const action = String((payload && payload.action) || "");
    const key = action.includes("/") ? action.substring(action.indexOf("/") + 1) : action;
    if (!key) {
        throw new Error("Payload thieu action dang '<MODULE_MH>/<suffix>'.");
    }
    let xor = "";
    for (let i = 0; i < text.length; i++) {
        xor += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(xor, "utf8").toString("base64");
}

module.exports = { ma_hoa };
