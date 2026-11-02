'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectCourseMaterials, materialText } = require('../../API/utils/edux-materials');

const cookie = 'access_token=test-session-only';
const scope = { resolved: true, semester: '1', academicYear: '2026-2027',
    courses: [{ subjectId: 7, subjectCode: 'SQL', subjectName: 'Cơ sở dữ liệu' }] };
const subject = { id: 'edux-sql', subject_code: 'SQL', name: 'Cơ sở dữ liệu' };
const error = status => Object.assign(new Error(`HTTP ${status}`), { status });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture(overrides = {}) {
    return {
        layHocPhan: async () => [subject, { id: 'old-subject', subject_code: 'OLD', name: 'Môn học kỳ trước' }],
        layChuongTrinhHoc: async () => [{ id: 'chapter-1', title: 'Chương 1' }],
        laySlide: async () => [{ id: 'slide-1', title: 'Khóa ngoại', document_number: 1 }],
        layNoiDungSlide: async () => '<p>Khóa ngoại tham chiếu khóa chính.</p>',
        ...overrides,
    };
}

test('HTML/editor text conversion preserves knowledge, code, inline spaces and line breaks', () => {
    const html = '<h2>SQL &amp; JOIN</h2><p>A &lt; B &#x2264; C</p><pre>if (x &lt; y) {\n  return x;\n}</pre><script>not lesson content</script>';
    const result = materialText(html).trim();
    assert.match(result, /SQL & JOIN\nA < B ≤ C/);
    assert.match(result, /if \(x < y\) \{\n  return x;\n\}/);
    assert.ok(!result.includes('not lesson content'));
    assert.equal(materialText({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Khóa ' }, { type: 'text', text: 'chính' }, { type: 'hardBreak' }, { type: 'text', text: 'Ví dụ' },
    ] }] }), 'Khóa chính\nVí dụ');
    assert.equal(materialText({ ops: [{ insert: 'Dòng 1\n' }, { insert: 'Dòng 2\n' }] }), 'Dòng 1\nDòng 2\n');
    assert.match(materialText({ heading: 'JOIN', explanation: ['INNER', 'LEFT'], example: 'vector<int>' }), /vector<int>/);
});

test('unresolved or empty timetable scope never reads all joined courses', async () => {
    let calls = 0;
    const edux = fixture({ layHocPhan: async () => { calls++; return [subject]; } });
    const result = await collectCourseMaterials(cookie, { scope: { resolved: false }, edux });
    assert.equal(result.complete, false); assert.equal(calls, 0); assert.deepEqual(result.courses, []);
    const empty = await collectCourseMaterials('', { scope: { resolved: true, courses: [] }, edux });
    assert.equal(empty.complete, true); assert.equal(calls, 0);
    await assert.rejects(() => collectCourseMaterials('', { scope, edux }), { statusCode: 401 });
});

test('retrieves every current course/chapter/slide in source order with bounded parallelism', async () => {
    let active = 0, maximum = 0;
    const requested = [];
    const edux = fixture({
        layChuongTrinhHoc: async (id, options) => {
            assert.equal(id, 'edux-sql'); assert.equal(options.cookie, cookie); assert.equal(options.strict, true);
            return [{ id: 'ch1', title: 'SQL' }, { id: 'ch2', title: 'JOIN' }];
        },
        laySlide: async id => Array.from({ length: 7 }, (_, index) => ({ id: `${id}-${index}`, title: `Slide ${index}`, document_number: index })),
        layNoiDungSlide: async id => {
            requested.push(id); maximum = Math.max(maximum, ++active);
            await delay(id.endsWith('0') ? 20 : 1); active--;
            return `<p>Nội dung ${id}</p>`;
        },
    });
    const result = await collectCourseMaterials(cookie, { scope, edux, concurrency: 3, retryDelayMs: 0 });
    assert.equal(result.complete, true); assert.equal(result.courses.length, 1);
    assert.equal(result.courses[0].id, 'edux-sql'); assert.equal(maximum, 3); assert.equal(requested.length, 14);
    for (const chapter of result.courses[0].chapters) {
        assert.equal(chapter.complete, true);
        assert.deepEqual(chapter.documents.map(item => item.id), Array.from({ length: 7 }, (_, index) => `${chapter.id}-${index}`));
        assert.ok(chapter.documents.every(item => item.status === 'ready' && item.content.includes(item.id) && item.rawContent.includes('<p>')));
    }
    await assert.rejects(() => collectCourseMaterials(cookie, { scope, edux, subjectId: 'old-subject' }), { statusCode: 404 });
});

test('chapter and slide failures are explicit and cannot masquerade as an empty complete course', async () => {
    const attempts = new Map();
    const edux = fixture({
        layChuongTrinhHoc: async () => [{ id: 'list-failure', title: 'Missing chapter' }, { id: 'partial', title: 'Partial chapter' }],
        laySlide: async id => {
            if (id === 'list-failure') throw error(404);
            return [{ id: 'ready' }, { id: 'missing' }, { id: 'empty' }];
        },
        layNoiDungSlide: async id => {
            attempts.set(id, (attempts.get(id) || 0) + 1);
            if (id === 'missing') throw error(404);
            return id === 'empty' ? '   ' : 'Nội dung được đọc.';
        },
    });
    const result = await collectCourseMaterials(cookie, { scope, edux, retryDelayMs: 0 });
    assert.equal(result.complete, false); assert.equal(result.failures.length, 3);
    const course = result.courses[0]; assert.equal(course.complete, false);
    assert.equal(result.failures[0].stage, 'slides'); assert.equal(result.failures[0].chapter, 'Missing chapter');
    assert.equal(course.chapters[0].complete, false); assert.deepEqual(course.chapters[0].documents, []);
    assert.equal(course.chapters[1].complete, false);
    assert.deepEqual(course.chapters[1].documents.map(item => item.status), ['ready', 'error', 'error']);
    assert.equal(attempts.get('missing'), 1); assert.equal(attempts.get('empty'), 1);
    const missing = await collectCourseMaterials(cookie, { scope: { ...scope, courses: [...scope.courses,
        { subjectId: 8, subjectCode: 'NOT-ON-EDUX', subjectName: 'Môn chưa có tài liệu' }] }, edux: fixture() });
    assert.equal(missing.complete, false); assert.match(missing.failures[0].message, /chưa có học liệu/);
});

