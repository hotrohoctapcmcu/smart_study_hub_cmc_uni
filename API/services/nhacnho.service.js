const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { loi } = require('../utils/error');
const validate = require('../validators/nhacnho.validator');
let db;

async function getUnreadCount() {
    const data = await db.layDanhSachNhacNho(NGUOI_DUNG_ID);
    const now = Date.now();
    return data.filter(item => !item.is_sent && new Date(item.remind_time).getTime() <= now).length;
}

function create(body) {
    validate.create(body);
    return db.taoNhacNho(NGUOI_DUNG_ID, body);
}

function createMultiTier(body) {
    validate.multiTier(body);
    const { targetType, targetId, title, deadline, channel } = body;
    return db.taoNhacNhoDaTang(NGUOI_DUNG_ID, targetType, targetId, title, deadline, channel);
}

async function markSent(id) {
    validate.id(id);
    const updated = await db.danhDauDaGuiNhacNho(id, NGUOI_DUNG_ID);
    if (!updated) throw loi('Không tìm thấy nhắc nhở.', 404);
}

async function remove(id) {
    validate.id(id);
    const deleted = await db.xoaNhacNho(id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy nhắc nhở.', 404);
}

module.exports = {
    setDb: instance => { db = instance; },
    getAll: () => db.layDanhSachNhacNho(NGUOI_DUNG_ID),
    getUnreadCount,
    getDue: () => db.layNhacNhoDenHanChuaGui(),
    create,
    createMultiTier,
    markSent,
    remove
};
