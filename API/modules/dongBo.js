const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');
const iuKho = require('../shared/iu-session');
const { keoDuLieuIU, keoNhomIU, mapSangDataIU } = require('../shared/iu-client');
const eduxKho = require('../shared/edux-session');
const { dangNhapEDUX, keoBaiTapEDUX, laHetPhien } = require('../shared/edux-client');

const router = express.Router();
let db;

const loi = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const xuLy = (callback, status = 200) => async (req, res, next) => {
    try {
        res.status(status).json({ success: true, ...await callback(req) });
    } catch (err) {
        next(err);
    }
};

function layCacNguonDongBo() {
    return [
        {
            id: 'IU',
            name: 'Cổng thông tin IU CMC',
            url: 'https://iu.cmcu.edu.vn/congthongtin/Index.aspx',
            description: 'Thời khóa biểu, bảng điểm, lịch thi, thông tin sinh viên',
            icon: 'university',
            isRequired: true
        },
        {
            id: 'EDUX',
            name: 'EduX CMC',
            url: 'https://edux.cmcu.edu.vn/',
            description: 'Bài giảng theo chương và bài tập AI của từng học phần',
            icon: 'book',
            isRequired: false
        }
    ];
}

function khoiTaoDongBo(sources, userId) {
    const hopLe = ['IU', 'EDUX'];

    if (!Array.isArray(sources) || !sources.length) {
        throw loi('Phải chọn ít nhất 1 nguồn đồng bộ.');
    }

    if (sources.some(source => !hopLe.includes(source))) {
        throw loi('Nguồn đồng bộ không hợp lệ.');
    }

    return {
        jobId: `sync_${userId}_${Date.now()}`,
        status: 'PENDING',
        sources,
        message: 'Đã khởi tạo đồng bộ.'
    };
}

function layTrangThaiJob(jobId) {
    if (!jobId) throw loi('jobId là bắt buộc.');

    return {
        jobId,
        status: 'PENDING',
        message: 'Đang chờ dữ liệu đồng bộ...',
        completedSources: [],
        pendingSources: ['IU', 'EDUX']
    };
}


/**
 * Xác định mã số sinh viên để ghi vào DB.
 * Ưu tiên MSV IU trả về; nếu nhóm hồ sơ lỗi/thiếu thì dùng mã đã lưu sẵn trong DB
 * (hồ sơ vẫn còn nguyên từ lần đồng bộ trước).
 * @param {string} maSinhVien - MSV từ mapSangDataIU()
 * @returns {Promise<string>}
 */
async function layMaSinhVien(maSinhVien) {
    const tuIU = String(maSinhVien == null ? '' : maSinhVien).trim();
    if (tuIU) return tuIU;

    try {
        // Ứng dụng chỉ có một hồ sơ sinh viên duy nhất, nên lấy thẳng bản ghi đầu tiên
        // (không dùng layHoSo(NGUOI_DUNG_ID) vì student_id không nhất thiết bằng userId).
        const rows = await db.executeQuery(
            'SELECT student_code FROM Students ORDER BY student_id LIMIT 1'
        );
        const daLuu = rows.length ? String(rows[0].student_code || '').trim() : '';
        if (daLuu) return daLuu;
    } catch { /* DB chưa sẵn sàng — rơi xuống lỗi bên dưới */ }

    throw loi(
        'Không lấy được mã số sinh viên từ cổng IU. ' +
        'Hãy đăng nhập IU lại rồi đồng bộ để tải nhóm Hồ sơ sinh viên.'
    );
}

router.get('/sources', xuLy(() => ({ sources: layCacNguonDongBo() })));

router.post('/', xuLy(req => khoiTaoDongBo(req.body.sources, NGUOI_DUNG_ID), 202));

router.get('/status', xuLy(req => layTrangThaiJob(req.query.jobId)));

router.post('/iu/session', xuLy(req => {
    const { session, cookie, data, ttlMs } = req.body || {};
    const status = iuKho.saveSession(NGUOI_DUNG_ID, { session, cookie, data, ttlMs });

    return { message: 'Đã lưu phiên IU.', ...status };
}, 201));

router.get('/iu/status', xuLy(req => iuKho.getStatus(NGUOI_DUNG_ID)));

router.delete('/iu/session', xuLy(req => {
    iuKho.clearSession(NGUOI_DUNG_ID);
    return { message: 'Đã xoá phiên IU.' };
}));

