const service = require('../services/kythi.service');
const { spreadHandler } = require('../utils/response');

exports.getAll = spreadHandler(async () => ({ data: await service.getAll() }));
exports.getUpcoming = spreadHandler(async () => ({ data: await service.getUpcoming() }));
exports.getStudyPlans = spreadHandler(async () => ({ data: await service.getStudyPlans() }));
exports.create = spreadHandler(async req => ({ message: 'Đã thêm kỳ thi.', data: await service.create(req.body) }), 201);
exports.createStudyPlan = spreadHandler(async req => ({
    message: 'Đã tạo kế hoạch ôn thi.', data: await service.createStudyPlan(req.body)
}), 201);
exports.update = spreadHandler(async req => ({
    message: 'Đã cập nhật kỳ thi.', data: await service.update(req.params.id, req.body || {})
}));
exports.updatePlanStatus = spreadHandler(async req => {
    await service.updatePlanStatus(req.params.id, req.body);
    return { message: 'Đã cập nhật trạng thái kế hoạch ôn thi.' };
});
exports.removeStudyPlan = spreadHandler(async req => {
    await service.removeStudyPlan(req.params.id);
    return { message: 'Đã xóa giai đoạn kế hoạch ôn thi.' };
});
exports.getExamStudyPlans = spreadHandler(async req => ({
    examId: req.params.examId, data: await service.getStudyPlans(req.params.examId)
}));
exports.remove = spreadHandler(async req => {
    await service.remove(req.params.id);
    return { message: 'Đã xóa kỳ thi và dữ liệu liên quan.' };
});
