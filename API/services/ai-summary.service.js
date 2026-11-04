'use strict';

const { randomUUID, createHash } = require('node:crypto');
const gemini = require('../utils/gemini-client');
const { summarizeInBatches } = require('../utils/course-summary-ai');
const { learningAiQueue } = require('../utils/learning-ai-queue');
const { requiredText, optionalText } = require('../validators/trolyai.validator');
const { MAX_TEXT_LENGTH, SUMMARY_BACKGROUND_THRESHOLD } = require('../utils/trolyai-config');

const fail = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code });
const TTL = 30 * 60 * 1000;

// Bounded, process-local jobs. The client keeps the source; course summaries use
// the separate durable database pipeline. Failed jobs retain completed parts.
function createSummaryService() {
    const jobs = new Map();
    let shortActive = 0;
    const snapshot = job => ({ jobId: job.id, status: job.status, message: job.message,
        result: job.result || null, error: job.error || null, expiresAt: new Date(job.updated + TTL).toISOString() });
    function prune() {
        for (const [id, job] of jobs) if (!job.active && Date.now() - job.updated > TTL) jobs.delete(id);
    }
    function find(id) {
        prune();
        const job = jobs.get(id);
        if (!job) throw fail('Tác vụ không còn tồn tại. Hãy gửi lại nội dung đã giữ.', 404, 'AI_JOB_NOT_FOUND');
        return job;
    }
    async function execute(text, title, parts, signal, update) {
        signal.throwIfAborted();
        let format = {};
        const summary = await summarizeInBatches({ subject: title || 'nội dung được cung cấp' }, text, {
            singlePass: true,
            onFormat: value => { format = value; },
            limits: { inputChars: 14000, partChars: 4000, summaryChars: 8000 },
            load: key => parts.get(key), save: (key, value) => { signal.throwIfAborted(); parts.set(key, value); }, update,
            ask: prompt => learningAiQueue.run(async () => {
                signal.throwIfAborted();
                for (let attempt = 0; ; attempt++) {
                    try { return await gemini.generateText(prompt, { signal, timeoutMs: 45000, maxInputChars: 18000, retry: false }); }
                    catch (error) {
                        if (signal.aborted || attempt >= 1 || !['GEMINI_NETWORK', 'GEMINI_TIMEOUT', 'GEMINI_RESPONSE_ERROR', 'GEMINI_RATE_LIMIT'].includes(error.code)) throw error;
                        // A bounded delay, cancellable even while the provider is busy.
                        await require('node:timers/promises').setTimeout(500, undefined, { signal });
                    }
                }
            })
        });
        return { title, summary, ...format };
    }
    function start(job, text, title) {
        job.status = 'queued'; job.error = null; job.updated = Date.now();
        job.active = true;
        job.controller = new AbortController();
        const signal = AbortSignal.any([job.controller.signal, AbortSignal.timeout(10 * 60 * 1000)]);
        job.work = Promise.resolve().then(async () => {
            signal.throwIfAborted();
            job.status = 'running';
            job.result = await execute(text, title, job.parts, signal, message => { job.message = message; });
            signal.throwIfAborted(); job.status = 'completed'; job.message = 'Đã tóm tắt toàn bộ nội dung.';
        }).catch(error => {
            job.status = job.controller.signal.aborted ? 'cancelled' : 'failed';
            job.error = { code: error.code || 'AI_SUMMARY_FAILED', message: signal.aborted ? 'Đã dừng tóm tắt. Nội dung và các phần đã xong được giữ để thử lại.' : error.message };
        }).finally(() => { job.updated = Date.now(); job.active = false; });
        return snapshot(job);
    }
    return {
        async summarize(body = {}, options = {}) {
            const text = requiredText(body?.text ?? body?.content, 'text', MAX_TEXT_LENGTH);
            const title = optionalText(body?.title, 180);
            const active = () => shortActive + [...jobs.values()].filter(job => job.active).length;
            if (text.length <= SUMMARY_BACKGROUND_THRESHOLD) {
                if (active() >= 4) throw fail('Đang có nhiều tài liệu được xử lý. Hãy thử lại sau.', 429, 'AI_JOB_LIMIT');
                shortActive++;
                const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
                try { return await execute(text, title, new Map(), signal, () => {}); }
                catch (error) { if (signal.aborted) throw fail('AI chưa hoàn tất tóm tắt trong thời gian chờ. Hãy thử lại.', 504, 'GEMINI_TIMEOUT'); throw error; }
                finally { shortActive--; }
            }
            prune();
            const hash = createHash('sha256').update(JSON.stringify([text, title])).digest('hex');
            const prior = [...jobs.values()].find(job => job.hash === hash);
            if (prior && ['queued', 'running', 'completed'].includes(prior.status)) return snapshot(prior);
            if (prior?.active) throw fail('Tác vụ đang dừng. Hãy đợi rồi thử lại.', 409, 'AI_JOB_STOPPING');
            if (active() >= 4) throw fail('Đang có nhiều tài liệu được xử lý. Hãy đợi một tác vụ hoàn tất rồi thử lại.', 429, 'AI_JOB_LIMIT');
            if (!prior && jobs.size >= 12) {
                const oldest = [...jobs.values()].filter(job => !job.active).sort((a, b) => a.updated - b.updated)[0];
                if (oldest) jobs.delete(oldest.id);
            }
            const job = prior || { id: randomUUID(), hash, parts: new Map() };
            jobs.set(job.id, job);
            return start(job, text, title);
        },
        summaryJob: id => snapshot(find(id)),
        cancelSummary: id => { const job = find(id); if (['queued', 'running'].includes(job.status)) { job.controller.abort(); job.status = 'cancelled'; job.message = 'Đã yêu cầu dừng.'; } return snapshot(job); }
    };
}
module.exports = { createSummaryService };