router.post('/iu/pull', xuLy(async req => {
    const saved = iuKho.getSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên IU.', 401);

    const { ngayBatDau, ngayKetThuc, luuDb = true } = req.body || {};
    const { data, thatBai } = await keoDuLieuIU(saved.session, saved.cookie, { ngayBatDau, ngayKetThuc });

    iuKho.saveSession(NGUOI_DUNG_ID, {
        session: saved.session,
        cookie: saved.cookie,
        data
    });

    const dataIU = mapSangDataIU(data);

    // saveIUData() khoá hồ sơ theo MÃ SỐ SINH VIÊN, không phải userId nội bộ.
    // Trước đây truyền NGUOI_DUNG_ID (number) nên .trim() ném TypeError.
    const studentCode = await layMaSinhVien(dataIU.MSV);

    const savedDb = luuDb
        ? await db.dongBoHoSoIU(studentCode, dataIU)
        : null;


    let message = 'Đã kéo dữ liệu IU.';
    if (Array.isArray(thatBai) && thatBai.length) {
        message += ` Một số nhóm lỗi: ${thatBai.join('; ')}`;
    }

    return { message, thatBai, savedDb };
}));

router.post('/iu/group', xuLy(async req => {
    const saved = iuKho.getSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên IU.', 401);

    const { nhom, ...opts } = req.body || {};
    const data = await keoNhomIU(saved.session, saved.cookie, nhom, opts);

    return { nhom, data };
}));

// ─── Nhánh EDUX (đăng nhập bằng tài khoản EDUX -> phiên RAM -> kéo bài tập) ───

/**
 * Đăng nhập EDUX bằng email + mật khẩu người dùng nhập.
 * Mật khẩu chỉ dùng cho đúng lời gọi loginEdux() rồi bị bỏ; không lưu, không log.
 */
router.post('/edux/session', xuLy(async req => {
    const { email, password } = req.body || {};
    if (!email || !password) throw loi('email và password là bắt buộc.');

    let phien;
    try {
        phien = await dangNhapEDUX({ email, password });
    } catch (err) {
        // Sai thông tin đăng nhập: không giữ lại phiên cũ (nếu có) để tránh dùng nhầm.
        if (err.statusCode === 401) eduxKho.clearSession(NGUOI_DUNG_ID);
        throw err;
    }

    const status = eduxKho.saveSession(NGUOI_DUNG_ID, {
        cookie: phien.cookie,
        email: phien.email
    });

    return { message: 'Đã đăng nhập EDUX.', ...status };
}, 201));

router.get('/edux/status', xuLy(() => eduxKho.getStatus(NGUOI_DUNG_ID)));

router.delete('/edux/session', xuLy(async () => {
    eduxKho.clearSession(NGUOI_DUNG_ID);
    // Xoá cả bài tập EDUX đã lưu trong DB: ngắt kết nối nghĩa là không còn
    // dùng dữ liệu của cổng trường đó nữa.
    const daXoa = await db.xoaBaiTapEDUX(NGUOI_DUNG_ID);
    return { message: `Đã xoá phiên EDUX và ${daXoa} bài tập đã lưu.`, removed: daXoa };
}));

/**
 * Kéo bài tập AI từ EDUX bằng phiên đã lưu.
 * Trả về đúng shape task frontend đang dùng (id/title/subject/due/status/...).
 */
router.post('/edux/pull', xuLy(async req => {
    const saved = eduxKho.getSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);

    const { subjectId, questions = false } = req.body || {};

    let ketQua;
    try {
        ketQua = await keoBaiTapEDUX(saved.cookie, { subjectId, questions: questions === true });
    } catch (err) {
        // 401 = cookie EDUX hết hạn/không hợp lệ -> xoá phiên để FE yêu cầu đăng nhập lại.
        if (laHetPhien(err)) {
            eduxKho.clearSession(NGUOI_DUNG_ID);
            throw loi('Phiên EDUX đã hết hạn. Hãy đăng nhập EDUX lại.', 401);
        }
        throw err;
    }

    // Ghi đè dữ liệu đã kéo để lần sau chỉ cần đọc lại trong RAM.
    eduxKho.saveSession(NGUOI_DUNG_ID, {
        cookie: saved.cookie,
        email: saved.email,
        data: ketQua.assignments,
        subjectIds: ketQua.subjectIds
    });

    // Lưu hẳn xuống SQLite — trước đây chỉ có trong RAM nên tắt app là mất,
    // mở lại không thấy bài tập nào trong DB.
    const daLuu = await db.luuBaiTapEDUX(NGUOI_DUNG_ID, ketQua.assignments);

    const soBai = ketQua.assignments.length;
    let message = `Đã kéo ${soBai} bài tập EDUX từ ${ketQua.subjects} học phần.`;
    if (daLuu.saved) message += ` Đã lưu ${daLuu.saved} bài vào cơ sở dữ liệu.`;
    if (daLuu.removed) message += ` Đã xoá ${daLuu.removed} bài không còn trên EDUX.`;
    if (ketQua.thatBai.length) {
        message += ` Một số chương lỗi: ${ketQua.thatBai.join('; ')}`;
    }

    return {
        message,
        assignments: ketQua.assignments,
        thatBai: ketQua.thatBai,
        saved: daLuu.saved,
        removed: daLuu.removed
    };
}));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};