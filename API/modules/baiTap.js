const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');
const eduxKho = require('../shared/edux-session');
const { keoBaiTapEDUX, laHetPhien } = require('../shared/edux-client');

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

/**
 * Bài tập AI lấy từ EDUX, đã chuẩn hoá về đúng shape task frontend dùng.
 *
 * Nguồn dữ liệu là SQLite (bảng EduxAssignments), KHÔNG phải RAM: nhờ vậy mở
 * lại app vẫn thấy bài tập dù phiên EDUX đã mất. Chỉ khi cần `refresh=1` mới
 * gọi lại cổng EDUX (và ghi đè DB).
 *
 * - Chưa đồng bộ lần nào + không có phiên EDUX -> 401 để FE mời đăng nhập.
 * - `refresh=1` -> gọi lại EDUX rồi lưu DB.
 * - `subjectId` -> chỉ lấy bài tập của một học phần.
 * - `questions=1` -> kèm câu hỏi chi tiết (tạo phiên làm bài mới trên EDUX).
 */
router.get('/edux', xuLy(async req => {
    const subjectId = req.query.subjectId || undefined;
    const questions = req.query.questions === '1' || req.query.questions === 'true';
    const muonKeoLai = req.query.refresh === '1' || req.query.refresh === 'true';
    const saved = eduxKho.getSession(NGUOI_DUNG_ID);

    // Đường đọc thường: lấy từ DB (không cần phiên EDUX còn sống).
    if (!muonKeoLai && !questions) {
        const trongDb = await db.layBaiTapEDUX(NGUOI_DUNG_ID, { subjectId });

        if (trongDb.length > 0) {
            return { source: 'EDUX', cached: true, assignments: trongDb, total: trongDb.length };
        }

        // DB trống: chỉ báo 401 khi cũng không có phiên để kéo dữ liệu.
        if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);

        if (Array.isArray(saved.data)) {
            const subjectIds = Array.isArray(saved.subjectIds) ? saved.subjectIds : [];
            if (subjectId && subjectIds.length && !subjectIds.includes(String(subjectId))) {
                throw loi(`Không tìm thấy học phần ${subjectId} trên EDUX.`, 404);
            }
            const assignments = subjectId
                ? saved.data.filter(item => String(item.subjectId) === String(subjectId))
                : saved.data;

            // Phiên RAM có dữ liệu nhưng DB trống (vd vừa nâng cấp) -> ghi bù.
            await db.luuBaiTapEDUX(NGUOI_DUNG_ID, saved.data);

            return { source: 'EDUX', cached: true, assignments, total: assignments.length };
        }
    }

    if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);

    let ketQua;
    try {
        ketQua = await keoBaiTapEDUX(saved.cookie, { subjectId, questions });
    } catch (err) {
        if (laHetPhien(err)) {
            eduxKho.clearSession(NGUOI_DUNG_ID);
            throw loi('Phiên EDUX đã hết hạn. Hãy đăng nhập EDUX lại.', 401);
        }
        throw err;
    }

    eduxKho.saveSession(NGUOI_DUNG_ID, {
        cookie: saved.cookie,
        email: saved.email,
        data: ketQua.assignments,
        subjectIds: ketQua.subjectIds
    });

    // Lưu xuống DB để lần sau đọc được mà không cần gọi lại EDUX.
    await db.luuBaiTapEDUX(NGUOI_DUNG_ID, ketQua.assignments);

    return {
        source: 'EDUX',
        cached: false,
        assignments: ketQua.assignments,
        total: ketQua.assignments.length,
        thatBai: ketQua.thatBai
    };
}));

/** Một bài tập EDUX theo id ổn định (`edux-<subjectId>-<modelId>`). */
router.get('/edux/:id', xuLy(async req => {
    const trongDb = await db.layBaiTapEDUX(NGUOI_DUNG_ID);
    const assignment = trongDb.find(item => item.id === req.params.id);
    if (assignment) return { source: 'EDUX', assignment };

    // Chưa có trong DB nhưng phiên RAM còn dữ liệu -> tìm trong RAM.
    const saved = eduxKho.getSession(NGUOI_DUNG_ID);
    if (saved && Array.isArray(saved.data)) {
        const trongRam = saved.data.find(item => item.id === req.params.id);
        if (trongRam) return { source: 'EDUX', assignment: trongRam };
    }

    if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);
    throw loi(`Không tìm thấy bài tập EDUX: ${req.params.id}`, 404);
}));

/** Cập nhật trạng thái một bài tập EDUX đã lưu (tick trên app, không gọi EDUX). */
router.patch('/edux/:id/status', xuLy(async req => {
    const { status } = req.body || {};
    const hopLe = ['Chưa làm', 'Đang làm', 'Hoàn thành'];
    if (!status || !hopLe.includes(status)) {
        throw loi(`status phải là một trong: ${hopLe.join(', ')}`);
    }

    const row = await db.capNhatTrangThaiBaiTapEDUX(NGUOI_DUNG_ID, req.params.id, status);
    if (!row) throw loi(`Không tìm thấy bài tập EDUX: ${req.params.id}`, 404);
    return { message: 'Đã cập nhật trạng thái bài tập EDUX.', data: row };
}));

router.post('/', xuLy(req => {
    const { subjectId, title, deadline } = req.body;
    kiemTra(subjectId && title && deadline, 'subjectId, title và deadline là bắt buộc.');
    return db.themBaiTap(NGUOI_DUNG_ID, req.body);
}, 201, 'Đã tạo bài tập.'));

router.put('/:id', xuLy(req => {
    kiemTra(req.params.id, 'assignmentId là bắt buộc.');
    return db.capNhatBaiTap(req.params.id, req.body, NGUOI_DUNG_ID);
}, 200, 'Đã cập nhật bài tập.'));

router.patch('/:id/status', xuLy(req => {
    const { status } = req.body;
    kiemTra(status && trangThaiHopLe.includes(status), `status phải là một trong: ${trangThaiHopLe.join(', ')}`);
    return db.capNhatTrangThaiBaiTap(req.params.id, status, NGUOI_DUNG_ID);
}, 200, 'Đã cập nhật trạng thái bài tập.'));

router.delete('/:id', xuLy(req => db.xoaBaiTap(req.params.id, NGUOI_DUNG_ID), 200, 'Đã xóa bài tập và nhắc nhở liên quan.'));

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

router.put('/checklist/:id', xuLy(req => db.capNhatChecklist(req.params.id, req.body, NGUOI_DUNG_ID), 200, 'Đã cập nhật task.'));

router.patch('/checklist/:id/done', xuLy(req => {
    return db.hoanThanhChecklist(req.params.id, req.body.isCompleted !== false, NGUOI_DUNG_ID);
}, 200, 'Đã cập nhật trạng thái checklist.'));

router.delete('/checklist/:id', xuLy(req => db.xoaChecklist(req.params.id, NGUOI_DUNG_ID), 200, 'Đã xóa task.'));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};