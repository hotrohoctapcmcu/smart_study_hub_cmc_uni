/**
 * API AI branch test — chạy bằng node, KHÔNG gọi Gemini thật.
 *
 * Dựng HTTP server giả lập Gemini (trang /app + StreamGenerate), trỏ
 * GEMINI_ORIGIN vào đó rồi chạy toàn bộ luồng qua Express thật:
 *
 *   không cần cấu hình key/cookie -> /ai/status ready=true (phiên khách)
 *   thiếu câu hỏi  -> 400
 *   hỏi thành công -> 200 + câu trả lời bóc từ payload Gemini
 *   Gemini lỗi 403 -> 503 cho FE (phiên khách chưa truy cập được)
 *   hội thoại nhiều lượt -> gửi kèm conversationId, giữ cid/rid
 *
 * Chạy: node tests/API/test-ai-api.js (từ thư mục gốc dự án)
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "unistudy-ai-web-"));
process.env.DB_PATH = path.join(testDirectory, "test.db");
process.env.GEMINI_SESSION_DIR = testDirectory;
process.env.GEMINI_API_KEY = "";

const GEMINI_PORT = 4598;
const GEMINI_ORIGIN = `http://127.0.0.1:${GEMINI_PORT}`;

// gemini-client đọc ORIGIN/COOKIES lúc require -> phải set trước khi nạp API.
process.env.GEMINI_ORIGIN = GEMINI_ORIGIN;
// Luồng khách mặc định không dùng key/cookie đăng nhập.
process.env.GEMINI_COOKIES = "";
process.env.GEMINI_TIMEOUT_MS = "5000";

let pass = 0;
let fail = 0;
function ok(cond, msg) {
    if (cond) { pass++; console.log(`  PASS ${msg}`); }
    else { fail++; console.log(`  FAIL ${msg}`); }
}

// ─── Gemini giả lập ──────────────────────────────────────────────────────
const CAU_TRA_LOI = "Đạo hàm mô tả tốc độ thay đổi của hàm số.";
let lanHoi = 0;
let tuChoi = false;
const nhanDuoc = [];

/**
 * Payload StreamGenerate: một dòng JSON dạng mảng chứa item wrb.fr với
 * item[2] là JSON lồng; parser lấy câu trả lời ở p[4][0][1][0] và mã hội
 * thoại ở p[1].
 */
function payloadGemini(text) {
    const item = ["wrb.fr", null, JSON.stringify([null, ["cid-1", "rid-1"], null, null, [["rcid-1", [text]]]])];
    return JSON.stringify([item]) + "\n";
}

