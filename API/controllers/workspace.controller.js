'use strict';

const { dataHandler, binaryHandler } = require('../utils/response');
const { documentMeta } = require('../validators/workspace.validator');

function createWorkspaceController(service) {
    const exportNotes = notebook => binaryHandler(async (req, res) => {
        const buffer = await service.exportNotes(req.params.id, notebook);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${notebook ? 'notebook' : 'note'}.docx"`
        }).send(buffer);
    });

    return {
        documents: dataHandler(() => service.documents()),
        upload: dataHandler(req => service.upload(documentMeta(req.get('X-Document-Meta')), req.body), 201),
        setDocumentTags: dataHandler(req => service.setDocumentTags(req.params.id, req.body)),
        removeDocument: dataHandler(req => service.removeDocument(req.params.id)),
        documentFile: binaryHandler(async (req, res) => {
            const file = await service.documentFile(req.params.id);
            if (file.url) return res.redirect(file.url);
            const inline = req.query.download !== '1' && ['application/pdf', 'text/plain', 'image/png', 'image/jpeg'].includes(file.mime);
            res.set({
                'Content-Type': file.mime || 'application/octet-stream',
                'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
                'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name || 'document')}`
            });
            res.sendFile(file.path);
        }),
        notebooks: dataHandler(() => service.notebooks()),
        createNotebook: dataHandler(req => service.saveNotebook(null, req.body), 201),
        updateNotebook: dataHandler(req => service.saveNotebook(req.params.id, req.body)),
        removeNotebook: dataHandler(req => service.removeNotebook(req.params.id)),
        notes: dataHandler(() => service.notes()),
        createNote: dataHandler(req => service.saveNote(null, req.body), 201),
        updateNote: dataHandler(req => service.saveNote(req.params.id, req.body)),
        removeNote: dataHandler(req => service.removeNote(req.params.id)),
        exportNote: exportNotes(false),
        exportNotebook: exportNotes(true),
        pomodoros: dataHandler(() => service.pomodoros()),
        savePomodoro: dataHandler(req => service.savePomodoro(req.body), 201),
        clearPomodoros: dataHandler(() => service.clearPomodoros()),
        search: dataHandler(req => service.search(req.query.q, req.query.tag)),
        setTaskTags: dataHandler(req => service.setTaskTags('task', req.params.id, req.body)),
        setEduxTags: dataHandler(req => service.setTaskTags('edux', req.params.id, req.body)),
        emails: dataHandler(() => service.emails()),
        emailStatus: dataHandler(() => service.emailStatus()),
        syncEmails: dataHandler(req => service.syncEmails(req.body?.top)),
        logoutEmail: dataHandler(() => service.logoutEmail()),
        readAllEmails: dataHandler(() => service.readAllEmails()),
        readEmail: dataHandler(req => service.readEmail(req.params.id)),
        refreshEmail: dataHandler(req => service.refreshEmail(req.params.id)),
        emailTask: dataHandler(req => service.processEmail(req.params.id, 'task'), 201),
        emailExam: dataHandler(req => service.processEmail(req.params.id, 'exam'), 201)
    };
}

module.exports = { createWorkspaceController };
