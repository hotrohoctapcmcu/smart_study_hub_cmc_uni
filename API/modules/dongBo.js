const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');
const iuKho = require('../shared/iu-session');
const { keoDuLieuIU, keoNhomIU, mapSangDataIU } = require('../shared/iu-client');

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
            description: 'Tài liệu môn học, bài giảng theo chương',
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

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};