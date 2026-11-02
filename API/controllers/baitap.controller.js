const service = require('../services/baitap.service');
const { dataHandler } = require('../utils/response');

exports.getAll = dataHandler(req => service.getAll(req.query.status || null));
exports.getUpcoming = dataHandler(req => service.getUpcoming(parseInt(req.query.days || '3', 10)));
exports.getEdux = dataHandler(req => service.getEdux(req.query));
exports.getEduxById = dataHandler(req => service.getEduxById(req.params.id));
exports.updateEduxStatus = dataHandler(req => service.updateEduxStatus(req.params.id, req.body), 200, 'Đã cập nhật trạng thái bài tập EDUX.');
exports.create = dataHandler(req => service.create(req.body), 201, 'Đã tạo bài tập.');
exports.update = dataHandler(req => service.update(req.params.id, req.body), 200, 'Đã cập nhật bài tập.');
exports.updateStatus = dataHandler(req => service.updateStatus(req.params.id, req.body), 200, 'Đã cập nhật trạng thái bài tập.');
exports.remove = dataHandler(req => service.remove(req.params.id), 200, 'Đã xóa hoặc ẩn bài tập và nhắc nhở liên quan.');
exports.getChecklist = dataHandler(() => service.getChecklist());
exports.getTaskChecklist = dataHandler(req => service.getTaskChecklist(Number(req.params.taskId)));
exports.createChecklist = dataHandler(req => service.createChecklist(req.body), 201, 'Đã thêm task vào checklist.');
exports.createTaskChecklist = dataHandler(req => service.createTaskChecklist(Number(req.params.taskId), req.body), 201, 'Đã thêm task con vào bài tập.');
exports.updateChecklist = dataHandler(req => service.updateChecklist(req.params.id, req.body), 200, 'Đã cập nhật task.');
exports.completeChecklist = dataHandler(req => service.completeChecklist(req.params.id, req.body?.isCompleted !== false), 200, 'Đã cập nhật trạng thái checklist.');
exports.removeChecklist = dataHandler(req => service.removeChecklist(req.params.id), 200, 'Đã xóa task.');
