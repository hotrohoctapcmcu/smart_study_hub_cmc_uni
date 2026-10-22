/**
 * E2E render check cho nhánh EDUX (chạy bằng Electron, không cần cấu hình).
 *
 * Mở app thật ở http://localhost:8080?route=sync, kiểm tra:
 *   - trang Đồng bộ render được card IU + EduX và form đăng nhập EduX
 *   - gửi form sai mật khẩu -> hiện thông báo lỗi, KHÔNG lộ mật khẩu
 *   - không có lỗi runtime trong console
 *
 * Chạy: npx electron tests/e2e-edux-render.js  (cần `node index.js` đang chạy)
 */

"use strict";

const { app, BrowserWindow } = require("electron");

const FE_URL = process.env.FE_URL || "http://localhost:8080";
const LOI_RUNTIME = [];

function thoat(code, message) {
    if (message) console.log(message);
    app.exit(code);
}

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

    try {
        await win.loadURL(`${FE_URL}/?route=sync`);
        // Chờ shell + sync view mount xong.
        await new Promise((r) => setTimeout(r, 1500));

        const html = await win.webContents.executeJavaScript(
            `document.querySelector("#workspaceContentPane")?.innerHTML || ""`
        );

        const checks = [
            [html.includes("Đồng bộ dữ liệu học tập"), "trang Đồng bộ render"],
            [html.includes("Hệ thống Quản lý Đào tạo (IU)"), "có card IU"],
            [html.includes("EduX CMC"), "có card EduX"],
            [html.includes('id="eduxLoginForm"'), "có form đăng nhập EduX"],
            [html.includes('id="eduxPasswordInput"'), "có ô mật khẩu"],
            [html.includes("Chưa kết nối"), "hiện trạng thái chưa kết nối"]
        ];

        let fail = 0;
        console.log("== EDUX E2E RENDER ==");
        for (const [ok, label] of checks) {
            console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
            if (!ok) fail++;
        }

        // Gửi form với mật khẩu sai -> phải hiện lỗi và không lộ mật khẩu.
        await win.webContents.executeJavaScript(`
            (() => {
                const form = document.querySelector("#eduxLoginForm");
                form.querySelector("#eduxEmailInput").value = "khong-ton-tai@st.cmcu.edu.vn";
                form.querySelector("#eduxPasswordInput").value = "mat-khau-sai-123";
                form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                return true;
            })()
        `);
        await new Promise((r) => setTimeout(r, 6000));

        const sauKhiGui = await win.webContents.executeJavaScript(
            `document.querySelector("#workspaceContentPane")?.innerHTML || ""`
        );
        const coLoi = /Đồng bộ EduX thất bại|Đăng nhập EduX thất bại/i.test(sauKhiGui);
        const loMatKhau = sauKhiGui.includes("mat-khau-sai-123");
        const conODangNhap = sauKhiGui.includes('id="eduxLoginForm"');
        const giuEmail = sauKhiGui.includes("khong-ton-tai@st.cmcu.edu.vn");

        for (const [ok, label] of [
            [coLoi, "đăng nhập sai -> hiện thông báo lỗi"],
            [!loMatKhau, "mật khẩu không bị render lại vào HTML"],
            [conODangNhap, "vẫn ở form đăng nhập để thử lại"],
            [giuEmail, "giữ email đã nhập để thử lại"]
        ]) {
            console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
            if (!ok) fail++;
        }

        // Không có lỗi runtime (bỏ qua log mạng 4xx dự kiến).
        // Bỏ qua cảnh báo CSP có sẵn của Electron (không liên quan thay đổi này)
        // và log mạng 4xx dự kiến khi cố tình đăng nhập sai.
        const loiThat = LOI_RUNTIME.filter(
            (m) => !/API Request Error|Failed to load resource|401|400|Electron Security Warning|Content-Security-Policy/i.test(m)
        );
        console.log(`  ${loiThat.length === 0 ? "PASS" : "FAIL"} không có lỗi runtime (${loiThat.length})`);
        if (loiThat.length) {
            loiThat.slice(0, 5).forEach((m) => console.log("    >", m));
            fail++;
        }

        console.log(`\n==== EDUX E2E: ${fail === 0 ? "ALL PASS" : `${fail} FAIL`} ====`);
        thoat(fail ? 1 : 0);
    } catch (err) {
        console.error("LỖI E2E:", err);
        thoat(1);
    }
});
