"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { getExamWindow, collectExamSchedule, normalizeDate, addDays } = require("../../CRWEB/IU/exam-calendar");
const { mapLichThi } = require("../../CRWEB/IU/data/maps");
const { mapSangDataIU } = require("../../API/shared/iu-client");
const rawExam = date => ({ MAHOCPHAN: "M1", TENHOCPHAN: "Môn học", NGAYTHI: date, GIOBATDAU: 9, PHUTBATDAU: 0 });

test("70-day window starts on Vietnam's current day and crosses the year", () => {
    const window = getExamWindow(70, new Date("2026-10-26T18:00:00Z"));
    assert.equal(window.from, "2026-10-27");
    assert.equal(window.to, "2027-01-05");
    assert.equal(window.weeklyDates[0], "27/10/2026");
    assert.equal(window.weeklyDates.at(-1), "05/01/2027");
    assert.equal(window.weeklyDates.length, 11);
    assert.equal(getExamWindow(70, new Date("2028-02-28T12:00:00Z")).to, "2028-05-08");
    assert.equal(normalizeDate("31/02/2026"), null);
});

test("lookahead is bounded and can be shortened to 60 days", () => {
    const shortened = getExamWindow(60, new Date("2026-11-01T00:00:00Z"));
    assert.equal(shortened.days, 60);
    assert.equal(shortened.weeklyDates.at(-1), shortened.to.split("-").reverse().join("/"));
    for (const days of [0, 71, -1, 3.5, "invalid", null, true, [70]]) assert.throws(() => getExamWindow(days), /1 đến 70/);
});

test("weekly fetch covers the whole window, ignores timetable dates and deduplicates results", async () => {
    const window = getExamWindow();
    const dates = [];
    const result = await collectExamSchedule(async (endpoint, patch) => {
        assert.equal(endpoint, "LayTTLichThi");
        dates.push(patch.strNgayDangChon);
        return { rsLichThiCaNhan: [rawExam(window.from), rawExam(window.to), rawExam(addDays(window.from, -1)), rawExam(addDays(window.to, 1))] };
    }, mapLichThi, { ngayBatDau: "01/09/2020", ngayKetThuc: "31/08/2021" });
    assert.deepEqual(dates, window.weeklyDates);
    assert.equal(result.source, "weekly");
    assert.deepEqual(result.exams.map(row => normalizeDate(row.ngay_thi)), [window.from, window.to]);
});

test("a successful empty response is authoritative and does not pick an old semester", async () => {
    const result = await collectExamSchedule(async () => [], mapLichThi);
    assert.deepEqual(result.exams, []);
    assert.deepEqual(mapSangDataIU({ IU: { lich_thi: { chi_tiet_lich_thi: [], fetched: true } } }).lich_thi, []);
});

test("semester fallback includes next semester and rejects an old current flag", async () => {
    const window = getExamWindow();
    const selected = [];
    const result = await collectExamSchedule(async (endpoint, patch) => {
        if (endpoint === "LayTTLichThi") throw Object.assign(new Error("Unsupported"), { statusCode: 404 });
        if (endpoint === "LayDSThoiGianLichThi") return [
            { ID: "old", DANGDIEN: true, NGAYBATDAU: "2020-01-01", NGAYKETTHUC: "2020-12-31" },
            { ID: "current", NGAYBATDAU: window.from, NGAYKETTHUC: addDays(window.from, 30) },
            { ID: "next", NGAYBATDAU: addDays(window.from, 31), NGAYKETTHUC: addDays(window.to, 30) }
        ];
        if (endpoint === "LayDSHocPhanLichThi") return [{ ID: "course" }];
        selected.push(patch.strDaoTao_ThoiGianDaoTao_Id);
        return [rawExam(patch.strDaoTao_ThoiGianDaoTao_Id === "current" ? window.from : window.to)];
    }, mapLichThi);
    assert.ok(!selected.includes("old"));
    assert.ok(selected.includes("current") && selected.includes("next"));
    assert.equal(result.exams.length, 2);
    assert.equal(result.source, "semester");
});

test("partial failures are not converted into an authoritative empty schedule", async () => {
    await assert.rejects(collectExamSchedule(async endpoint => {
        if (endpoint === "LayDSThoiGianLichThi") return [];
        throw new Error("Unavailable");
    }, mapLichThi), /Chưa lấy đủ lịch thi/);
    assert.equal(Object.hasOwn(mapSangDataIU({ IU: { lich_thi: { fetched: false, chi_tiet_lich_thi: [] } } }), "lich_thi"), false);
    assert.equal(Object.hasOwn(mapSangDataIU({ IU: {} }), "lich_thi"), false);
});

test("expired IU sessions stop the scan without attempting another endpoint", async () => {
    const endpoints = [];
    await assert.rejects(collectExamSchedule(async endpoint => {
        endpoints.push(endpoint);
        throw Object.assign(new Error("Expired"), { statusCode: 401 });
    }, mapLichThi), error => error.statusCode === 401);
    assert.ok(endpoints.every(endpoint => endpoint === "LayTTLichThi"));
    assert.ok(endpoints.length <= 3);
});

test("frontend delegates timetable defaults and forwards the exam horizon over HTTP and Electron", async () => {
    const { pullIuData } = await import(pathToFileURL(path.resolve("Frontend/src/features/sync/sync.service.js")).href);
    const previousFetch = global.fetch;
    const previousWindow = global.window;
    let captured;
    try {
        global.fetch = async (_url, options) => {
            captured = JSON.parse(options.body);
            return { ok: true, json: async () => ({ success: true, savedDb: {}, thatBai: [] }) };
        };
        await pullIuData();
        assert.equal(captured.soNgayLichThi, 70);
        assert.equal(Object.hasOwn(captured, "ngayBatDau"), false);
        assert.equal(Object.hasOwn(captured, "ngayKetThuc"), false);
        global.window = { __uniStudyIU: {
            isAvailable: true, loginIU() {}, pullIU: async options => { captured = options; return { ok: true }; }
        } };
        await pullIuData({ soNgayLichThi: 60 });
        assert.equal(captured.soNgayLichThi, 60);
    } finally {
        global.fetch = previousFetch;
        if (previousWindow === undefined) delete global.window;
        else global.window = previousWindow;
    }
});

test("database refresh clears stale IU rows on a successful empty result and preserves manual exams", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "unistudy-exam-window-"));
    process.env.DB_PATH = path.join(directory, "test.db");
    const db = await require("../../database")();
    t.after(async () => {
        await db.closePool();
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'TEST','Sinh viên test','CNTT')");
    await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'M1','Môn học')");
    await db.executeQuery(`INSERT INTO Exams(student_id,subject_id,exam_date,exam_time,room,campus,source)
        VALUES(1,1,'2026-09-01','09:00','P1','CMC','IU'),(1,1,'2026-09-02','09:00','P1','CMC','TEACHER')`);
    const profile = { ho_ten: "Sinh viên test", ten_nganh_hoc: "CNTT" };
    const failed = mapSangDataIU({ IU: { lich_thi: { fetched: false, chi_tiet_lich_thi: [] } } });
    await db.dongBoHoSoIU("TEST", { ...failed, ...profile });
    assert.equal((await db.layLichThi(1)).length, 2);
    await db.dongBoHoSoIU("TEST", { ...profile, lich_thi: [] });
    const remaining = await db.layLichThi(1);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].source, "TEACHER");
});
