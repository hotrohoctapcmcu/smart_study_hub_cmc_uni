"use strict";

/**
 * pagescript.js — 2 đoạn script chạy TRONG trang web portal.
 *
 * NHIEM VU: giu nguyen van cac function se duoc .toString() roi day vao
 * webContents.executeJavaScript(). Khong dung duoc const/let/arrow/optional
 * chaining ben trong — phai viet ES5 vi chay trong page context.
 *
 * NGUON DU LIEU: trich tu luan sync cua ung dung thoiGianBieu
 *   thoiGianBieu/src/main/sync/browserLogin.js
 *     -> openCmc / clickMsSignIn / portalAuthState
 * Kiem chung bang cach doi chieu voi trang that cua portal:
 *   portalSrc/loi/Index.aspx (nút "Sign in using Microsoft"),
 *   portalSrc/loi/pagination.js (luồng login AFG -> Logout.aspx).
 *
 * CACH DUNG (tu file khac trong cum login):
 *   const { clickMsSignInScript, portalAuthStateScript } = require("./pagescript");
 *   await win.webContents.executeJavaScript(`(${clickMsSignInScript.toString()})()`, true);
 */

// Tự bấm nút "Sign in using Microsoft" trên trang portal (APIS).
function clickMsSignInScript() {
    var kw = /microsoft|đăng nhập.*microsoft|sign in using microsoft|office ?365|azure/i;
    var sel = "a, button, input[type=button], input[type=submit], div[role=button], span[role=button], img";
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    for (var i = 0; i < els.length; i++) {
        var e = els[i];
        var t = (e.innerText || e.value || e.getAttribute("aria-label") || e.title || e.alt || "").trim();
        if (t && kw.test(t)) {
            var clickable = e.closest && e.closest("a,button,[role=button]") ? e.closest("a,button,[role=button]") : e;
            clickable.click();
            return t || "clicked";
        }
    }
    var links = Array.prototype.slice.call(document.querySelectorAll("a[href]"));
    for (var j = 0; j < links.length; j++) {
        if (/microsoft|oauth|external|azuread|\bsso\b|signin-oidc|openid/i.test(links[j].href)) {
            links[j].click();
            return links[j].href;
        }
    }
    return false;
}

// Kiểm tra đã đăng nhập IU thật chưa (nhìn URL, không chỉ nhìn domain).
function portalAuthStateScript() {
    try {
        var href = location.href || "";
        if (/login\.microsoftonline\.com|login\.live\.com/i.test(href)) return false;
        return /cmcu\.edu\.vn/i.test(location.hostname) && !/login|signin|sign-in/i.test(href);
    } catch (e) {
        return false;
    }
}

// Phát hiện trang lỗi Microsoft (chạy trong page context, ES5).
// Trả về mã lỗi dạng chuỗi, "" nếu không có lỗi.
// AADSTS50020 = sai tài khoản (Gmail cá nhân thay vì email trường).
function msLoginErrorScript() {
    try {
        var t = (document.body ? document.body.innerText : "") || "";
        if (/AADSTS50020/i.test(t)) return "AADSTS50020";
        if (/does not exist in tenant/i.test(t)) return "WRONG_TENANT";
        return "";
    } catch (e) {
        return "";
    }
}

module.exports = { clickMsSignInScript, portalAuthStateScript, msLoginErrorScript };
