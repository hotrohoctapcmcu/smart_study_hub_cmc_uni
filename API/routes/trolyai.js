'use strict';

const express = require('express');
const { createTrolyaiService, generateProgressAdvice, analyzeDifficultNotes, validatePlanSessions } = require('../services/trolyai.service');
const { createTrolyaiController } = require('../controllers/trolyai.controller');
const { errorHandler } = require('../middlewares/trolyai');
const studyContext = require('../services/study-context.service');

const router = express.Router();
let db;
const service = createTrolyaiService({ getDb: () => db, getHocTapAiService: () => hocTapAi.service });
const hocTapAi = require('./hoctapai').createHocTapAiRouter({ getDb: () => db, loadFreeSlots: service.loadFreeSlots, validatePlanSessions });
const controller = createTrolyaiController(service);

router.get('/status', controller.status);
router.post('/ask', controller.ask);
router.post('/plan', controller.plan);
router.post('/plan/confirm', controller.confirmPlan);
router.post('/pomodoro-goals', controller.pomodoroGoals);
router.post('/exam-plan', controller.examPlan);
router.post('/check', controller.check);
router.post('/summarize', controller.summarize);
router.get('/summary-jobs/:id', controller.summaryJob);
router.delete('/summary-jobs/:id', controller.cancelSummary);
router.post('/draft-leave', controller.draftLeave);
router.post('/progress-advice', controller.progressAdvice);
router.post('/difficult-notes', controller.difficultNotes);

router.use(hocTapAi.router);
router.use(errorHandler);

module.exports = router;
module.exports.setDb = instance => { db = instance; studyContext.setDb(instance); };
module.exports.generateProgressAdvice = generateProgressAdvice;
module.exports.analyzeDifficultNotes = analyzeDifficultNotes;
module.exports.validatePlanSessions = validatePlanSessions;
