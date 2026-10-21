"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");

const HOST = "https://gemini.google.com";
const API = `${HOST}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;
const TIMEOUT = 45000;
const TTL = 300000;
const transport = {
    request: (options, callback) =>
        https.request({ ...options, maxHeaderSize: 1048576 }, callback)
};

class CookieError extends Error {
    constructor(message, code = "GEMINI_ERROR") {
        super(message);
        this.name = "CookieError";
        this.code = code;
    }
}

let dir, cookies = {}, token;
const chats = {};

const sessionFile = () => path.join(dir || ".", "gemini", "session.json");
const resetConversation = id => (delete chats[id], true);
const getChat = id => id ? (chats[id] ||= { cid: "", rid: "", rcid: "" }) : null;
const isConfigured = () => true;
const isAuthenticated = () => !!cookies["__Secure-1PSID"];

function setDataDir(value) {
    dir = value;
    try {
        cookies = { ...cookies, ...JSON.parse(fs.readFileSync(sessionFile(), "utf8")).cookies };
    } catch { }
}

function saveCookies() {
    if (!dir) return;
    try {
        fs.mkdirSync(path.dirname(sessionFile()), { recursive: true });
        fs.writeFileSync(sessionFile(), JSON.stringify({ cookies, updatedAt: Date.now() }));
    } catch { }
}

function setCookies(input) {
    if (typeof input === "string") {
        const parsed = {};
        for (const line of input.split(/\r?\n/)) {
            const [name, value] = line.split("\t");
            if (name && value) parsed[name.trim()] = value.trim();
        }
        input = Object.keys(parsed).length ? parsed : Object.fromEntries(
            input.split(/;\s*/).map(v => v.split(/=(.*)/s).slice(0, 2)).filter(v => v[0] && v[1] !== undefined)
        );
    }
    cookies = { ...cookies, ...(input || {}) };
    token = null;
    saveCookies();
    return { count: Object.keys(cookies).length, hasRequired: isAuthenticated() };
}

function headers() {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
        "X-Same-Domain": "1",
        Origin: HOST,
        Referer: `${HOST}/`,
        Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
    };
}

function absorbCookies(values) {
    for (const value of [].concat(values || [])) {
        const [pair] = value.split(";");
        const i = pair.indexOf("=");
        if (i > 0) cookies[pair.slice(0, i)] = pair.slice(i + 1);
    }
    saveCookies();
}

async function ensureSession() {
    if (token && Date.now() - token.time < TTL) return token;
    try {
        const r = await axios.get(`${HOST}/app`, {
            timeout: TIMEOUT, transport, headers: headers(),
            transformResponse: [v => v]
        });
        absorbCookies(r.headers["set-cookie"]);
        const get = key => (r.data.match(new RegExp(`"${key}":"(.*?)"`)) || [])[1] || "";
        return token = {
            at: get("SNlM0e"), bl: get("cfb2h") || "boq_assistant-bard-web-server",
            fsid: get("FdrFJe"), time: Date.now()
        };
    } catch (e) {
        throw new CookieError(e.message, "GEMINI_NETWORK");
    }
}

function parseResponse(raw) {
    let text = "", ids = { cid: "", rid: "", rcid: "" }, found = false;
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
        } catch { }
    }

    if (!found || !text) throw new CookieError("Gemini không trả về nội dung.", "GEMINI_PARSE");
    return { text: text.trim(), ...ids };
}

async function askOnce(prompt, chat) {
    const t = await ensureSession();
    const body = new URLSearchParams({
        "f.req": JSON.stringify([null, JSON.stringify([[prompt], null,
        chat ? [chat.cid, chat.rid, chat.rcid] : ["", "", ""]])]),
        at: t.at
    });
    const query = new URLSearchParams({
        bl: t.bl, _reqid: String(Math.floor(Math.random() * 900000) + 100000), rt: "c"
    });
    if (t.fsid) query.set("f.sid", t.fsid);

    try {
        const r = await axios.post(`${API}?${query}`, body.toString(), {
            timeout: TIMEOUT, transport, headers: {
                ...headers(), "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            }, transformResponse: [v => v], validateStatus: s => s < 500
        });
        absorbCookies(r.headers["set-cookie"]);
        if ([401, 403].includes(r.status)) {
            token = null;
            throw new CookieError("Gemini từ chối yêu cầu.", "GEMINI_AUTH");
        }
        const result = parseResponse(r.data);
        if (chat) Object.assign(chat, {
            cid: result.cid || chat.cid,
            rid: result.rid || chat.rid,
            rcid: result.rcid || chat.rcid
        });
        return result.text;
    } catch (e) {
        if (e instanceof CookieError) throw e;
        throw new CookieError(e.message, "GEMINI_NETWORK");
    }
}

async function ask(_cfg, prompt, opts = {}) {
    const chat = getChat(opts.conversationId);
    const build = system => [
        system && opts.system ? `[Hướng dẫn hệ thống]\n${opts.system}` : "",
        String(prompt || "")
    ].filter(Boolean).join("\n\n");

    try {
        return await askOnce(build(!chat || !chat.cid), chat);
    } catch {
        token = null;
        try {
            return await askOnce(build(!chat || !chat.cid), chat);
        } catch (e) {
            if (!chat) throw e;
            resetConversation(opts.conversationId);
            return askOnce(build(true), getChat(opts.conversationId));
        }
    }
}

module.exports = {
    setDataDir, setCookies, isConfigured, isAuthenticated,
    ask, resetConversation, CookieError
};