const geminiServer = http.createServer((req, res) => {
    const url = new URL(req.url, GEMINI_ORIGIN);

    if (req.method === "GET" && url.pathname === "/app") {
        res.writeHead(200, {
            "Content-Type": "text/html",
            "Set-Cookie": "NID=gia-lap; Path=/"
        });
        return res.end('<script>window.WIZ_global_data={"SNlM0e":"token-gia-lap","cfb2h":"bl-gia-lap","FdrFJe":"fsid-gia-lap"}</script>');
    }

    if (req.method === "POST" && url.pathname.endsWith("/StreamGenerate")) {
        let raw = "";
        req.on("data", (c) => { raw += c; });
        req.on("end", () => {
            lanHoi++;
            const form = new URLSearchParams(raw);
            nhanDuoc.push({
                fReq: form.get("f.req") || "",
                at: form.get("at"),
                query: url.search,
                cookie: req.headers.cookie || ""
            });

            if (tuChoi) {
                res.writeHead(403, { "Content-Type": "text/plain" });
                return res.end("forbidden");
            }

            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(payloadGemini(CAU_TRA_LOI));
        });
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
});

// ─── API thật ────────────────────────────────────────────────────────────
async function main() {
    await new Promise((resolve) => geminiServer.listen(GEMINI_PORT, "127.0.0.1", resolve));

    require("../../API/shared/gemini-client");
    const apiModule = require("../../API/index");
    const apiServer = await apiModule.start();
    const API = `http://127.0.0.1:${apiServer.address().port}/api/v1`;

    const goi = async (method, route, body) => {
        const res = await fetch(`${API}${route}`, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        let json = null;
        try { json = await res.json(); } catch { json = null; }
        return { status: res.status, json };
    };

    try {
        console.log("== AI API BRANCH ==");

        // 1. Trạng thái dịch vụ
        let r = await goi("GET", "/ai/status");
        ok(r.status === 200 && r.json.success === true, "GET /ai/status -> 200 success");
        ok(r.json.data.ready === true, "không cấu hình key/cookie -> ready=true (phiên khách)");
        ok(r.json.data.guest === true, "không có cookie -> dùng phiên khách");
        ok(!JSON.stringify(r.json).includes("gia-lap-phien"), "status không lộ cookie");

        // 2. Thiếu câu hỏi
        r = await goi("POST", "/ai/ask", {});
        ok(r.status === 400, "thiếu question -> 400");
        r = await goi("POST", "/ai/ask", { question: "   " });
        ok(r.status === 400, "question chỉ có khoảng trắng -> 400");
        r = await goi("POST", "/ai/ask", { question: "x".repeat(4001) });
        ok(r.status === 400, "question quá dài -> 400");
        ok(lanHoi === 0, "request không hợp lệ không gọi Gemini");

        // 3. Hỏi thành công (lượt đầu của hội thoại conv-1)
        r = await goi("POST", "/ai/ask", { question: "Đạo hàm là gì?", conversationId: "conv-1" });
        ok(r.status === 200 && r.json.success === true, "POST /ai/ask -> 200 success");
        ok(r.json.data.answer === CAU_TRA_LOI, "bóc đúng câu trả lời từ payload Gemini");
        ok(lanHoi === 1, "gọi Gemini đúng 1 lần");
        ok(!nhanDuoc[0].cookie.includes("__Secure-1PSID"), "phiên khách không gửi cookie đăng nhập");
        ok(nhanDuoc[0].query.includes("bl=bl-gia-lap"), "dùng bl lấy từ trang /app");
        ok(nhanDuoc[0].at === "token-gia-lap", "gửi kèm token at lấy từ trang /app");
        ok(nhanDuoc[0].fReq.includes("Đạo hàm là gì?"), "câu hỏi nằm trong f.req");
        ok(nhanDuoc[0].fReq.includes("Hướng dẫn hệ thống"), "lượt đầu của hội thoại kèm hướng dẫn hệ thống");

        // 4. Lượt sau của cùng hội thoại giữ ngữ cảnh
        r = await goi("POST", "/ai/ask", { question: "Cho ví dụ", conversationId: "conv-1" });
        ok(r.status === 200 && r.json.data.conversationId === "conv-1", "trả lại conversationId");
        const lan2 = nhanDuoc[1].fReq;
        ok(lan2.includes("cid-1") && lan2.includes("rid-1"), "lượt sau gửi kèm cid/rid của lượt trước");
        ok(!lan2.includes("Hướng dẫn hệ thống"), "lượt sau không lặp lại hướng dẫn hệ thống");

        // 5. Gemini từ chối phiên khách -> 503 để FE hiển thị lỗi
        tuChoi = true;
        r = await goi("POST", "/ai/ask", { question: "Câu hỏi khác" });
        ok(r.status === 503, "Gemini trả 403 -> API trả 503");
        ok(r.json.success === false && typeof r.json.message === "string", "lỗi có message cho FE");
        tuChoi = false;

    } finally {
        apiServer.closeAllConnections();
        geminiServer.closeAllConnections();
        await new Promise((resolve) => apiServer.close(resolve));
        await new Promise((resolve) => geminiServer.close(resolve));
        await require("../../database/connection/db").closePool();
        if (!path.resolve(testDirectory).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error("Unsafe test directory");
        fs.rmSync(testDirectory, { recursive: true, force: true });
    }

    console.log(`\n==== AI API BRANCH: ${pass} PASS, ${fail} FAIL ====`);
    process.exitCode = fail ? 1 : 0;
}

main().catch((err) => {
    console.error("LỖI TEST:", err);
    process.exitCode = 1;
});
