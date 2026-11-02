const service = require('../services/dashboard.service');

async function getDashboard(req, res, next) {
    if (!service.isAvailable()) {
        return res.status(503).json({ success: false, message: 'Database unavailable' });
    }
    try {
        res.json({ success: true, data: await service.getDashboard() });
    } catch (error) {
        next(error);
    }
}

module.exports = { getDashboard };
