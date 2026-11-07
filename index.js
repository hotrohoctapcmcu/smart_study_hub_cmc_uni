const http = require('http');
const fs = require('fs');
const path = require('path');

const apiModule = require('./API/index');
const FE_DIR = path.resolve(__dirname, 'Frontend', 'dist');
const FE_PORT = Number(process.env.FE_PORT ?? 8080);
const packaged = process.env.SMART_STUDY_PACKAGED === '1';

let apiServer = null;
let apiUrl;

const apiReady = apiModule.start().then(server => {
    apiServer = server;
    apiUrl = `http://${packaged ? '127.0.0.1' : 'localhost'}:${server.address().port}`;
    return server;
});

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf',
    '.map': 'application/json; charset=utf-8'
};

const feServer = http.createServer((req, res) => {
    let reqPath;

    try {
        reqPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
        res.writeHead(400);
        return res.end('400 Bad Request');
    }

    if (reqPath === '/') reqPath = '/index.html';

    const filePath = path.resolve(FE_DIR, `.${reqPath}`);

    if (filePath !== FE_DIR && !filePath.startsWith(FE_DIR + path.sep)) {
        res.writeHead(403);
        return res.end('403 Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // React routes have no file extension; assets must still return 404.
            if (reqPath === '/index.html' || (!path.extname(reqPath) && !reqPath.startsWith('/assets/'))) {
                return sendFile(path.join(FE_DIR, 'index.html'), res);
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404 Not Found');
        }
        sendFile(filePath, res);
    });
});

function sendFile(filePath, res) {
    if (packaged && path.basename(filePath) === 'index.html') {
        const runtime = JSON.stringify({ apiBaseUrl: apiUrl + '/api/v1' }).replace(/</g, '\\u003c');
        const html = fs.readFileSync(filePath, 'utf8').replace('<head>', `<head><script>globalThis.__SSH_RUNTIME__=${runtime};</script>`);
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
        return res.end(html);
    }
    const stream = fs.createReadStream(filePath);
    stream.once('open', () => {
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
        });
        stream.pipe(res);
    });
    stream.once('error', () => {
        if (res.headersSent) return res.destroy();
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Frontend build unavailable. Run npm --prefix Frontend run build, then restart the application.');
    });
}

if (!fs.existsSync(path.join(FE_DIR, 'index.html'))) {
    console.error('[FE] Frontend build unavailable. Run npm --prefix Frontend run build before starting.');
}

const frontendReady = new Promise((resolve, reject) => {
    feServer.once('error', reject);
    feServer.listen({ port: FE_PORT, ...(process.env.FE_HOST ? { host: process.env.FE_HOST } : {}) }, () => {
        console.log(`[FE] http://localhost:${FE_PORT}`);
        resolve(feServer);
    });
});

const ready = Promise.all([apiReady, frontendReady]).then(() => ({
    apiUrl, frontendUrl: `http://${packaged ? '127.0.0.1' : 'localhost'}:${feServer.address().port}`
}));
ready.catch(error => console.error('[Startup]', error.message));
function close() { apiServer?.close(); feServer.close(); }
module.exports = { ready, close };

function shutdown() {
    if (apiServer) apiServer.close();
    feServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
