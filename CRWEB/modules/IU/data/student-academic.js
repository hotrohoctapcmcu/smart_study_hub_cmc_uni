"use strict";

const { portalError, readJson, readPage } = require("./student-client");
const { mapBangDiem, mapChuongTrinhHoc } = require("./maps");

const text = value => value == null ? "" : String(value).trim();
const year = value => text(value).replace(/^(\d{4})_(\d{4})$/, "$1-$2");
const credit = value => {
    const amount = Number(text(value).replace(",", "."));
    return text(value) && Number.isFinite(amount) && amount >= 0 ? amount : null;
};

function requireRows(value, group) {
    if (!Array.isArray(value)) throw portalError(`IU chưa trả dữ liệu ${group}.`);
    return value;
}

async function layHoSoSinhVien(cookie) {
    const { student } = await readPage(cookie, "profile/hoso", ["student", "initialFields"]);
    if (!student?.studentCode || !student.fullName) throw portalError("IU chưa trả hồ sơ sinh viên.");
    return {
        ma_sinh_vien: text(student.studentCode), ho_ten: text(student.fullName),
        ngay_sinh: text(student.birthDate), gioi_tinh: text(student.gender), email: "", so_dien_thoai: "",
        lop: text(student.managingClass), nganh: text(student.major), khoa: "",
    };
}

function gradePage(cookie) {
    return readPage(cookie, "hoctap/diemhoc", ["programs", "initialProgramId", "initialTranscript"]);
}

async function transcript(cookie, page, programId) {
    const id = programId || page.initialProgramId;
    if (!id) throw portalError("IU chưa trả chương trình học của sinh viên.");
    if (id === page.initialProgramId) return page.initialTranscript;
    const { data } = await readJson(cookie, "grades/transcript", { program: id });
    return data;
}

function gradesFrom(data) {
    return mapBangDiem(requireRows(data?.scores, "bảng điểm").map(row => ({
        DAOTAO_HOCPHAN_MA: row.subjectCode, DAOTAO_HOCPHAN_TEN: row.subjectName,
        DAOTAO_HOCPHAN_HOCTRINH: credit(row.credits), DIEM: credit(row.score10), DIEMQUYDOI: credit(row.score4),
        DIEMQUYDOI_TEN: row.scoreLetter, HOCKY: row.semester, NAMHOC: year(row.year),
        LANHOC: row.attempt, LANTHI: row.examAttempt, DANHGIA_TEN: row.evaluation,
    })));
}

function failedCoursesFrom(data) {
    return requireRows(data?.failedSubjects, "học phần chưa hoàn thành").map(row => ({
        ma_mon: text(row.subjectCode), ten_mon: text(row.subjectName),
        so_tin_chi: credit(row.credits) ?? 0, hoc_ky: text(row.semester), nam_hoc: year(row.year),
    }));
}

async function layKetQuaDangKy(cookie, page, periodId) {
    const selected = periodId || page.initialPeriodId;
    if (!selected) return [];
    const registration = selected === page.initialPeriodId ? page.initialRegistration
        : (await readJson(cookie, "grades/registration", { period: selected })).data;
    return requireRows(registration?.current, "kết quả đăng ký").map(row => ({
        ma_mon: text(row.subjectCode), ten_mon: text(row.subjectName || row.className),
        so_tin_chi: credit(row.credits) ?? 0, trang_thai: "Đã đăng ký",
    }));
}

async function layDiemRenLuyen(cookie, page, programId) {
    const id = programId || page.initialProgramId;
    const conduct = id === page.initialProgramId ? page.initialConduct
        : (await readJson(cookie, "grades/conduct", { program: id })).data;
    return requireRows(conduct?.bySemester, "điểm rèn luyện").map(row => ({
        hoc_ky: text(row.time), nam_hoc: "", diem: credit(row.score), chi_tiet: {},
    }));
}

async function curriculum(cookie, programId, gradesPage = null) {
    const { programs, initialProgramId, initialData } = await readPage(cookie, "hoctap/chuontrinhhoc",
        ["programs", "initialProgramId", "initialData"]);
    if (programId && programId !== initialProgramId) {
        throw portalError("Cổng sinh viên IU chưa cung cấp danh mục cho chương trình đã chọn.", 400);
    }
    const program = requireRows(programs, "chương trình học").find(row => row.id === initialProgramId);
    if (!program) throw portalError("IU chưa trả chương trình học của sinh viên.");
    const programTotal = credit(program.totalCredits);
    const gradeTotal = gradesPage?.initialProgramId === initialProgramId
        ? credit(gradesPage.initialTranscript?.totalStats?.totalCreditsProgram) : null;
    const total = programTotal > 0 ? programTotal : gradeTotal > 0 ? gradeTotal : null;
    const courses = requireRows(initialData?.subjects, "danh mục học phần").map(row => {
        const term = /^(\d{4}_\d{4})_(\d+)(?:\(\d+\))?$/.exec(text(row.plannedSemester));
        return {
            DAOTAO_HOCPHAN_MA: row.subjectCode, DAOTAO_HOCPHAN_TEN: row.subjectName,
            DAOTAO_HOCPHAN_HOCTRINH: row.creditsStudy, HOCKY: term?.[2], NAMHOC: year(term?.[1]),
            TENKHOI: row.knowledgeBlock,
        };
    });
    const blocks = gradesPage?.initialProgramId === initialProgramId ? gradesPage.initialBlocks?.summary : null;
    return {
        chuong_trinh: {
            ma: initialProgramId, ten: text(program.name), tong_tin_chi: total,
            nguon_tong_tin_chi: programTotal > 0 ? "SinhVien.chuongTrinhHoc.programs.totalCredits"
                : total ? "SinhVien.diemHoc.initialTranscript.totalStats.totalCreditsProgram" : null,
        },
        chuong_trinh_fetched: true,
        chuong_trinh_hoc_tap: mapChuongTrinhHoc([], courses),
        khoi_kien_thuc: Array.isArray(blocks) ? blocks.map(row => ({
            ma: text(row.code), ten: text(row.name), tong_tin_chi: credit(row.totalCredits),
            tin_chi_bat_buoc: credit(row.required), tin_chi_dat: credit(row.cumulative),
        })) : null,
    };
}

async function layTinTuc(cookie) {
    const { initialNews } = await readPage(cookie, "tintuc", ["initialNews"]);
    return requireRows(initialNews, "tin tức").map(row => ({
        loai: text(row.category), tieu_de: text(row.title), noi_dung: text(row.content),
        thoi_gian: text(row.date),
    }));
}

async function layPhucKhao(cookie, periodId) {
    const { periods, initialItems, initialPeriodId } = await readPage(cookie, "hoctap/phuckhao",
        ["periods", "initialItems", "initialPeriodId"]);
    if (periodId && periodId !== initialPeriodId) {
        throw portalError("Cổng sinh viên IU chưa cung cấp phúc khảo cho học kỳ đã chọn.", 400);
    }
    const period = Array.isArray(periods) ? periods.find(row => row.id === initialPeriodId) : null;
    return requireRows(initialItems, "phúc khảo").map(row => ({
        hoc_ky: text(period?.name), nam_hoc: "", ma_mon: text(row.subjectCode), ten_mon: text(row.subjectName),
        ly_do: "", ngay_dang_ky: text(row.registerDate), trang_thai: text(row.reviewStatus),
    }));
}

module.exports = {
    gradePage, transcript, gradesFrom, failedCoursesFrom, curriculum,
    layHoSoSinhVien, layKetQuaDangKy, layDiemRenLuyen, layTinTuc, layPhucKhao,
};
