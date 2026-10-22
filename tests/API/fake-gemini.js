/**
 * Server Gemini giả lập để chạy E2E cho trợ lý AI (không gọi Gemini thật).
 *
 *   node tests/API/fake-gemini.js
 *
 * Trả trang /app có token + payload StreamGenerate chứa câu trả lời cố định,
 * để API thật (với GEMINI_ORIGIN trỏ vào đây) đi hết luồng hỏi đáp.
 */

"use strict";

const http = require("http");

const PORT = Number(process.env.FAKE_GEMINI_PORT) || 4598;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const CAU_TRA_LOI = "Đạo hàm mô tả tốc độ thay đổi của hàm số tại một điểm.";

function payloadGemini(text) {
    const item = ["wrb.fr", null, JSON.stringify([null, ["cid-1", "rid-1"], null, null, [["rcid-1", [text]]]])];
    return JSON.stringify([item]) + "\n";
}

http.createServer((req, res) => {
    const url = new URL(req.url, ORIGIN);

    if (req.method === "GET" && url.pathname === "/app") {
        res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "NID=gia-lap; Path=/" });
        return res.end('<script>window.WIZ_global_data={"SNlM0e":"token-gia-lap","cfb2h":"bl-gia-lap","FdrFJe":"fsid-gia-lap"}</script>');
    }

    if (req.method === "POST" && url.pathname.endsWith("/StreamGenerate")) {
        req.resume();
        req.on("end", () => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end(payloadGemini(CAU_TRA_LOI));
        });
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
}).listen(PORT, "127.0.0.1", () => {
    console.log(`[Fake Gemini] ${ORIGIN}`);
});
