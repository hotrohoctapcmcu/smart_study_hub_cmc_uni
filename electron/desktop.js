'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { APP_ORIGIN, isAppUrl } = require('./app-origin');
const { createLocalTransport } = require('./local-transport');
const { storageMigrationScript } = require('./storage-migration');
const { resetStorageScript } = require('./data-management');

async function createDesktopRuntime({ frontend = path.resolve(__dirname, '../Frontend/dist'), legacyStorage = null, pendingReset = null } = {}) {
    if (!fs.existsSync(path.join(frontend, 'index.html'))) {
        throw new Error('Frontend build unavailable. Run npm --prefix Frontend run build first.');
    }
    const backend = await require('../API').initialize();
    const app = express();
    app.use((req, res, next) => {
        if (req.path === '/health' || req.path === '/api' || req.path.startsWith('/api/')) {
            return backend.app(req, res, next);
        }
        next();
    });
    const sendIndex = (_req, res) => {
        if (!legacyStorage && !pendingReset) return res.sendFile(path.join(frontend, 'index.html'));
        const html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8');
        const script = (legacyStorage ? storageMigrationScript(legacyStorage) : '') + (pendingReset ? resetStorageScript(pendingReset) : '');
        res.type('html').send(html.replace('<head>', `<head><script>${script}</script>`));
    };
    app.get(['/', '/index.html'], sendIndex);
    app.use(express.static(frontend));
    app.get('*', (req, res, next) => {
        // React routes use the compiled index; missing assets stay 404.
        if (path.extname(req.path) || req.path.startsWith('/assets/')) return next();
        sendIndex(req, res);
    });
    app.use((_req, res) => res.status(404).type('text').send('Not Found'));
    const transport = createLocalTransport(app);

    return {
        fetch: transport.fetch,
        handle(request) {
            if (!isAppUrl(request.url)) return new Response('Not Found', { status: 404 });
            if (request.initiatorOrigin !== undefined && request.initiatorOrigin !== APP_ORIGIN) {
                return new Response('Forbidden', { status: 403 });
            }
            return transport.fetch(request);
        },
        close() {
            transport.close();
            return backend.close();
        }
    };
}

module.exports = { createDesktopRuntime };
