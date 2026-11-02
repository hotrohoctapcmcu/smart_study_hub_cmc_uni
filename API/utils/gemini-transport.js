"use strict";

const http = require("http");
const https = require("https");
const { GeminiError } = require("./gemini-error");
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) > 0 ? Number(process.env.GEMINI_TIMEOUT_MS) : 45000;
const MAX_HEADER_SIZE = 1048576;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function request(method, url, { headers = {}, body = null, timeoutMs = TIMEOUT_MS, signal } = {}) {
    timeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Math.min(180000, Math.max(1, Number(timeoutMs))) : 45000;
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const transport = target.protocol === "http:" ? http : https;
        const req = transport.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port || undefined,
            path: `${target.pathname}${target.search}`,
            method,
            headers,
            maxHeaderSize: MAX_HEADER_SIZE,
            signal
        }, res => {
            const chunks = [];
            let bytes = 0;
            res.on("error", error => { clearTimeout(deadline); reject(error); });
            res.on("data", chunk => {
                bytes += chunk.length;
                if (bytes > MAX_RESPONSE_BYTES) {
                    const error = new GeminiError("Phản hồi Gemini quá lớn.", "GEMINI_RESPONSE_SIZE", 502);
                    clearTimeout(deadline);
                    reject(error);
                    req.destroy(error);
                } else chunks.push(chunk);
            });
            res.on("end", () => {
                clearTimeout(deadline);
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: Buffer.concat(chunks).toString("utf8")
                });
            });
        });

        // Deadline tính cả thời gian chờ kết nối và phản hồi nhỏ giọt.
        const deadline = setTimeout(() => {
            const error = new Error("Gemini không phản hồi kịp.");
            error.code = "ETIMEDOUT";
            req.destroy(error);
        }, timeoutMs);
        req.on("error", error => { clearTimeout(deadline); reject(error); });
        if (body) req.write(body);
        req.end();
    });
}

module.exports = { request };
