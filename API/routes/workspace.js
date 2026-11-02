'use strict';

const express = require('express');
const { createWorkspaceService } = require('../services/workspace.service');
const { createWorkspaceController } = require('../controllers/workspace.controller');

function createWorkspaceRouter({ outlook = require('../../CRWEB/modules/OUTLOOK') } = {}) {
    const router = express.Router();
    let db;
    const service = createWorkspaceService({ getDb: () => db, outlook });
    const controller = createWorkspaceController(service);
    router.setDb = value => { db = value; };

    router.get('/documents', controller.documents);
    router.post('/documents', express.raw({ type: 'application/octet-stream', limit: '25mb' }), controller.upload);
    router.patch('/documents/:id/tags', controller.setDocumentTags);
    router.delete('/documents/:id', controller.removeDocument);
    router.get('/documents/:id/file', controller.documentFile);
    router.get('/notebooks', controller.notebooks);
    router.post('/notebooks', controller.createNotebook);
    router.put('/notebooks/:id', controller.updateNotebook);
    router.delete('/notebooks/:id', controller.removeNotebook);
    router.get('/notes', controller.notes);
    router.post('/notes', controller.createNote);
    router.put('/notes/:id', controller.updateNote);
    router.delete('/notes/:id', controller.removeNote);
    router.get('/notes/:id/export', controller.exportNote);
    router.get('/notebooks/:id/export', controller.exportNotebook);
    router.get('/pomodoro', controller.pomodoros);
    router.post('/pomodoro', controller.savePomodoro);
    router.delete('/pomodoro', controller.clearPomodoros);
    router.get('/search', controller.search);
    router.patch('/tags/tasks/:id', controller.setTaskTags);
    router.patch('/tags/edux/:id', controller.setEduxTags);
    router.get('/email', controller.emails);
    router.get('/email/status', controller.emailStatus);
    router.post('/email/sync', controller.syncEmails);
    router.delete('/email/session', controller.logoutEmail);
    router.patch('/email/read', controller.readAllEmails);
    router.patch('/email/:id/read', controller.readEmail);
    router.post('/email/:id/refresh', controller.refreshEmail);
    router.post('/email/:id/task', controller.emailTask);
    router.post('/email/:id/exam', controller.emailExam);
    return router;
}

module.exports = createWorkspaceRouter();
module.exports.createWorkspaceRouter = createWorkspaceRouter;
