"use strict";

const { IU_ORIGIN, STUDENT_PATH, STUDENT_API_URL } = require("../login/constants");
const { fetchIU } = require("./client");

function portalError(message, statusCode = 502) {
    return Object.assign(new Error(message), { statusCode });
}

function expiredSession() {
    return Object.assign(portalError("Phiên IU đã hết hạn. Hãy đăng nhập IU lại.", 401), { code: "SESSION_EXPIRED" });
}

async function readPortal(url, cookie, accept) {
    const parsed = new URL(url);
    if (parsed.origin !== IU_ORIGIN) throw portalError("Địa chỉ cổng sinh viên IU không hợp lệ.");
    if (!cookie) throw expiredSession();
    const { res, text } = await fetchIU(parsed, {
        method: "GET", redirect: "manual", headers: { Accept: accept, Cookie: cookie },
    });
    const location = res.headers.get("location");
    if (location && res.status >= 300 && res.status < 400) {
        const destination = new URL(location, parsed);
        if (destination.pathname.startsWith("/sinhvien/login/") || destination.hostname === "login.microsoftonline.com") {
            throw expiredSession();
        }
    }
    if ([401, 403].includes(res.status)) throw expiredSession();
    if (!res.ok) throw portalError(`Cổng sinh viên IU trả HTTP ${res.status}.`);
    return text;
}

async function readJson(cookie, endpoint, query) {
    const url = new URL(endpoint, STUDENT_API_URL);
    url.search = new URLSearchParams(query).toString();
    const text = await readPortal(url, cookie, "application/json");
    let result;
    try { result = JSON.parse(text); }
    catch { throw portalError("Cổng sinh viên IU trả dữ liệu khác JSON."); }
    if (result?.success !== true) throw portalError("Cổng sinh viên IU chưa xác nhận lấy dữ liệu thành công.");
    return result;
}

// Next.js gửi props trong các dòng JSON, đôi khi chia một dòng thành nhiều
// script. Ghép các đoạn trước khi parse và chỉ đọc props của trang cần dùng.
function pageProps(html, requiredKeys) {
    const segments = html.matchAll(/self\.__next_f\.push\(\s*(\[1\s*,\s*"(?:[^"\\]|\\.)*"\])\s*\)/g);
    const parts = [];
    for (const match of segments) {
        try { parts.push(JSON.parse(match[1])[1]); }
        catch { throw portalError("Không đọc được dữ liệu trang cổng sinh viên IU."); }
    }
    const payload = parts.join("");
    for (const line of payload.split("\n")) {
        const separator = line.indexOf(":");
        const value = line.slice(separator + 1);
        if (separator < 0 || !["[", "{"].includes(value[0])) continue;
        let root;
        try { root = JSON.parse(value); } catch { continue; }
        const pending = [root];
        while (pending.length) {
            const candidate = pending.pop();
            if (!candidate || typeof candidate !== "object") continue;
            if (!Array.isArray(candidate) && requiredKeys.every(key => Object.hasOwn(candidate, key))) {
                return candidate;
            }
            pending.push(...Object.values(candidate));
        }
    }
    throw portalError("Không đọc được dữ liệu trang cổng sinh viên IU.");
}

async function readPage(cookie, endpoint, requiredKeys) {
    const html = await readPortal(IU_ORIGIN + STUDENT_PATH + "/" + endpoint, cookie, "text/html");
    return pageProps(html, requiredKeys);
}

async function queryInBatches(values, read) {
    const rows = [];
    for (let index = 0; index < values.length; index += 3) {
        const batch = await Promise.allSettled(values.slice(index, index + 3).map(read));
        const failures = batch.filter(result => result.status === "rejected");
        if (failures.length) {
            throw (failures.find(result => result.reason?.code === "SESSION_EXPIRED") || failures[0]).reason;
        }
        rows.push(...batch.flatMap(result => result.value));
    }
    return rows;
}

module.exports = { portalError, readJson, readPage, pageProps, queryInBatches };
