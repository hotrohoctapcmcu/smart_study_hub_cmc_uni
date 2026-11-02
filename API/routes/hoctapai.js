'use strict';

const express = require('express');
const { createHocTapAiService } = require('../services/hoctapai.service');
const { createHocTapAiController } = require('../controllers/hoctapai.controller');

function createHocTapAiRouter(options) {
    const router = express.Router();
    const service = createHocTapAiService(options);
    const controller = createHocTapAiController(service);

    router.get('/conversations', controller.conversations);
    router.get('/conversations/:id', controller.conversation);
    router.get('/quizzes', controller.quizzes);
    router.post('/quizzes', controller.generateQuiz);
    router.get('/quizzes/:id', controller.quiz);
    router.post('/quizzes/:id/submit', controller.submitQuiz);
    router.get('/weaknesses', controller.weaknesses);
    router.post('/weaknesses/analyze', controller.analyzeWeaknesses);
    router.post('/exam-plan/confirm', controller.confirmExamPlan);
    router.get('/leave-drafts', controller.leaveDrafts);
    router.post('/leave-drafts', controller.createLeave);
    router.put('/leave-drafts/:id', controller.updateLeave);
    router.get('/leave-drafts/:id/docx', controller.exportLeave);
    return { router, service };
}

module.exports = { createHocTapAiRouter };
