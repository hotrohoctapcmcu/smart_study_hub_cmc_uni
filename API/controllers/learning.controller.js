'use strict';

const { aggregateCourseText } = require('../utils/course-material-text');
const { dataHandler, binaryHandler } = require('../utils/response');

function createLearningController(service) {
    return {
        courses: dataHandler(() => service.courses()),
        course: dataHandler(req => service.course(req.params.id)),
        source: binaryHandler(async (req, res) => {
            const course = await service.course(req.params.id);
            const filename = encodeURIComponent(`${course.subject || 'hoc-lieu'}.txt`);
            res.type('text/plain; charset=utf-8')
                .set('Content-Disposition', `attachment; filename="hoc-lieu.txt"; filename*=UTF-8''${filename}`)
                .send('\uFEFF' + aggregateCourseText(course));
        }),
        summary: binaryHandler(async (req, res) => {
            const course = await service.course(req.params.id);
            if (!course.summary || course.summary.stale) {
                throw Object.assign(new Error('Chưa có bản tóm tắt toàn môn hiện tại.'), { statusCode: 404 });
            }
            const filename = encodeURIComponent(`tom-tat-${course.subject || 'mon-hoc'}.txt`);
            res.type('text/plain; charset=utf-8')
                .set('Content-Disposition', `attachment; filename="tom-tat.txt"; filename*=UTF-8''${filename}`)
                .send('\uFEFF' + course.summary.content);
        }),
        sync: dataHandler(req => service.startSync(req.body || {}), 202),
        summarize: dataHandler(req => service.startSummary(req.params.id), 202),
        job: dataHandler(req => service.job(req.params.id)),
        review: dataHandler(req => service.review(req.params.id, req.body || {}))
    };
}

module.exports = { createLearningController };
