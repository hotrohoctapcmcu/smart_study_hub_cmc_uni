"use strict";

const MAX_EXAM_LOOKAHEAD_DAYS = 70;
const DAY_MS = 86400000;

function vietnamToday(now = new Date()) {
    return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}

function addDays(date, days) {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function portalDate(date) { return date.split("-").reverse().join("/"); }

function normalizeDate(value) {
    const text = String(value || "").trim();
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/.exec(text);
    const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
        : (/^\d{4}-\d{2}-\d{2}(?=$|T|\s)/.exec(text) || [])[0];
    if (!iso) return null;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function getExamWindow(days = MAX_EXAM_LOOKAHEAD_DAYS, now = new Date()) {
    const lookaheadDays = Number(days);
    if (!["number", "string"].includes(typeof days) || !Number.isInteger(lookaheadDays)
        || lookaheadDays < 1 || lookaheadDays > MAX_EXAM_LOOKAHEAD_DAYS) {
        throw Object.assign(new Error(`soNgayLichThi phải từ 1 đến ${MAX_EXAM_LOOKAHEAD_DAYS} ngày.`), { statusCode: 400 });
    }
    const from = vietnamToday(now);
    const to = addDays(from, lookaheadDays);
    const weeklyDates = [];
    for (let offset = 0; offset <= lookaheadDays; offset += 7) weeklyDates.push(portalDate(addDays(from, offset)));
    if (weeklyDates.at(-1) !== portalDate(to)) weeklyDates.push(portalDate(to));
    return { from, to, days: lookaheadDays, weeklyDates };
}

function rowsFrom(value) {
    const rows = value?.rsLichThiCaNhan || value?.rsKeHoachThiChung || (Array.isArray(value) ? value : []);
    return Array.isArray(rows) ? rows : [];
}

function filterExams(rows, mapRows, range) {
    const found = new Set();
    return mapRows(rows).filter(exam => {
        const date = normalizeDate(exam.ngay_thi);
        if (!date || date < range.from || date > range.to) return false;
        const key = JSON.stringify([exam.ma_mon, exam.ten_mon, date, exam.gio_thi, exam.phong_thi]);
        if (found.has(key)) return false;
        found.add(key);
        return true;
    }).sort((a, b) => normalizeDate(a.ngay_thi).localeCompare(normalizeDate(b.ngay_thi)) || a.gio_thi.localeCompare(b.gio_thi));
}

/** Cả luồng kéo riêng và đồng bộ đầy đủ đều dùng cùng cửa sổ lịch thi. */
async function collectExamSchedule(request, mapRows, opts = {}) {
    const range = getExamWindow(opts.soNgayLichThi);
    const rows = [];
    let failedWeeks = 0;
    // Endpoint nhận một ngày đang chọn, không nhận khoảng ngày: tra từng tuần.
    for (let offset = 0; offset < range.weeklyDates.length; offset += 3) {
        const results = await Promise.allSettled(range.weeklyDates.slice(offset, offset + 3).map(date =>
            request("LayTTLichThi", { strNgayDangChon: date })));
        for (const result of results) {
            if (result.status === "fulfilled") rows.push(...rowsFrom(result.value));
            else {
                if ([401, 403].includes(result.reason?.statusCode)) throw result.reason;
                failedWeeks++;
            }
        }
    }
    const metadata = { from: range.from, to: range.to, days: range.days };
    const weeklyExams = filterExams(rows, mapRows, range);
    if (!failedWeeks && weeklyExams.length) return { exams: weeklyExams, range: metadata, source: "weekly" };

    // Portal khác phiên bản có thể chỉ hỗ trợ endpoint theo học kỳ.
    // Quét các kỳ giao với cửa sổ, không cố định học kỳ đầu hoặc cờ "hiện tại".
    let terms;
    try { terms = await request("LayDSThoiGianLichThi", {}); }
    catch (error) {
        if ([401, 403].includes(error.statusCode) || failedWeeks) throw error;
        return { exams: weeklyExams, range: metadata, source: "weekly" };
    }
    const candidates = (Array.isArray(terms) ? terms : []).filter(term => {
        if (!term?.ID) return false;
        if (opts.thoiGianId) return String(term.ID) === String(opts.thoiGianId);
        const from = normalizeDate(term.NGAYBATDAU || term.TUNGAY || term.NGAYBATDAU_HIENTHI);
        const to = normalizeDate(term.NGAYKETTHUC || term.DENNGAY || term.NGAYKETTHUC_HIENTHI);
        return (!from || from <= range.to) && (!to || to >= range.from);
    });
    let complete = candidates.length > 0;
    for (const term of candidates) {
        let courses;
        try {
            courses = await request("LayDSHocPhanLichThi", {
                strDaoTao_ThoiGianDaoTao_Id: term.ID, strTHI_DotThi_Id: "", strDiem_ThanhPhanDiem_Id: ""
            });
        } catch (error) {
            if ([401, 403].includes(error.statusCode)) throw error;
            complete = false;
            continue;
        }
        const list = Array.isArray(courses) ? courses : courses?.rsDanhSach || courses?.rsHocPhan || courses?.rs || courses?.data || [];
        const ids = [...new Set((Array.isArray(list) ? list : []).map(course => course?.ID || course?.DAOTAO_HOCPHAN_ID
            || course?.DAOTAO_HOCPHANID || course?.HOCPHAN_ID || course?.strDaoTao_HocPhan_Id).filter(Boolean))];
        for (const id of ["", ...ids]) {
            try {
                const result = await request("LayDSLichThi_KeHoachThi", {
                    strDaoTao_ThoiGianDaoTao_Id: term.ID, strDaoTao_HocPhan_Id: id
                });
                rows.push(...rowsFrom(result));
            } catch (error) {
                if ([401, 403].includes(error.statusCode)) throw error;
                if (id || !ids.length) complete = false;
            }
        }
    }
    if (!complete) {
        if (failedWeeks) throw Object.assign(new Error("Chưa lấy đủ lịch thi trong khoảng đã chọn. Giữ nguyên dữ liệu đã đồng bộ trước đó."), { statusCode: 502 });
        return { exams: weeklyExams, range: metadata, source: "weekly" };
    }
    return { exams: filterExams(rows, mapRows, range), range: metadata, source: "semester" };
}

module.exports = { MAX_EXAM_LOOKAHEAD_DAYS, vietnamToday, addDays, portalDate, normalizeDate, getExamWindow, collectExamSchedule };
