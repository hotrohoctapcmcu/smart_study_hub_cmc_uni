const service = require('../services/thoikhoabieu.service');
const { spreadHandler, dataHandler } = require('../utils/response');

exports.getAll = spreadHandler(async () => ({ data: await service.getAll() }));
exports.getToday = spreadHandler(async () => {
    const date = new Date().toISOString().split('T')[0];
    return { date, data: await service.getByDate(date) };
});
exports.getByDate = spreadHandler(async req => ({
    date: req.query.date, data: await service.getByDate(req.query.date)
}));
exports.getByWeek = spreadHandler(async req => ({
    from: req.query.from, to: req.query.to, data: await service.getByWeek(req.query.from, req.query.to)
}));
exports.create = dataHandler(req => service.create(req.body), 201, 'Đã thêm tiết học.');
exports.remove = spreadHandler(async req => {
    await service.remove(req.params.id);
    return { message: 'Đã xóa tiết học.' };
});
exports.getConflicts = spreadHandler(async () => {
    const conflicts = await service.getConflicts();
    return { hasConflict: conflicts.length > 0, conflicts };
});
exports.checkConflicts = spreadHandler(async req => {
    const { studyDate, startTime, endTime, excludeScheduleId } = req.body || {};
    const conflicts = await service.checkConflicts(studyDate, startTime, endTime, excludeScheduleId);
    return { hasConflict: conflicts.length > 0, conflicts };
});
exports.getStudy = spreadHandler(async req => ({
    data: await service.getStudy(req.query.from || null, req.query.to || null)
}));
exports.createStudy = dataHandler(req => service.createStudy(req.body), 201, 'Đã xếp lịch tự học.');
exports.updateStudyStatus = spreadHandler(async req => {
    await service.updateStudyStatus(req.params.id, req.body || {});
    return { message: 'Đã cập nhật trạng thái lịch tự học.' };
});
exports.updateStudy = spreadHandler(async req => ({
    message: 'Đã cập nhật lịch tự học.', data: await service.updateStudy(req.params.id, req.body || {})
}));
exports.removeStudy = spreadHandler(async req => {
    await service.removeStudy(req.params.id);
    return { message: 'Đã xóa lịch tự học.' };
});
exports.getFreeSlots = spreadHandler(async req => {
    const { date, duration = 60 } = req.query;
    return { date, freeSlots: await service.getFreeSlots(date, duration) };
});
