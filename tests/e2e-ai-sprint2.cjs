"use strict";

// Giao diện thật + Gemini khách thật + bản sao dữ liệu CMC đã đồng bộ.
// BrowserWindow và storage được cách ly, không sửa lịch/ghi chú của người dùng.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
require("dotenv").config();
if (!app) throw new Error("Cần chạy bằng Electron, bỏ ELECTRON_RUN_AS_NODE khỏi môi trường.");
const root = path.resolve(__dirname, "..");
const source = path.resolve(process.env.DB_PATH || path.join(root, "data/unistudy.db"));
const original = fs.readFileSync(source);
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "unistudy-ai-e2e-"));
process.env.DB_PATH = path.join(directory, "snapshot.db");
process.env.GEMINI_SESSION_DIR = directory;
fs.writeFileSync(process.env.DB_PATH, original);
app.setPath("userData", path.join(directory, "browser"));

app.whenReady().then(async () => {
    let db;
    let server;
    let win;
    let stage = "boot";
    const report = { testedAt: new Date().toISOString(), mode: "web-guest", checks: [], passed: false };
    const mark = label => { report.checks.push({ label, passed: true }); console.log(JSON.stringify({ label, passed: true })); };
    try {
        db = await require("../database")();
        assert.ok(await db.layHoSo(1), "Cần hồ sơ CMC đã đồng bộ");
        const assignments = await db.layBaiTapEDUX(1);
        const subject = assignments.find(item => item.subject)?.subject;
        assert.ok(subject, "Cần môn học EDUX thật");
        const express = require("express");
        const api = express();
        api.use(express.json());
        const { setDbForAll, registerModules } = require("../API/modules");
        setDbForAll(db);
        registerModules(api, "/api/v1");
        api.get("/src/shared/config/app.config.js", (req, res) => {
            const config = fs.readFileSync(path.join(root, "Frontend/src/shared/config/app.config.js"), "utf8");
            res.type("application/javascript").send(config.replace("http://localhost:3001", `http://127.0.0.1:${server.address().port}`));
        });
        api.use(express.static(path.join(root, "Frontend")));
        server = api.listen(0, "127.0.0.1");
        await new Promise(resolve => server.once("listening", resolve));
        win = new BrowserWindow({ show: false, width: 1380, height: 900,
            webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
        const evaluate = code => win.webContents.executeJavaScript(code);
        const waitFor = async (code, timeout = 180000) => {
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
                if (await evaluate(code)) return;
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            throw new Error(`Timeout ở bước ${stage}`);
        };
        const navigate = route => evaluate(`import('/src/app/workspace.js').then(module => { module.changeCurrentTabRoute(${JSON.stringify(route)}); return true; })`);
        await win.loadURL(`http://127.0.0.1:${server.address().port}/?route=study-planner`);
        await waitFor("import('/src/app/state.js').then(({state}) => Boolean(state.studentProfile?.studentId && state.schoolEvents.length && state.tasks.length))", 20000);
        mark("ui-loads-synced-cmc-profile-schedule-and-edux");
        stage = "plan-preview";
        await evaluate(`(() => {
            const form = document.querySelector('#studyPlannerForm');
            form.elements.subject.value = ${JSON.stringify(subject)};
            form.elements.targetHours.value = '2';
            form.requestSubmit();
            return true;
        })()`);
        await waitFor("import('/src/app/state.js').then(({state}) => state.studyPlans.length > 0 || Boolean(document.querySelector('#plannerAlertBox')?.textContent.trim()))");
        const preview = await evaluate("import('/src/app/state.js').then(({state}) => state.studyPlans[0] ? { sessions: state.studyPlans[0].sessions.length, persisted: state.studyPlans[0].persisted } : null)");
        assert.ok(preview?.sessions > 0, "Giao diện chưa có preview hợp lệ");
        assert.equal(preview.persisted, false);
        assert.equal((await db.layLichTuHoc(1)).length, 0);
        mark("ui-preview-does-not-save-schedules");
        stage = "confirm";
        await evaluate("document.querySelector('[data-confirm-plan-id]').click(); true");
        await waitFor("import('/src/app/state.js').then(({state}) => Boolean(state.studyPlans[0]?.persisted && state.studyEvents.length))");
        const saved = await db.layLichTuHoc(1);
        assert.equal(saved.length, preview.sessions);
        assert.ok(saved.every(row => row.is_ai_suggested === 1));
        mark("ui-confirm-saves-real-database-snapshot");
        stage = "reload";
        await win.loadURL(`http://127.0.0.1:${server.address().port}/?route=schedule`);
        await waitFor(`import('/src/app/state.js').then(({state}) => state.studyEvents.length === ${saved.length})`, 20000);
        mark("ui-reload-restores-confirmed-schedules");
        stage = "note";
        await navigate("documents");
        await evaluate("document.querySelector('[data-doc-tab=notes]').click(); true");
        await evaluate("document.querySelector('#createNewNoteBtn').click(); true");
        const assignment = assignments.find(item => item.description?.trim()) || assignments[0];
        await evaluate(`(() => {
            document.querySelector('#noteTitleInput').value = ${JSON.stringify(assignment.title)};
            document.querySelector('#noteSubjectInput').value = ${JSON.stringify(subject)};
            document.querySelector('#noteContentTextarea').value = ${JSON.stringify(`${assignment.title}\n${assignment.description || ""}`.slice(0, 1200))};
            document.querySelector('#noteDifficultInput').checked = true;
            document.querySelector('#analyzeDifficultNotesBtn').click();
            setTimeout(() => import('/src/app/state.js').then(module => module.notifyStateChange()), 200);
            return true;
        })()`);
        await waitFor("Boolean(document.querySelector('#difficultNotesResult')?.textContent.trim() && !document.querySelector('#analyzeDifficultNotesBtn')?.disabled)");
        const noteResult = await evaluate("document.querySelector('#difficultNotesResult').textContent");
        assert.ok(noteResult.length > 0 && !/Chưa thể|Không kết nối|Chưa có ghi chú/.test(noteResult));
        mark("ui-difficult-note-uses-actual-edux-excerpt-in-isolated-storage");
        stage = "progress";
        await navigate("progress");
        await evaluate("document.querySelector('#progressAdviceBtn').click(); setTimeout(() => import('/src/app/state.js').then(module => module.notifyStateChange()), 200); true");
        await waitFor("Boolean(document.querySelector('#progressAdviceResult')?.textContent.trim() && !document.querySelector('#progressAdviceBtn')?.disabled)");
        const progressResult = await evaluate("document.querySelector('#progressAdviceResult').textContent");
        assert.ok(progressResult.length > 0 && !/Chưa thể|Không kết nối/.test(progressResult));
        mark("ui-progress-advice-uses-synced-edux-tasks");
        report.originalDatabaseUnchanged = hash(fs.readFileSync(source)) === hash(original);
        assert.equal(report.originalDatabaseUnchanged, true);
        report.passed = true;
    } catch (error) {
        report.checks.push({ label: stage, passed: false, message: error.message });
        console.error(JSON.stringify({ stage, passed: false, message: error.message }));
    } finally {
        if (win && !win.isDestroyed()) win.destroy();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        fs.writeFileSync(path.join(root, "docs/ai_e2e_result.json"), JSON.stringify(report, null, 2) + "\n");
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        spawn(process.execPath, [path.join(__dirname, "helpers/cleanup-electron-temp.cjs"), directory, String(process.pid)], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, detached: true, stdio: "ignore"
        }).unref();
        console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length }));
        app.exit(report.passed ? 0 : 1);
    }
});
