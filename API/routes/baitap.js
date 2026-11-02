const router = require('express').Router();
const controller = require('../controllers/baitap.controller');
const service = require('../services/baitap.service');

router.get('/', controller.getAll);
router.get('/upcoming', controller.getUpcoming);
router.get('/edux', controller.getEdux);
router.get('/edux/:id', controller.getEduxById);
router.patch('/edux/:id/status', controller.updateEduxStatus);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.updateStatus);
router.delete('/:id', controller.remove);
router.get('/checklist', controller.getChecklist);
router.get('/:taskId/checklist', controller.getTaskChecklist);
router.post('/checklist', controller.createChecklist);
router.post('/:taskId/checklist', controller.createTaskChecklist);
router.put('/checklist/:id', controller.updateChecklist);
router.patch('/checklist/:id/done', controller.completeChecklist);
router.delete('/checklist/:id', controller.removeChecklist);

module.exports = router;
module.exports.setDb = service.setDb;
