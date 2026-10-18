/**
 * API/shared/iu-client.js
 * ===================================================================================
 * ADAPTER GỌI NHÁNH IU_VT TỪ API SERVER (NODE THƯỜNG, KHÔNG ELECTRON)
 * ===================================================================================
 * - Chỉ dùng các cụm chạy được trên Node: data / payload / crypto (+ capture
 *   khi có window, không dùng ở đây).
 * - KHÔNG require cụm login/window (cần Electron main process) ở top-level;
 *   login do client/Electron thực hiện rồi gửi cookie+session lên.
 * - IU_VT trả schema { IU: {...} }; adapter map sang shape dataIU phẳng mà
 *   database/functions/sync.js (saveIUData) đang nhận: MSV, ho_ten,
 *   ten_nganh_hoc, ngay_thang_nam_sinh, bang_diem, tkb, lich_thi.
 * ===================================================================================
 */

function loadIU() {
    // Require lười để API vẫn boot được nếu thiếu file IU_VT.
    // eslint-disable-next-line global-require
    return require('../../CRWEB/IU_VT');
}

function s(v) {
    return v == null ? '' : String(v);
}

// DD/MM/YYYY hoặc ISO -> DD/MM/YYYY cho convertDate() của saveIUData
function toDMY(v) {
    const str = s(v).trim();
    if (!str) return '';
    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
    m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`;
    return str;
}

function thuToDayOfWeek(thu) {
    const t = s(thu).trim().toLowerCase();
    if (!t) return null;
    // Số trực tiếp theo quy ước dự án: 2=T2 ... 7=T7, 8=CN
    const num = parseInt(t, 10);
    if (num >= 2 && num <= 8) return num;
    // Tên thứ tiếng Việt (có/không dấu) và tiếng Anh.
    if (/^(cn|chunhat|chủ nhật|sun|sunday)$/.test(t)) return 8;
    if (/^(t2|thu2|thứ 2|thứ hai|hai|mon|monday)$/.test(t)) return 2;
    if (/^(t3|thu3|thứ 3|thứ ba|ba|tue|tuesday)$/.test(t)) return 3;
    if (/^(t4|thu4|thứ 4|thứ tư|tu|wed|wednesday)$/.test(t)) return 4;
    if (/^(t5|thu5|thứ 5|thứ năm|nam|thu nam|thứ năm|thu5|thứ 5|thu 5|thứ năm|thu năm|thu nam)$/.test(t)) return 5;
    if (/^(t6|thu6|thứ 6|thứ sáu|sau|fri|friday)$/.test(t)) return 6;
    if (/^(t7|thu7|thứ 7|thứ bảy|bay|sat|saturday)$/.test(t)) return 7;
    // Dạng có tiền tố "Thứ ..." tự do.
    if (/chủ nhật|chu nhat|cn/.test(t)) return 8;
    if (/hai/.test(t)) return 2;
    if (/ba\b/.test(t)) return 3;
    if (/tư|tu\b/.test(t)) return 4;
    if (/năm|nam\b/.test(t)) return 5;
    if (/sáu|sau\b/.test(t)) return 6;
    if (/bảy|bay\b/.test(t)) return 7;
    return null;
}

// Suy ra thứ trong tuần (2..8) từ chuỗi ngày DD/MM/YYYY hoặc YYYY-MM-DD.
// Portal IU trả NGAYHOC chứ không trả THU cho từng buổi học.
function thuTuNgay(ngay) {
    const str = s(ngay).trim();
    if (!str) return null;
    let y, mo, d;
    let m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else {
        m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return null;
        y = +m[1]; mo = +m[2]; d = +m[3];
    }
    const jsDay = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=CN..6=T7
    return jsDay === 0 ? 8 : jsDay + 1;
}

/**
 * Map schema { IU: {...} } của IU_VT -> dataIU phẳng cho saveIUData().
 */
function mapSangDataIU(schema) {
    const iu = (schema && schema.IU) || {};
    const cn = (iu.ho_so_sinh_vien && iu.ho_so_sinh_vien.thong_tin_ca_nhan) || {};
    const goc = iu.goc_hoc_tap || {};
    const traCuu = goc.tra_cuu_diem || {};

    const bangDiemRaw = Array.isArray(traCuu.bang_diem) ? traCuu.bang_diem : [];
    const bang_diem = {};
    for (const mon of bangDiemRaw) {
        // Ghep ky tu HOCKY + NAMHOC that (VD "HK1 2026-2027"); fallback HK1.
        const hk = s(mon.hoc_ky).trim();
        const nam = s(mon.nam_hoc).trim();
        const ky = (hk || nam ? `${hk} ${nam}`.trim() : 'HK1').replace(/\s+/g, '_') || 'HK1';
        if (!bang_diem[ky]) bang_diem[ky] = {};
        const key = s(mon.ten_hoc_phan || mon.ma_mon).replace(/\s+/g, '_') || 'Mon_hoc';
        bang_diem[ky][key] = {
            so_tin_chi: Number(mon.so_tin_chi) || 3,
            diem_tong_ket: Number(mon.diem_he_10) || 0,
            diem_chu: s(mon.diem_chu) || 'B',
            trang_thai: (Number(mon.diem_he_10) || 0) >= 4 ? 'dat' : 'rot'
        };
    }

    const tkb = ((iu.lich_hoc && iu.lich_hoc.chi_tiet_thoi_khoa_bieu) || []).map((t) => ({
        ma_mon: s(t.ma_mon),
        ten_mon: s(t.ten_mon).replace(/\s+/g, '_'),
        ten_lop: s(t.hinh_thuc) || 'Lớp học phần',
        phong: s(t.phong),
        co_so: 'Cơ sở chính',
        // Portal IU không trả THU cho từng buổi — suy ra từ NGAYHOC.
        thu: thuToDayOfWeek(t.thu) || thuTuNgay(t.ngay) || 2,
        gio_bat_dau: s(t.thoi_gian_bat_dau) || '07:30',
        gio_ket_thuc: s(t.thoi_gian_ket_thuc) || '09:30',
        ngay_bat_dau: toDMY(t.ngay),
        ngay_ket_thuc: toDMY(t.ngay),
        giang_vien: s(t.giang_vien)
    }));

    const lich_thi = ((iu.lich_thi && iu.lich_thi.chi_tiet_lich_thi) || []).map((t) => {
        const gio = s(t.gio_thi).split('-')[0].trim();
        return {
            ma_mon: s(t.ma_mon),
            ten_mon: s(t.ten_mon).replace(/\s+/g, '_'),
            ngay_thi: toDMY(t.ngay_thi),
            gio_thi: gio || '08:00',
            phong_thi: s(t.phong_thi),
            co_so: 'Cơ sở chính'
        };
    });

    return {
        MSV: s(cn.ma_sinh_vien),
        ho_ten: s(cn.ho_ten),
        ten_nganh_hoc: s(cn.nganh),
        ngay_thang_nam_sinh: toDMY(cn.ngay_sinh),
        bang_diem,
        tkb,
        lich_thi
    };
}

/**
 * Khoảng ngày mặc định cho TKB khi client không truyền: từ 01/09 năm nay
 * tới 31/08 năm sau (bao quát năm học hiện tại).
 */
function khoangNgayMacDinh() {
    const now = new Date();
    // Nếu đang ở tháng 1-7 thì năm học bắt đầu từ năm trước.
    const namBatDau = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return {
        ngayBatDau: `01/09/${namBatDau}`,
        ngayKetThuc: `31/08/${namBatDau + 1}`
    };
}

/**
 * Kéo toàn bộ dữ liệu IU bằng cookie+session đã lưu (không mở trình duyệt).
 * @param {Object} session - session từ laySession (Electron)
 * @param {string} cookie - chuỗi cookie header
 * @param {Object} opts - { ngayBatDau, ngayKetThuc, log? }
 * @returns {Promise<{ data, thatBai }>} schema { IU: {...} } + lỗi từng nhóm
 */
async function keoDuLieuIU(session, cookie, opts = {}) {
    if (!session) throw Object.assign(new Error('session là bắt buộc.'), { statusCode: 400 });
    if (!cookie) throw Object.assign(new Error('cookie là bắt buộc.'), { statusCode: 400 });
    const iu = loadIU();
    // TKB chỉ lấy được khi có khoảng ngày — thiếu thì dùng năm học hiện tại,
    // tránh trường hợp đồng bộ xong báo 0 tiết TKB.
    const macDinh = khoangNgayMacDinh();
    return iu.layTatCaIU(session, cookie, {
        ...opts,
        ngayBatDau: opts.ngayBatDau || macDinh.ngayBatDau,
        ngayKetThuc: opts.ngayKetThuc || macDinh.ngayKetThuc
    });
}

/**
 * Kéo 1 nhóm dữ liệu (tkb / lichthi / bangdiem / hoso) bằng cookie đã lưu.
 */
async function keoNhomIU(session, cookie, nhom, opts = {}) {
    const iu = loadIU();
    switch (nhom) {
        case 'hoso':
            return iu.layHoSoSinhVien(session, cookie, opts);
        case 'bangdiem':
            return iu.layBangDiem(session, cookie, opts);
        case 'tkb':
            if (!opts.ngayBatDau || !opts.ngayKetThuc) {
                throw Object.assign(new Error('tkb cần ngayBatDau và ngayKetThuc (DD/MM/YYYY).'), { statusCode: 400 });
            }
            return iu.layLichHoc(session, cookie, opts);
        case 'lichthi':
            return iu.layLichThi(session, cookie, opts);
        default:
            throw Object.assign(new Error(`nhom không hỗ trợ: ${nhom} (hoso|bangdiem|tkb|lichthi).`), { statusCode: 400 });
    }
}

module.exports = { keoDuLieuIU, keoNhomIU, mapSangDataIU };
