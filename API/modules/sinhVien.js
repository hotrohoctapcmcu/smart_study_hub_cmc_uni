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


router.get('/profile', xuLy(async req => {
    const data = await db.layHoSo(NGUOI_DUNG_ID);
    if (!data) throw loi('Chưa có hồ sơ. Vui lòng đồng bộ dữ liệu từ cổng trường.', 404);
    return { data };
}));

router.put('/profile', xuLy(async req => {
    if (!req.body || !Object.keys(req.body).length) {
        throw loi('Không có dữ liệu cập nhật.');
    }

    return {
        message: 'Cập nhật hồ sơ thành công.',
        data: await db.luuHoSo(NGUOI_DUNG_ID, req.body)
    };
}));

router.get('/grades', xuLy(async req => ({
    data: await db.layBangDiem(NGUOI_DUNG_ID, req.query.hocKy || null)
})));

router.get('/subjects', xuLy(async req => ({
    data: await db.layDanhSachMonHoc(NGUOI_DUNG_ID)
})));

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
}; 