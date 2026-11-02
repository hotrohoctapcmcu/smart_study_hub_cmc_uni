'use strict';

const express = require('express');
const controller = require('../controllers/dongbo.controller');
const service = require('../services/dongbo.service');
const router = express.Router();

router.get('/sources', controller.sources);
router.post('/', controller.start);
router.post('/all', controller.all);
router.get('/status', controller.status);
router.get('/current-courses', controller.currentCourses);
router.post('/refresh', controller.refresh);
router.post('/iu/session', controller.saveIuSession);
router.get('/iu/status', controller.iuStatus);
router.delete('/iu/session', controller.clearIuSession);
router.post('/iu/pull', controller.pullAndSaveIU);
router.post('/iu/group', controller.pullIuGroup);
router.post('/edux/session', controller.saveEduxSession);
router.get('/edux/status', controller.eduxStatus);
router.delete('/edux/session', controller.clearEduxSession);
router.post('/edux/pull', controller.pullAndSaveEdux);

module.exports = router;
module.exports.setDb = service.setDb;
