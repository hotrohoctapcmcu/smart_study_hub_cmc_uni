require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});

const express = require('express');
const cors = require('cors');
const ketNoiDatabase = require('../database');
const { API_PREFIX, PORT, CORS_OPTIONS, JSON_LIMIT } = require('./config');
const { notFound, errorHandler } = require('./middlewares/error');
const { setDbForAll, registerModules } = require('./routes');
const dashboard = require('./routes/dashboard');

const app = express();

app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true }));

app.use(require('./routes/status'));

let initialization;

function initialize() {
    if (!initialization) initialization = initializeBackend();
    return initialization;
}

async function initializeBackend() {
    let db;

    try {
        db = await ketNoiDatabase();
        setDbForAll(db);
        console.log('[DB] Connected');
    } catch (err) {
        console.error('[DB]', err.message);
    }

    registerModules(app, API_PREFIX);

    dashboard.setDb(db);
    app.use(`${API_PREFIX}/dashboard`, dashboard);

    app.use(notFound);
    app.use(errorHandler);

    // Desktop uses these same handlers in memory, without app.listen().
    void require('./utils/edux-account').restore(require('./utils/nguoiDung').NGUOI_DUNG_ID);
    return { app, close: () => db?.closePool?.() };
}

async function start() {
    const backend = await initialize();
    const server = await new Promise((resolve, reject) => {
        const listener = app.listen({ port: Number(PORT), ...(process.env.API_HOST ? { host: process.env.API_HOST } : {}) }, () => {
            console.log(`[API] http://localhost:${PORT}`);
            resolve(listener);
        });
        listener.once('error', reject);
    });
    async function shutdown() {
        server.close(async () => {
            try {
                await backend.close();
                process.exit(0);
            } catch (err) {
                console.error('[Shutdown]', err.message);
                process.exit(1);
            }
        });
    }

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    // Trả server để tiến trình cha (index.js) quản lý vòng đời khi require.
    return server;
}

if (require.main === module) {
    start().catch(err => {
        console.error('[FATAL]', err);
        process.exit(1);
    });
}

module.exports = app;
module.exports.initialize = initialize;
module.exports.start = start;
