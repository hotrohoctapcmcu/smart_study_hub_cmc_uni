const service = require('../services/sinhvien.service');
const { spreadHandler } = require('../utils/response');

exports.getProfile = spreadHandler(async () => ({ data: await service.getProfile() }));
exports.updateProfile = spreadHandler(async req => ({
    message: 'Cập nhật hồ sơ thành công.',
    data: await service.updateProfile(req.body)
}));
exports.getGrades = spreadHandler(async req => ({ data: await service.getGrades(req.query.hocKy || null) }));
exports.getSubjects = spreadHandler(async () => ({ data: await service.getSubjects() }));
