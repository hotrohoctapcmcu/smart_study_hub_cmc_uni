"use strict";

const store = require("./store");
const geminiCookie = require("./geminiCookie");

const AI_IDENTITY =
    "Bạn là Trợ lý AI của ứng dụng học tập CMC. Không tự giới thiệu hoặc nhắc tên nhà cung cấp, nền tảng hay tên mô hình AI đang vận hành.";

function setDataDir(dir) {
    geminiCookie.setDataDir(dir);
}

function status() {
    const settings = store.getSettings();
    const provider = settings.ai?.provider || "cookie";

    if (provider !== "cookie") {
        return {
            provider,
            ready: false,
            model: "Trợ lý AI",
        };
    }

    const authenticated = geminiCookie.isAuthenticated();

    return {
        provider: "cookie",
        ready: true,
        guest: !authenticated,
        model: "Trợ lý AI",
    };
}

async function ask(prompt, opts = {}) {
    if (typeof prompt !== "string" || !prompt.trim()) {
        throw new Error("Vui lòng nhập câu hỏi.");
    }

    const settings = store.getSettings();
    const provider = settings.ai?.provider || "cookie";

    if (provider !== "cookie") {
        throw new Error("Provider AI chưa được hỗ trợ.");
    }

    return geminiCookie.ask(null, prompt.trim(), {
        ...opts,
        system: opts.system
            ? `${AI_IDENTITY}\n${opts.system}`
            : AI_IDENTITY,
    });
}

module.exports = {
    setDataDir,
    status,
    ask,
};