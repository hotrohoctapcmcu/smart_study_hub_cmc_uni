/**
 * API/shared/errorHandler.js
 * ===================================================================================
 * HÀM DÙNG CHUNG: XỬ LÝ LỖI TOÀN CỤC
 * ===================================================================================
 * Bắt tất cả lỗi throw từ route handlers và trả về response chuẩn.
 * Phải được đăng ký SAU TẤT CẢ các route trong API/index.js.
 * (Chuyển từ API/middleware/errorHandler.js → API/shared/errorHandler.js,
 * giữ nguyên logic.)
 * ===================================================================================
 */

/**
 * Middleware xử lý lỗi 404 — route không tồn tại
 */
function notFound(req, res, next) {
    const err = new Error(`Route không tìm thấy: ${req.method} ${req.originalUrl}`);
    err.statusCode = 404;
    next(err);
}

/**
 * Middleware xử lý lỗi toàn cục
 */
function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Lỗi máy chủ nội bộ.';

    // Log lỗi phía server (không gửi stack trace ra client ở production)
    if (process.env.NODE_ENV !== 'production') {
        console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${statusCode}: ${message}`);
        if (err.stack) console.error(err.stack);
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}

module.exports = { notFound, errorHandler };
