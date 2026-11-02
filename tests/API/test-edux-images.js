'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { cacheSlideImages, rasterImage } = require('../../API/utils/edux-slide-images');
const { collectCourseMaterials } = require('../../API/utils/edux-materials');
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';

test('nested base64 and data URIs share one cached raster file served byte-for-byte over the Learning API', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-edux-raster-'));
    const previous = process.env.EDUX_IMAGES_PATH;
    process.env.EDUX_IMAGES_PATH = directory;
    t.after(() => {
        if (previous === undefined) delete process.env.EDUX_IMAGES_PATH; else process.env.EDUX_IMAGES_PATH = previous;
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const cached = await cacheSlideImages({ content: `<p>Bài học</p><img src="data:image/png;base64,${image}">`,
        data: { image_base64: image }, editor: JSON.stringify({ imageBase64: `data:image/png;base64,${image}` }) });
    assert.equal(cached.images.length, 1); assert.equal(fs.readdirSync(directory).length, 1);
    assert.ok(cached.content.content.includes(cached.images[0]));
    assert.ok(!JSON.stringify(cached.content).includes(image));
    assert.equal(rasterImage('data:image/svg+xml;base64,PHN2Zz4='), null);
    const app = express();
    app.use('/api/v1/learning', require('../../API/routes/learning').createLearningRouter());
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(origin + cached.images[0]);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /image\/png/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(image, 'base64'));
    assert.equal((await fetch(origin + '/api/v1/learning/images/accounts.json')).status, 404);
});

test('image-only slides remain usable and do not produce invented lecture text', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-edux-only-image-'));
    t.after(() => {
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const result = await collectCourseMaterials('test-only', { scope: { resolved: true, courses: [{ subjectCode: 'SQL', subjectName: 'SQL' }] },
        imageCache: { directory }, edux: {
            layHocPhan: async () => [{ id: 'sql', subject_code: 'SQL', name: 'SQL' }],
            layChuongTrinhHoc: async () => [{ id: 'chapter' }], laySlide: async () => [{ id: 'slide' }],
            layNoiDungSlide: async () => ({ content: '', image_base64: image }),
        } });
    const slide = result.courses[0].chapters[0].documents[0];
    assert.equal(result.complete, true); assert.equal(slide.status, 'ready');
    assert.equal(slide.content, ''); assert.equal(slide.rawContent, ''); assert.equal(slide.images.length, 1);
});
