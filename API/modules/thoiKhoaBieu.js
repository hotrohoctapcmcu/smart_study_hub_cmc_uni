const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');

const router = express.Router();
let db;

const loi = (message, statusCode = 400) =>
    Object.assign(new Error(message), { statusCode });

const xuLy = callback => async (req, res, next) => {
    try {
        res.json({ success: true, ...await callback(req) });
    } catch (err) {
        next(err);
    }
}; 

async function layTheoNgay(userId, ngay) {
    if (!ngay) throw loi('ngay là bắt buộc (YYYY-MM-DD).');
    return db.layThoiKhoaBieuTheoNgay(userId, ngay);
}

async function layTheoTuan(userId, tuNgay, denNgay) {
    if (!tuNgay || !denNgay) throw loi('tuNgay và denNgay là bắt buộc.');
    return db.layThoiKhoaBieuTheoTuan(userId, tuNgay, denNgay);
}

async function themTietHoc(userId, data) {
    if (!data?.subjectId || !data?.className || !data?.room) {
        throw loi('subjectId, className và room là bắt buộc.');
    }
    return db.themTietHoc(userId, data);
}

async function kiemTraXungDot(userId, studyDate, startTime, endTime, excludeScheduleId = null) {
    if (!studyDate || !startTime || !endTime) {
        throw loi('studyDate, startTime và endTime là bắt buộc.');
    }
    return db.kiemTraXungDotLichTuHoc(
        userId, studyDate, startTime, endTime, excludeScheduleId
    );
}

async function xepLichTuHoc(userId, data) {
    if (!data?.title || !data?.studyDate || !data?.startTime || !data?.endTime) {
        throw loi('title, studyDate, startTime và endTime là bắt buộc.');
    }
    return db.xepLichTuHoc(userId, data);
}


router.get('/', xuLy(async req => ({
    data: await db.layThoiKhoaBieu(NGUOI_DUNG_ID)
})));

router.get('/today', xuLy(async req => {
    const date = new Date().toISOString().split('T')[0];
    return { date, data: await layTheoNgay(NGUOI_DUNG_ID, date) };
}));

router.get('/by-date', xuLy(async req => ({
    date: req.query.date,
    data: await layTheoNgay(NGUOI_DUNG_ID, req.query.date)
})));

router.get('/by-week', xuLy(async req => ({
    from: req.query.from,
    to: req.query.to,
    data: await layTheoTuan(NGUOI_DUNG_ID, req.query.from, req.query.to)
})));

router.post('/', async (req, res, next) => {
    try {
        const data = await themTietHoc(NGUOI_DUNG_ID, req.body);
        res.status(201).json({ success: true, message: 'Đã thêm tiết học.', data });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', xuLy(async req => {
    if (!req.params.id) throw loi('timetableId là bắt buộc.');
    await db.xoaTietHoc(req.params.id, NGUOI_DUNG_ID);
    return { message: 'Đã xóa tiết học.' };
}));

router.get('/conflicts/check', xuLy(async req => {
    const conflicts = await db.kiemTraTrungLich(NGUOI_DUNG_ID);
    return { hasConflict: conflicts.length > 0, conflicts };
}));

router.post('/conflicts/check', xuLy(async req => {
    const { studyDate, startTime, endTime, excludeScheduleId } = req.body || {};
    const conflicts = await kiemTraXungDot(
        NGUOI_DUNG_ID, studyDate, startTime, endTime, excludeScheduleId
    );
    return { hasConflict: conflicts.length > 0, conflicts };
}));

router.get('/study', xuLy(async req => ({
    data: await db.layLichTuHoc(NGUOI_DUNG_ID, req.query.from || null, req.query.to || null)
})));

router.post('/study', async (req, res, next) => {
    try {
        const data = await xepLichTuHoc(NGUOI_DUNG_ID, req.body);
        res.status(201).json({ success: true, message: 'Đã xếp lịch tự học.', data });
    } catch (err) {
        next(err);
    }
});

router.patch('/study/:id/status', xuLy(async req => {
    const { status } = req.body || {};
    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    if (!status || !validStatuses.includes(status)) {
        throw loi(`status phải là một trong: ${validStatuses.join(', ')}`);
    }

    const updated = await db.capNhatTrangThaiLichTuHoc(req.params.id, status, NGUOI_DUNG_ID);
    if (!updated) throw loi('Không tìm thấy lịch tự học.', 404);
    return { message: 'Đã cập nhật trạng thái lịch tự học.' };
}));

/**
 * Sửa nội dung một buổi tự học (giờ/ngày/tiêu đề/ghi chú).
 * PATCH /study/:id/status chỉ đổi trạng thái; sửa giờ phải qua route này.
 */
router.put('/study/:id', xuLy(async req => {
    const data = await db.capNhatLichTuHoc(NGUOI_DUNG_ID, req.params.id, req.body || {});
    if (!data) throw loi('Không tìm thấy lịch tự học.', 404);
    return { message: 'Đã cập nhật lịch tự học.', data };
}));

router.delete('/study/:id', xuLy(async req => {
    const deleted = await db.xoaLichTuHoc(req.params.id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy lịch tự học.', 404);
    return { message: 'Đã xóa lịch tự học.' };
}));

router.get('/study/free-slots', xuLy(async req => {
    const { date, duration = 60 } = req.query;
    if (!date) throw loi('date là bắt buộc.');

    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes <= 0) {
        throw loi('duration phải là số nguyên dương.');
    }

    return {
        date,
        freeSlots: await db.timKhoangTrongTuHoc(NGUOI_DUNG_ID, date, minutes)
    };
}));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};
