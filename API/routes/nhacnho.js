const router = require('express').Router();
const controller = require('../controllers/nhacnho.controller');
const service = require('../services/nhacnho.service');

router.get('/', controller.getAll);
router.get('/unread-count', controller.getUnreadCount);
router.get('/due', controller.getDue);
router.post('/', controller.create);
router.post('/multi-tier', controller.createMultiTier);
router.patch('/:id/read', controller.markRead);
router.patch('/:id/sent', controller.markSent);
router.delete('/:id', controller.remove);

module.exports = router;
module.exports.setDb = service.setDb;
