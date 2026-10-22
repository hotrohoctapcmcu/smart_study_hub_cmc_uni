"use strict";

/**
 * Ham tien ich dung chung cho toan bo module EDUX.
 * Chi chua logic thuan tuy, khong goi API.
 */

// Thuoc tinh cua header Set-Cookie khong phai cap name=value.
const THUOC_TINH_COOKIE = new Set([
  "path", "domain", "expires", "max-age", "samesite", "secure",
  "httponly", "priority", "partitioned",
]);

/**
 * Chuan hoa cookie tho (Cookie header hoac Set-Cookie da luu) thanh chuoi
 * `name=value; name=value` de gui lai cho server.
 */
function cookieFrom(rawCookie) {
  if (!rawCookie) return "";
  const pairs = [];
  const seen = new Set();
  const cleaned = String(rawCookie).replace(/^set-cookie:\s*/gim, "");
  for (const match of cleaned.matchAll(/(?:^|[;,\r\n]\s*)([^=;,\s]+)=([^;,\r\n]*)/g)) {
    const key = match[1].trim();
    if (!key || THUOC_TINH_COOKIE.has(key.toLowerCase()) || seen.has(key)) continue;
    seen.add(key);
    pairs.push(`${key}=${match[2].trim()}`);
  }
  return pairs.join("; ");
}

/**
 * Bo cac lop boc { data: ... } cua API de lay du lieu loi.
 */
function unwrap(value) {
  let result = value;
  while (result && typeof result === "object" && !Array.isArray(result)
    && Object.hasOwn(result, "data")) {
    result = result.data;
  }
  return result;
}

/**
 * Lay mang ban ghi tu phan hoi API. Uu tien cac khoa da biet, sau do tim
 * rong theo chieu sau de chiu duoc cac lop boc khac nhau cua EDUX.
 */
function asList(value, preferredKeys = []) {
  const root = unwrap(value);
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return [];

  const queue = [root];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    for (const key of preferredKeys) {
      if (Array.isArray(current[key])) return current[key];
    }
    for (const child of Object.values(current)) {
      if (child && typeof child === "object" && !Array.isArray(child)) queue.push(child);
    }
  }
  return [];
}

/**
 * Gia tri dau tien khac undefined/null/"" trong danh sach khoa.
 */
function firstValue(object, keys) {
  if (!object || typeof object !== "object") return undefined;
  for (const key of keys) {
    const value = object[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/**
 * Bo HTML va cac thuc the pho bien trong noi dung EDUX tra ve.
 */
function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * EDUX tra thoi gian dang epoch giay (vd 1791794465). Doi sang ISO 8601.
 */
function isoTime(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && Number.isNaN(Number(value))) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Chay worker tren danh sach voi gioi han so viec song song.
 * Giu nguyen thu tu ket qua theo danh sach dau vao.
 */
async function parallel(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

module.exports = {
  cookieFrom,
  unwrap,
  asList,
  firstValue,
  cleanText,
  isoTime,
  parallel,
};
