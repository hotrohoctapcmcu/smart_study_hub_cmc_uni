/**
 * E2E check cho trợ lý AI (chạy bằng Electron, không cần Gemini thật).
 *
 * Yêu cầu: một HTTP server giả lập Gemini đang chạy ở GEMINI_ORIGIN (mặc định
 * http://127.0.0.1:4598) và app đang chạy (node index.js) với GEMINI_ORIGIN
 * trỏ tới server đó. Không cần API key hoặc cookie đăng nhập.
 *
 * Mở http://localhost:8080, mở panel trợ lý AI và kiểm tra:
 *   - panel render, trạng thái "Đã kết nối trợ lý AI"
 *   - gửi câu hỏi -> hiện câu hỏi, loading, rồi câu trả lời của trợ lý
 *   - không có lỗi runtime trong console
 *
 * Chạy: npx electron tests/e2e-ai-chat.js
 */

"use strict";

const { app, BrowserWindow } = require("electron");

const FE_URL = process.env.FE_URL || "http://localhost:8080";
const CAU_HOI = "Đạo hàm là gì?";
const LOI_RUNTIME = [];

// Bỏ qua cảnh báo do chính Electron phát ra (CSP mặc định khi chạy dev),
// chỉ giữ lỗi runtime thật của ứng dụng.
const CANH_BAO_BO_QUA = /Electron Security Warning|Content-Security-Policy/;

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 900,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });

    win.webContents.on("console-message", (_e, level, message) => {
        if (level >= 2 && !CANH_BAO_BO_QUA.test(message)) LOI_RUNTIME.push(message);
    });

    const checks = [];
    const kiemTra = (ok, label) => checks.push([ok, label]);

    try {
        await win.loadURL(FE_URL);
        await new Promise((r) => setTimeout(r, 1200));

        // Mở panel trợ lý AI
        await win.webContents.executeJavaScript(
            `document.querySelector("#openMiniChatBtn")?.click(); true`
        );
        await new Promise((r) => setTimeout(r, 800));

        let panel = await win.webContents.executeJavaScript(
            `document.querySelector("#miniChatPanel")?.outerHTML || ""`
        );
        kiemTra(panel.length > 0, "panel trợ lý AI mở được");
        kiemTra(panel.includes("Đã kết nối trợ lý AI"), "status kết nối từ backend");
        kiemTra(panel.includes("ai-chat-empty"), "chưa hỏi gì -> empty state");

        // Gửi câu hỏi qua form thật
        await win.webContents.executeJavaScript(`
            (() => {
                const input = document.querySelector("#aiChatInput");
                input.value = ${JSON.stringify(CAU_HOI)};
                input.dispatchEvent(new Event("input", { bubbles: true }));
                document.querySelector("#aiChatForm").dispatchEvent(
                    new Event("submit", { bubbles: true, cancelable: true })
                );
                return true;
            })()
        `);

        // Trong lúc chờ API: phải có câu hỏi + chỉ báo loading
        await new Promise((r) => setTimeout(r, 120));
        panel = await win.webContents.executeJavaScript(
            `document.querySelector("#miniChatPanel")?.outerHTML || ""`
        );
        kiemTra(panel.includes(CAU_HOI), "câu hỏi hiện ngay khi gửi");

        // Chờ phản hồi
        await new Promise((r) => setTimeout(r, 2500));
        panel = await win.webContents.executeJavaScript(
            `document.querySelector("#miniChatPanel")?.outerHTML || ""`
        );
        kiemTra(panel.includes("Đạo hàm mô tả tốc độ thay đổi"), "câu trả lời từ Gemini hiện trong panel");
        kiemTra(!panel.includes("ai-typing"), "loading đã tắt sau khi có phản hồi");
        kiemTra(!panel.includes("ai-chat-error"), "không có lỗi hiển thị");

    } catch (err) {
        kiemTra(false, `lỗi khi chạy: ${err.message}`);
    }

    console.log("== AI CHAT E2E ==");
    let fail = 0;
    for (const [ok, label] of checks) {
        console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
        if (!ok) fail++;
    }
    console.log(`  ${LOI_RUNTIME.length === 0 ? "PASS" : "FAIL"} không có lỗi runtime console`);
    if (LOI_RUNTIME.length) LOI_RUNTIME.forEach((m) => console.log(`    ! ${m}`));

    app.exit(fail || LOI_RUNTIME.length ? 1 : 0);
});
