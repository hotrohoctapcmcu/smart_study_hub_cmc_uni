const http = require('http');
const fs = require('fs');
const path = require('path');

const apiModule = require('./API/index');
const FE_DIR = path.resolve(__dirname, 'Frontend', 'dist');
const FE_PORT = 8080;

let apiServer = null;

if (typeof apiModule?.start === 'function') {
    apiModule.start()
        .then(server => { apiServer = server; })
        .catch(err => console.error('[API]', err.message));
}

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

feServer.listen(FE_PORT, () => {
    console.log(`[FE] http://localhost:${FE_PORT}`);
});

function shutdown() {
    if (apiServer) apiServer.close();
    feServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
