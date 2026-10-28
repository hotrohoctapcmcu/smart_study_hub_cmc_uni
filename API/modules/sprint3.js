'use strict';

const express = require('express');
const { createSprint3Service } = require('./sprint3.service');

function createSprint3Router(options) {
    const router = express.Router();
    const service = createSprint3Service(options);
    const run = fn => async (req, res, next) => {
        try { res.json({ success: true, data: await fn(req) }); } catch (error) { next(error); }
    };
    router.get('/conversations', run(() => service.conversations()));
    router.get('/conversations/:id', run(req => service.conversation(req.params.id)));
    router.get('/quizzes', run(() => service.quizzes()));
    router.post('/quizzes', run(req => service.generateQuiz(req.body)));
    router.get('/quizzes/:id', run(req => service.quiz(req.params.id)));
    router.post('/quizzes/:id/submit', run(req => service.submitQuiz(req.params.id, req.body)));
    router.get('/weaknesses', run(() => service.weaknesses()));
    router.post('/weaknesses/analyze', run(() => service.analyzeWeaknesses()));
    router.post('/exam-plan/confirm', run(req => service.confirmExamPlan(req.body)));
    router.get('/leave-drafts', run(() => service.leaveDrafts()));
    router.post('/leave-drafts', run(req => service.saveLeave(null, req.body)));
    router.put('/leave-drafts/:id', run(req => service.saveLeave(req.params.id, req.body)));
    router.get('/leave-drafts/:id/docx', async (req, res, next) => {
        try {
            const buffer = await service.exportLeave(req.params.id);
            res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                .set('Content-Disposition', 'attachment; filename="don-xin-nghi-hoc.docx"').send(buffer);
        } catch (error) { next(error); }
    });
    return { router, service };
}

module.exports = { createSprint3Router };
