"use strict";

// Gemini thật + dữ liệu đã đồng bộ; thao tác ghi chỉ chạy trên bản sao tạm.
// Báo cáo không chứa tên, mã sinh viên, điểm cụ thể, token hoặc nội dung ghi chú.
require("dotenv").config();
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const overlap = (start, end, otherStart, otherEnd) => minutes(start) < minutes(otherEnd) && minutes(end) > minutes(otherStart);
const projectDay = date => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const classOnDate = (row, date) => String(row.start_date).slice(0, 10) <= date
    && String(row.end_date).slice(0, 10) >= date && Number(row.day_of_week) === projectDay(date) + 1;

async function main() {
    const source = path.resolve(process.env.DB_PATH || "data/unistudy.db");
    if (!fs.existsSync(source)) throw new Error("Chưa có database đã đồng bộ CMC.");
    const original = fs.readFileSync(source);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "unistudy-ai-live-"));
    process.env.DB_PATH = path.join(directory, "snapshot.db");
    process.env.GEMINI_SESSION_DIR = directory;
    fs.writeFileSync(process.env.DB_PATH, original);
    let db;
    let server;
    const report = { testedAt: new Date().toISOString(), checks: [], remoteGemini: "pending" };
    try {
        db = await require("../../database")();
        const contextModule = require("../../API/shared/study-context");
        contextModule.setDb(db);
        const studentId = Number(process.env.APP_USER_ID) || 1;
        const context = await contextModule.buildStudyContext(studentId);
        assert.ok(JSON.stringify(context).length <= contextModule.MAX_CONTEXT_CHARS);
        report.profileFound = context.sources.profile.found;
        report.contextChars = JSON.stringify(context).length;
        report.sources = Object.fromEntries(Object.entries(context.sources).map(([name, info]) =>
            [name, { available: info.available, total: info.total ?? null, included: info.included ?? null, truncated: info.truncated ?? false }]));
        const gemini = require("../../API/shared/gemini-client");
        report.mode = gemini.getStatus().mode;
        assert.equal(report.mode, "web-guest");
        const express = require("express");
        const api = express();
        api.use(express.json());
        const { setDbForAll, registerModules } = require("../../API/modules");
        setDbForAll(db);
        registerModules(api, "/api/v1");
        server = api.listen(0, "127.0.0.1");
        await new Promise(resolve => server.once("listening", resolve));
        const base = `http://127.0.0.1:${server.address().port}/api/v1`;
        const request = async (route, body, expectedStatus = 200) => {
            const response = await fetch(`${base}${route}`, {
                method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(180000)
            });
            const json = await response.json();
            assert.equal(response.status, expectedStatus, `${route}: ${json.error?.code || response.status}: ${json.message || "Request failed"}`);
            assert.equal(json.success, expectedStatus < 400);
            return json;
        };
        const check = async (label, callback) => {
            try {
                await callback();
                report.checks.push({ label, passed: true });
                console.log(JSON.stringify({ label, passed: true }));
            } catch (error) {
                report.checks.push({ label, passed: false, message: error.message });
                console.log(JSON.stringify({ label, passed: false, message: error.message }));
            }
        };
        const [classes, exams, existingStudy, edux, localAssignments, grades] = await Promise.all([
            db.layThoiKhoaBieu(studentId), db.layLichThi(studentId), db.layLichTuHoc(studentId),
            db.layBaiTapEDUX(studentId), db.layDanhSachDeadline(studentId), db.layBangDiem(studentId)
        ]);
        report.recordCounts = { classes: classes.length, exams: exams.length, grades: grades.length, edux: edux.length, existingStudy: existingStudy.length };
        const startDate = contextModule.normalizeDate(new Date());
        const endDate = addDays(startDate, 6);
        const upcoming = exams.filter(exam => contextModule.normalizeDate(exam.exam_date) >= startDate);
        report.upcomingExams = upcoming.length;
        await check("ask-real-study-context", async () => {
            const { data } = await request("/ai/ask", { question: "Nêu ngắn các nguồn học tập hiện có và nguồn còn thiếu trong ngữ cảnh được cung cấp. Không tạo số liệu." });
            assert.ok(data.answer?.trim());
        });
        await check("progress-real-edux-and-grades", async () => {
            const { data } = await request("/ai/progress-advice", { progress: {
                assignments: { total: edux.length + localAssignments.length, incomplete: context.sources.assignments.total },
                grades: context.grades
            } });
            assert.ok(data.overview?.trim());
            assert.ok(data.unavailableMetrics.includes("studyTime"));
        });
        let proposals = [];
        await check("plan-against-all-real-classes-and-exams", async () => {
            const { data } = await request("/ai/plan", { startDate, endDate, targetHours: 2, durationMinutes: 60 });
            assert.equal(data.preview, true);
            assert.equal(data.persisted, false);
            assert.ok(data.sessions.length > 0, "Gemini phải trả ít nhất một buổi hợp lệ khi còn khoảng trống");
            let duration = 0;
            for (const [index, item] of data.sessions.entries()) {
                assert.ok(item.date >= startDate && item.date <= endDate);
                assert.ok(new Date(`${item.date}T${item.start}:00+07:00`).getTime() > Date.now());
                assert.ok(minutes(item.end) - minutes(item.start) >= 30);
                assert.ok(minutes(item.start) >= 420 && minutes(item.end) <= 1320);
                for (const row of classes.filter(row => classOnDate(row, item.date))) {
                    assert.ok(!overlap(item.start, item.end, row.start_time, row.end_time), "Đề xuất trùng lịch IU thật");
                }
                for (const row of exams.filter(row => contextModule.normalizeDate(row.exam_date) === item.date)) {
                    const examStart = minutes(row.exam_time);
                    assert.ok(minutes(item.end) <= examStart || minutes(item.start) >= examStart + row.duration_minutes, "Đề xuất trùng lịch thi thật");
                }
                for (const row of existingStudy.filter(row => String(row.study_date).slice(0, 10) === item.date && row.status !== "CANCELLED")) {
                    assert.ok(!overlap(item.start, item.end, row.start_time, row.end_time));
                }
                assert.ok(!data.sessions.slice(0, index).some(other => other.date === item.date && overlap(item.start, item.end, other.start, other.end)));
                duration += minutes(item.end) - minutes(item.start);
            }
            assert.ok(duration <= 120);
            assert.equal((await db.layLichTuHoc(studentId)).length, existingStudy.length, "Preview không tự lưu lịch");
            proposals = data.sessions;
            report.proposedSessions = proposals.length;
            report.rejectedSessions = data.rejected.length;
        });
        await check("confirm-persist-and-reload-on-snapshot", async () => {
            assert.ok(proposals.length, "Cần preview hợp lệ trước khi xác nhận");
            const { data } = await request("/ai/plan/confirm", { confirmed: true, sessions: proposals });
            assert.equal(data.persisted, true);
            const loaded = (await request("/schedules/study")).data;
            assert.equal(loaded.length, existingStudy.length + proposals.length);
            const SQL = await require("sql.js")();
            const disk = new SQL.Database(fs.readFileSync(process.env.DB_PATH));
            try {
                for (const row of data.sessions) {
                    const result = disk.exec(`SELECT is_ai_suggested FROM StudySchedules WHERE schedule_id = ${Number(row.schedule_id)}`);
                    assert.equal(result[0]?.values[0]?.[0], 1);
                }
            } finally { disk.close(); }
            report.confirmedSessionsOnSnapshot = data.sessions.length;
        });
        await check("repeat-confirm-is-rejected", async () => {
            assert.ok(proposals.length);
            const result = await request("/ai/plan/confirm", { confirmed: true, sessions: proposals }, 409);
            assert.equal(result.error.code, "PLAN_CONFLICT");
        });
        await check("exam-plan-respects-actual-exam-dates", async () => {
            const result = await request("/ai/exam-plan", {}, upcoming.length ? 200 : 404);
            if (upcoming.length) assert.ok(Array.isArray(result.data.phases));
            else assert.equal(result.data, null);
        });
        await check("difficult-notes-do-not-invent-missing-source", async () => {
            const { data } = await request("/ai/difficult-notes", {});
            if (!context.sources.notes.available) {
                assert.equal(data.available, false);
                assert.equal(data.difficultNotesCount, 0);
                assert.deepEqual(data.topics, []);
            }
        });
        await check("summarize-real-edux-content", async () => {
            const assignment = edux.find(item => item.description?.trim()) || edux[0];
            assert.ok(assignment, "Cần bài EDUX thật để tóm tắt");
            const { data } = await request("/ai/summarize", { text: `${assignment.title}\n${assignment.description || ""}`.slice(0, 30000) });
            assert.ok(data.summary?.trim());
        });
        await check("check-answer-functional-input", async () => {
            const { data } = await request("/ai/check", { question: "1 + 1 bằng bao nhiêu?", answer: "2" });
            assert.equal(data.verdict, "correct");
        });
        await check("leave-draft-matches-untruncated-iu-timetable", async () => {
            let match;
            for (let day = 1; day < 31 && !match; day++) {
                const date = addDays(startDate, day);
                const row = classes.find(row => classOnDate(row, date));
                if (row) match = { row, date };
            }
            assert.ok(match, "Cần lớp IU thật trong 30 ngày tới");
            const subject = match.row.subject_name;
            const expected = classes.filter(row => classOnDate(row, match.date) && row.subject_name?.toLowerCase().includes(subject.toLowerCase())).length;
            const { data } = await request("/ai/draft-leave", { date: match.date, subject, reason: "Kiểm thử bản nháp trong môi trường local." });
            assert.equal(data.matchedClasses, expected);
            assert.ok(data.draft?.trim());
        });
        report.originalDatabaseUnchanged = hash(fs.readFileSync(source)) === hash(original);
        assert.equal(report.originalDatabaseUnchanged, true);
        report.remoteGemini = report.checks.every(item => item.passed) ? "passed" : "failed";
        if (report.remoteGemini === "failed") process.exitCode = 1;
        const reportPath = path.resolve(process.env.AI_LIVE_REPORT_PATH || "docs/ai_live_result.json");
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
        console.log(JSON.stringify(report, null, 2));
    } finally {
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
