const router = require('express').Router();
const controller = require('../controllers/sinhvien.controller');
const service = require('../services/sinhvien.service');

router.get('/profile', controller.getProfile);
router.put('/profile', controller.updateProfile);
router.get('/grades', controller.getGrades);
router.get('/subjects', controller.getSubjects);

module.exports = router;
module.exports.setDb = service.setDb;
