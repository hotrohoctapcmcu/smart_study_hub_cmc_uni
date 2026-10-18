require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});

const express = require('express');
const cors = require('cors');
const ketNoiDatabase = require('../database/index');
const { API_PREFIX, PORT, CORS_OPTIONS, JSON_LIMIT } = require('./config');
const { notFound, errorHandler } = require('./shared/errorHandler');
const { setDbForAll, registerModules } = require('./modules');

const app = express();

app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'online' });
});

app.get(['/', '/api', API_PREFIX], (req, res) => {
    res.json({
        success: true,
        status: 'online',
        endpoints: API_PREFIX
    });
});

async function start() {
    let db;

    try {
        db = await ketNoiDatabase();
        setDbForAll(db);
        console.log('[DB] Connected');
    } catch (err) {
        console.error('[DB]', err.message);
    }

    registerModules(app, API_PREFIX);

    app.get(`${API_PREFIX}/dashboard`, async (req, res, next) => {
        if (!db) {
            return res.status(503).json({
                success: false,
                message: 'Database unavailable'
            });
        }

        try {
            const userId = req.user?.id || 1;
            const today = new Date().toISOString().slice(0, 10);

            const [profile, schedules, deadlines, exams, reminders] =
                await Promise.all([
                    db.layHoSo(userId),
                    db.layThoiKhoaBieuTheoNgay(userId, today),
                    db.layDeadlineSapToi(userId, 3),
                    db.layLichThiSapToi(userId),
                    db.layDanhSachNhacNho(userId)
                ]);

            res.json({
                success: true,
                data: {
                    profile,
                    todaySchedules: schedules,
                    upcomingDeadlines: deadlines,
                    upcomingExams: exams,
                    unreadRemindersCount:
                        (reminders || []).filter(r => !r.is_sent).length
                }
            });
        } catch (err) {
            next(err);
        }
    });

    app.use(notFound);
    app.use(errorHandler);

    const server = app.listen(PORT, () => {
        console.log(`[API] http://localhost:${PORT}`);
    });

    async function shutdown() {
        server.close(async () => {
            try {
                if (db?.closePool) await db.closePool();
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
// Export start để index.js gốc gọi tường minh khi require (lúc đó
// require.main không phải file này nên khối auto-start bên trên không chạy).
module.exports.start = start;