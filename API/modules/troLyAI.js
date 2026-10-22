/**
 * API/modules/troLyAI.js
 * ===================================================================================
 * MODULE TRỢ LÝ AI (CHỨC NĂNG 7 — HỎI ĐÁP KIẾN THỨC)
 * ===================================================================================
 * Hai endpoint cho FE:
 *   GET  /api/v1/ai/status  -> trạng thái dịch vụ (đã cấu hình hay chưa)
 *   POST /api/v1/ai/ask     -> { question, conversationId? } => { answer }
 *
 * Logic gọi Gemini nằm ở API/shared/gemini-client.js; module này chỉ kiểm tra
 * tham số, gọi client và giữ nguyên khuôn response { success, ... } của hệ thống.
 * ===================================================================================
 */

const express = require('express');
const gemini = require('../shared/gemini-client');

const router = express.Router();

const MAX_QUESTION_LENGTH = 4000;

const loi = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const xuLy = (callback, status = 200) => async (req, res, next) => {
    try {
        res.status(status).json({ success: true, ...await callback(req) });
    } catch (err) {
        next(err);
    }
};

router.get('/status', xuLy(async () => ({ data: gemini.getStatus() })));

router.post('/ask', xuLy(async req => {
    const question = req.body?.question;

    if (typeof question !== 'string' || !question.trim()) {
        throw loi('Vui lòng nhập câu hỏi.');
    }
    if (question.length > MAX_QUESTION_LENGTH) {
        throw loi(`Câu hỏi tối đa ${MAX_QUESTION_LENGTH} ký tự.`);
    }

    const conversationId = typeof req.body?.conversationId === 'string'
        && req.body.conversationId.trim()
        ? req.body.conversationId.trim().slice(0, 64)
        : undefined;

    const answer = await gemini.ask(question, { conversationId });

    return { data: { answer, conversationId } };
}));

module.exports = router;
