"use strict";

// Chạy bằng Electron; tái dùng đúng partition IU của ứng dụng, không mở cửa sổ đăng nhập.
// Chỉ in trạng thái phiên/số lượng, không in cookie, token hay thông tin cá nhân.
const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
const { IU_URL, CMC_PARTITION } = require("../../CRWEB/IU/login/constants");
if (!app) {
    console.error("Chạy bằng Electron và bỏ ELECTRON_RUN_AS_NODE khỏi môi trường tiến trình.");
    process.exit(1);
}
app.setPath("userData", path.join(process.env.APPDATA, "hotrohoctap"));
process.env.IU_REQUEST_TIMEOUT_MS = "15000";
process.env.IU_REQUEST_RETRIES = "0";

app.whenReady().then(async () => {
    let win;
    let deadline;
    try {
        const currentSession = session.fromPartition(CMC_PARTITION);
        const cookies = await currentSession.cookies.get({ url: IU_URL });
        if (!cookies.length) {
            console.log(JSON.stringify({ cmcSession: "unavailable", reason: "Không có cookie IU trong phiên cục bộ của ứng dụng." }));
            return;
        }
        win = new BrowserWindow({ show: false, webPreferences: { session: currentSession, contextIsolation: true, nodeIntegration: false, sandbox: true } });
        await Promise.race([
            win.loadURL(IU_URL),
            new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("IU_TIMEOUT")), 20000); })
        ]);
        const authenticated = await win.webContents.executeJavaScript("Boolean(window.edu && window.edu.system && window.edu.system.userId)");
        if (!authenticated) {
            console.log(JSON.stringify({ cmcSession: "unavailable", reason: "Phiên IU cục bộ chưa đăng nhập hoặc đã hết hạn." }));
            return;
        }
        const iu = require("../../CRWEB/IU");
        const identifiers = await iu.laySession(win);
        const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
        const profile = await iu.layHoSoSinhVien(identifiers, cookieHeader);
        console.log(JSON.stringify({ cmcSession: "authenticated", profileRead: Boolean(profile && Object.keys(profile).length) }));
        if (process.argv.includes("--refresh-exams")) {
            const { getExamWindow } = require("../../CRWEB/IU/exam-calendar");
            const range = getExamWindow();
            const exams = await iu.layLichThi(identifiers, cookieHeader);
            require("dotenv").config();
            const db = await require("../../database")();
            try {
                const localProfile = await db.layHoSo(Number(process.env.APP_USER_ID) || 1);
                if (!localProfile || String(profile.ma_sinh_vien) !== String(localProfile.student_code)) {
                    throw new Error("CMC_PROFILE_MISMATCH");
                }
                const { mapSangDataIU } = require("../../API/shared/iu-client");
                const mapped = mapSangDataIU({ IU: { lich_thi: { chi_tiet_lich_thi: exams, fetched: true } } });
                await db.dongBoHoSoIU(localProfile.student_code, {
                    ho_ten: localProfile.full_name, ten_nganh_hoc: localProfile.major,
                    lich_thi: mapped.lich_thi
                });
                console.log(JSON.stringify({ refreshedExams: true, from: range.from, to: range.to, exams: exams.length }));
            } finally { await db.closePool(); }
        }
    } catch (error) {
        console.log(JSON.stringify({ cmcSession: "unavailable", reason: error.code || "Không xác minh được phiên IU cục bộ." }));
    } finally {
        clearTimeout(deadline);
        if (win && !win.isDestroyed()) win.destroy();
        app.quit();
    }
});
