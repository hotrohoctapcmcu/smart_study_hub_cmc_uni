const router = require('express').Router();
const { API_PREFIX } = require('../config');
const controller = require('../controllers/status.controller');

router.get('/health', controller.health);
router.get(['/', '/api', API_PREFIX], controller.index);

module.exports = router;
