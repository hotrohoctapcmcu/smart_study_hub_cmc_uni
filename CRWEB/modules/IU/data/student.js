"use strict";

const { schemaRong } = require("./schema");
const { portalError } = require("./student-client");
const calendar = require("./student-calendar");
const academic = require("./student-academic");

async function keepResult(group, load, failures) {
    try { return await load(); }
    catch (error) {
        if (error?.code === "SESSION_EXPIRED" || error?.statusCode === 400) throw error;
        failures.push(`${group}: ${error.message}`);
        return null;
    }
}

async function layKetQuaHocTapTho(cookie, opts = {}) {
    return academic.transcript(cookie, await academic.gradePage(cookie), opts.chuongTrinhId);
}

async function layDuLieuChuongTrinh(cookie, opts = {}) {
    const thatBai = [];
    const [profile, gradesPage] = await Promise.all([
        academic.layHoSoSinhVien(cookie),
        keepResult("Thông tin tích lũy", () => academic.gradePage(cookie), thatBai),
    ]);
    const curriculum = await academic.curriculum(cookie, opts.chuongTrinhId, gradesPage);
    if (!curriculum.chuong_trinh.tong_tin_chi) thatBai.push("IU chưa cung cấp tổng tín chỉ chương trình.");
    return { data: { IU: {
        ho_so_sinh_vien: { thong_tin_ca_nhan: profile },
        goc_hoc_tap: curriculum,
    } }, thatBai };
}

async function layTatCaIU(cookie, opts = {}) {
    const data = schemaRong();
    const out = data.IU;
    const thatBai = [];
    const profile = await academic.layHoSoSinhVien(cookie);
    out.ho_so_sinh_vien.thong_tin_ca_nhan = profile;
    out.lich_hoc.fetched = false;
    out.lich_thi.fetched = false;
    const gradesPage = keepResult("Kết quả học tập", () => academic.gradePage(cookie), thatBai);
    const timetable = opts.ngayBatDau || opts.ngayKetThuc
        ? keepResult("Lịch học", async () => ({
            range: calendar.timetableRange(opts),
            chi_tiet_thoi_khoa_bieu: await calendar.layLichHoc(cookie, opts),
            fetched: true,
        }), thatBai) : null;
    const exams = keepResult("Lịch thi", () => calendar.collectExams(cookie, opts), thatBai);
    const news = keepResult("Tin tức", () => academic.layTinTuc(cookie), thatBai);
    const reviews = keepResult("Phúc khảo", () => academic.layPhucKhao(cookie), thatBai);
    const courses = keepResult("Chương trình học", async () =>
        academic.curriculum(cookie, opts.chuongTrinhId, await gradesPage), thatBai);
    const results = keepResult("Bảng điểm", async () => {
        const page = await gradesPage;
        if (!page) return null;
        const transcript = await academic.transcript(cookie, page, opts.chuongTrinhId);
        const scores = academic.gradesFrom(transcript);
        const failed = await keepResult("Học phần chưa hoàn thành", () => academic.failedCoursesFrom(transcript), thatBai);
        return { scores, failed };
    }, thatBai);
    const registration = keepResult("Kết quả đăng ký", async () => {
        const page = await gradesPage;
        return page && academic.layKetQuaDangKy(cookie, page, opts.thoiGianId);
    }, thatBai);
    const conduct = keepResult("Điểm rèn luyện", async () => {
        const page = await gradesPage;
        return page && academic.layDiemRenLuyen(cookie, page, opts.chuongTrinhId);
    }, thatBai);

    const [timetableData, examData, newsData, reviewData, curriculum, scoreData, registrationData, conductData] =
        await Promise.all([timetable, exams, news, reviews, courses, results, registration, conduct]);
    if (timetableData) out.lich_hoc = timetableData;
    if (examData) out.lich_thi = { chi_tiet_lich_thi: examData.exams, fetched: true, range: examData.range };
    if (newsData) out.tin_tuc = newsData;
    if (reviewData) out.goc_hoc_tap.dang_ky_xin_phuc_khao = reviewData;
    if (curriculum) Object.assign(out.goc_hoc_tap, curriculum);
    if (scoreData) {
        out.goc_hoc_tap.tra_cuu_diem.bang_diem = scoreData.scores;
        if (scoreData.failed) out.goc_hoc_tap.tra_cuu_diem.hoc_phan_no = scoreData.failed;
    }
    if (registrationData) out.goc_hoc_tap.tra_cuu_diem.ket_qua_dang_ky = registrationData;
    if (conductData) out.goc_hoc_tap.diem_ren_luyen = conductData;
    return { data, thatBai };
}

module.exports = {
    layTatCaIU,
    layDuLieuChuongTrinh,
    layKetQuaHocTapTho,
    layHoSoSinhVien: academic.layHoSoSinhVien,
    layTinTuc: academic.layTinTuc,
    layLichHoc: calendar.layLichHoc,
    layLichThi: async (cookie, opts) => (await calendar.collectExams(cookie, opts)).exams,
    layBangDiem: async (cookie, opts) => academic.gradesFrom(await layKetQuaHocTapTho(cookie, opts)),
    layHocPhanNo: async (cookie, opts) => academic.failedCoursesFrom(await layKetQuaHocTapTho(cookie, opts)),
    layChuongTrinhId: async (cookie, opts) => opts.chuongTrinhId || (await academic.gradePage(cookie)).initialProgramId || "",
    layChuongTrinhHoc: async (cookie, opts) => (await academic.curriculum(cookie, opts.chuongTrinhId)).chuong_trinh_hoc_tap,
    layKetQuaDangKy: async (cookie, opts) => academic.layKetQuaDangKy(cookie, await academic.gradePage(cookie), opts.thoiGianId),
    layDiemRenLuyen: async (cookie, opts) => academic.layDiemRenLuyen(cookie, await academic.gradePage(cookie), opts.chuongTrinhId),
    layPhucKhao: (cookie, opts) => academic.layPhucKhao(cookie, opts.thoiGianId),
    layVanBang: async () => { throw portalError("Cổng sinh viên IU chưa có nguồn văn bằng được xác nhận.", 501); },
};
