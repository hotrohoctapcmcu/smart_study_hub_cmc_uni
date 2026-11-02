'use strict';

function errorHandler(error, req, res, next) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Không thể xử lý yêu cầu AI." : error.message;
    res.status(status).json({ success: false, data: null, message, error: { code: error.code || "AI_ERROR", message } });
}

module.exports = { errorHandler };
