const router = require('express').Router();
const controller = require('../controllers/thoikhoabieu.controller');
const service = require('../services/thoikhoabieu.service');

router.get('/', controller.getAll);
router.get('/today', controller.getToday);
router.get('/by-date', controller.getByDate);
router.get('/by-week', controller.getByWeek);
router.post('/', controller.create);
router.delete('/:id', controller.remove);
router.get('/conflicts/check', controller.getConflicts);
router.post('/conflicts/check', controller.checkConflicts);
router.get('/study', controller.getStudy);
router.post('/study', controller.createStudy);
router.patch('/study/:id/status', controller.updateStudyStatus);
router.put('/study/:id', controller.updateStudy);
router.delete('/study/:id', controller.removeStudy);
router.get('/study/free-slots', controller.getFreeSlots);

module.exports = router;
module.exports.setDb = service.setDb;
