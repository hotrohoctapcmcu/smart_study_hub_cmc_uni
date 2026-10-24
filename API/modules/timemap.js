'use strict';

const express = require('express');
const { createTimeMapController } = require('./timemap.controller');

const router = express.Router();
let db = null;

const controller = createTimeMapController({ getDb: () => db });

router.get('/', controller.getTimeMap);

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
};
