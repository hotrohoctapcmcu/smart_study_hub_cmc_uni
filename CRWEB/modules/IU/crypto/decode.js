"use strict";

/**
 * decode.js — Giai ma response theo dung ham AD() goc cua portal IU.
 *
 * NHIEM VU:
 *  - giai_ma_request(aMaHoa, suffixHoacAction) -> object: giai nguoc field "A"
 *    cua request (can biet suffix endpoint). Dung de debug/kiem tra.
 *  - giai_ma(input) -> string[]: quet response, giai moi chuoi base64 (Data.B)
 *    bang cach thu lan luot 4 key, giu ban doc duoc.
 *
 * NGUON DU LIEU:
 *  - Cong thuc goc: function AD(r, t) o cuoi file
 *      portalSrc/loi/assets_js_crypto-js.js
 *    AD(b64, key) = base64-decode thanh chuoi UTF-8 roi XOR tung charCode voi key.
 *  - Cach portal giai response (ham makeRequest trong
 *      portalSrc/loi/Core_systemroot.js):
 *      n.Data = JSON.parse(AD(n.Data.B, params.iM))
 *    voi iM mac dinh "AzzSystem" (ham AFG trong portalSrc/loi/pagination.js).
 *  - Bo key lay tu crypto/keys.js (thu tu uu tien: "AzzSystem" truoc).
 *  - Vi du that: payload "B" trong test cu giai bang "AzzSystem" ra JSON hop le
 *    gom rsChiTiet (63 mon) + rsTongHop (10 dong).
 */

const { APIS_KEYS } = require("./keys");

// Giai field "A" cua request ve object (can biet suffix endpoint da goi),
// hoac giai Data.B cua response (key = iM cua request, VD "AzzSystem").
// Luu y: suffix endpoint CHUA "/" (VD "DSA4...") duoc dung NGUYEN lam key
// (khong cat). Chi khi chuoi co DAU "/" (dang "MODULE/suffix") moi cat lay
// phan sau — neu khong de y se cat nham key iM ngan nhu "AzzSystem" (khong
// co "/" nen giu nguyen, dung), nhung key "31415926535" cung vay.
function giai_ma_request(aMaHoa, suffixHoacAction) {
    let key = String(suffixHoacAction || "");
    if (key.includes("/")) key = key.substring(key.indexOf("/") + 1);
    if (!key) throw new Error("giai_ma_request can key (suffix hoac iM).");
    const mid = Buffer.from(String(aMaHoa), "base64").toString("utf8");
    let text = "";
    for (let i = 0; i < mid.length; i++) {
        text += String.fromCharCode(mid.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return JSON.parse(text);
}

// XOR + base64 dung chuan AD() — thu 1 key.
function xorBase64(base64, keyStr) {
    try {
        const mid = Buffer.from(String(base64), "base64").toString("utf8");
        if (!mid.length || !keyStr.length) return "";
        let out = "";
        for (let i = 0; i < mid.length; i++) {
            out += String.fromCharCode(mid.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length));
        }
        return out;
    } catch {
        return "";
    }
}

function laBase64(s) {
    if (typeof s !== "string") return false;
    const t = s.replace(/\s/g, "");
    return t.length >= 16 && t.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(t);
}

function docDuoc(s) {
    if (!s || s.length < 8) return false;
    let printable = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126) || c >= 0xa0) printable++;
    }
    return printable / s.length > 0.9 && /[{[]|":"|[A-Za-zÀ-ỹ]{4}/.test(s);
}

// Thu lan luot cac key, giu ban giai ma doc duoc dai nhat.
function giaiTotNhat(b64) {
    let best = "";
    for (const k of APIS_KEYS) {
        const d = xorBase64(b64, k);
        if (docDuoc(d) && d.length > best.length) best = d;
    }
    return best;
}

// Quet 1 response tho, tim moi chuoi base64 bi ma hoa (ke ca boc trong
// {"Data": "..."}) roi giai ma tung chuoi. Tra ve toi da 40 block.
function quetGiaiMa(rawText) {
    const results = [];
    const raw = String(rawText == null ? "" : rawText);
    const tryPush = (str) => {
        if (laBase64(str)) {
            const d = giaiTotNhat(str.replace(/\s/g, ""));
            if (d) results.push(d);
        }
    };
    if (raw.trim() && !raw.trim().startsWith("{") && !raw.trim().startsWith("[")) tryPush(raw.trim());
    try {
        const obj = JSON.parse(raw);
        const scan = (v, depth) => {
            if (depth > 6 || v == null) return;
            if (typeof v === "string") tryPush(v);
            else if (Array.isArray(v)) v.forEach((x) => scan(x, depth + 1));
            else if (typeof v === "object") Object.values(v).forEach((x) => scan(x, depth + 1));
        };
        scan(obj, 0);
    } catch {
        /* khong phai JSON — da thu raw o tren */
    }
    return results.slice(0, 40);
}

/**
 * Giai ma response cua IU.
 *
 * @param {string|object} input — body text cua fetch (string), hoac object JSON da parse.
 *   Vi du: '{"Data":{"B":"aGk..."}}' hoac object { Data: { B: "aGk..." } }.
 * @returns {string[]} mang chuoi JSON da giai ma (rong neu khong giai duoc).
 *   Thuong lay phan tu dau: JSON.parse(giai_ma(raw)[0]).
 */
function giai_ma(input) {
    if (input == null) return [];
    if (typeof input === "object") {
        try {
            return quetGiaiMa(JSON.stringify(input));
        } catch {
            return [];
        }
    }
    return quetGiaiMa(String(input));
}

module.exports = { giai_ma_request, giai_ma };
