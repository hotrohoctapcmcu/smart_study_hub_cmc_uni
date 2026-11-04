'use strict';

// Synthetic fixture, not a raw authenticated response. portalResults/portalBlocks
// use field names and selection rules verified in the live diemhoc.js on 2026-11-05.
module.exports = {
    programs: [{ ID: 'PROGRAM-K4', TEN: 'Cử nhân Kỹ thuật phần mềm_K4' }],
    results: {
        rsThongTinNguoiHoc: [{ QLSV_NGUOIHOC_MASO: 'BSE250001', QLSV_NGUOIHOC_TEN: 'Curriculum tester', TONGSOHOCTRINH: 126 }],
        rsDiemKetThucHocPhan: [], rsDiemThanhPhan: [], rsHocPhanChuaHoanThanh: [],
    },
    accumulated: {
        rsChiTiet: [
            { DAOTAO_HOCPHAN_MA: 'SENG3008', DAOTAO_HOCPHAN_TEN: 'Đồ án chuyên ngành KTPM', DAOTAO_HOCPHAN_HOCTRINH: 3, MAKHOI: 'CN', TENKHOI: 'Chuyên ngành' },
            { DAOTAO_HOCPHAN_MA: 'SENG3009', DAOTAO_HOCPHAN_TEN: 'Phát triển ứng dụng web nâng cao', DAOTAO_HOCPHAN_HOCTRINH: 3, MAKHOI: 'CN', TENKHOI: 'Chuyên ngành' },
            { DAOTAO_HOCPHAN_MA: 'INFO2011', DAOTAO_HOCPHAN_TEN: 'Công nghệ phần mềm', DAOTAO_HOCPHAN_HOCTRINH: 4, MAKHOI: 'CSN', TENKHOI: 'Cơ sở ngành' },
            { DAOTAO_HOCPHAN_MA: 'ZERO', DAOTAO_HOCPHAN_TEN: 'Học phần không tính tín chỉ', DAOTAO_HOCPHAN_HOCTRINH: 0 },
            { DAOTAO_HOCPHAN_MA: 'UNKNOWN', DAOTAO_HOCPHAN_TEN: 'Học phần chưa có số tín chỉ', DAOTAO_HOCPHAN_HOCTRINH: null },
        ],
        rsTongHop: [{ MAKHOI: 'ALL', TENKHOI: 'Tổng các khối', TONGSOHOCTRINH: 203, SOHOCTRINHBATBUOC: 129, SOHOCTRINHDAT: 28 }],
    },
};

module.exports.portalResults = {
    rsThongTinNguoiHoc: [{ QLSV_NGUOIHOC_MASO: 'BSE250001', QLSV_NGUOIHOC_TEN: 'Curriculum tester' }],
    rsDiemTrungBinhChung: [
        { DAOTAO_THOIGIANDAOTAO_ID: 'SEMESTER', LOAIDIEMTRUNGBINH_MA: 'TRUNGBINHCHUNG', THUOCTINHLANTINH: 0, THANGDIEM_MA: '10', TONGSOTINCHICTDT: 150, TONGSOTINCHI: 20 },
        { DAOTAO_THOIGIANDAOTAO_ID: null, LOAIDIEMTRUNGBINH_MA: 'TRUNGBINHCHUNG', THUOCTINHLANTINH: 1, THANGDIEM_MA: '10', TONGSOTINCHICTDT: 140 },
        { DAOTAO_THOIGIANDAOTAO_ID: null, LOAIDIEMTRUNGBINH_MA: 'TRUNGBINHCHUNG', THUOCTINHLANTINH: 0, THANGDIEM_MA: '10', TONGSOTINCHICTDT: 126, TONGSOTINCHI: 28 },
        { DAOTAO_THOIGIANDAOTAO_ID: null, LOAIDIEMTRUNGBINH_MA: 'TRUNGBINHTICHLUY', THUOCTINHLANTINH: 0, THANGDIEM_MA: '10', TONGSOTINCHI: 25 },
    ],
};
module.exports.portalBlocks = [
    ['CN', 'Chuyên ngành', 9, 9, null], ['CSKN', 'Cơ sở khối ngành', 31, 31, 15],
    ['CSN', 'Cơ sở ngành', 25, 25, ''], ['KHCB', 'Toán và khoa học cơ bản', 9, 9, 3],
    ['KNM', 'Kỹ năng mềm', 2, 2, 2], ['LLCT', 'Lý luận chính trị và pháp luật', 13, 13, 5],
    ['TTTN', 'Thực tập nghề nghiệp và tốt nghiệp', 16, 16, null], ['CSNTC', 'Cơ sở ngành (Tự chọn)', 40, 21, null],
    ['ENG', 'Tiếng Anh', 48, 0, 0], ['GDTC', 'GDTC', 10, 3, 3],
].map(([MAKHOI, TENKHOI, TONGSOTINCHICUAKHOI, SOBATBUOC, SODATICHLUY]) => ({ MAKHOI, TENKHOI, TONGSOTINCHICUAKHOI, SOBATBUOC, SODATICHLUY }));
