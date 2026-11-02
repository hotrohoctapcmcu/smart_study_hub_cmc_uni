'use strict';

const express = require('express');
const { createProgressController } = require('../controllers/progress.controller');
const { createProgressService } = require('../services/progress.service');

const router = express.Router();
let db = null;

const service = createProgressService({ getDb: () => db });
const controller = createProgressController({ service });

router.get('/', controller.getProgress);

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};
