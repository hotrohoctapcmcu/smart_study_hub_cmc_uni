'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-hardening-'));
process.env.GEMINI_SESSION_DIR = directory;
const gemini = require('../../API/utils/gemini-client');
const { createSummaryService } = require('../../API/services/ai-summary.service');
const { normalizeText, sliceText } = require('../../API/utils/ai-text');
const { requiredText } = require('../../API/validators/trolyai.validator');
const { splitInTwo } = require('../../API/utils/course-summary-ai');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function finished(service, id) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const job = service.summaryJob(id);
        if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
        await tick();
    }
    throw new Error('Summary did not settle');
}
test('AI input, summary jobs and conversation boundaries', async t => {
    const original = { ask: gemini.ask, generateText: gemini.generateText };
    t.after(() => { Object.assign(gemini, original); fs.rmSync(directory, { recursive: true, force: true }); });
    await t.test('Unicode cleanup preserves accents, emoji, tabs and literal escapes', () => {
        const source = 'a\u0301 👨‍👩‍👧‍👦\t`C:\\new\\test`\r\n**đậm**\0';
        assert.equal(normalizeText(source), source.replace('\r\n', '\n').replace('\0', ''));
        assert.equal(normalizeText(String.fromCharCode(0xd800)), '�');
        assert.equal(sliceText('👨‍👩‍👧‍👦abc', 6), '');
        assert.equal(sliceText('a\u0301bc', 2), 'a\u0301');
        for (const text of ['a\u0301b', '👨‍👩‍👧‍👦x', '🧠🧠', 'a'.repeat(100) + 'a\u0301'.repeat(100)]) {
            const halves = splitInTwo(text);
            assert.equal(halves.join(''), text);
            assert.ok(!halves[1] || !/^[\u0300-\u036f\u200d]/u.test(halves[1]));
        }
    });
    await t.test('empty, control-only, wrong types and oversized input fail before AI', async () => {
        let calls = 0; gemini.generateText = async () => { calls++; return 'summary'; };
        const service = createSummaryService();
        for (const text of ['', ' \r\n\t ', '\0', '\u200b\u200d\ufeff', null, {}, 42]) await assert.rejects(service.summarize({ text }), error => error.statusCode === 400);
        await assert.rejects(service.summarize({ text: 'x'.repeat(500001) }), error => error.statusCode === 413);
        assert.equal(requiredText('🧠'.repeat(32000), 'question', 32000).length, 64000);
        assert.throws(() => requiredText('🧠'.repeat(32001), 'question', 32000), error => error.statusCode === 413);
        assert.equal(calls, 0);
        await assert.rejects(service.summarize({ text: 'a' + '\u0301'.repeat(4500) }), error => error.statusCode === 413);
    });
    await t.test('a single grapheme is returned faithfully; ordinary short text uses one request', async () => {
        let calls = 0; gemini.generateText = async () => { calls++; return '**Tóm tắt**\r\nGiữ ý chính.'; };
        const service = createSummaryService();
        assert.equal((await service.summarize({ text: '👨‍👩‍👧‍👦' })).summary, '👨‍👩‍👧‍👦');
        assert.equal(calls, 0);
        assert.equal((await service.summarize({ text: 'Kiến thức ngắn.' })).summary, '**Tóm tắt**\nGiữ ý chính.');
        assert.equal(calls, 1);
        gemini.generateText = async () => ' \0 ';
        await assert.rejects(service.summarize({ text: 'Nội dung' }), error => error.statusCode === 502);
    });
    await t.test('500,000 characters use background batches with the entire source and no duplicate jobs', async () => {
        const sourceParts = [];
        gemini.generateText = async prompt => {
            assert.ok(prompt.length <= 14000);
            const part = prompt.match(/NỘI DUNG PHẦN [^\n]+:\n([\s\S]*)$/);
            if (part) sourceParts.push(part[1]);
            return '**Ý chính**: kiến thức.';
        };
        const service = createSummaryService(), text = ('a\u0301🧠\n').repeat(124998) + 'KẾT THÚC';
        assert.equal(Array.from(text).length, 500000);
        // The codepoint count remains below 500,000 despite UTF-16 pairs.
        const first = await service.summarize({ text });
        assert.ok(first.jobId);
        assert.equal((await service.summarize({ text })).jobId, first.jobId);
        const job = await finished(service, first.jobId);
        assert.equal(job.status, 'completed', JSON.stringify(job));
        assert.equal(sourceParts.join(''), normalizeText(text).trim());
        assert.equal(job.result.summary, '**Ý chính**: kiến thức.');
        assert.equal((await service.summarize({ text })).jobId, first.jobId);
        assert.throws(() => createSummaryService().summaryJob(first.jobId), error => error.statusCode === 404);
    });
    await t.test('failed merge preserves completed parts and retry runs only the merge', async () => {
        let sources = 0, merges = 0, rejectMerge = true;
        gemini.generateText = async prompt => {
            if (prompt.includes('NỘI DUNG PHẦN')) { sources++; return 'Nội dung phần.'; }
            merges++;
            if (rejectMerge) throw Object.assign(new Error('Provider unavailable'), { code: 'GEMINI_SCHEMA', statusCode: 502 });
            return 'Bản tổng hợp.';
        };
        const service = createSummaryService(), body = { text: 'nội dung '.repeat(2500) };
        const first = await service.summarize(body);
        assert.equal((await finished(service, first.jobId)).status, 'failed');
        const completedSources = sources;
        rejectMerge = false;
        const retry = await service.summarize(body);
        assert.equal(retry.jobId, first.jobId);
        assert.equal((await finished(service, retry.jobId)).result.summary, 'Bản tổng hợp.');
        assert.equal(sources, completedSources);
        assert.equal(merges, 2);
    });
    await t.test('transient errors retry once; size refusal adapts and never truncates the source', async () => {
        let calls = 0;
        gemini.generateText = async () => { if (++calls === 1) throw Object.assign(new Error('network'), { code: 'GEMINI_NETWORK', statusCode: 502 }); return 'Đã thử lại.'; };
        assert.equal((await createSummaryService().summarize({ text: 'Dữ kiện' })).summary, 'Đã thử lại.');
        assert.equal(calls, 2);
    });
    await t.test('concurrency is bounded, cancellation releases work and unknown IDs are 404', async () => {
        gemini.generateText = async (prompt, { signal }) => new Promise((resolve, reject) => {
            if (signal.aborted) return reject(new Error('aborted'));
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
        const service = createSummaryService(), ids = [];
        for (let i = 0; i < 4; i++) ids.push((await service.summarize({ title: String(i), text: 'x'.repeat(15000) })).jobId);
        await assert.rejects(service.summarize({ title: 'overflow', text: 'x'.repeat(15000) }), error => error.statusCode === 429);
        await tick();
        for (const id of ids) assert.equal(service.cancelSummary(id).status, 'cancelled');
        await tick(); await tick();
        assert.throws(() => service.cancelSummary('missing'), error => error.statusCode === 404);
        gemini.generateText = async () => 'Có thể chạy tiếp.';
        assert.equal((await service.summarize({ text: 'ngắn' })).summary, 'Có thể chạy tiếp.');
    });
    await t.test('chat keeps a 32,000 character question, bounds history and stores valid output only', async () => {
        const context = require('../../API/services/study-context.service'), build = context.buildStudyContext;
        context.buildStudyContext = async () => ({ profile: { description: 'x'.repeat(50000) }, notes: [], sources: {} });
        try {
            const saved = [];
            const { createHoiThoaiService } = require('../../API/services/hoithoai.service');
            const service = createHoiThoaiService({ userId: 1, q: async (sql, params) => {
                if (sql.startsWith('SELECT')) return [{ messages_json: JSON.stringify(Array.from({ length: 12 }, () => ({ role: 'assistant', text: 'x'.repeat(50000) }))) }];
                saved.push(params); return [];
            } });
            const question = '🧠'.repeat(32000);
            gemini.ask = async prompt => { assert.ok(Array.from(prompt).length < 60000); assert.ok(prompt.endsWith(question)); return '**Đúng** 🧠'; };
            assert.equal((await service.ask({ question })).answer, '**Đúng** 🧠');
            assert.equal(saved.length, 1);
            gemini.ask = async () => ' \0 ';
            await assert.rejects(service.ask({ question: 'test' }), error => error.statusCode === 502);
            assert.equal(saved.length, 1);
            await assert.rejects(service.ask({ question: 'x'.repeat(32001) }), error => error.statusCode === 413);
        } finally { context.buildStudyContext = build; }
    });
    await t.test('JSON extraction handles prose, escaped quotes and braces in code strings', () => {
        const value = { code: 'if (x) { return "} ]"; }', path: 'C:\\new\\test', emoji: '🧠' };
        assert.deepEqual(gemini.parseJson('Kết quả:\n' + JSON.stringify(value) + '\nGiải thích {khác}'), value);
        assert.deepEqual(gemini.parseJson('```json\n[1,{"nested":[2]}]\n```'), [1, { nested: [2] }]);
        assert.throws(() => gemini.parseJson('{"broken":'), error => error.code === 'GEMINI_JSON');
    });
    await t.test('HTTP summary contract returns 200/202, polls and cancels with structured errors', async () => {
        const express = require('express'), app = express(), service = createSummaryService();
        const controller = require('../../API/controllers/trolyai.controller').createTrolyaiController(service);
        app.use(express.json({ limit: '10mb' }));
        app.post('/summarize', controller.summarize);
        app.get('/summary-jobs/:id', controller.summaryJob);
        app.delete('/summary-jobs/:id', controller.cancelSummary);
        app.use(require('../../API/middlewares/trolyai').errorHandler);
        const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
        const base = `http://127.0.0.1:${server.address().port}`;
        const call = async (method, url, body) => {
            const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
            return { status: response.status, body: await response.json() };
        };
        try {
            gemini.generateText = async () => '**Tóm tắt**';
            assert.equal((await call('POST', '/summarize', { text: 'Nội dung ngắn.' })).status, 200);
            assert.equal((await call('POST', '/summarize', { text: 'x'.repeat(500001) })).status, 413);
            assert.equal((await call('POST', '/summarize', {})).status, 400);
            const started = await call('POST', '/summarize', { text: 'văn bản '.repeat(3000) });
            assert.equal(started.status, 202);
            const id = started.body.data.jobId;
            await finished(service, id);
            assert.equal((await call('GET', '/summary-jobs/' + id)).body.data.result.summary, '**Tóm tắt**');
            gemini.generateText = async (prompt, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
            const waiting = await call('POST', '/summarize', { text: 'chờ '.repeat(4000) });
            const cancelled = await call('DELETE', '/summary-jobs/' + waiting.body.data.jobId);
            assert.equal(cancelled.status, 200);
            assert.equal(cancelled.body.data.status, 'cancelled');
            const missing = await call('GET', '/summary-jobs/missing');
            assert.equal(missing.status, 404);
            assert.equal(missing.body.error.code, 'AI_JOB_NOT_FOUND');
            await tick();
        } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    });
});
