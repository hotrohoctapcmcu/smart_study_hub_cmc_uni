const router = require('express').Router();
const controller = require('../controllers/kythi.controller');
const service = require('../services/kythi.service');

router.get('/', controller.getAll);
router.get('/upcoming', controller.getUpcoming);
router.get('/study-plans', controller.getStudyPlans);
router.post('/', controller.create);
router.post('/study-plans', controller.createStudyPlan);
router.put('/:id', controller.update);
router.patch('/study-plans/:id/status', controller.updatePlanStatus);
router.delete('/study-plans/:id', controller.removeStudyPlan);
router.get('/:examId/study-plans', controller.getExamStudyPlans);
router.delete('/:id', controller.remove);

module.exports = router;
module.exports.setDb = service.setDb;
