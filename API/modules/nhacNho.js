const express = require('express');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');

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


router.get('/', xuLy(async req => ({
    data: await db.layDanhSachNhacNho(NGUOI_DUNG_ID)
})));

router.get('/unread-count', xuLy(async req => {
    const data = await db.layDanhSachNhacNho(NGUOI_DUNG_ID);
    const now = Date.now();
    const unreadCount = data.filter(item =>
        !item.is_sent && new Date(item.remind_time).getTime() <= now
    ).length;

    return { unreadCount };
}));

router.get('/due', xuLy(async () => ({
    data: await db.layNhacNhoDenHanChuaGui()
})));

router.post('/', xuLy(async req => {
    const { targetType, targetId, title, remindTime } = req.body;

    if (!targetType || !targetId || !title || !remindTime) {
        throw loi('targetType, targetId, title và remindTime là bắt buộc.');
    }

    return {
        message: 'Đã tạo nhắc nhở.',
        data: await db.taoNhacNho(NGUOI_DUNG_ID, req.body)
    };
}, 201));

router.post('/multi-tier', xuLy(async req => {
    const { targetType, targetId, title, deadline, channel } = req.body;

    if (!targetType || !targetId || !title || !deadline) {
        throw loi('targetType, targetId, title và deadline là bắt buộc.');
    }

    return {
        message: 'Đã tạo bộ nhắc nhở đa tầng.',
        data: await db.taoNhacNhoDaTang(
            NGUOI_DUNG_ID,
            targetType,
            targetId,
            title,
            deadline,
            channel
        )
    };
}, 201));

router.patch('/:id/read', xuLy(async req => {
    await db.danhDauDaGuiNhacNho(req.params.id);
    return { message: 'Đã đánh dấu đã đọc.' };
}));

router.patch('/:id/sent', xuLy(async req => {
    await db.danhDauDaGuiNhacNho(req.params.id);
    return { message: 'Đã đánh dấu đã gửi thông báo.' };
}));

router.delete('/:id', xuLy(async req => {
    await db.xoaNhacNho(req.params.id);
    return { message: 'Đã xóa nhắc nhở.' };
}));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
}; 