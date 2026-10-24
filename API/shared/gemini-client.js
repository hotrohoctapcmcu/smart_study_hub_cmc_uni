/**
 * API/shared/gemini-client.js
 * ===================================================================================
 * CLIENT GỌI GEMINI CHO MODULE TRỢ LÝ AI
 * ===================================================================================
 * Chuyển từ API/gemini_AI/geminiCookie.js vào hệ thống API hiện có, giữ nguyên
 * luồng: lấy token phiên -> gửi StreamGenerate -> bóc câu trả lời -> lưu cookie mới.
 *
 * - KHÔNG bắt buộc cấu hình: không có cookie thì dùng phiên khách, có cookie thì
 *   dùng phiên đăng nhập. Cookie hỏng/hết hạn tự động rơi về phiên khách.
 * - Cookie phiên đọc từ GEMINI_COOKIES (nếu có) và từ <GEMINI_SESSION_DIR>/gemini/session.json.
 * - Không dùng axios: gọi thẳng http/https để giữ maxHeaderSize lớn (Gemini trả
 *   header Set-Cookie rất dài) và tránh thêm phụ thuộc chưa cài trong dự án.
 * - GeminiError mang sẵn statusCode để errorHandler trả đúng mã HTTP cho FE.
 *   Lỗi xác thực chỉ được trả ra ngoài khi cả phiên cookie và phiên khách đều bị từ chối.
 * ===================================================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const AI_IDENTITY =
    "Bạn là Trợ lý AI của ứng dụng học tập CMC. Không tự giới thiệu hoặc nhắc tên nhà cung cấp, nền tảng hay tên mô hình AI đang vận hành.";

const ORIGIN = (process.env.GEMINI_ORIGIN || "https://gemini.google.com").replace(/\/+$/, "");
const CHAT_URL = `${ORIGIN}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) > 0
    ? Number(process.env.GEMINI_TIMEOUT_MS)
    : 45000;
const TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_HEADER_SIZE = 1048576;

const DATA_DIR = process.env.GEMINI_SESSION_DIR
    ? path.resolve(process.env.GEMINI_SESSION_DIR)
    : path.resolve(__dirname, "../../data");

class GeminiError extends Error {
    constructor(message, code = "GEMINI_ERROR", statusCode = 502) {
        super(message);
        this.name = "GeminiError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

let cookies = {};
let token = null;
const chats = {};

// Phiên khách: dùng được ngay mà không cần cấu hình gì. Cookie (nếu có) chỉ là
// tuỳ chọn — khi cookie hết hạn/hỏng, client tự chuyển sang phiên khách thay vì
// báo "chưa được cấu hình" và khoá khung chat.
let guestMode = false;
// Cookie nạp từ biến môi trường không xoá được khỏi process.env; cờ này để
// ensureSession() không nạp lại cookie đã bị đánh giá là hết hạn.
let envCookiesEnabled = true;

const sessionFile = () => path.join(DATA_DIR, "gemini", "session.json");
const isAuthenticated = () => !guestMode && !!cookies["__Secure-1PSID"];

function parseCookies(input) {
    if (typeof input !== "string") return { ...(input || {}) };

    const parsed = {};
    for (const line of input.split(/\r?\n/)) {
        const [name, value] = line.split("\t");
        if (name && value) parsed[name.trim()] = value.trim();
    }
    if (Object.keys(parsed).length) return parsed;

    return Object.fromEntries(
        input.split(/;\s*/)
            .map(v => v.split(/=(.*)/s).slice(0, 2))
            .filter(v => v[0] && v[1] !== undefined)
    );
}

function loadCookies() {
    try {
        const saved = JSON.parse(fs.readFileSync(sessionFile(), "utf8"));
        cookies = { ...cookies, ...(saved.cookies || {}) };
    } catch { /* chưa có phiên đã lưu */ }

    // Cookie từ biến môi trường ưu tiên hơn file, nhưng KHÔNG ghi ngược ra đĩa.
    if (envCookiesEnabled && process.env.GEMINI_COOKIES) {
        cookies = { ...cookies, ...parseCookies(process.env.GEMINI_COOKIES) };
    }
}

function saveCookies() {
    // Cookie nạp từ biến môi trường là bí mật của máy chủ: không ghi ngược ra đĩa.
    if (envCookiesEnabled && process.env.GEMINI_COOKIES) return;
    try {
        fs.mkdirSync(path.dirname(sessionFile()), { recursive: true });
        fs.writeFileSync(sessionFile(), JSON.stringify({ cookies, updatedAt: Date.now() }));
    } catch { /* không chặn luồng hỏi đáp nếu không ghi được file */ }
}

