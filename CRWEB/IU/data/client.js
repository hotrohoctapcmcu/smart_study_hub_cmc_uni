"use strict";

/**
 * client.js — POST 1 endpoint IU + giai ma response (dung chuan portal).
 *
 * NHIEM VU: goiIU(session, cookie, tenEndpoint, patch, cumApi) ->
 *   { ok, status, data, rawLen, message }; layData(resp) -> data tho.
 * KHONG database, KHONG doc/ghi file — chi goi portal truc tiep va tra du lieu
 * moi nhat trong RAM. (Chuyen nguyen ven tu API/goiIU cu, doi require sang
 * ../payload + ../crypto noi bo IU_VT, bo require dong trong vong lap.)
 *
 * QUY TAC DUNG CHUAN PORTAL (portalSrc/loi/Core_systemroot.js makeRequest):
 *  - Gui kem header Authorization: Bearer <tokenJWT> (lay tu edu.system).
 *    Thieu header nay server tra 401 "invalid credentials" du cookie con han.
 *  - Server tra { Success, Data, Pager, Message }; chi khi Data = { B: "<base64>" }
 *    thi moi giai AD(B, request.iM) roi JSON.parse. Data mang/object thuong
 *    (vd dropdown hoc ky) dung truc tiep, KHONG dem di giai base64.
 */

const { buildPayload, setPayload, layUrl } = require("../payload");
const { ma_hoa, giai_ma, giai_ma_request, APIS_KEYS } = require("../crypto");

const REQUEST_TIMEOUT_MS = Number(process.env.IU_REQUEST_TIMEOUT_MS) > 0
    ? Number(process.env.IU_REQUEST_TIMEOUT_MS)
    : 30000;
const MAX_RETRIES = Number.isInteger(Number(process.env.IU_REQUEST_RETRIES))
    && Number(process.env.IU_REQUEST_RETRIES) >= 0
    ? Number(process.env.IU_REQUEST_RETRIES)
    : 2;

function coTheThuLai(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchIU(url, options) {
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            if (!coTheThuLai(res.status) || attempt === MAX_RETRIES) return res;
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        } catch (err) {
            lastError = err;
            if (attempt === MAX_RETRIES) {
                const reason = err && err.name === "AbortError"
                    ? `timeout sau ${REQUEST_TIMEOUT_MS}ms`
                    : (err && err.message) || String(err);
                throw new Error(`Không kết nối được cổng IU: ${reason}`);
            }
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError || new Error("Không kết nối được cổng IU.");
}

async function goiIU(session, cookie, tenEndpoint, patch = {}, cumApi) {
    let p = buildPayload(session, tenEndpoint);
    if (patch && Object.keys(patch).length) p = setPayload(p, patch);
    // Cổng IU (ASP.NET) trả 401 nếu request không giống XHR từ trình duyệt:
    // thiếu Accept/Origin/Referer/X-Requested-With/User-Agent là bị chặn,
    // dù cookie + Bearer token còn hạn. Đã kiểm chứng bằng diag-iu-auth.js:
    // chỉ khi gửi đủ bộ header dưới đây mới nhận 200 (trước đó 10/12 endpoint 401).
    const headers = {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://iu.cmcu.edu.vn",
        Referer: "https://iu.cmcu.edu.vn/congthongtin/Index.aspx",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    };
    if (session && session.tokenJWT) {
        headers.Authorization = "Bearer " + session.tokenJWT;
    }
    const res = await fetchIU(layUrl(p, cumApi), {
        method: "POST",
        headers,
        body: new URLSearchParams({ A: ma_hoa(p) }),
    });
    const text = await res.text();
    let body = null;
    try {
        body = JSON.parse(text);
    } catch {
        body = null; // vd trang 401 HTML
    }
    if (body && typeof body === "object" && body.Data !== undefined && body.Data !== null &&
        typeof body.Data === "object" && !Array.isArray(body.Data) &&
        typeof body.Data.B === "string") {
        // Data ma hoa: giai AD(B, iM cua request) nhu portal.
        // Luu y: Data.B ngan (vd "Gic=" giai ra "[]") khong du dieu kien
        // laBase64 (dai >= 16) nen giai_ma() bo qua — giai truc tiep o day
        // bang p.iM (dung chuan AD(n.Data.B, l.data.iM) cua makeRequest),
        // thu them cac key con lai phong khi phien dung iM khac.
        // Luu y: giai_ma_request() da JSON.parse san (tra ve object/array),
        // KHONG parse lai — chi dung truc tiep, kiem tra undefined chu khong
        // kiem tra null (vi []/0/false la data hop le).
        let data;
        let giaiDuoc = false;
        const keysThu = [p.iM].concat(
            (APIS_KEYS || []).filter((k) => k !== p.iM));
        for (const k of keysThu) {
            if (!k) continue;
            try {
                data = giai_ma_request(body.Data.B, k);
                giaiDuoc = true;
                break;
            } catch {
                giaiDuoc = false;
            }
        }
        if (!giaiDuoc) {
            const blocks = giai_ma(text);
            if (!blocks.length) {
                return { ok: false, status: res.status, data: null, rawLen: text.length, message: `Khong giai duoc Data.B (len=${String(body.Data.B).length}, iM=${p.iM || "?"})` };
            }
            try {
                data = JSON.parse(blocks[0]);
            } catch {
                return { ok: false, status: res.status, data: null, rawLen: text.length, message: "Data.B giai ra khong phai JSON" };
            }
        }
        return { ok: body.Success !== false, status: res.status, data, rawLen: text.length, message: String(body.Message || "") };
    }
    if (body && typeof body === "object" && ("Success" in body || "Data" in body)) {
        // Response JSON thuong (thuong la mang dropdown).
        return { ok: body.Success !== false, status: res.status, data: body.Data !== undefined ? body.Data : body, rawLen: text.length, message: String(body.Message || "") };
    }
    const blocks = giai_ma(text);
    if (!blocks.length) {
        return { ok: false, status: res.status, data: null, rawLen: text.length, message: text.slice(0, 200) };
    }
    try {
        return { ok: true, status: res.status, data: JSON.parse(blocks[0]), rawLen: text.length, message: "" };
    } catch {
        return { ok: false, status: res.status, data: null, rawLen: text.length, message: "Response khong phai JSON" };
    }
}

// Lay Data tu ket qua goiIU (tuong thich nguoc: nhan ca dang cu { Data }
// va mang thang lan dang moi { ok, data }).
function layData(resp) {
    if (resp == null) return null;
    if (typeof resp === "object" && ("ok" in resp || "data" in resp) && ("status" in resp || "rawLen" in resp)) {
        return resp.data !== undefined ? resp.data : null;
    }
    if (Array.isArray(resp)) return resp;
    if (resp.Data !== undefined) return resp.Data;
    return resp;
}

module.exports = { goiIU, layData };
