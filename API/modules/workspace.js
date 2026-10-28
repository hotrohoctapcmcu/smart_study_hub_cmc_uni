'use strict';

const express = require('express');
const { createWorkspaceService, fail } = require('./workspace.service');
const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');

function createWorkspaceRouter({ outlook = require('../../CRWEB/OUTLOOK') } = {}) {
    const router = express.Router();
    let db;
    const service = createWorkspaceService({ getDb: () => db });
    router.setDb = value => { db = value; };
    const handle = (fn, status = 200) => async (req, res, next) => {
        try { res.status(status).json({ success: true, data: await fn(req) }); } catch (error) { next(error); }
    };
    const binary = fn => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };

    router.get('/documents', handle(() => service.documents()));
    router.post('/documents', express.raw({ type: 'application/octet-stream', limit: '25mb' }), handle(req => {
        let meta;
        try { meta = JSON.parse(decodeURIComponent(req.get('X-Document-Meta') || '')); } catch { throw fail('Thông tin tệp tải lên không hợp lệ.'); }
        return service.upload(meta, req.body);
    }, 201));
    router.patch('/documents/:id/tags', handle(req => service.setDocumentTags(req.params.id, req.body)));
    router.delete('/documents/:id', handle(req => service.removeDocument(req.params.id)));
    router.get('/documents/:id/file', binary(async (req, res) => {
        const file = await service.documentFile(req.params.id);
        if (file.url) return res.redirect(file.url);
        const inline = req.query.download !== '1' && ['application/pdf', 'text/plain', 'image/png', 'image/jpeg'].includes(file.mime);
        res.set({ 'Content-Type': file.mime || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
            'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name || 'document')}` });
        res.sendFile(file.path);
    }));
    router.get('/notebooks', handle(() => service.notebooks()));
    router.post('/notebooks', handle(req => service.saveNotebook(null, req.body), 201));
    router.put('/notebooks/:id', handle(req => service.saveNotebook(req.params.id, req.body)));
    router.delete('/notebooks/:id', handle(req => service.removeNotebook(req.params.id)));
    router.get('/notes', handle(() => service.notes()));
    router.post('/notes', handle(req => service.saveNote(null, req.body), 201));
    router.put('/notes/:id', handle(req => service.saveNote(req.params.id, req.body)));
    router.delete('/notes/:id', handle(req => service.removeNote(req.params.id)));
    async function exportNotes(req, res, notebook = false) {
        let notes = await service.notes();
        if (notebook) notes = notes.filter(note => String(note.notebookId) === req.params.id);
        else notes = notes.filter(note => note.id === req.params.id || String(note.databaseId) === req.params.id);
        if (!notes.length) throw fail('Chưa có ghi chú để xuất.', 404);
        const { Document, Packer, Paragraph, HeadingLevel } = require('docx');
        const children = notes.flatMap(note => [new Paragraph({ text: note.title, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: [note.subject, note.chapter, note.tags.join(', ')].filter(Boolean).join(' · ') }),
            ...note.content.split(/\r?\n/).map(line => new Paragraph({ text: line }))]);
        const buffer = await Packer.toBuffer(new Document({ creator: 'UniStudy CMC', sections: [{ children }] }));
        res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${notebook ? 'notebook' : 'note'}.docx"` }).send(buffer);
    }
    router.get('/notes/:id/export', binary((req, res) => exportNotes(req, res)));
    router.get('/notebooks/:id/export', binary((req, res) => exportNotes(req, res, true)));
    router.get('/pomodoro', handle(() => service.pomodoros()));
    router.post('/pomodoro', handle(req => service.savePomodoro(req.body), 201));
    router.delete('/pomodoro', handle(() => service.clearPomodoros()));
    router.get('/search', handle(req => service.search(req.query.q, req.query.tag)));
    router.patch('/tags/tasks/:id', handle(req => service.setTaskTags('task', req.params.id, req.body)));
    router.patch('/tags/edux/:id', handle(req => service.setTaskTags('edux', req.params.id, req.body)));
    router.get('/email', handle(() => service.emails()));
    router.get('/email/status', handle(() => outlook.status()));
    router.post('/email/sync', handle(async req => {
        const result = await outlook.listMessages({ top: req.body?.top });
        const messages = await service.storeEmails(result.messages, result.account || '');
        return { messages, source: result.source, account: result.account, syncedCount: result.messages.length };
    }));
    router.delete('/email/session', handle(() => outlook.logout()));
    router.patch('/email/read', handle(async () => {
        await db.executeQuery('UPDATE SchoolEmails SET is_read=1 WHERE user_id=@uid', { uid: NGUOI_DUNG_ID });
        return true;
    }));
    router.patch('/email/:id/read', handle(req => service.readEmail(req.params.id)));
    router.post('/email/:id/refresh', handle(async req => {
        const row = (await db.executeQuery('SELECT * FROM SchoolEmails WHERE user_id=@uid AND email_id=@id', { uid: NGUOI_DUNG_ID, id: req.params.id }))[0];
        if (!row) throw fail('Không tìm thấy email.', 404);
        const message = await outlook.getMessage(row.external_id);
        await service.storeEmails([message], row.mailbox);
        return (await service.emails()).find(mail => mail.id === req.params.id);
    }));
    router.post('/email/:id/task', handle(req => service.processEmail(req.params.id, 'task'), 201));
    router.post('/email/:id/exam', handle(req => service.processEmail(req.params.id, 'exam'), 201));
    return router;
}

module.exports = createWorkspaceRouter();
module.exports.createWorkspaceRouter = createWorkspaceRouter;
