const http = require('http');
const fs = require('fs');
const path = require('path');

const apiModule = require('./API/index');
const FE_DIR = path.resolve(__dirname, 'Frontend/unistudy-fe');
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
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
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
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404 Not Found');
        }

        res.writeHead(200, {
            'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
        });

        fs.createReadStream(filePath).pipe(res);
    });
});

feServer.listen(FE_PORT, () => {
    console.log(`[FE] http://localhost:${FE_PORT}`);
});

function shutdown() {
    if (apiServer) apiServer.close();
    feServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);