function getStatus() {
    const authenticated = isAuthenticated();
    return {
        provider: "gemini",
        // Luôn sẵn sàng: có cookie phiên thì dùng phiên đó, không có thì dùng
        // phiên khách. Nhờ vậy mở app là chat được ngay, không cần cấu hình.
        ready: true,
        authenticated,
        guest: !authenticated,
        model: "Trợ lý AI",
        message: "Trợ lý AI sẵn sàng."
    };
}

/**
 * Chuyển sang phiên khách khi cookie hiện tại hết hạn hoặc bị từ chối.
 * Xoá cookie phiên để lần gọi sau không gửi lại cookie chết.
 */
function chuyenSangPhienKhach() {
    guestMode = true;
    token = null;
    for (const name of Object.keys(cookies)) {
        if (/SID/i.test(name)) delete cookies[name];
    }
    // Cookie env không xoá được khỏi process.env → tắt hẳn nguồn đó trong phiên này.
    if (process.env.GEMINI_COOKIES) envCookiesEnabled = false;
    saveCookies();
}

function headers() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
        "X-Same-Domain": "1",
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
    };
}

/**
 * Gọi HTTP thô, trả body dạng text (Gemini trả nhiều dòng JSON, không phải JSON hợp lệ).
 */
function request(method, url, {
    headers: extraHeaders = {},
    body = null,
    timeoutMs = TIMEOUT_MS,
    signal
} = {}) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const transport = target.protocol === "http:" ? http : https;

        const req = transport.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port || undefined,
            path: `${target.pathname}${target.search}`,
            method,
            headers: extraHeaders,
            maxHeaderSize: MAX_HEADER_SIZE,
            signal
        }, res => {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => resolve({
                status: res.statusCode,
                headers: res.headers,
                data: Buffer.concat(chunks).toString("utf8")
            }));
        });

        req.setTimeout(timeoutMs, () => req.destroy(new Error("Gemini không phản hồi kịp.")));
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

function absorbCookies(values) {
    for (const value of [].concat(values || [])) {
        const [pair] = value.split(";");
        const i = pair.indexOf("=");
        if (i > 0) cookies[pair.slice(0, i)] = pair.slice(i + 1);
    }
    saveCookies();
}

async function ensureSession(timeoutMs = TIMEOUT_MS, signal) {
    if (token && Date.now() - token.time < TOKEN_TTL_MS) return token;

    let res;
    try {
        res = await request("GET", `${ORIGIN}/app`, { headers: headers(), timeoutMs, signal });
    } catch (err) {
        throw new GeminiError(err.message, "GEMINI_NETWORK");
    }
    if (res.status >= 400) {
        throw new GeminiError("Không mở được phiên Gemini.", "GEMINI_NETWORK");
    }

    absorbCookies(res.headers["set-cookie"]);
    const get = key => (res.data.match(new RegExp(`"${key}":"(.*?)"`)) || [])[1] || "";

    return token = {
        at: get("SNlM0e"),
        bl: get("cfb2h") || "boq_assistant-bard-web-server",
        fsid: get("FdrFJe"),
        time: Date.now()
    };
}

function parseResponse(raw) {
    let text = "";
    const ids = { cid: "", rid: "", rcid: "" };
    let found = false;

    const deep = (v, d = 0) => d > 8 ? "" : typeof v === "string" ? v :
        Array.isArray(v) ? v.map(x => deep(x, d + 1)).sort((a, b) => b.length - a.length)[0] || "" : "";

    for (const line of String(raw).split("\n")) {
        try {
            for (const item of JSON.parse(line.trim())) {
                if (item[0] !== "wrb.fr" || typeof item[2] !== "string") continue;
                const p = JSON.parse(item[2]);
                found = true;
                if (Array.isArray(p[1])) [ids.cid, ids.rid] = p[1];
                const first = (p[4] || p[3] || [])[0];
                if (!first) continue;
                ids.rcid = first[0] || ids.rcid;
                const answer = Array.isArray(first[1]) ? first[1][0] : first[1];
                if ((answer || deep(first)).length > text.length) text = answer || deep(first);
            }
        } catch { /* bỏ dòng không phải JSON */ }
    }

    if (!found || !text) throw new GeminiError("Gemini không trả về nội dung.", "GEMINI_PARSE");
    return { text: text.trim(), ...ids };
}

