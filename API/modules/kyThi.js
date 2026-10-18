const express = require('express');
const { verifyToken } = require('../shared/auth');

const router = express.Router();
let db;

const loi = message => Object.assign(new Error(message), { statusCode: 400 });

const xuLy = (callback, status = 200) => async (req, res, next) => {
    try {
        res.status(status).json({ success: true, ...await callback(req) });
    } catch (err) {
        next(err);
    }
};

const trangThaiHopLe = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

router.use(verifyToken);

router.get('/', xuLy(async req => ({
    data: await db.layLichThi(req.user.id)
})));

router.get('/upcoming', xuLy(async req => ({
    data: await db.layLichThiSapToi(req.user.id)
})));

router.get('/study-plans', xuLy(async req => ({
    data: await db.layKeHoachOnThi(req.user.id)
})));

router.post('/', xuLy(async req => {
    const { subjectId, examDate, examTime, room } = req.body;

    if (!subjectId || !examDate || !examTime || !room) {
        throw loi('subjectId, examDate, examTime và room là bắt buộc.');
    }

    return {
        message: 'Đã thêm kỳ thi.',
        data: await db.themLichThi(req.user.id, req.body)
    };
}, 201));

router.post('/study-plans', xuLy(async req => {
    const { examId, phaseTitle, startDate, endDate } = req.body;

    if (!examId || !phaseTitle || !startDate || !endDate) {
        throw loi('examId, phaseTitle, startDate và endDate là bắt buộc.');
    }

    return {
        message: 'Đã tạo kế hoạch ôn thi.',
        data: await db.taoKeHoachOnThi(req.user.id, req.body)
    };
}, 201));

router.patch('/study-plans/:id/status', xuLy(async req => {
    const { status } = req.body;

    if (!trangThaiHopLe.includes(status)) {
        throw loi(`status phải là: ${trangThaiHopLe.join(', ')}`);
    }

    await db.capNhatTrangThaiKeHoachOnThi(req.params.id, status);
    return { message: 'Đã cập nhật trạng thái kế hoạch ôn thi.' };
}));

router.delete('/study-plans/:id', xuLy(async req => {
    await db.xoaKeHoachOnThi(req.params.id);
    return { message: 'Đã xóa giai đoạn kế hoạch ôn thi.' };
}));

router.get('/:examId/study-plans', xuLy(async req => ({
    examId: req.params.examId,
    data: await db.layKeHoachOnThi(req.user.id, req.params.examId)
})));

router.delete('/:id', xuLy(async req => {
    await db.xoaLichThi(req.params.id);
    return { message: 'Đã xóa kỳ thi và dữ liệu liên quan.' };
}));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
}; 