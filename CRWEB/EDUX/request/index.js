"use strict";

/**
 * Goi API EDUX va chuan hoa phan hoi.
 *
 * Moi request deu tu gan cookie phien. Khi gap 401:
 *   - co `options.reLogin`  -> goi ham do de lay cookie moi roi gui lai mot lan;
 *   - khong co             -> nem loi 401 de caller xu ly (het phien).
 *
 * KHONG tu dang nhap bang tai khoan mac dinh: mat khau chi do nguoi dung
 * cung cap tai thoi diem dang nhap.
 */

const { layCookie, API_BASE, ORIGIN } = require("../login");

/**
 * Ghep query string vao route.
 */
function themQuery(route, params) {
  if (!params) return route;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  if (!query) return route;
  return `${route}${route.includes("?") ? "&" : "?"}${query}`;
}

/**
 * Goi mot endpoint EDUX.
 *
 * @param {string} route Duong dan tuong doi tinh tu /api, vd "/subjects/joined".
 * @param {{
 *   method?: string, body?: unknown, params?: object, cookie?: string,
 *   retry?: boolean, reLogin?: () => Promise<{cookie: string}> | Promise<string>,
 * }} [options]
 * @returns {Promise<unknown>} Du lieu JSON da parse cua phan hoi.
 */
async function goiEdux(route, options = {}) {
  const { method = "GET", body, params, retry = true } = options;
  const cookie = options.cookie || layCookie();
  const url = `${API_BASE}${themQuery(route, params)}`;

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
    Cookie: cookie,
  };

  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  // Cookie het han: dang nhap lai mot lan (neu caller cung cap) roi thu lai.
  if (response.status === 401 && retry && typeof options.reLogin === "function") {
    const moi = await options.reLogin();
    const cookieMoi = typeof moi === "string" ? moi : moi && moi.cookie;
    if (!cookieMoi) {
      const error = new Error(`Het phien EDUX khi goi ${route}: khong lay duoc cookie moi.`);
      error.status = 401;
      error.route = route;
      throw error;
    }
    return goiEdux(route, { ...options, cookie: cookieMoi, retry: false });
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Phan hoi khong phai JSON (HTTP ${response.status}) tu ${route}.`);
  }

  if (!response.ok) {
    const error = new Error(
      `HTTP ${response.status} ${method} ${route}: ${data?.detail ?? data?.message ?? "loi khong xac dinh"}`,
    );
    error.status = response.status;
    error.body = data;
    error.route = route;
    throw error;
  }

  return data;
}

/**
 * Thu lan luot cac route, tra ve route dau tien tra du lieu thanh cong.
 * Dung cho cac endpoint chua duoc EDUX cong bo on dinh.
 *
 * @param {string[]} routes
 * @param {object} [options] Tuy chon truyen cho goiEdux.
 * @returns {Promise<{route: string|null, data: unknown, diagnostics: Array<{route: string, status: number|string}>}>}
 */
async function thuLanLuot(routes, options = {}) {
  const diagnostics = [];
  for (const route of routes) {
    try {
      const data = await goiEdux(route, options);
      diagnostics.push({ route, status: 200 });
      return { route, data, diagnostics };
    } catch (error) {
      diagnostics.push({ route, status: error.status ?? "network-error" });
    }
  }
  return { route: null, data: null, diagnostics };
}

module.exports = {
  goiEdux,
  thuLanLuot,
};
