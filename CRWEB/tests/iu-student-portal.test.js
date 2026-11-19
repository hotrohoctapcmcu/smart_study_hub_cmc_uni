"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const iu = require("../modules/IU");
const { mapSangDataIU } = require("../../API/utils/iu-client");
const fixture = require("./fixtures/iu-student-portal/snapshot.json");

const session = { portal: "sinhvien" };
const cookie = "iu=synthetic";
const base = "/sinhvien/congsinhvien";
const api = "/sinhvien/api";
const interval = { ngayBatDau: "18/11/2026", ngayKetThuc: "24/11/2026" };

function page(props) {
    const payload = `a:${JSON.stringify(["$", "$L1", null, props])}\n`;
    const split = Math.floor(payload.length / 2);
    const script = segment => `<script>self.__next_f.push(${JSON.stringify([1, segment])})</script>`;
    return new Response(script(payload.slice(0, split)) + script(payload.slice(split)));
}

function mockPortal(t, { weeks = new Map(), examResponse } = {}) {
    const paths = new Map([
        [base + "/profile/hoso", fixture.profilePage],
        [base + "/hoctap/diemhoc", fixture.gradePage],
        [base + "/hoctap/chuontrinhhoc", fixture.curriculumPage],
        [base + "/thoikhoabieu/lichthi", fixture.examPage],
        [base + "/hoctap/phuckhao", { periods: [], initialItems: [], initialPeriodId: "" }],
        [base + "/tintuc", { initialNews: [] }],
    ]);
    const calls = [];
    t.mock.method(globalThis, "fetch", async (input, options) => {
        const url = new URL(input);
        calls.push(url);
        assert.equal(url.origin, "https://iu.cmcu.edu.vn");
        assert.equal(options.method, "GET");
        assert.equal(options.headers.Cookie, cookie);
        assert.equal(options.redirect, "manual");
        if (paths.has(url.pathname)) return page(paths.get(url.pathname));
        if (url.pathname === api + "/timetable/week") {
            const response = weeks.get(url.searchParams.get("start"));
            assert.ok(response, "Expected a whole calendar week");
            return Response.json(response);
        }
        if (url.pathname === api + "/exam-schedule/schedule") {
            assert.equal(url.searchParams.get("subject"), "");
            assert.equal(url.searchParams.get("history"), "0");
            return examResponse(url.searchParams.get("period"));
        }
        assert.fail(`Unexpected request ${url.pathname}`);
    });
    return calls;
}

test("IU sinhvien sync maps the saved page shapes and reads every week in the selected interval", async t => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-19T08:00:00Z") });
    const [event] = fixture.timetablePage.initialEvents;
    const [exam] = fixture.examPage.initialData.personal;
    const calls = mockPortal(t, {
        weeks: new Map([
            ["16/11/2026", { success: true, events: [event, event, { ...event, date: "16/11/2026" }, { type: "exam" }] }],
            ["23/11/2026", { success: true, events: [{ ...event, date: "24/11/2026" }, { ...event, date: "25/11/2026" }] }],
        ]),
        examResponse: period => Response.json({
            success: true,
            personal: period === "period-1" ? [exam, { ...exam, date: "18/11/2026" }]
                : [exam, { ...exam, date: "29/11/2026" }],
            general: [{ ...exam, subjectCode: "OTHER999" }],
        }),
    });

    const result = await iu.layTatCaIU(session, cookie, { ...interval, soNgayLichThi: 5 });
    const mapped = mapSangDataIU(result.data);
    assert.deepEqual(result.thatBai, []);
    assert.equal(mapped.MSV, "TEST0001");
    assert.equal(mapped.ten_nganh_hoc, "Sample Engineering");
    assert.equal(mapped.chuong_trinh.tong_tin_chi, 126);
    assert.equal(mapped.hoc_phan_chuong_trinh[0].ma_mon, "SAMPLE101");
    assert.equal(mapped.khoi_kien_thuc[0].tin_chi_dat, 3);
    assert.equal(mapped.bang_diem["1_2026-2027"].Sample_Computing.diem_tong_ket, 8.5);
    assert.deepEqual(mapped.tkb.map(row => [row.ngay_bat_dau, row.thu, row.gio_bat_dau]), [
        ["18/11/2026", 4, "09:45"], ["24/11/2026", 3, "09:45"],
    ]);
    assert.deepEqual(mapped.lich_thi.map(row => [row.ma_mon, row.ngay_thi, row.thoi_luong]), [
        ["SAMPLE101", "23/11/2026", 90],
    ]);
    assert.deepEqual(calls.filter(url => url.pathname.endsWith("/week")).map(url =>
        [...url.searchParams.values()]), [
        ["16/11/2026", "22/11/2026", "18/11/2026"],
        ["23/11/2026", "29/11/2026", "23/11/2026"],
    ]);
    assert.equal(calls.filter(url => url.pathname.endsWith("/diemhoc")).length, 1);
});

test("IU distinguishes unreadable calendar data from an empty successful response", async t => {
    const [event] = fixture.timetablePage.initialEvents;
    mockPortal(t, {
        weeks: new Map([
            ["16/11/2026", { success: true, events: [event] }],
            ["23/11/2026", fixture.calendarDays],
        ]),
        examResponse: () => Response.json({ success: true, personal: [], general: [] }),
    });
    const result = await iu.layTatCaIU(session, cookie, interval);
    assert.equal(result.data.IU.lich_hoc.fetched, false);
    assert.equal(Object.hasOwn(mapSangDataIU(result.data), "tkb"), false);
    assert.equal(result.data.IU.lich_thi.fetched, true);
    assert.deepEqual(result.data.IU.lich_thi.chi_tiet_lich_thi, []);
    assert.match(result.thatBai.join("\n"), /Lịch học/);
});

test("IU treats a redirect to sign-in as an expired session without following it", async t => {
    const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, {
        status: 307, headers: { location: "/sinhvien/login/sinhvien?from=%2Fcongsinhvien" },
    }));
    await assert.rejects(iu.layTatCaIU(session, cookie, interval), { statusCode: 401, code: "SESSION_EXPIRED" });
    assert.equal(fetch.mock.callCount(), 1);
});
