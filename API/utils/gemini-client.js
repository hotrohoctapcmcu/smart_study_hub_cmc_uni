"use strict";

const fs = require("fs");
const path = require("path");
const { responseFailure } = require("./ai-response");
const { GeminiError } = require("./gemini-error");
const { request } = require("./gemini-transport");
const { parseJson } = require("./gemini-json");
const { normalizeText, characterCount, hasVisibleText } = require('./ai-text');

const AI_IDENTITY =
    "Bạn là Trợ lý AI của ứng dụng học tập CMC. Chỉ sử dụng dữ liệu được cung cấp, không bịa số liệu hoặc sự kiện. Không tự giới thiệu hoặc nhắc tên nhà cung cấp, nền tảng hay tên mô hình AI đang vận hành.";

const WEB_ORIGIN = (process.env.GEMINI_ORIGIN || "https://gemini.google.com").replace(/\/+$/, "");
const WEB_CHAT_URL = `${WEB_ORIGIN}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) > 0
    ? Number(process.env.GEMINI_TIMEOUT_MS)
    : 45000;
const TOKEN_TTL_MS = 5 * 60 * 1000;

const DATA_DIR = process.env.GEMINI_SESSION_DIR
    ? path.resolve(process.env.GEMINI_SESSION_DIR)
    : path.resolve(__dirname, "../../data");

let cookies = {};
let token = null;
let sessionPromise = null;
const webChats = Object.create(null);
const MAX_CONVERSATIONS = 100;
const GUEST_COOKIE_NAMES = new Set(["NID", "AEC", "SOCS", "CONSENT", "COMPASS", "__Secure-ENID"]);
const sessionFile = () => path.join(DATA_DIR, "gemini", "guest-session.json");
const guestCookies = input => Object.fromEntries(Object.entries(input || {})
    .filter(([name, value]) => GUEST_COOKIE_NAMES.has(name) && typeof value === "string"));

function loadCookies() {
    try {
        const saved = JSON.parse(fs.readFileSync(sessionFile(), "utf8"));
        cookies = guestCookies(saved.cookies);
    } catch { /* chưa có phiên đã lưu */ }
}

function saveCookies() {
    try {
        fs.mkdirSync(path.dirname(sessionFile()), { recursive: true });
        fs.writeFileSync(sessionFile(), JSON.stringify({ cookies: guestCookies(cookies), updatedAt: Date.now() }));
    } catch { /* không chặn luồng AI nếu không ghi được file */ }
}

function getStatus() {
    return {
        provider: "gemini",
        ready: true,
        mode: "web-guest",
        authenticated: false,
        guest: true,
        officialApi: false,
        webFallback: false,
        model: "Trợ lý AI",
        message: "Trợ lý AI dùng phiên Gemini chưa đăng nhập."
    };
}

function resetGuestSession() {
    token = null;
    cookies = {};
    for (const id of Object.keys(webChats)) delete webChats[id];
    saveCookies();
}

function webHeaders() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
        "X-Same-Domain": "1",
        Origin: WEB_ORIGIN,
        Referer: `${WEB_ORIGIN}/`,
        Cookie: Object.entries(guestCookies(cookies)).map(([key, value]) => `${key}=${value}`).join("; ")
    };
}

function mapNetworkError(error) {
    if (error instanceof GeminiError) return error;
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') return new GeminiError('Đã hủy yêu cầu AI.', 'AI_CANCELLED', 499);
    if (error?.code === "ETIMEDOUT" || /không phản hồi kịp/i.test(error?.message || "")) {
        return new GeminiError("Gemini không phản hồi kịp.", "GEMINI_TIMEOUT", 504);
    }
    return new GeminiError("Không kết nối được tới Gemini.", "GEMINI_NETWORK", 502);
}

function absorbCookies(values) {
    for (const value of [].concat(values || [])) {
        const [pair] = value.split(";");
        const index = pair.indexOf("=");
        if (index > 0 && GUEST_COOKIE_NAMES.has(pair.slice(0, index))) cookies[pair.slice(0, index)] = pair.slice(index + 1);
    }
    saveCookies();
}

async function ensureWebSession(options = {}) {
    if (options.signal?.aborted) throw new GeminiError('Đã hủy yêu cầu AI.', 'AI_CANCELLED', 499);
    if (token && Date.now() - token.time < TOKEN_TTL_MS) return token;
    // The bootstrap is shared; cancelling one waiter must not cancel others.
    if (!sessionPromise) {
        sessionPromise = openGuestSession({ timeoutMs: options.timeoutMs }).finally(() => { sessionPromise = null; });
    }
    if (!options.signal) return sessionPromise;
    const pending = sessionPromise;
    return new Promise((resolve, reject) => {
        const abort = () => reject(new GeminiError('Đã hủy yêu cầu AI.', 'AI_CANCELLED', 499));
        options.signal.addEventListener('abort', abort, { once: true });
        pending.then(resolve, reject).finally(() => options.signal.removeEventListener('abort', abort));
    });
}

async function openGuestSession(options = {}) {
    let response;
    try {
        response = await request("GET", `${WEB_ORIGIN}/app`, { headers: webHeaders(), ...options });
    } catch (error) {
        throw mapNetworkError(error);
    }
    checkWebStatus(response);

    absorbCookies(response.headers["set-cookie"]);
    const get = key => (response.data.match(new RegExp(`"${key}":"(.*?)"`)) || [])[1] || "";
    const bl = get("cfb2h");
    if (!bl) throw new GeminiError("Chưa mở được phiên Gemini chưa đăng nhập. Vui lòng thử lại sau.", "GEMINI_SESSION", 503);
    return token = {
        at: get("SNlM0e"),
        bl,
        fsid: get("FdrFJe"),
        time: Date.now()
    };
}

function checkWebStatus(response) {
    if ([413, 414].includes(response.status)) throw new GeminiError("Nội dung vượt giới hạn đầu vào hiện tại của AI.", "GEMINI_INPUT_SIZE", 413);
    if (response.status === 429) throw new GeminiError("Gemini đang giới hạn số lượng yêu cầu.", "GEMINI_RATE_LIMIT", 503);
    if ([401, 403].includes(response.status) || (response.status >= 300 && response.status < 400)) {
        throw new GeminiError("Phiên Gemini chưa đăng nhập hiện không truy cập được. Vui lòng thử lại sau.", "GEMINI_GUEST_UNAVAILABLE", 503);
    }
    if (response.status < 200 || response.status >= 400) {
        throw new GeminiError("Gemini đang tạm thời không phản hồi.", "GEMINI_NETWORK", 502);
    }
}

function parseWebResponse(raw) {
    let text = "";
    const ids = { cid: "", rid: "", rcid: "" };
    let found = false;

    for (const line of String(raw).split("\n")) {
        try {
            for (const item of JSON.parse(line.trim())) {
                if (item[0] !== "wrb.fr" || typeof item[2] !== "string") continue;
                const payload = JSON.parse(item[2]);
                found = true;
                if (Array.isArray(payload[1])) [ids.cid, ids.rid] = payload[1];
                const first = (payload[4] || payload[3] || [])[0];
                if (!first) continue;
                ids.rcid = first[0] || ids.rcid;
                const answer = Array.isArray(first[1]) ? first[1][0] : first[1];
                if (typeof answer === "string" && answer.length > text.length) text = answer;
            }
        } catch { /* bỏ dòng không phải JSON */ }
    }

    if (!found || !text) {
        throw new GeminiError("Gemini không trả về nội dung.", "GEMINI_PARSE", 502);
    }
    text = normalizeText(text).trim();
    const failure = responseFailure(text);
    if (failure) throw new GeminiError(failure.message, failure.code, failure.statusCode);
    if (!hasVisibleText(text)) throw new GeminiError('AI trả nội dung rỗng.', 'GEMINI_PARSE', 502);
    return { text, ...ids };
}

async function webAskOnce(prompt, chat, options = {}) {
    const session = await ensureWebSession(options);
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

    let response;
    try {
        response = await request("POST", `${WEB_CHAT_URL}?${query}`, {
            headers: {
                ...webHeaders(),
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString(),
            ...options
        });
    } catch (error) {
        throw mapNetworkError(error);
    }

    absorbCookies(response.headers["set-cookie"]);
    checkWebStatus(response);

    const result = parseWebResponse(response.data);
    if (chat) {
        Object.assign(chat, {
            cid: result.cid || chat.cid,
            rid: result.rid || chat.rid,
            rcid: result.rcid || chat.rcid
        });
    }
    return result.text;
}

function getWebChat(id) {
    if (!id) return null;
    if (!webChats[id] && Object.keys(webChats).length >= MAX_CONVERSATIONS) delete webChats[Object.keys(webChats)[0]];
    return webChats[id] || (webChats[id] = { cid: "", rid: "", rcid: "" });
}

function resetConversation(id) {
    delete webChats[id];
    return true;
}

async function webAsk(question, options = {}) {
    const requestOptions = {
        timeoutMs: Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : TIMEOUT_MS,
        signal: options.signal
    };
    const build = withSystem => [
        withSystem ? `[Hướng dẫn hệ thống]\n${AI_IDENTITY}` : "",
        question.trim()
    ].filter(Boolean).join("\n\n");
    const askOnce = () => {
        const chat = getWebChat(options.conversationId);
        const prompt = build(!chat || !chat.cid);
        if (characterCount(prompt) > (Number(options.maxInputChars) > 0 ? Number(options.maxInputChars) : 120000)) {
            throw new GeminiError("Nội dung cần chia nhỏ trước khi gửi AI.", "GEMINI_INPUT_SIZE", 413);
        }
        return webAskOnce(prompt, chat, requestOptions);
    };

    try {
        return await askOnce();
    } catch (error) {
        if (options.retry === false || options.signal?.aborted) throw error;
        if (!["GEMINI_GUEST_UNAVAILABLE", "GEMINI_PARSE", "GEMINI_SESSION", "GEMINI_NETWORK", "GEMINI_TIMEOUT", "GEMINI_RESPONSE_ERROR"].includes(error.code)) throw error;
        if (["GEMINI_GUEST_UNAVAILABLE", "GEMINI_PARSE", "GEMINI_SESSION"].includes(error.code)) resetGuestSession();
        return askOnce();
    }
}

async function generateText(prompt, options = {}) {
    prompt = typeof prompt === 'string' ? normalizeText(prompt).trim() : '';
    if (!hasVisibleText(prompt)) {
        throw new GeminiError("Nội dung gửi AI không được để trống.", "GEMINI_INPUT", 400);
    }

    return webAsk(prompt, options);
}

async function generateJson(prompt, options = {}) {
    if (typeof prompt !== "string" || !prompt.trim()) throw new GeminiError("Nội dung gửi AI không được để trống.", "GEMINI_INPUT", 400);
    const schemaDescription = options.schemaDescription
        ? `\n\nCấu trúc JSON bắt buộc:\n${options.schemaDescription}`
        : "";
    const jsonInstruction = [
        prompt.trim(),
        schemaDescription,
        "Chỉ trả về một giá trị JSON hợp lệ. Không dùng Markdown, không thêm giải thích ngoài JSON. Không tự tạo dữ liệu còn thiếu."
    ].filter(Boolean).join("\n");

    const checked = raw => {
        const parsed = parseJson(raw);
        if (options.validate && !options.validate(parsed)) {
            throw new GeminiError("AI trả JSON sai cấu trúc yêu cầu.", "GEMINI_SCHEMA", 502);
        }
        return parsed;
    };
    let raw = await generateText(jsonInstruction, { ...options, json: true });
    try {
        return checked(raw);
    } catch (error) {
        if (options.retryMalformed === false || !['GEMINI_JSON', 'GEMINI_SCHEMA'].includes(error.code)) throw error;
        raw = await generateText([
            jsonInstruction,
            "Phản hồi trước không phải JSON hợp lệ. Hãy tạo lại toàn bộ JSON đúng cú pháp."
        ].join("\n\n"), { ...options, json: true });
        return checked(raw);
    }
}

async function ask(question, options = {}) {
    if (typeof question !== "string" || !question.trim()) {
        throw new GeminiError("Vui lòng nhập câu hỏi.", "GEMINI_INPUT", 400);
    }
    return generateText(question.trim(), options);
}

loadCookies();

module.exports = {
    ask,
    generateText,
    generateJson,
    parseJson,
    getStatus,
    resetConversation,
    GeminiError
};
