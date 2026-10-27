'use strict';

const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');

function createProgressController({ service, studentId = NGUOI_DUNG_ID } = {}) {
    if (!service) {
        throw new TypeError('service là bắt buộc.');
    }

    async function getProgress(req, res, next) {
        try {
            const [taskMetrics, weeklyStudyHours, gpaBySemester, nextExam] = await Promise.all([
                service.getTaskMetrics(studentId),
                service.getWeeklyStudyHours(studentId),
                service.getGPA(studentId),
                service.getDaysToNextExam(studentId)
            ]);

            const metrics = {
                ...taskMetrics,
                weeklyStudyHours,
                gpaBySemester,
                nextExam
            };
            // Giao diện tải số liệu trước; chỉ gọi AI khi người dùng yêu cầu.
            const advice = req.query.advice === 'false'
                ? null
                : await service.generateProgressAdvice(metrics);

            res.json({
                success: true,
                data: { metrics, advice }
            });
        } catch (err) {
            next(err);
        }
    }

    return { getProgress };
}

module.exports = { createProgressController };
