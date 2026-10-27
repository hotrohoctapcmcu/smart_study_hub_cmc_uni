
const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');
const eduxKho = require('../shared/edux-session');
const { keoBaiTapEDUX, laHetPhien } = require('../shared/edux-client');

const router = express.Router();
const trangThaiHopLe = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
const trangThaiEDUX = ['Chưa làm', 'Đang làm', 'Hoàn thành'];
let db;

const loi = (message, statusCode = 400) =>
    Object.assign(new Error(message), { statusCode });

const kiemTra = (dieuKien, message) => {
    if (!dieuKien) throw loi(message);
};

const xuLy = (callback, status = 200, message) => async (req, res, next) => {
    try {
        const data = await callback(req);
        res.status(status).json({
            success: true,
            ...(message && { message }),
            ...(data !== undefined && { data })
        });
    } catch (err) {
        next(err);
    }
};

const layPhienEDUX = () => {
    const saved = eduxKho.getSession(NGUOI_DUNG_ID);
    if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);
    return saved;
};

router.get('/', xuLy(req =>
    db.layDanhSachDeadline(NGUOI_DUNG_ID, req.query.status || null)
));

router.get('/upcoming', xuLy(req =>
    db.layDeadlineSapToi(NGUOI_DUNG_ID, parseInt(req.query.days || '3', 10))
));

router.get('/edux', xuLy(async req => {
    const { subjectId, questions, refresh } = req.query;
    const canCauHoi = ['1', 'true'].includes(questions);
    const lamMoi = ['1', 'true'].includes(refresh);
    const options = { subjectId: subjectId || undefined, questions: canCauHoi };
    const saved = eduxKho.getSession(NGUOI_DUNG_ID);

    if (!lamMoi && !canCauHoi) {
        const cachedAssignments = await db.layBaiTapEDUX(NGUOI_DUNG_ID, {
            subjectId: options.subjectId,
            includeHidden: true
        });
        const assignments = cachedAssignments.filter(item => !item.isHidden);

        if (cachedAssignments.length) {
            return {
                source: 'EDUX',
                cached: true,
                assignments,
                total: assignments.length
            };
        }

        if (saved && Array.isArray(saved.data)) {
            const subjectIds = saved.subjectIds || [];

            if (subjectId && subjectIds.length &&
                !subjectIds.includes(String(subjectId))) {
                throw loi(`Không tìm thấy học phần ${subjectId} trên EDUX.`, 404);
            }

            await db.luuBaiTapEDUX(NGUOI_DUNG_ID, saved.data);
            const daLuu = await db.layBaiTapEDUX(NGUOI_DUNG_ID, { subjectId });

            return {
                source: 'EDUX',
                cached: true,
                assignments: daLuu,
                total: daLuu.length
            };
        }
    }

    const session = layPhienEDUX();
    let result;

    try {
        result = await keoBaiTapEDUX(session.cookie, options);
    } catch (err) {
        if (!laHetPhien(err)) throw err;

        eduxKho.clearSession(NGUOI_DUNG_ID);
        throw loi('Phiên EDUX đã hết hạn. Hãy đăng nhập EDUX lại.', 401);
    }

    eduxKho.saveSession(NGUOI_DUNG_ID, {
        cookie: session.cookie,
        email: session.email,
        data: result.assignments,
        subjectIds: result.subjectIds
    });

    await db.luuBaiTapEDUX(NGUOI_DUNG_ID, result.assignments);
    const assignments = await db.layBaiTapEDUX(NGUOI_DUNG_ID, { subjectId });

    return {
        source: 'EDUX',
        cached: false,
        assignments,
        total: assignments.length,
        thatBai: result.thatBai
    };
}));

router.get('/edux/:id', xuLy(async req => {
    const assignments = await db.layBaiTapEDUX(NGUOI_DUNG_ID);
    let assignment = assignments.find(item => item.id === req.params.id);

    if (!assignment) {
        const saved = eduxKho.getSession(NGUOI_DUNG_ID);
        assignment = saved?.data?.find(item => item.id === req.params.id);
    }

    if (assignment) return { source: 'EDUX', assignment };

    layPhienEDUX();
    throw loi(`Không tìm thấy bài tập EDUX: ${req.params.id}`, 404);
}));