async function askOnce(prompt, chat, timeoutMs = TIMEOUT_MS, signal) {
    const session = await ensureSession(timeoutMs, signal);
    const body = new URLSearchParams({
        "f.req": JSON.stringify([null, JSON.stringify([[prompt], null,
        chat ? [chat.cid, chat.rid, chat.rcid] : ["", "", ""]])]),
        at: session.at
    });
    const query = new URLSearchParams({
        bl: session.bl,
        _reqid: String(Math.floor(Math.random() * 900000) + 100000),
        rt: "c"
    });
    if (session.fsid) query.set("f.sid", session.fsid);

    let res;
    try {
        res = await request("POST", `${CHAT_URL}?${query}`, {
            headers: {
                ...headers(),
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString(),
            timeoutMs,
            signal
        });
    } catch (err) {
        throw new GeminiError(err.message, "GEMINI_NETWORK");
    }

    absorbCookies(res.headers["set-cookie"]);

    if ([401, 403].includes(res.status)) {
        token = null;
        throw new GeminiError("Gemini từ chối yêu cầu.", "GEMINI_AUTH", 401);
    }
    if (res.status >= 500) {
        throw new GeminiError("Gemini đang tạm thời không phản hồi.", "GEMINI_NETWORK");
    }

    const result = parseResponse(res.data);
    if (chat) {
        Object.assign(chat, {
            cid: result.cid || chat.cid,
            rid: result.rid || chat.rid,
            rcid: result.rcid || chat.rcid
        });
    }
    return result.text;
}

function getChat(id) {
    if (!id) return null;
    return chats[id] || (chats[id] = { cid: "", rid: "", rcid: "" });
}

function resetConversation(id) {
    delete chats[id];
    return true;
}

/**
 * Hỏi trợ lý AI. `conversationId` giữ ngữ cảnh nhiều lượt trong RAM.
 * @param {string} question
 * @param {{ conversationId?: string, timeoutMs?: number, retry?: boolean, signal?: AbortSignal }} [opts]
 * @returns {Promise<string>} câu trả lời dạng text
 */
async function ask(question, opts = {}) {
    if (typeof question !== "string" || !question.trim()) {
        throw new GeminiError("Vui lòng nhập câu hỏi.", "GEMINI_INPUT", 400);
    }

    const chat = getChat(opts.conversationId);
    const build = withSystem => [
        withSystem ? `[Hướng dẫn hệ thống]\n${AI_IDENTITY}` : "",
        question.trim()
    ].filter(Boolean).join("\n\n");

    // Luôn chat được, không đòi cấu hình: nếu cookie phiên hỏng/hết hạn thì
    // chuyển sang phiên khách rồi hỏi lại; chỉ báo lỗi khi cả hai đều thất bại.
    const timeoutMs = Number.isFinite(Number(opts.timeoutMs)) && Number(opts.timeoutMs) > 0
        ? Number(opts.timeoutMs)
        : TIMEOUT_MS;
    const hoiMotLan = () => askOnce(build(!chat || !chat.cid), chat, timeoutMs, opts.signal);

    // Gemini từ chối cả phiên cookie lẫn phiên khách → báo "đang bận" cho người
    // dùng thay vì câu "chưa được cấu hình" (không còn đúng nữa). Giữ 401 để FE
    // và test API phân biệt được với lỗi mạng.
    const loiChoNguoiDung = err => err.code === "GEMINI_AUTH"
        ? new GeminiError(
            "Trợ lý AI đang bận. Vui lòng thử lại sau ít phút.",
            "GEMINI_AUTH",
            401
        )
        : err;

    try {
        return await hoiMotLan();
    } catch (err) {
        token = null;

        if (opts.retry === false) throw loiChoNguoiDung(err);

        // Cookie hỏng/hết hạn → bỏ cookie phiên, dùng phiên khách ngay.
        if (!guestMode && (err.code === "GEMINI_AUTH" || err.code === "GEMINI_PARSE")) {
            chuyenSangPhienKhach();
        }

        try {
            return await hoiMotLan();
        } catch (lan2) {
            if (!chat) throw loiChoNguoiDung(lan2);

            // Hội thoại cũ có thể đã mất ngữ cảnh phía Gemini → mở hội thoại mới.
            resetConversation(opts.conversationId);
            try {
                return await askOnce(build(true), getChat(opts.conversationId), timeoutMs, opts.signal);
            } catch (lan3) {
                throw loiChoNguoiDung(lan3);
            }
        }
    }
}


loadCookies();

module.exports = {
    ask,
    getStatus,
    GeminiError
};
