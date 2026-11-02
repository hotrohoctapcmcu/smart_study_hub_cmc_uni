'use strict';

const express = require('express');
const { createLearningController } = require('../controllers/learning.controller');
const learningRuntime = require('../services/learning-runtime.service');

function routerFromRuntime({ service, setDb, backgroundSync }) {
    const router = express.Router();
    const controller = createLearningController(service);
    router.setDb = setDb;

    // Cached raster files keep course JSON small even for thousands of slides.
    router.get('/images/:file', (req, res, next) => {
        if (!/^[a-f0-9]{64}\.(png|jpg|gif|webp)$/.test(req.params.file)) return res.sendStatus(404);
        res.sendFile(req.params.file, { root: require('../utils/edux-slide-images').imageDirectory(),
            dotfiles: 'deny', maxAge: '1y', immutable: true }, error => { if (error) next(error); });
    });

    router.get('/courses', controller.courses);
    router.get('/courses/:id', controller.course);
    router.get('/courses/:id/source', controller.source);
    router.get('/courses/:id/summary', controller.summary);
    router.post('/sync', controller.sync);
    router.post('/courses/:id/summarize', controller.summarize);
    router.get('/jobs/:id', controller.job);
    router.post('/cards/:id/review', controller.review);

    router.backgroundSync = backgroundSync;
    router.service = service;
    return router;
}

function createLearningRouter(options = {}) {
    return routerFromRuntime(learningRuntime.createLearningRuntime(options));
}

module.exports = routerFromRuntime(learningRuntime);
module.exports.createLearningRouter = createLearningRouter;