router.patch('/edux/:id/status', xuLy(async req => {
    kiemTra(trangThaiEDUX.includes(req.body?.status),
        `status phải là một trong: ${trangThaiEDUX.join(', ')}`);

    const row = await db.capNhatTrangThaiBaiTapEDUX(
        NGUOI_DUNG_ID, req.params.id, req.body.status
    );

    if (!row) throw loi(`Không tìm thấy bài tập EDUX: ${req.params.id}`, 404);
    return row;
}, 200, 'Đã cập nhật trạng thái bài tập EDUX.'));

router.post('/', xuLy(req => {
    const { subjectId, title, deadline } = req.body;
    kiemTra(subjectId && title && deadline,
        'subjectId, title và deadline là bắt buộc.');
    return db.themBaiTap(NGUOI_DUNG_ID, req.body);
}, 201, 'Đã tạo bài tập.'));

router.put('/:id', xuLy(req => {
    kiemTra(req.params.id, 'assignmentId là bắt buộc.');
    return db.capNhatBaiTap(req.params.id, req.body, NGUOI_DUNG_ID);
}, 200, 'Đã cập nhật bài tập.'));

router.patch('/:id/status', xuLy(req => {
    kiemTra(trangThaiHopLe.includes(req.body?.status),
        `status phải là một trong: ${trangThaiHopLe.join(', ')}`);
    return db.capNhatTrangThaiBaiTap(
        req.params.id, req.body.status, NGUOI_DUNG_ID
    );
}, 200, 'Đã cập nhật trạng thái bài tập.'));

router.delete('/:id', xuLy(async req => {
    const id = String(req.params.id || '').trim();
    if (/^edux-/i.test(id)) {
        const hidden = await db.anBaiTapEDUX(NGUOI_DUNG_ID, id);
        if (!hidden) throw loi(`Không tìm thấy bài tập EDUX: ${id}`, 404);
        return { id, hidden: true };
    }
    kiemTra(/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0,
        'ID bài tập phải là số nguyên dương hoặc có tiền tố edux-.');
    await db.xoaBaiTap(Number(id), NGUOI_DUNG_ID);
    return { id: Number(id) };
}, 200, 'Đã xóa hoặc ẩn bài tập và nhắc nhở liên quan.'));

router.get('/checklist', xuLy(() =>
    db.layChecklist(NGUOI_DUNG_ID)
));

router.get('/:taskId/checklist', xuLy(async req => {
    const items = await db.layChecklist(NGUOI_DUNG_ID);
    return items.filter(item =>
        item.assignment_id === Number(req.params.taskId)
    );
}));

router.post('/checklist', xuLy(req => {
    kiemTra(req.body?.title, 'title là bắt buộc.');
    return db.themChecklist(NGUOI_DUNG_ID, req.body);
}, 201, 'Đã thêm task vào checklist.'));

router.post('/:taskId/checklist', xuLy(req => {
    kiemTra(req.body?.title, 'title là bắt buộc.');
    return db.themChecklist(NGUOI_DUNG_ID, {
        ...req.body,
        assignmentId: Number(req.params.taskId)
    });
}, 201, 'Đã thêm task con vào bài tập.'));

router.put('/checklist/:id', xuLy(req =>
    db.capNhatChecklist(req.params.id, req.body, NGUOI_DUNG_ID),
    200, 'Đã cập nhật task.'
));

router.patch('/checklist/:id/done', xuLy(req =>
    db.hoanThanhChecklist(
        req.params.id, req.body?.isCompleted !== false, NGUOI_DUNG_ID
    ),
    200, 'Đã cập nhật trạng thái checklist.'
));

router.delete('/checklist/:id', xuLy(async req => {
    const id = String(req.params.id || '').trim();
    kiemTra(/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0,
        'checklistId phải là số nguyên dương.');
    const deleted = await db.xoaChecklist(Number(id), NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy checklist thuộc người dùng hiện tại.', 404);
    return { checklistId: Number(id) };
}, 200, 'Đã xóa task.'));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};
