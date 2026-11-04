'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

test('course materials, whole-course AI summaries and flashcard reviews persist safely', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-learning-'));
    process.env.DB_PATH = path.join(directory, 'test.db');
    process.env.NODE_ENV = 'test';
    let database = await require('../../database')();
    const query = (...args) => database.executeQuery(...args);
    const { createLearningService, aggregateCourseText } = require('../../API/services/learning.service');
    const { createLearningRouter } = require('../../API/routes/learning');
    const stamp = new Date('2026-10-28T03:00:00Z');
    let current = { resolved: true, semester: '1', academicYear: '2026-2027', message: 'Môn hiện tại',
        courses: [{ subjectId: 1, subjectCode: 'SQL', subjectName: 'Cơ sở dữ liệu' }] };
    let connected = true, authFailure = false, aiFailure = false, lastCollectOptions;
    let collected = { courses: [{ id: 'edux-sql', subject: 'Cơ sở dữ liệu', subjectCode: 'SQL', complete: true, chapters: [
        { id: 'chapter-1', title: 'SQL cơ bản', complete: true, documents: [
            { id: 'slide-1', title: 'SELECT', number: 1, content: 'SELECT '.repeat(2000) + 'ĐUÔI_CUỐI_SLIDE', rawContent: '<p>' + 'SELECT '.repeat(2000) + 'ĐUÔI_CUỐI_SLIDE</p>', image_base64: 'unused-edux-image', images: ['https://edux.example/old-slide.png'], status: 'ready' },
            { id: 'slide-2', title: 'JOIN', number: 2, content: 'JOIN ghép các dòng. KHÓA_NGOẠI', status: 'ready' }
        ] },
        { id: 'chapter-2', title: 'Thiết kế dữ liệu', complete: true, documents: [
            { id: 'slide-3', title: 'Chuẩn hóa', number: 1, content: 'Chuẩn hóa dữ liệu. KIẾN_THỨC_CHƯƠNG_CUỐI', status: 'ready' }
        ] }
    ] }], failures: [] };
    const prompts = [], cardPrompts = [];
    const expectedSummary = 'BẢN TÓM TẮT TOÀN MÔN\nSQL cơ bản: SELECT và JOIN.\nThiết kế dữ liệu: chuẩn hóa.';
    const options = { getDb: () => database, clock: () => stamp, userId: 1, getScope: async () => structuredClone(current),
        sessions: { getSession: () => connected ? { cookie: 'test-only' } : null, clearSession: () => { connected = false; } },
        collect: async (_cookie, collectOptions) => { lastCollectOptions = collectOptions; if (authFailure) throw Object.assign(new Error('Phiên hết hạn'), { statusCode: 401 }); return structuredClone(collected); },
        ai: { ask: async (prompt, config) => {
            assert.ok(config.timeoutMs >= 120000, 'whole-course AI has a longer deadline than interactive chat');
            prompts.push(prompt);
            if (aiFailure) throw new Error('AI tạm thời lỗi');
            const [storedInput] = await query('SELECT * FROM LearningCourseTexts WHERE user_id=1');
            const part = prompt.match(/NỘI DUNG PHẦN ([AB](?:\.\d+)*):\n([\s\S]*)$/);
            if (part) {
                assert.ok(storedInput.content.includes(part[2]), 'source parts come from the exact saved course text');
                return `KIẾN_THỨC_TÓM_TẮT_PHẦN_${part[1]}`;
            }
            assert.ok(prompt.includes('KIẾN_THỨC_TÓM_TẮT_PHẦN_A') && prompt.includes('KIẾN_THỨC_TÓM_TẮT_PHẦN_B'));
            return expectedSummary;
        }, generateJson: async (prompt, config) => {
            cardPrompts.push(prompt);
            const [summary] = await query('SELECT * FROM LearningSummaries WHERE user_id=1');
            assert.equal(summary.content, expectedSummary, 'the AI summary is saved before generating cards');
            assert.ok(prompt.endsWith(expectedSummary));
            assert.ok(!prompt.includes('ĐUÔI_CUỐI_SLIDE') && !prompt.includes('KIẾN_THỨC_CHƯƠNG_CUỐI'), 'cards use the stored summary, not raw slides');
            const target = Number(prompt.match(/tối đa (\d+) thẻ/)[1]);
            const output = { cards: [1, 2, 3].slice(0, target).map(number => ({ front: `Câu ${number}?`, back: `Ý ${number} từ bản tóm tắt`, chapter: 'SQL' })) };
            assert.equal(config.validate(output), true);
            return output;
        } }
    };
    let service = createLearningService(options);
    const router = createLearningRouter(options); router.setDb(database);
    const app = express(); app.use(express.json()); app.use('/learning', router);
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const request = async (method, endpoint, body) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/learning${endpoint}`, {
            method, headers: { 'Content-Type': 'application/json' }, ...(body && { body: JSON.stringify(body) })
        });
        return { status: response.status, ...(await response.json()) };
    };
    const finish = async (started, target = service) => {
        const deadline = Date.now() + 10000;
        let job;
        do { job = target.job(started.jobId); if (!['running', 'queued'].includes(job.status)) return job; await new Promise(resolve => setTimeout(resolve, 10)); } while (Date.now() < deadline);
        throw new Error('Job không kết thúc');
    };
    t.after(async () => {
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        await database.closePool();
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });

    await t.test('additive migration preserves existing data and shows IU placeholders before EDUX sync', async () => {
        await query("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'LEARN','Learner','IT')");
        require('../../database/migrations/learningMigration').migrateLearning(await database.getPool());
        assert.equal((await query('SELECT * FROM Students')).length, 1);
        const catalog = await service.courses();
        assert.equal(catalog.courses.length, 1); assert.equal(catalog.courses[0].id, 'pending-1');
        assert.deepEqual((await service.course('pending-1')).chapters, []);
        assert.equal((await request('GET', '/courses')).status, 200);
    });
    await t.test('sync jobs deduplicate concurrent requests and store every source in order', async () => {
        const [first, second] = await Promise.all([service.startSync({ summarize: false }), service.startSync({ summarize: false })]);
        assert.equal(first.jobId, second.jobId);
        assert.equal((await finish(first)).status, 'completed');
        const course = await service.course('edux-sql');
        assert.equal(course.sourceCount, 3); assert.equal(course.failedCount, 0); assert.equal(course.complete, true);
        assert.equal(course.chapters[0].documents[0].content.endsWith('ĐUÔI_CUỐI_SLIDE'), true);
        assert.equal(Object.hasOwn(course.chapters[0].documents[0], 'images'), false);
        assert.ok(!JSON.stringify(course).includes('unused-edux-image'));
        assert.ok(!JSON.stringify(await query('SELECT chapters_json FROM LearningCourses')).includes('unused-edux-image'));
        assert.equal(course.chapters[1].documents[0].id, 'slide-3');
    });
    await t.test('previous multipart summaries are preserved but require regeneration from the whole course', async () => {
        await query(`INSERT INTO LearningSummaries(user_id,course_id,source_hash,content,coverage_json,created_at)
            SELECT 1,course_id,source_hash,'Bản tóm tắt từ các phần cũ','[]','2026-01-01' FROM LearningCourses WHERE course_id='edux-sql'`);
        const result = await service.course('edux-sql');
        assert.equal(result.summary.pipelineVersion, 1); assert.equal(result.summary.stale, true);
        assert.equal(result.summary.content, 'Bản tóm tắt từ các phần cũ');
    });
    let card;
    await t.test('A and B include the entire course, are merged, then the final summary is saved before cards', async () => {
        const before = prompts.length;
        const job = await finish(await service.startSummary('edux-sql'));
        assert.equal(job.status, 'completed', job.error);
        assert.equal(prompts.length, before + 3, 'summarize A, summarize B, then merge A+B');
        const parts = prompts.slice(before, before + 2).map(prompt => prompt.match(/NỘI DUNG PHẦN [AB]:\n([\s\S]*)$/)[1]);
        assert.equal(parts.join(''), aggregateCourseText(collected.courses[0]));
        assert.ok(parts.join('').includes('ĐUÔI_CUỐI_SLIDE') && parts.join('').includes('KIẾN_THỨC_CHƯƠNG_CUỐI'));
        assert.ok(!prompts[before + 2].includes('ĐUÔI_CUỐI_SLIDE'), 'merge uses the AI summaries, not raw slides');
        const course = await service.course('edux-sql');
        assert.equal(course.summary.content, expectedSummary);
        assert.equal(course.summary.pipelineVersion, 3);
        assert.deepEqual(course.summary.sourceIds, ['slide-1', 'slide-2', 'slide-3']);
        assert.equal(course.summary.stale, false); assert.ok(course.cards.length >= 3);
        card = course.cards[0];
        const calls = prompts.length;
        await service.summarize('edux-sql');
        assert.equal(prompts.length, calls, 'unchanged sources reuse the saved summary');
    });
    await t.test('a saved whole-course summary survives card timeouts and is reused after reopening', async () => {
        const savedSources = structuredClone(collected);
        collected.courses[0].chapters[0].documents[0].content += '\nNew resumable version';
        collected.courses[0].chapters[0].documents[0].rawContent += '\nNew resumable version';
        await finish(await service.startSync({ summarize: false }));
        let calls = 0;
        const original = options.ai.generateJson;
        options.ai.generateJson = async (...args) => {
            calls++;
            throw Object.assign(new Error('Temporary provider timeout'), { code: 'GEMINI_TIMEOUT' });
        };
        const interrupted = await finish(await service.startSummary('edux-sql'));
        assert.equal(interrupted.status, 'failed');
        assert.ok(interrupted.error.includes('Bản tóm tắt toàn môn đã được lưu'));
        assert.equal(calls, 2, 'one transient retry for card generation');
        assert.equal((await service.course('edux-sql')).summary.content, expectedSummary);
        assert.equal((await service.course('edux-sql')).summary.stale, false);
        await database.closePool(); database = await require('../../database')();
        service = createLearningService(options);
        const summaryCalls = prompts.length;
        options.ai.generateJson = original;
        assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
        assert.equal(prompts.length, summaryCalls, 'the complete saved summary is not regenerated to retry cards');
        collected = savedSources;
        await finish(await service.startSync());
        await finish(await service.startSummary('edux-sql'));
        card = (await service.course('edux-sql')).cards[0];
    });
    await t.test('review is atomic, idempotent and protected from foreign user/card ids', async () => {
        const updated = await service.review(card.id, { rating: 'good', requestId: 'review-1' });
        assert.equal(updated.reviews, 1); assert.ok(Date.parse(updated.dueAt) > stamp.getTime());
        assert.deepEqual(await service.review(card.id, { rating: 'good', requestId: 'review-1' }), updated);
        await assert.rejects(service.review(card.id, { rating: 'easy', requestId: 'review-1' }), { statusCode: 409 });
        const foreign = createLearningService({ ...options, userId: 2 });
        assert.deepEqual((await foreign.courses()).courses[0].cards, []);
        await assert.rejects(foreign.review(card.id, { rating: 'easy', requestId: 'foreign' }), { statusCode: 404 });
        assert.equal((await request('POST', `/cards/${card.id}/review`, { rating: 'bad', requestId: 'invalid' })).status, 400);
    });
    await t.test('a failed slide refresh retains cached content, marks old summaries stale and blocks AI/review', async () => {
        collected.courses[0].complete = false;
        collected.courses[0].chapters[0].complete = false;
        collected.courses[0].chapters[0].documents[0] = { id: 'slide-1', title: 'SELECT', number: 1, content: '', status: 'error', error: 'HTTP 503' };
        await finish(await service.startSync({ summarize: false }));
        const course = await service.course('edux-sql');
        assert.ok(course.chapters[0].documents[0].content.includes('ĐUÔI_CUỐI_SLIDE'));
        assert.equal(course.chapters[0].documents[0].cached, true);
        assert.equal(Object.hasOwn(course.chapters[0].documents[0], 'images'), false);
        assert.ok(!JSON.stringify(course).includes('unused-edux-image'));
        assert.ok(!JSON.stringify(await query('SELECT chapters_json FROM LearningCourses')).includes('unused-edux-image'));
        assert.equal(course.summary.stale, true); assert.deepEqual(course.cards, []);
        await assert.rejects(service.startSummary('edux-sql'), { statusCode: 409 });
        await assert.rejects(service.review(card.id, { rating: 'good', requestId: 'stale' }), { statusCode: 409 });
    });
    await t.test('sync never starts AI; only an explicit summary request can run AI and its failure preserves sources', async () => {
        collected.courses[0].complete = true; collected.courses[0].chapters[0].complete = true;
        collected.courses[0].chapters[0].documents[0] = { id: 'slide-1', title: 'SELECT', number: 1, content: 'Nội dung đã cập nhật', status: 'ready' };
        aiFailure = true;
        const before = prompts.length;
        const scanned = await finish(await service.startSync({ summarize: true, automatic: true }));
        assert.equal(scanned.status, 'completed'); assert.equal(prompts.length, before);
        assert.deepEqual(scanned.result.failures, []);
        assert.equal((await service.course('edux-sql')).summary.stale, true);
        const failed = await finish(await service.startSummary('edux-sql'));
        assert.equal(failed.status, 'failed');
        assert.ok((await service.course('edux-sql')).failures.some(failure => failure.stage === 'summary' && failure.message === 'AI tạm thời lỗi'));
        aiFailure = false;
        assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
        assert.equal((await service.course('edux-sql')).summary.stale, false);
        assert.ok(!(await service.course('edux-sql')).failures.some(failure => failure.stage === 'summary'));
    });
    await t.test('after B fails, reopening SQLite reuses saved A and only retries B plus the final merge', async () => {
        const previous = structuredClone(collected), original = options.ai.ask;
        collected.courses[0].chapters[1].documents[0].content += '\nVersion for resumable A and B';
        await finish(await service.startSync({ summarize: false }));
        const [before] = await query('SELECT * FROM LearningSummaries');
        let failures = 0;
        options.ai.ask = async (prompt, config) => {
            if (prompt.includes('NỘI DUNG PHẦN B:')) {
                failures++;
                throw Object.assign(new Error('Temporary timeout in B'), { code: 'GEMINI_TIMEOUT' });
            }
            return original(prompt, config);
        };
        try {
            assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'failed');
            assert.equal(failures, 2);
            assert.equal((await query('SELECT * FROM LearningSummaries'))[0].source_hash, before.source_hash);
            const [input] = await query('SELECT input_hash FROM LearningCourseTexts');
            const parts = await query('SELECT content FROM LearningSummaryParts WHERE input_hash=@hash', { hash: input.input_hash });
            assert.deepEqual(parts.map(row => row.content), ['KIẾN_THỨC_TÓM_TẮT_PHẦN_A']);
            await database.closePool(); database = await require('../../database')();
            service = createLearningService(options); options.ai.ask = original;
            const count = prompts.length;
            assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
            assert.equal(prompts.length - count, 2);
            assert.ok(prompts[count].includes('NỘI DUNG PHẦN B:'));
            assert.equal((await service.course('edux-sql')).summary.stale, false);
        } finally { options.ai.ask = original; collected = previous; }
        await finish(await service.startSync());
        await finish(await service.startSummary('edux-sql'));
    });
    await t.test('card response overflow retries with fewer shorter cards while keeping the final summary', async () => {
        const previous = structuredClone(collected), original = options.ai.generateJson;
        collected.courses[0].chapters[1].documents[0].content += '\nVersion for smaller card responses';
        await finish(await service.startSync({ summarize: false }));
        let calls = 0;
        options.ai.generateJson = async (prompt, config) => {
            calls++;
            if (calls === 1) throw Object.assign(new Error('Response too large'), { code: 'GEMINI_RESPONSE_SIZE' });
            assert.ok(prompt.includes('tối đa 2 thẻ') && prompt.includes('tối đa 250 ký tự'));
            return original(prompt, config);
        };
        try {
            assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
            assert.equal(calls, 2);
            assert.equal((await service.course('edux-sql')).summary.content, expectedSummary);
        } finally { options.ai.generateJson = original; collected = previous; }
        await finish(await service.startSync());
        await finish(await service.startSummary('edux-sql'));
    });
    await t.test('persistent provider input limits retain all sources and the previous final summary', async () => {
        const previous = structuredClone(collected);
        collected.courses[0].chapters[0].documents[0].content = 'Changed whole-course input';
        await finish(await service.startSync({ summarize: false }));
        const original = options.ai.ask;
        let calls = 0;
        options.ai.ask = async prompt => {
            calls++;
            throw Object.assign(new Error('Input exceeds provider limit'), { statusCode: 413 });
        };
        const result = await finish(await service.startSummary('edux-sql'));
        assert.equal(result.status, 'failed'); assert.ok(calls >= 2);
        const [input] = await query("SELECT content FROM LearningCourseTexts WHERE course_id='edux-sql'");
        assert.equal(input.content, aggregateCourseText(collected.courses[0]));
        assert.equal((await service.course('edux-sql')).summary.content, expectedSummary);
        options.ai.ask = original; collected = previous;
        await finish(await service.startSync());
        await finish(await service.startSummary('edux-sql'));
    });
    await t.test('HTTP 200 error text is retried without replacing the summary or generating cards', async () => {
        const previous = structuredClone(collected);
        const original = options.ai.ask;
        collected.courses[0].chapters[1].documents[0].content += '\nNew input for provider response failure';
        await finish(await service.startSync({ summarize: false }));
        let calls = 0;
        const cardsBefore = cardPrompts.length;
        options.ai.ask = async (prompt, config) => {
            if (!prompt.includes('NỘI DUNG PHẦN B:')) return original(prompt, config);
            calls++;
            assert.ok(prompt.includes('New input for provider response failure'));
            return 'Sorry, something went wrong. Please try your request again.';
        };
        try {
            const result = await finish(await service.startSummary('edux-sql'));
            assert.equal(result.status, 'failed'); assert.equal(calls, 2);
            assert.ok(result.error.includes('AI trả thông báo lỗi'));
            assert.equal(cardPrompts.length, cardsBefore);
            assert.equal((await query('SELECT content FROM LearningSummaries'))[0].content, expectedSummary);
            assert.equal((await query('SELECT content FROM LearningCourseTexts'))[0].content, aggregateCourseText(collected.courses[0]));
        } finally { options.ai.ask = original; collected = previous; }
        await finish(await service.startSync());
        await finish(await service.startSummary('edux-sql'));
    });
    await t.test('previously saved provider errors are stale and regenerated from the whole course', async () => {
        await query("UPDATE LearningSummaries SET content='Sorry, something went wrong. Please try your request again.' WHERE course_id='edux-sql'");
        const invalid = await service.course('edux-sql');
        assert.equal(invalid.summary.stale, true); assert.deepEqual(invalid.cards, []);
        const before = prompts.length;
        assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
        assert.equal(prompts.length, before, 'restore the valid cached A+B result without resending content');
        assert.equal((await service.course('edux-sql')).summary.content, expectedSummary);
        assert.equal((await service.course('edux-sql')).summary.stale, false);
    });
    await t.test('chapter errors and unavailable courses remain visible after reload, with retry scoped to one course', async () => {
        current.courses.push({ subjectId: 9, subjectCode: 'MATH', subjectName: 'Giải tích' });
        collected.courses[0].complete = false;
        collected.courses[0].chapters[0].complete = false;
        collected.courses[0].chapters[0].error = 'Không đọc được học liệu EDUX (HTTP 404).';
        const documents = collected.courses[0].chapters[0].documents;
        collected.courses[0].chapters[0].documents = [];
        collected.failures = [{ courseId: 'edux-sql', subject: 'Cơ sở dữ liệu', stage: 'slides', chapterId: 'chapter-1', chapter: 'SQL cơ bản', message: 'HTTP 404' },
            { subject: 'Giải tích', subjectCode: 'MATH', stage: 'course', message: 'Chưa được cấp học liệu.' }];
        await finish(await service.startSync({ summarize: false }));
        const reopenedService = createLearningService(options);
        assert.ok((await reopenedService.course('edux-sql')).failures.some(failure => failure.stage === 'slides' && failure.chapter === 'SQL cơ bản'));
        assert.equal((await reopenedService.course('pending-9')).failures[0].message, 'Chưa được cấp học liệu.');
        collected.courses[0].complete = true; collected.courses[0].chapters[0].complete = true;
        delete collected.courses[0].chapters[0].error;
        collected.courses[0].chapters[0].documents = documents; collected.failures = [];
        await finish(await service.startSync({ subjectId: 'edux-sql', summarize: false }));
        assert.equal(lastCollectOptions.subjectId, 'edux-sql');
        assert.equal((await service.course('edux-sql')).failures.length, 0);
        assert.equal((await service.course('pending-9')).failures.length, 1);
        current.courses.pop();
    });
    await t.test('card storage rolls back without losing the previously saved AI summary', async () => {
        collected.courses[0].chapters[0].documents[0].content = 'Phiên bản thứ ba';
        await finish(await service.startSync({ summarize: false }));
        const before = (await query('SELECT * FROM LearningSummaries'))[0];
        await query("CREATE TRIGGER reject_learning_card BEFORE INSERT ON LearningCards BEGIN SELECT RAISE(ABORT,'Save denied'); END");
        const failed = await finish(await service.startSummary('edux-sql'));
        assert.equal(failed.status, 'failed');
        assert.notEqual((await query('SELECT * FROM LearningSummaries'))[0].source_hash, before.source_hash);
        assert.equal((await service.course('edux-sql')).summary.content, expectedSummary);
        assert.equal((await service.course('edux-sql')).summary.stale, false);
        const [currentSummary] = await query('SELECT source_hash,summary_hash FROM LearningSummaries WHERE course_id=\'edux-sql\'');
        assert.equal((await query('SELECT * FROM LearningCardBatches WHERE course_id=\'edux-sql\' AND source_hash=@source AND summary_hash=@summary',
            { source: currentSummary.source_hash, summary: currentSummary.summary_hash })).length, 0, 'a failed card transaction cannot persist a completed checkpoint');
        const summaryCalls = prompts.length;
        await query('DROP TRIGGER reject_learning_card');
        assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
        assert.equal(prompts.length, summaryCalls);
    });
    await t.test('expanded summaries remain current and partial card batches resume after SQLite reopen', async () => {
        const previous = structuredClone(collected), originalAsk = options.ai.ask, originalCards = options.ai.generateJson;
        collected.courses[0].chapters[1].documents[0].content += '\nLong answer and resumable card batches';
        await finish(await service.startSync({ summarize: false }));
        const longSummary = Array.from({ length: 180 }, (_, index) => `Chương ${index}: Kiến thức AI, đủ định nghĩa và điều kiện. `).join('').trim();
        let summaryCalls = 0, cardCalls = 0, broken = true;
        const successfulSources = [];
        options.ai.ask = async prompt => { summaryCalls++; return prompt.includes('NỘI DUNG PHẦN ') ? 'Kiến thức AI phần nhỏ.' : longSummary; };
        options.ai.generateJson = async (prompt, config) => {
            cardCalls++;
            if (broken && cardCalls > 1) throw Object.assign(new Error('Broken JSON'), { code: 'GEMINI_JSON' });
            const text = prompt.split('BẢN TÓM TẮT ĐÃ LƯU:\n')[1];
            successfulSources.push(text);
            const output = { cards: [{ front: `Thẻ ${require('../../API/utils/course-material-text').fingerprint(text).slice(0, 12)}`, back: 'Đáp án từ bản tóm tắt.' }] };
            assert.equal(config.validate(output), true); return output;
        };
        try {
            const failed = await finish(await service.startSummary('edux-sql'));
            assert.equal(failed.status, 'failed'); assert.equal(cardCalls, 4);
            let result = await service.course('edux-sql');
            assert.equal(result.summary.content, longSummary); assert.equal(result.summary.stale, false);
            assert.equal(result.summary.format, 'expanded'); assert.ok(result.summary.notice);
            assert.equal(result.cardCount, 1); assert.equal(result.summary.cardsState.status, 'partial');
            assert.equal(result.summary.cardsState.completedBatches, 1);
            assert.ok(result.failures.some(failure => failure.stage === 'cards'));
            const total = result.summary.cardsState.totalBatches;
            const callsBefore = summaryCalls;
            await database.closePool(); database = await require('../../database')(); service = createLearningService(options);
            result = await service.course('edux-sql'); assert.equal(result.summary.cardsState.status, 'partial');
            // A regenerated identical summary may reset display metadata. Its
            // durable batch checkpoints still distinguish partial from legacy.
            await query("UPDATE LearningSummaries SET cards_state_json='{}' WHERE course_id='edux-sql'");
            broken = false;
            assert.equal((await finish(await service.startSummary('edux-sql'))).status, 'completed');
            result = await service.course('edux-sql');
            assert.equal(summaryCalls, callsBefore, 'reuses long persisted summary rather than rejecting it at 8000 characters');
            assert.equal(cardCalls, 4 + total - 1, 'only unfinished batches are retried');
            assert.equal(successfulSources.join(''), longSummary, 'all summary sections used exactly once in successful batches');
            assert.equal(result.summary.cardsState.status, 'complete'); assert.equal(result.cardCount, total);
            const finalCalls = cardCalls;
            await service.summarize('edux-sql'); assert.equal(cardCalls, finalCalls, 'completed batches are idempotent');
        } finally { options.ai.ask = originalAsk; options.ai.generateJson = originalCards; collected = previous; }
        await finish(await service.startSync()); await finish(await service.startSummary('edux-sql'));
    });
    await t.test('changing term hides old materials without deleting sources or review history', async () => {
        current.courses = [{ subjectId: 2, subjectCode: 'WEB', subjectName: 'Lập trình Web' }];
        assert.equal((await service.courses()).courses[0].id, 'pending-2');
        await assert.rejects(service.course('edux-sql'), { statusCode: 404 });
        assert.equal((await query('SELECT * FROM LearningCourses')).length, 1);
        assert.equal((await query('SELECT * FROM LearningReviews')).length, 1);
        current.courses = [{ subjectId: 1, subjectCode: 'SQL', subjectName: 'Cơ sở dữ liệu' }];
    });
    await t.test('expired EDUX sessions preserve stored materials and clear only the invalid session', async () => {
        authFailure = true;
        assert.equal((await finish(await service.startSync())).status, 'failed');
        assert.equal(connected, false);
        assert.equal((await service.course('edux-sql')).sourceCount, 3);
        await assert.rejects(service.startSync(), { statusCode: 401 });
    });
    await t.test('sources, summaries and reviews survive closing and reopening SQLite', async () => {
        await database.closePool(); database = await require('../../database')();
        service = createLearningService(options);
        const course = await service.course('edux-sql');
        assert.equal(course.summary.stale, false); assert.ok(course.cards.length);
        assert.equal((await query('SELECT * FROM LearningReviews')).length, 1);
    });
    await t.test('scoped sync requests share one FIFO queue and duplicate queued courses are scanned once', async () => {
        const order = [], queueCourses = ['queue-a', 'queue-b'];
        let release;
        const barrier = new Promise(resolve => { release = resolve; });
        let aiCalls = 0;
        const queueService = createLearningService({ ...options,
            getScope: async () => ({ resolved: true, courses: queueCourses.map((id, index) => ({ subjectId: index + 20, subjectName: id, subjectCode: id })) }),
            sessions: { getSession: () => ({ cookie: 'queue-test-only' }), clearSession: () => {} },
            collect: async (_cookie, { subjectId }) => {
                order.push(subjectId);
                if (subjectId === 'queue-a') await barrier;
                return { courses: [{ id: subjectId, subject: subjectId, subjectCode: subjectId, complete: true,
                    chapters: [{ id: 'chapter', complete: true, documents: [{ id: 'slide', title: 'Slide', content: 'Saved source', status: 'ready' }] }] }], failures: [] };
            },
            ai: { ask: async () => { aiCalls++; throw new Error('Sync must not call AI'); } },
        });
        const first = await queueService.startSync({ subjectId: 'queue-a' });
        const second = await queueService.startSync({ subjectId: 'queue-b' });
        const duplicate = await queueService.startSync({ subjectId: 'queue-b' });
        try {
            assert.equal(duplicate.jobId, second.jobId);
            assert.equal(queueService.job(second.jobId).status, 'queued');
            const catalog = await queueService.courses();
            assert.deepEqual(catalog.jobs.map(job => [job.kind, job.queuePosition]), [['sync', 1], ['sync', 2]]);
            assert.deepEqual(order, ['queue-a']);
        } finally { release(); }
        assert.equal((await finish(first, queueService)).status, 'completed');
        assert.equal((await finish(second, queueService)).status, 'completed');
        assert.deepEqual(order, queueCourses); assert.equal(aiCalls, 0);
        assert.equal((await queueService.course('queue-b')).sourceCount, 1);
    });
    await t.test('six explicitly requested courses queue in order, finish each whole course, and keep input isolated', async () => {
        const batch = Array.from({ length: 6 }, (_, index) => ({ id: `batch-${index}`, subject: `Batch course ${index}`, subjectCode: `BATCH${index}`,
            complete: true, chapters: [{ id: `b${index}-first`, title: 'First chapter', complete: true,
                documents: [{ id: `b${index}-s1`, title: 'First', status: 'ready', content: `BATCH_START_${index}` }] },
            { id: `b${index}-last`, title: 'Last chapter', complete: true,
                documents: [{ id: `b${index}-s2`, title: 'Last', status: 'ready', content: `BATCH_END_${index}` }] }] }));
        let release;
        const barrier = new Promise(resolve => { release = resolve; });
        let active = 0, maximum = 0;
        const asked = [];
        const work = async fn => { maximum = Math.max(maximum, ++active); try { return await fn(); } finally { active--; } };
        const batchService = createLearningService({ ...options,
            sessions: { getSession: () => ({ cookie: 'batch-test-only' }), clearSession: () => {} },
            getScope: async () => ({ resolved: true, courses: batch.map((item, i) => ({ subjectId: i + 10, subjectCode: item.subjectCode, subjectName: item.subject })) }),
            collect: async () => ({ courses: batch, failures: [] }),
            ai: {
                ask: prompt => work(async () => {
                    const index = Number(prompt.match(/môn Batch course (\d+)/)[1]);
                    asked.push(index);
                    const part = prompt.match(/NỘI DUNG PHẦN ([AB]):/);
                    if (part) assert.ok(prompt.includes(part[1] === 'A' ? `BATCH_START_${index}` : `BATCH_END_${index}`));
                    else assert.ok(prompt.includes(`SAVED_BATCH_PART_A_${index}`) && prompt.includes(`SAVED_BATCH_PART_B_${index}`));
                    for (let other = 0; other < 6; other++) if (other !== index) assert.ok(!prompt.includes(`BATCH_START_${other}`));
                    await barrier;
                    return part ? `SAVED_BATCH_PART_${part[1]}_${index}` : `SAVED_BATCH_SUMMARY_${index}`;
                }),
                generateJson: prompt => work(async () => {
                    const index = Number(prompt.match(/SAVED_BATCH_SUMMARY_(\d+)/)[1]);
                    const [saved] = await query('SELECT content FROM LearningSummaries WHERE course_id=@id', { id: `batch-${index}` });
                    assert.equal(saved.content, `SAVED_BATCH_SUMMARY_${index}`);
                    assert.ok(!prompt.includes('BATCH_START_'));
                    return { cards: [{ front: `Question ${index}`, back: `Answer ${index}` }] };
                })
            }
        });
        assert.equal((await finish(await batchService.startSync(), batchService)).status, 'completed');
        assert.equal(asked.length, 0, 'sync alone does not request AI');
        const started = await Promise.all(batch.map(item => batchService.startSummary(item.id)));
        try {
            const until = Date.now() + 3000;
            while (active < 2 && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
            assert.equal(active, 2); assert.deepEqual(asked, [0, 0], 'two parts of course 0 run together; later courses still wait');
            assert.equal(batchService.job(started[5].jobId).status, 'queued');
            assert.equal(batchService.job(started[5].jobId).queuePosition, 6);
        } finally { release(); }
        const finished = await Promise.all(started.map(item => finish(item, batchService)));
        assert.ok(finished.every(item => item.status === 'completed'));
        assert.equal(maximum, 2); assert.equal(active, 0); assert.equal(asked.length, 18);
        assert.deepEqual(asked, batch.flatMap((_, index) => [index, index, index]));
        for (let index = 0; index < 6; index++) {
            const result = await batchService.course(`batch-${index}`);
            assert.equal(result.summary.content, `SAVED_BATCH_SUMMARY_${index}`);
            assert.equal(result.cards.length, 1);
        }
    });
});
