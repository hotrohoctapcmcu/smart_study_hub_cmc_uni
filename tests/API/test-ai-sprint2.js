"use strict";

// HTTP Gemini giả lập + Express + SQLite thật, luôn dùng database tạm.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("Sprint 2 AI: context, planning, advice and provider failures", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "unistudy-ai-"));
    let reply = "Câu trả lời thử nghiệm";
    let providerStatus = 200;
    let delay = false;
    let afterGenerate = null;
    const calls = [];
    const provider = http.createServer((req, res) => {
        if (req.method === "GET" && req.url === "/app") {
            res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": ["NID=anonymous; Path=/", "__Secure-1PSID=must-be-ignored; Path=/"] });
            return res.end('<script>window.WIZ_global_data={"cfb2h":"guest-build","FdrFJe":"guest-fsid"}</script>');
        }
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", async () => {
            const form = new URLSearchParams(body);
            const payload = JSON.parse(JSON.parse(form.get("f.req"))[1]);
            calls.push({ url: req.url, key: req.headers["x-goog-api-key"], cookie: req.headers.cookie || "", prompt: payload[0][0] });
            if (delay) return;
            if (afterGenerate) { const callback = afterGenerate; afterGenerate = null; await callback(); }
            res.writeHead(providerStatus, { "Content-Type": "text/plain" });
            res.end(providerStatus === 200
                ? JSON.stringify([["wrb.fr", null, JSON.stringify([null, ["cid", "rid"], null, null, [["rcid", [reply]]]])]])
                : "provider-error-with-secret");
        });
    });
    await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
    Object.assign(process.env, {
        DB_PATH: path.join(directory, "test.db"), APP_USER_ID: "1",
        GEMINI_API_KEY: "must-be-ignored", GEMINI_COOKIES: "__Secure-1PSID=must-be-ignored",
        GEMINI_ENABLE_WEB_FALLBACK: "false", GEMINI_ORIGIN: `http://127.0.0.1:${provider.address().port}`,
        GEMINI_SESSION_DIR: directory, GEMINI_TIMEOUT_MS: "500"
    });
    fs.mkdirSync(path.join(directory, "gemini"));
    fs.writeFileSync(path.join(directory, "gemini", "guest-session.json"), JSON.stringify({ cookies: {
        NID: "saved-anonymous", "__Secure-1PSID": "must-be-ignored"
    } }));
    fs.writeFileSync(path.join(directory, "gemini", "session.json"), JSON.stringify({ cookies: {
        "__Secure-1PSID": "must-be-ignored"
    } }));
    const gemini = require("../../API/shared/gemini-client");
    const db = await require("../../database")();
    const contextModule = require("../../API/shared/study-context");
    const ai = require("../../API/modules/troLyAI");
    ai.setDb(db);
    const express = require("express");
    const app = express();
    app.use(express.json());
    app.use("/api/v1/ai", ai);
    const api = app.listen(0, "127.0.0.1");
    await new Promise(resolve => api.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${api.address().port}/api/v1/ai`;
    const call = async (route, body) => {
        const response = await fetch(`${baseUrl}${route}`, {
            method: body === undefined ? "GET" : "POST",
            headers: { "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        return { status: response.status, body: await response.json() };
    };
    t.after(async () => {
        api.closeAllConnections(); provider.closeAllConnections();
        await Promise.all([new Promise(resolve => api.close(resolve)), new Promise(resolve => provider.close(resolve))]);
        await db.closePool();
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const query = db.executeQuery;
    const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
    const today = contextModule.normalizeDate(new Date());
    const tomorrow = addDays(today, 1);
    const weekday = new Date(`${tomorrow}T00:00:00Z`).getUTCDay();
    const planInput = { startDate: tomorrow, endDate: tomorrow };
    const session = (start, end, extra = {}) => ({ date: tomorrow, start, end, subject: "CSDL", title: "Ôn CSDL", ...extra });
    await query("INSERT INTO Students(student_id, student_code, full_name, major) VALUES (1, 'TEST1', 'Sinh viên test', 'CNTT'), (2, 'TEST2', 'Người khác', 'CNTT')");
    await query("INSERT INTO Subjects(subject_id, subject_code, subject_name) VALUES(1, 'DB', 'CSDL')");
    await query(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date)
        VALUES(1,1,'L1','P1','CMC',@weekday,'08:00','10:00',@date,@date)`, { weekday: weekday === 0 ? 8 : weekday + 1, date: tomorrow });
    await query(`INSERT INTO StudySchedules(student_id,title,study_date,start_time,end_time,status)
        VALUES(1,'Đã có',@date,'11:00','12:00','PLANNED'),(1,'Đã hủy',@date,'12:00','13:00','CANCELLED')`, { date: tomorrow });
    await query(`INSERT INTO Exams(student_id,subject_id,exam_name,exam_date,exam_time,duration_minutes,room,campus)
        VALUES(1,1,'Thi CSDL',@date,'14:00',60,'P1','CMC')`, { date: tomorrow });
    await query(`INSERT INTO Assignments(student_id,subject_id,title,deadline,status)
        VALUES(1,1,'Chưa làm',@date,'PENDING'),(1,1,'Đã làm',@date,'COMPLETED'),(2,1,'Không được thấy',@date,'PENDING')`, { date: `${tomorrow}T23:00:00+07:00` });

    await t.test("normalizes Vietnam time and rejects impossible dates", () => {
        assert.equal(contextModule.normalizeDate("2028-02-30"), null);
        assert.equal(contextModule.normalizeDate("2028-01-01T20:30:00Z"), "2028-01-02");
        assert.equal(contextModule.normalizeTime("2028-01-01T20:30:00Z"), "03:30");
        assert.equal(contextModule.normalizeTime("24:10"), null);
        assert.equal(contextModule.normalizeTime("10:00oops"), null);
        assert.equal(contextModule.normalizeTime("10:00:99"), null);
        assert.equal(contextModule.normalizeDate("2028-01-01T25:00:00"), null);
        assert.equal(contextModule.normalizeDateTime("2028-01-01 10:30:00"), "2028-01-01T10:30:00+07:00");
    });
    await t.test("context uses actual student records and marks absent optional sources", async () => {
        const context = await contextModule.buildStudyContext(1);
        assert.equal(context.timezone, "Asia/Ho_Chi_Minh");
        assert.deepEqual(context.assignments.map(item => item.title), ["Chưa làm"]);
        assert.equal(context.studySchedules.length, 1);
        assert.equal(context.grades.length, 0);
        assert.equal(context.sources.notes.available, true);
        assert.equal(context.notes.length, 0);
        assert.equal(context.sources.documents.available, true);
        assert.equal(context.documents.length, 0);
    });
    await t.test("browser notes/documents are normalized and total context is bounded", async () => {
        const studyData = {
            notes: Array.from({ length: 100 }, (_, id) => ({ id, content: "x".repeat(9000), isDifficult: true })),
            documents: [{ id: "doc", title: "Tài liệu thật", content: "Bài đọc" }]
        };
        const context = await contextModule.buildStudyContext(1, { studyData, limits: { notes: 100 } });
        assert.ok(JSON.stringify(context).length <= contextModule.MAX_CONTEXT_CHARS);
        assert.equal(context.sources.notes.total, 100);
        assert.equal(context.sources.notes.truncated, true);
        assert.equal(context.sources.notes.origin, "browser");
        assert.equal(context.documents[0].text, "Bài đọc");
        await assert.rejects(contextModule.buildStudyContext(1, { studyData: { notes: [null] } }), /không hợp lệ/);
    });
    await t.test("guest works without keys/login and ignores old API/cookie configuration", async () => {
        const status = await call("/status");
        assert.equal(status.body.data.mode, "web-guest");
        assert.equal(status.body.data.guest, true);
        assert.equal(status.body.data.authenticated, false);
        assert.ok(!JSON.stringify(status.body).includes("must-be-ignored"));
        const result = await call("/ask", { question: "Lịch của tôi?", conversationId: "__proto__" });
        assert.equal(result.status, 200);
        assert.equal(calls.at(-1).key, undefined);
        assert.ok(!calls.at(-1).url.includes("must-be-ignored"));
        assert.ok(!calls.at(-1).cookie.includes("PSID"));
        assert.ok(!calls.at(-1).cookie.includes("must-be-ignored"));
        assert.ok(calls.at(-1).prompt.includes("Chưa làm"));
        assert.ok(calls.at(-1).prompt.includes("Sinh viên test"));
        assert.ok(!calls.at(-1).prompt.includes("Không được thấy"));
        assert.ok(!fs.readFileSync(path.join(directory, "gemini", "guest-session.json"), "utf8").includes("must-be-ignored"));
    });
    await t.test("input errors never call Gemini", async () => {
        const count = calls.length;
        for (const body of [ {}, { ...planInput, durationMinutes: 0 }, { ...planInput, startDate: "2028-02-30" },
            { ...planInput, endDate: addDays(tomorrow, 31) }, { ...planInput, freeStartTime: "09:00bad" },
            { ...planInput, daysOfWeek: [1] } ]) assert.equal((await call("/plan", body)).status, 400);
        assert.equal((await call("/ask", { question: " " })).status, 400);
        assert.equal(calls.length, count);
    });
    await t.test("planning filters classes, study, exams, overlaps, unknown IDs and excessive duration", async () => {
        reply = JSON.stringify({ sessions: [
            session("10:00", "11:00"), session("08:00", "09:00"), session("11:00", "12:00"),
            session("14:00", "15:00"), session("10:30", "11:00"), session("15:00", "15:15"),
            session("15:00", "20:00"), session("15:00", "16:00", { assignmentId: 999 }),
            session("12:00", "13:00")
        ] });
        const result = await call("/plan", planInput);
        assert.equal(result.status, 200);
        assert.equal(result.body.data.sessions.length, 2);
        assert.equal(result.body.data.rejected.length, 7);
        assert.equal(result.body.data.persisted, false);
        assert.equal((await db.layLichTuHoc(1)).length, 2);
        assert.ok(calls.at(-1).prompt.includes("Chỉ trả về một giá trị JSON hợp lệ"));
        reply = JSON.stringify({ sessions: [session("19:00", "20:00"), session("20:00", "21:00")] });
        const projectDay = weekday === 0 ? 8 : weekday + 1;
        const limited = await call("/plan", { ...planInput, targetHours: 1, daysOfWeek: [projectDay] });
        assert.equal(limited.body.data.sessions.length, 1);
        assert.equal(limited.body.data.rejected[0].reason, "target-hours-exceeded");
        const count = calls.length;
        const differentDay = projectDay === 8 ? 2 : projectDay + 1;
        const excluded = await call("/plan", { ...planInput, daysOfWeek: [differentDay] });
        assert.equal(excluded.body.data.sessions.length, 0);
        assert.equal(calls.length, count);
    });
    await t.test("past-only date range returns no proposal without calling Gemini", async () => {
        const count = calls.length;
        const yesterday = addDays(today, -1);
        const result = await call("/plan", { startDate: yesterday, endDate: yesterday });
        assert.equal(result.body.data.sessions.length, 0);
        assert.equal(calls.length, count);
    });
    await t.test("all exams block slots even beyond the AI context limit", async () => {
        for (let index = 0; index < 21; index++) await query(`INSERT INTO Exams(student_id,subject_id,exam_date,exam_time,room,campus)
            VALUES(1,1,@date,'08:00','P1','CMC')`, { date: addDays(today, -index) });
        assert.equal((await contextModule.buildStudyContext(1)).exams.length, 20);
        reply = JSON.stringify({ sessions: [session("14:00", "15:00")] });
        const result = await call("/plan", planInput);
        assert.equal(result.body.data.sessions.length, 0);
        assert.equal(result.body.data.rejected[0].reason, "not-in-free-slot");
    });
    await t.test("a schedule inserted while Gemini responds invalidates its proposal", async () => {
        reply = JSON.stringify({ sessions: [session("16:00", "17:00")] });
        afterGenerate = () => query(`INSERT INTO StudySchedules(student_id,title,study_date,start_time,end_time)
            VALUES(1,'Mới thêm',@date,'16:00','17:00')`, { date: tomorrow });
        const result = await call("/plan", planInput);
        assert.equal(result.body.data.sessions.length, 0);
    });
    await t.test("confirmation is explicit, atomic, rechecks conflicts and prevents repeat saves", async () => {
        const sessions = [session("10:00", "11:00"), session("12:00", "13:00")];
        assert.equal((await call("/plan/confirm", { sessions })).status, 400);
        const before = (await db.layLichTuHoc(1)).length;
        const failed = await call("/plan/confirm", { confirmed: true, sessions: [session("10:00", "11:00"), session("14:00", "15:00")] });
        assert.equal(failed.status, 409);
        assert.equal((await db.layLichTuHoc(1)).length, before);
        const saved = await call("/plan/confirm", { confirmed: true, sessions });
        assert.equal(saved.status, 200);
        assert.equal(saved.body.data.persisted, true);
        assert.equal((await db.layLichTuHoc(1)).filter(item => item.is_ai_suggested).length, 2);
        assert.equal((await call("/plan/confirm", { confirmed: true, sessions })).status, 409);
    });
    await t.test("empty or metadata-only progress does not fabricate metrics or call Gemini", async () => {
        const count = calls.length;
        for (const progress of [{}, { grades: null }, { period: "week", selectedDate: tomorrow }]) {
            const result = await call("/progress-advice", { progress });
            assert.equal(result.body.data.basedOnFields.length, 0);
            assert.deepEqual(result.body.data.comments, []);
        }
        assert.equal(calls.length, count);
    });
    await t.test("progress advice rejects unsupported numerical claims while retaining zero as real data", async () => {
        reply = JSON.stringify({ overview: "Bạn học 999 giờ.", comments: ["Bạn hoàn thành 0 bài.", "Bạn đạt 99%."], revisionSuggestions: ["Ôn phần còn khó."] });
        const result = await call("/progress-advice", { progress: { tasks: { completed: 0, total: 3 } } });
        assert.deepEqual(result.body.data.comments, ["Bạn hoàn thành 0 bài."]);
        assert.ok(!result.body.data.overview.includes("999"));
        assert.ok(result.body.data.unavailableMetrics.includes("grades"));
    });
    await t.test("difficult notes are selected before truncation and unknown note references are removed", async () => {
        const notes = Array.from({ length: 60 }, (_, index) => ({ id: `easy-${index}`, title: "Dễ", content: "Không gửi ghi chú này" }));
        notes.push({ id: "hard", title: "Chuẩn hóa", content: "Phụ thuộc hàm", tags: ["khó hiểu"] });
        reply = JSON.stringify({ topics: [{ topic: "Phụ thuộc hàm", noteIds: ["hard", "fake"] }, { topic: "Bịa", noteIds: ["fake"] }], suggestions: ["Ôn chuẩn hóa."] });
        const result = await call("/difficult-notes", { studyData: { notes } });
        assert.equal(result.body.data.difficultNotesCount, 1);
        assert.deepEqual(result.body.data.topics.map(item => item.noteIds), [["hard"]]);
        assert.ok(!calls.at(-1).prompt.includes("Không gửi ghi chú này"));
    });
    await t.test("optional tables are scoped to the resolved student profile", async () => {
        await query("INSERT INTO Notebooks(notebook_id,student_id,title) VALUES(1,1,'Sổ tay của tôi'),(2,2,'Sổ tay khác')");
        await query("INSERT INTO Notes(note_id,notebook_id,student_id,content,is_hard) VALUES(1,1,1,'Nội dung thật',1),(2,2,2,'Riêng tư',1)");
        const context = await contextModule.buildStudyContext("TEST1");
        assert.deepEqual(context.notes.map(item => item.id), ["1"]);
        assert.equal(context.notes[0].isDifficult, true);
    });
    await t.test("exam-plan, check, summarize and leave draft share the success envelope", async () => {
        reply = JSON.stringify({ phases: [{ examId: 1, title: "Ôn thi", startDate: today, endDate: tomorrow }] });
        const examPlan = await call("/exam-plan", { examId: 1 });
        assert.equal(examPlan.body.data.phases.length, 1);
        assert.equal(examPlan.body.data.persisted, false);
        reply = JSON.stringify({ verdict: "correct", feedback: "Đúng", corrections: [], revisionSuggestions: [] });
        assert.equal((await call("/check", { question: "1+1?", answer: "2" })).body.data.verdict, "correct");
        reply = "Văn bản thử nghiệm";
        assert.equal((await call("/summarize", { text: "Tài liệu" })).body.data.summary, reply);
        assert.equal((await call("/draft-leave", { date: tomorrow, reason: "Ốm" })).body.data.matchedClasses, 1);
    });
    await t.test("leave drafts select the requested day before truncating timetable history", async () => {
        for (let index = 0; index < 45; index++) {
            await query(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date)
                VALUES(1,1,'Old','P1','CMC',2,'07:00','08:00',@date,@date)`, { date: addDays(today, -30 - index) });
        }
        reply = "Đơn xin nghỉ học";
        const result = await call("/draft-leave", { date: tomorrow, reason: "Ốm" });
        assert.equal(result.status, 200);
        assert.equal(result.body.data.matchedClasses, 1);
        assert.ok(!calls.at(-1).prompt.includes('"className":"Old"'));
    });
    await t.test("the imported client contract supports per-call timeout, cancellation and disabled retry", async () => {
        delay = true;
        try {
            await assert.rejects(gemini.ask("Timeout check", { timeoutMs: 30, retry: false }),
                error => error.code === "GEMINI_TIMEOUT");
            const controller = new AbortController();
            const pending = gemini.ask("Cancellation check", { signal: controller.signal, retry: false });
            controller.abort();
            await assert.rejects(pending);
        } finally { delay = false; }
        providerStatus = 403;
        try {
            const before = calls.length;
            await assert.rejects(gemini.ask("No retry check", { retry: false }));
            assert.equal(calls.length - before, 1);
        } finally { providerStatus = 200; }
    });
    await t.test("malformed JSON/schema are retried once, then return a structured 502", async () => {
        for (const invalid of ["not JSON", '{"wrong":[]}', "null"]) {
            reply = invalid;
            const before = calls.length;
            const result = await call("/progress-advice", { progress: { completedTasks: 1 } });
            assert.equal(result.status, 502);
            assert.equal(result.body.success, false);
            assert.equal(result.body.data, null);
            assert.equal(calls.length - before, 2);
        }
        assert.deepEqual(gemini.parseJson('```json\n{"ok":true}\n```'), { ok: true });
    });
    await t.test("provider rejection, rate limits and timeouts do not leak details", async () => {
        for (const status of [403, 429, 500]) {
            providerStatus = status;
            const result = await call("/ask", { question: "Test" });
            assert.ok(result.status >= 500);
            assert.equal(result.body.success, false);
            assert.ok(!JSON.stringify(result.body).includes("provider-error-with-secret"));
        }
        providerStatus = 200;
        delay = true;
        const result = await call("/ask", { question: "Timeout" });
        assert.equal(result.status, 504);
        assert.equal(result.body.error.code, "GEMINI_TIMEOUT");
        delay = false;
    });
});
