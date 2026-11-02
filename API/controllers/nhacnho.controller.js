const service = require('../services/nhacnho.service');
const { spreadHandler } = require('../utils/response');

exports.getAll = spreadHandler(async () => ({ data: await service.getAll() }));
exports.getUnreadCount = spreadHandler(async () => ({ unreadCount: await service.getUnreadCount() }));
exports.getDue = spreadHandler(async () => ({ data: await service.getDue() }));
exports.create = spreadHandler(async req => ({ message: 'Đã tạo nhắc nhở.', data: await service.create(req.body) }), 201);
exports.createMultiTier = spreadHandler(async req => ({
    message: 'Đã tạo bộ nhắc nhở đa tầng.', data: await service.createMultiTier(req.body)
}), 201);
exports.markRead = spreadHandler(async req => {
    await service.markSent(req.params.id);
    return { message: 'Đã đánh dấu đã đọc.' };
});
exports.markSent = spreadHandler(async req => {
    await service.markSent(req.params.id);
    return { message: 'Đã đánh dấu đã gửi thông báo.' };
});
exports.remove = spreadHandler(async req => {
    await service.remove(req.params.id);
    return { message: 'Đã xóa nhắc nhở.' };
});
