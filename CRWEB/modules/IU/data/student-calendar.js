"use strict";

const { addDays, portalDate, normalizeDate, getExamWindow } = require("../exam-calendar");
const { portalError, readJson, readPage, queryInBatches } = require("./student-client");

function timetableRange({ ngayBatDau, ngayKetThuc }) {
    const from = normalizeDate(ngayBatDau);
    const to = normalizeDate(ngayKetThuc);
    if (!from || !to || from > to) {
        throw portalError("Chọn khoảng ngày hợp lệ cho lịch học IU.", 400);
    }
    return { from, to };
}

function clock(hour, minute) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
        !Number.isInteger(minute) || minute < 0 || minute > 59) return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function layLichHoc(cookie, opts = {}) {
    const { from, to } = timetableRange(opts);
    const weekday = new Date(from + "T00:00:00Z").getUTCDay();
    const monday = addDays(from, -((weekday + 6) % 7));
    const weeks = [];
    for (let start = monday; start <= to; start = addDays(start, 7)) weeks.push(start);
    const rows = await queryInBatches(weeks, async start => {
        const { events, complete } = await readJson(cookie, "timetable/week", {
            start: portalDate(start), end: portalDate(addDays(start, 6)),
            date: portalDate(start < from ? from : start),
        });
        if (!Array.isArray(events) || complete === false) {
            throw portalError("IU chưa trả đầy đủ lịch chi tiết của tuần.");
        }
        return events;
    });
    const unique = new Map();
    for (const event of rows) {
        if (event?.type === "exam") continue;
        const date = normalizeDate(event?.date);
        if (event?.type !== "class" || !date) throw portalError("IU trả buổi học thiếu ngày hoặc loại lịch.");
        if (date < from || date > to) continue;
        const start = clock(event.startHour, event.startMinute);
        const end = clock(event.endHour, event.endMinute);
        if (!event.subjectName || !start || !end || end <= start) {
            throw portalError("IU trả buổi học thiếu môn hoặc giờ học hợp lệ.");
        }
        const key = JSON.stringify([event.classId || event.className, event.subjectName, date, start, end, event.roomName]);
        unique.set(key, {
            ngay: portalDate(date), thu: "", thoi_gian_bat_dau: start, thoi_gian_ket_thuc: end,
            ma_mon: event.subjectCode || "", ten_mon: event.subjectName, phong: event.roomName || "",
            giang_vien: event.teacher || "", hinh_thuc: event.studyMode || "", hoc_ky: "", nam_hoc: "",
        });
    }
    return [...unique.values()].sort((a, b) => normalizeDate(a.ngay).localeCompare(normalizeDate(b.ngay)) ||
        a.thoi_gian_bat_dau.localeCompare(b.thoi_gian_bat_dau));
}

function examClock(value) {
    const time = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || "").trim());
    return time ? clock(Number(time[1]), Number(time[2])) : "";
}

async function collectExams(cookie, opts = {}) {
    const { from, to, days } = getExamWindow(opts.soNgayLichThi);
    const page = await readPage(cookie, "thoikhoabieu/lichthi", ["periods", "initialPeriodId", "initialData"]);
    if (!Array.isArray(page.periods) || page.periods.some(period => !period?.id)) {
        throw portalError("IU chưa trả danh sách học kỳ lịch thi.");
    }
    const ids = new Set(page.periods.map(period => String(period.id)));
    if (opts.thoiGianId && !ids.has(String(opts.thoiGianId))) {
        throw portalError("Học kỳ lịch thi không có trong danh sách IU.", 400);
    }
    const selected = opts.thoiGianId ? [String(opts.thoiGianId)] : [...ids];
    const rows = await queryInBatches(selected, async period => {
        const { personal } = await readJson(cookie, "exam-schedule/schedule", { period, subject: "", history: "0" });
        if (!Array.isArray(personal)) throw portalError("IU chưa trả lịch thi cá nhân theo học kỳ.");
        return personal;
    });
    const unique = new Map();
    for (const row of rows) {
        const date = normalizeDate(row?.date);
        if (!date) throw portalError("IU trả lịch thi thiếu ngày.");
        if (date < from || date > to) continue;
        const [rangeStart, rangeEnd] = String(row.timeRange || "").split(/[-–—]/);
        const start = examClock(row.startTime) || examClock(rangeStart);
        const end = examClock(row.endTime) || examClock(rangeEnd);
        if (!row.subjectName || !start) throw portalError("IU trả lịch thi thiếu môn hoặc giờ thi.");
        const exam = {
            ma_mon: row.subjectCode || "", ten_mon: row.subjectName, ngay_thi: portalDate(date),
            gio_thi: end ? `${start} - ${end}` : start, phong_thi: row.roomName || "",
            hinh_thuc_thi: row.examForm || "",
        };
        unique.set(JSON.stringify([exam.ma_mon || exam.ten_mon, date, start, exam.phong_thi]), exam);
    }
    const exams = [...unique.values()].sort((a, b) => normalizeDate(a.ngay_thi).localeCompare(normalizeDate(b.ngay_thi)) ||
        a.gio_thi.localeCompare(b.gio_thi));
    return { exams, range: { from, to, days } };
}

module.exports = { timetableRange, layLichHoc, collectExams };
