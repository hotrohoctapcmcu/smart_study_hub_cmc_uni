"use strict";

/**
 * Dang nhap EDUX va quan ly cookie phien.
 *
 * Cookie uu tien phien dang nhap trong RAM, sau do EDUX_COOKIE, cuoi cung
 * login/cookie.txt (dang chuoi Cookie header). Tai khoan lay tu tham so hoac bien
 * moi truong EDUX_EMAIL / EDUX_PASSWORD.
 *
 * Khong dat tai khoan mac dinh trong ma nguon hoac log mat khau.
 * API/utils/edux-account.js quan ly tai khoan duoc nho cuc bo khi dung app.
 */

const fs = require("node:fs");
const path = require("node:path");
const { cookieFrom } = require("../utils");

// Co the tro sang moi truong khac (staging/test) bang bien moi truong.
const ORIGIN = (process.env.EDUX_ORIGIN || "https://edux.cmcu.edu.vn").replace(/\/+$/, "");
const API_BASE = process.env.EDUX_API_BASE || `${ORIGIN}/api`;
const COOKIE_FILE = path.join(__dirname, "cookie.txt");
let sessionCookie = "";

// Chi doc tu bien moi truong khi caller khong truyen tham so.
// Khong dat mat khau mac dinh trong ma nguon.
const THONG_TIN_MAC_DINH = {
  email: process.env.EDUX_EMAIL || "",
  password: process.env.EDUX_PASSWORD || "",
};

// Gioi han thoi gian cho mot lan dang nhap, tranh treo request khi EDUX khong phan hoi.
const LOGIN_TIMEOUT_MS = Number(process.env.EDUX_TIMEOUT_MS) > 0
  ? Number(process.env.EDUX_TIMEOUT_MS)
  : 25000;

/**
 * Doc cookie: phien RAM moi nhat, bien moi truong, roi file.
 * Tra ve chuoi rong neu chua co.
 */
function docCookie() {
  const raw = sessionCookie || process.env.EDUX_COOKIE
    || (fs.existsSync(COOKIE_FILE) ? fs.readFileSync(COOKIE_FILE, "utf8") : "");
  return cookieFrom(raw);
}

/**
 * Ghi cookie moi xuong login/cookie.txt.
 */
function luuCookie(rawCookie) {
  fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
  const cookie = String(rawCookie ?? "").trim();
  fs.writeFileSync(COOKIE_FILE, cookie, "utf8");
  sessionCookie = cookie;
  return COOKIE_FILE;
}

/**
 * Lay cookie dang dung, bao loi ro rang neu chua dang nhap.
 */
function layCookie() {
  const cookie = docCookie();
  if (!cookie) {
    throw new Error(
      `Chua co cookie dang nhap. Hay goi loginEdux() hoac cap nhat ${COOKIE_FILE}.`,
    );
  }
  return cookie;
}

/**
 * Dang nhap EDUX, luu cookie phien va tra ve ket qua.
 *
 * @param {{email?: string, password?: string, luu?: boolean}} [options]
 * @returns {Promise<{email: string, message: string, cookie: string}>}
 */
async function loginEdux(options = {}) {
  const email = String(options.email || THONG_TIN_MAC_DINH.email || "").trim();
  const password = String(options.password || THONG_TIN_MAC_DINH.password || "");

  if (!email || !password) {
    throw new Error("Thieu email hoac mat khau EDUX.");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
      },
      body: JSON.stringify({ email, password }),
      ...(typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? { signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS) }
        : {}),
    });
  } catch (err) {
    // Khong dua thong tin dang nhap vao thong bao loi.
    const lyDo = err && err.name === "TimeoutError" ? "het thoi gian cho" : "khong ket noi duoc";
    throw new Error(`Dang nhap EDUX that bai: ${lyDo} (${API_BASE}).`);
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Dang nhap that bai: phan hoi khong phai JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const chiTiet = data?.detail ?? data?.message ?? "kiem tra lai tai khoan";
    const error = new Error(`Dang nhap EDUX that bai (HTTP ${response.status}): ${chiTiet}`);
    // 401/403: sai thong tin dang nhap. Cac ma khac: loi phia EDUX.
    error.status = response.status === 403 ? 401 : response.status;
    throw error;
  }

  // Node 20+ co getSetCookie(); cac ban cu chi co get("set-cookie").
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookieFrom(setCookies.join("; "));
  if (!cookie) {
    throw new Error("Dang nhap thanh cong nhung server khong tra ve cookie phien.");
  }

  if (options.luu !== false) luuCookie(cookie);
  sessionCookie = cookie;

  return {
    email: data?.email ?? email,
    message: data?.message ?? "Login successful",
    cookie,
  };
}

/**
 * Dang xuat: xoa cookie phien da luu. EDUX khong cong bo endpoint dang xuat
 * trong ma nguon hien co nen chi don trang thai cuc bo.
 */
function logoutEdux() {
  sessionCookie = "";
  if (fs.existsSync(COOKIE_FILE)) fs.rmSync(COOKIE_FILE, { force: true });
  delete process.env.EDUX_COOKIE;
  return true;
}

module.exports = {
  loginEdux,
  logoutEdux,
  layCookie,
  docCookie,
  luuCookie,
  COOKIE_FILE,
  API_BASE,
  ORIGIN,
};
