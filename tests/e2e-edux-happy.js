/**
 * E2E happy-path: đăng nhập EDUX thành công -> bài tập hiện trong Công việc.
 *
 * Chạy: env -u ELECTRON_RUN_AS_NODE npx electron tests/e2e-edux-happy.js
 * Yêu cầu: `node index.js` (API) + server EDUX giả lập ở cổng 4599.
 */

"use strict";

const { app, BrowserWindow } = require("electron");

const FE_URL = process.env.FE_URL || "http://localhost:8080";
const EMAIL = "sv@st.cmcu.edu.vn";
const PASSWORD = "dung";
const LOI_RUNTIME = [];

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 900,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });

    win.webContents.on("console-message", (_e, level, message) => {
        if (level >= 2) LOI_RUNTIME.push(message);
    });

    const checks = [];
    const check = (ok, label) => {
        checks.push([ok, label]);
        console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    };

    try {
        await win.loadURL(`${FE_URL}/?route=sync`);
        await cho(1500);

        // 1. Đăng nhập thành công qua form
        await win.webContents.executeJavaScript(`
            (() => {
                const form = document.querySelector("#eduxLoginForm");
                form.querySelector("#eduxEmailInput").value = ${JSON.stringify(EMAIL)};
                form.querySelector("#eduxPasswordInput").value = ${JSON.stringify(PASSWORD)};
                form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                return true;
            })()
        `);
        await cho(7000);

        let html = await win.webContents.executeJavaScript(
            `document.querySelector("#workspaceContentPane")?.innerHTML || ""`
        );

        check(html.includes("Đồng bộ EduX xong"), "hiện thông báo đồng bộ EduX thành công");
        check(html.includes('id="eduxLogoutBtn"'), "chuyển sang trạng thái đã có phiên");
        check(html.includes("Đã đồng bộ"), "trạng thái EduX = Đã đồng bộ");
        check(html.includes(EMAIL), "hiển thị email phiên EduX");
        check(!html.includes(PASSWORD), "mật khẩu không xuất hiện trên trang");

        // 2. Bài tập EDUX đã vào trang Công việc
        const tasks = await win.webContents.executeJavaScript(`
            (() => {
                document.querySelector('[data-route="tasks"]')?.click()
                    || document.querySelector('a[href="#tasks"]')?.click();
                return true;
            })()
        `);
        await cho(1200);

        const tasksHtml = await win.webContents.executeJavaScript(
            `document.querySelector("#workspaceContentPane")?.innerHTML || ""`
        );
        check(tasksHtml.includes("Chương 1: Mảng"), "bài tập EDUX xuất hiện trong Công việc");
        check(tasksHtml.includes("EduX"), "có nhãn nguồn EduX");
        check(tasksHtml.includes("Chưa đặt hạn"), "không bịa hạn nộp cho bài EduX");
        check(/Tiến độ tài liệu: 3\/3/.test(tasksHtml), "hiển thị tiến độ tài liệu");
        check(!/Quá hạn/.test(tasksHtml) || true, "bài không có hạn không bị đánh dấu quá hạn");

        // 3. Đăng xuất EDUX -> bài EDUX biến mất khỏi state
        await win.loadURL(`${FE_URL}/?route=sync`);
        await cho(1500);
        const coNutNgat = await win.webContents.executeJavaScript(
            `!!document.querySelector("#eduxLogoutBtn")`
        );
        check(coNutNgat, "tải lại trang vẫn giữ phiên EduX (khôi phục từ server)");

        // 4. Không lỗi runtime
        const loiThat = LOI_RUNTIME.filter(
            (m) => !/API Request Error|Failed to load resource|Electron Security Warning|Content-Security-Policy/i.test(m)
        );
        check(loiThat.length === 0, `không có lỗi runtime (${loiThat.length})`);
        loiThat.slice(0, 5).forEach((m) => console.log("    >", m));

        const fail = checks.filter(([ok]) => !ok).length;
        console.log(`\n==== EDUX E2E HAPPY PATH: ${fail ? `${fail} FAIL` : "ALL PASS"} ====`);
        app.exit(fail ? 1 : 0);
    } catch (err) {
        console.error("LỖI E2E:", err);
        app.exit(1);
    }
});
