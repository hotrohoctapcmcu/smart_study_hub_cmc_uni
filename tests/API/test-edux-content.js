'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { withoutEduxImages } = require('../../database/shared/eduxContent');
const { collectCourseMaterials, materialText } = require('../../API/utils/edux-materials');
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';

test('image fields, HTML, Markdown and editor embeds are discarded without losing lesson text', () => {
    const original = {
        content: `<p>Khóa ngoại</p><img src="data:image/png;base64,${image}">`,
        data: { image_base64: image, imageUrl: 'https://edux.example/slide.png', definition: 'Tham chiếu khóa chính.' },
        editor: JSON.stringify({ type: 'doc', content: [{ type: 'image', attrs: { src: image } }, { type: 'text', text: 'JOIN' }] }),
        markdown: 'Kiến thức ![slide](https://edux.example/slide.png) còn lại.',
        ops: [{ insert: { image: `data:image/png;base64,${image}` } }, { insert: 'SELECT' }],
        images: ['/old-cache.png'], rawImage: image,
    };
    const cleaned = withoutEduxImages(original);
    assert.equal(cleaned.content, '<p>Khóa ngoại</p>');
    assert.deepEqual(cleaned.data, { definition: 'Tham chiếu khóa chính.' });
    assert.deepEqual(JSON.parse(cleaned.editor).content, [{ type: 'text', text: 'JOIN' }]);
    assert.equal(cleaned.markdown, 'Kiến thức  còn lại.');
    assert.ok(!JSON.stringify(cleaned).includes(image));
    assert.ok(!JSON.stringify(cleaned).includes('edux.example'));
    assert.match(materialText(original.content), /Khóa ngoại/);
    assert.ok(!materialText(original).includes(image));
    assert.equal(original.data.image_base64, image, 'the original crawler response stays available to its caller');
});

test('material collection keeps text only and never creates a local image cache', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-edux-text-'));
    const previous = process.env.DB_PATH;
    process.env.DB_PATH = path.join(directory, 'test.db');
    t.after(() => {
        if (previous === undefined) delete process.env.DB_PATH; else process.env.DB_PATH = previous;
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const callbacks = [];
    const result = await collectCourseMaterials('test-only', {
        scope: { resolved: true, courses: [{ subjectCode: 'SQL', subjectName: 'SQL' }] },
        onCourse: course => callbacks.push(JSON.stringify(course)),
        edux: {
            layHocPhan: async () => [{ id: 'sql', subject_code: 'SQL', name: 'SQL' }],
            layChuongTrinhHoc: async () => [{ id: 'chapter' }],
            laySlide: async () => [{ id: 'text' }, { id: 'image-only' }],
            layNoiDungSlide: async (id, options) => {
                assert.ok(!options.includeImages, 'bulk sync does not request unused image fields');
                return { content: id === 'text' ? `<p>SELECT</p><img src="data:image/png;base64,${image}">` : '', image_base64: image };
            },
        },
    });
    const slides = result.courses[0].chapters[0].documents;
    assert.equal(slides[0].content, 'SELECT');
    assert.equal(slides[0].rawContent, '<p>SELECT</p>');
    assert.equal(slides[0].status, 'ready');
    assert.equal(slides[1].content, '');
    assert.equal(slides[1].status, 'error');
    assert.equal(result.complete, false);
    assert.equal(result.failures[0].code, 'EMPTY_MATERIAL');
    assert.ok(!JSON.stringify(result).includes(image));
    assert.ok(callbacks.every(value => !value.includes(image)));
    assert.deepEqual(fs.readdirSync(directory), []);
});

test('migration removes legacy EDUX images durably, preserves text and user uploads, and is idempotent', async () => {
    const SQL = await require('sql.js')();
    const { migrateLearning } = require('../../database/migrations/learningMigration');
    const { sourceHash } = require('../../API/services/learning.catalog.service');
    let db = new SQL.Database();
    try {
        migrateLearning(db);
        const chapters = [{ id: 'chapter', title: 'SQL', complete: true, documents: [
            { id: 'text', title: 'SELECT', content: 'SELECT', rawContent: `<p>SELECT</p><img src="data:image/png;base64,${image}">`, images: ['/old.png'], status: 'ready' },
            { id: 'image-only', content: '', rawContent: '', imageBase64: image, images: ['/old.png'], status: 'ready' },
        ] }];
        db.run('INSERT INTO LearningCourses(user_id,course_id,subject_name,chapters_json,source_hash,complete,updated_at) VALUES(1,?,?,?,?,1,?)',
            ['sql', 'SQL', JSON.stringify(chapters), 'old-hash', '2026-11-04']);
        db.run('CREATE TABLE UserUploads(content TEXT)');
        db.run('INSERT INTO UserUploads(content) VALUES(?)', [image]);
        migrateLearning(db);
        const stored = db.exec('SELECT chapters_json,source_hash,complete FROM LearningCourses')[0].values[0];
        const cleaned = JSON.parse(stored[0]);
        assert.ok(!stored[0].includes(image));
        assert.ok(!stored[0].includes('/old.png'));
        assert.equal(cleaned[0].documents[0].rawContent, '<p>SELECT</p>');
        assert.equal(cleaned[0].documents[1].status, 'error');
        assert.equal(stored[1], sourceHash(cleaned));
        assert.equal(stored[2], 0);
        assert.equal(db.exec('SELECT content FROM UserUploads')[0].values[0][0], image);
        const snapshot = db.export();
        db.close();
        db = new SQL.Database(snapshot);
        migrateLearning(db);
        assert.deepEqual(db.exec('SELECT chapters_json,source_hash,complete FROM LearningCourses')[0].values[0], stored);
    } finally { db.close(); }
});
