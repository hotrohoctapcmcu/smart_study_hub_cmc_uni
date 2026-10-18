const express = require('express');
const { verifyToken } = require('../shared/auth');
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

router.use(verifyToken);

router.get('/sources', xuLy(() => ({ sources: layCacNguonDongBo() })));

router.post('/', xuLy(req => khoiTaoDongBo(req.body.sources, req.user.id), 202));

router.get('/status', xuLy(req => layTrangThaiJob(req.query.jobId)));

router.post('/iu/session', xuLy(req => {
    const { session, cookie, data, ttlMs } = req.body || {};
    const status = iuKho.saveSession(req.user.id, { session, cookie, data, ttlMs });

    return { message: 'Đã lưu phiên IU.', ...status };
}, 201));

router.get('/iu/status', xuLy(req => iuKho.getStatus(req.user.id)));

router.delete('/iu/session', xuLy(req => {
    iuKho.clearSession(req.user.id);
    return { message: 'Đã xoá phiên IU.' };
}));

router.post('/iu/pull', xuLy(async req => { 
    const saved = iuKho.getSession(req.user.id);
    if (!saved) throw loi('Chưa có phiên IU.', 401);

    const { ngayBatDau, ngayKetThuc, luuDb = true } = req.body || {};
    const { data, thatBai } = await keoDuLieuIU(saved.session, saved.cookie, { ngayBatDau, ngayKetThuc });

    iuKho.saveSession(req.user.id, {
        session: saved.session,
        cookie: saved.cookie,
        data
    });

    const savedDb = luuDb
        ? await db.dongBoHoSoIU(req.user.id, mapSangDataIU(data))
        : null;

    // Gắn lỗi từng nhóm vào message để frontend hiển thị được nguyên nhân
    // khi kết quả 0 tiết TKB / 0 kỳ thi (trước đây lỗi bị nuốt).
    let message = 'Đã kéo dữ liệu IU.';
    if (Array.isArray(thatBai) && thatBai.length) {
        message += ` Một số nhóm lỗi: ${thatBai.join('; ')}`;
    }

    return { message, thatBai, savedDb };
}));

router.post('/iu/group', xuLy(async req => {
    const saved = iuKho.getSession(req.user.id);
    if (!saved) throw loi('Chưa có phiên IU.', 401);

    const { nhom, ...opts } = req.body || {};
    const data = await keoNhomIU(saved.session, saved.cookie, nhom, opts);

    return { nhom, data };
}));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};