test('transient GET failures retry, while session expiry stops acquisition without retries', async () => {
    let calls = 0;
    const result = await collectCourseMaterials(cookie, { scope, retryDelayMs: 0, edux: fixture({
        layNoiDungSlide: async () => { if (++calls < 3) throw error(503); return 'Đã lấy đủ nội dung.'; },
    }) });
    assert.equal(calls, 3); assert.equal(result.complete, true);
    let authCalls = 0;
    await assert.rejects(() => collectCourseMaterials(cookie, { scope, retryDelayMs: 0, edux: fixture({
        laySlide: async () => { authCalls++; throw error(401); },
    }) }), { statusCode: 401, code: 'EDUX_SESSION_EXPIRED' });
    assert.equal(authCalls, 1);
});

test('real EDUX adapter reads presentation endpoint, nested documents and auth/timeout errors without write requests', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-edux-images-'));
    t.after(() => {
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';
    const requests = [];
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;
        requests.push({ pathname, query: url.search, method: req.method, cookie: req.headers.cookie });
        const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
        if (pathname === '/api/subjects/joined') return reply(200, { data: { subjects: [subject] } });
        if (pathname === '/api/subjects/edux-sql/models') return reply(200, { data: { models: [{ id: 'chapter-1', title: 'SQL' }] } });
        if (pathname === '/api/api/v1/presentation/document-summary') {
            const model = url.searchParams.get('model_id');
            assert.equal(url.searchParams.get('edit'), 'false');
            if (model === 'chapter-1') return reply(200, { code: '200', data: { total_items: 2, total_slides: 2, documents: [
                { id: 'slide-1', title: 'Slide 1', document_number: 1 }, { id: 'slide-2', title: 'Slide 2', document_number: 2 },
            ] } });
            if (model === 'expired') return reply(401, { message: 'Expired' });
            if (model === 'malformed') return reply(200, {});
        }
        if (pathname === '/api/api/v1/presentation/document/slide-1') return reply(200, { data: { content: '<p>Khóa ngoại.</p>', image_base64: image } });
        if (pathname === '/api/api/v1/presentation/document/slide-2') return reply(404, {});
        if (pathname === '/api/presentation/document/slide-2') return reply(200, { content: { title: 'Khóa chính', definition: 'Duy nhất.' } });
        if (pathname === '/api/subjects/models/expired/slides') { res.writeHead(401); res.end('<html>Login</html>'); return; }
        if (pathname === '/api/subjects/models/malformed/slides') return reply(200, {});
        if (pathname === '/api/api/v1/presentation/document/slow') { setTimeout(() => reply(200, { content: 'late' }), 100); return; }
        return reply(404, {});
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const previous = { origin: process.env.EDUX_ORIGIN, base: process.env.EDUX_API_BASE };
    process.env.EDUX_ORIGIN = `http://127.0.0.1:${server.address().port}`;
    process.env.EDUX_API_BASE = `${process.env.EDUX_ORIGIN}/api`;
    t.after(() => {
        for (const [key, value] of Object.entries({ EDUX_ORIGIN: previous.origin, EDUX_API_BASE: previous.base })) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    });
    const edux = require('../../CRWEB/modules/EDUX');
    const result = await collectCourseMaterials(cookie, { scope, edux, retryDelayMs: 0, imageCache: { directory } });
    assert.equal(result.complete, true); assert.equal(result.courses[0].chapters[0].documents.length, 2);
    assert.ok(requests.some(request => request.pathname.endsWith('/presentation/document-summary') && request.query.includes('model_id=chapter-1')));
    assert.ok(!requests.some(request => request.pathname.endsWith('/chapter-1/slides')));
    assert.equal(result.courses[0].chapters[0].documents[0].content, 'Khóa ngoại.');
    const slide = result.courses[0].chapters[0].documents[0];
    assert.match(slide.images[0], /^\/api\/v1\/learning\/images\/[a-f0-9]{64}\.png$/);
    assert.deepEqual(fs.readFileSync(path.join(directory, path.basename(slide.images[0]))), Buffer.from(image, 'base64'));
    assert.ok(!JSON.stringify(result).includes(image), 'course responses never embed the large base64 field');
    const { aggregateCourseText } = require('../../API/utils/course-material-text');
    assert.ok(!aggregateCourseText(result.courses[0]).includes(image), 'AI gets source text without binary data');
    assert.match(result.courses[0].chapters[0].documents[1].content, /Khóa chính/);
    await assert.rejects(() => edux.laySlide('expired', { cookie, strict: true }), { status: 401 });
    await assert.rejects(() => edux.laySlide('malformed', { cookie, strict: true }), { status: 502 });
    await assert.rejects(() => edux.layNoiDungSlide('slow', { cookie, timeoutMs: 10 }), error => error.name === 'TimeoutError');
    assert.ok(requests.every(request => request.method === 'GET' && request.cookie === cookie));
    assert.ok(!requests.some(request => /exam\/start|complete|finish/.test(request.pathname)));
});
