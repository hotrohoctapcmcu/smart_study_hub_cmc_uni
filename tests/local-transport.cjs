'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const express = require('express');
const { createLocalTransport } = require('../electron/local-transport');

test('in-memory transport preserves requests, streaming, errors and cancellation without networking', async t => {
    const app = express();
    app.use(express.json());
    app.post('/json', (req, res) => res.status(201).json({ body: req.body, query: req.query }));
    app.post('/bytes', express.raw({ type: 'application/octet-stream' }), (req, res) => res.type('application/octet-stream').send(req.body));
    app.get('/stream', (_req, res) => { res.write('first'); setImmediate(() => res.end('second')); });
    app.get('/empty', (_req, res) => res.status(204).end());
    app.get('/redirect', (_req, res) => res.redirect('/stream'));
    let cancelled;
    const aborted = new Promise(resolve => { cancelled = resolve; });
    app.get('/slow', (req, res) => { res.write('started'); req.on('close', cancelled); });
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.type }));

    // Any attempt to listen or connect, even on another port, fails this test.
    t.mock.method(net.Server.prototype, 'listen', () => assert.fail('Must not listen on a port'));
    t.mock.method(net.Socket.prototype, 'connect', () => assert.fail('Must not open a TCP connection'));
    const transport = createLocalTransport(app);
    t.after(() => transport.close());
    const fetch = (route, options) => transport.fetch('studyhub://app' + route, options);

    const json = await fetch('/json?name=Ti%E1%BA%BFng+Vi%E1%BB%87t', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Ghi chú' })
    });
    assert.equal(json.status, 201);
    assert.deepEqual(await json.json(), { body: { title: 'Ghi chú' }, query: { name: 'Tiếng Việt' } });
    const bytes = Buffer.from([0, 1, 127, 128, 255]);
    assert.deepEqual(Buffer.from(await (await fetch('/bytes', {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes
    })).arrayBuffer()), bytes);
    assert.equal(await (await fetch('/stream')).text(), 'firstsecond');
    assert.equal((await fetch('/empty')).body, null);
    assert.equal((await fetch('/stream', { method: 'HEAD' })).body, null);
    const redirect = await fetch('/redirect');
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/stream');
    await redirect.text();
    const missing = await fetch('/missing');
    assert.equal(missing.status, 404);
    await missing.text();
    const invalid = await fetch('/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalid.status, 400);
    await invalid.text();
    const controller = new AbortController();
    const slow = await fetch('/slow', { signal: controller.signal });
    const reading = slow.text();
    controller.abort();
    await assert.rejects(reading);
    await aborted;
    await assert.rejects(fetch('/json', { signal: controller.signal }), { name: 'AbortError' });
    await assert.rejects(transport.fetch('https://example.invalid/'), /Invalid desktop address/);
    transport.close();
    await assert.rejects(fetch('/stream'), /closed/);
});
