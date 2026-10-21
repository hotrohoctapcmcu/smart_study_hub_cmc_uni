const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');

const router = express.Router();
let db;

const loi = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const trangThaiHopLe = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];

const kiemTra = (dieuKien, message) => {
    if (!dieuKien) throw loi(message);
};

const xuLy = (callback, status = 200, message = '') => async (req, res, next) => {
    try {
        const data = await callback(req);
        res.status(status).json({ success: true, ...(message && { message }), ...(data !== undefined && { data }) });
    } catch (err) {
        next(err);
    }
};


router.get('/', xuLy(req => db.layDanhSachDeadline(NGUOI_DUNG_ID, req.query.status || null)));

router.get('/upcoming', xuLy(req => db.layDeadlineSapToi(NGUOI_DUNG_ID, parseInt(req.query.days || 3, 10))));

router.post('/', xuLy(req => {
    const { subjectId, title, deadline } = req.body;
    kiemTra(subjectId && title && deadline, 'subjectId, title và deadline là bắt buộc.');
    return db.themBaiTap(NGUOI_DUNG_ID, req.body);
}, 201, 'Đã tạo bài tập.'));

router.put('/:id', xuLy(req => {
    kiemTra(req.params.id, 'assignmentId là bắt buộc.');
    return db.capNhatBaiTap(req.params.id, req.body);
}, 200, 'Đã cập nhật bài tập.'));

router.patch('/:id/status', xuLy(req => {
    const { status } = req.body;
    kiemTra(status && trangThaiHopLe.includes(status), `status phải là một trong: ${trangThaiHopLe.join(', ')}`);
    return db.capNhatTrangThaiBaiTap(req.params.id, status);
}, 200, 'Đã cập nhật trạng thái bài tập.'));

router.delete('/:id', xuLy(req => db.xoaBaiTap(req.params.id), 200, 'Đã xóa bài tập và nhắc nhở liên quan.'));

router.get('/checklist', xuLy(req => db.layChecklist(NGUOI_DUNG_ID)));

router.get('/:taskId/checklist', xuLy(async req => {
    const all = await db.layChecklist(NGUOI_DUNG_ID);
    return all.filter(item => item.assignment_id === Number(req.params.taskId));
}));

router.post('/checklist', xuLy(req => {
    kiemTra(req.body.title, 'title là bắt buộc.');
    return db.themChecklist(NGUOI_DUNG_ID, req.body);
}, 201, 'Đã thêm task vào checklist.'));

router.post('/:taskId/checklist', xuLy(req => {
    kiemTra(req.body.title, 'title là bắt buộc.');
    return db.themChecklist(NGUOI_DUNG_ID, {
        ...req.body,
        assignmentId: Number(req.params.taskId)
    });
}, 201, 'Đã thêm task con vào bài tập.'));

router.put('/checklist/:id', xuLy(req => db.capNhatChecklist(req.params.id, req.body), 200, 'Đã cập nhật task.'));

router.patch('/checklist/:id/done', xuLy(req => {
    return db.hoanThanhChecklist(req.params.id, req.body.isCompleted !== false);
}, 200, 'Đã cập nhật trạng thái checklist.'));

router.delete('/checklist/:id', xuLy(req => db.xoaChecklist(req.params.id), 200, 'Đã xóa task.'));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};