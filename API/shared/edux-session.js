/**
 * API/shared/edux-session.js
 * ===================================================================================
 * KHO PHIÊN EDUX SERVER-SIDE (IN-MEMORY)
 * ===================================================================================
 * Lưu cookie phiên EDUX sau khi người dùng đăng nhập bằng chính tài khoản EDUX
 * (email + mật khẩu). Mật khẩu KHÔNG được lưu ở đây — chỉ cookie và email
 * (để hiển thị lại trên giao diện).
 *
 * Cùng khuôn với iu-session.js: RAM-only (mất khi restart server), TTL mặc định
 * 24 giờ, có thể chỉnh bằng EDUX_SESSION_TTL_MS.
 *
 * Không trả cookie ra ngoài qua getStatus().
 * ===================================================================================
 */

const DEFAULT_TTL_MS = Number(process.env.EDUX_SESSION_TTL_MS) > 0
    ? Number(process.env.EDUX_SESSION_TTL_MS)
    : 24 * 60 * 60 * 1000; // 24 giờ

// userId -> { cookie, email, data, subjectIds, savedAt, expiresAt, ttlMs }
const store = new Map();

function now() {
    return Date.now();
}

function isExpired(entry) {
    return !entry || entry.expiresAt <= now();
}

/**
 * Lưu phiên EDUX của một user.
 * @param {number|string} userId
 * @param {Object} opts - { cookie, email?, data?, subjectIds?, ttlMs? }
 */
function saveSession(userId, { cookie, email = null, data = null, subjectIds = null, ttlMs = DEFAULT_TTL_MS } = {}) {
    if (!userId) throw Object.assign(new Error('userId là bắt buộc.'), { statusCode: 400 });
    if (!cookie) throw Object.assign(new Error('cookie là bắt buộc.'), { statusCode: 400 });
    const savedAt = now();
    const lifetimeMs = Number(ttlMs) > 0 ? Number(ttlMs) : DEFAULT_TTL_MS;
    store.set(String(userId), {
        cookie,
        email,
        data,
        subjectIds,
        savedAt,
        ttlMs: lifetimeMs,
        expiresAt: savedAt + lifetimeMs
    });
    return getStatus(userId);
}

/**
 * Lấy phiên còn hạn của user (null nếu chưa có / hết hạn).
 * Tự gia hạn khi phiên vẫn đang được dùng.
 */
function getSession(userId) {
    const entry = store.get(String(userId));
    if (!entry) return null;
    if (isExpired(entry)) {
        store.delete(String(userId));
        return null;
    }
    entry.expiresAt = now() + entry.ttlMs;
    return entry;
}

/**
 * Trạng thái phiên (để FE hiển thị, không lộ cookie).
 */
function getStatus(userId) {
    const entry = getSession(userId);
    if (!entry) {
        return {
            connected: false,
            userId: Number(userId) || userId,
            email: null
        };
    }
    return {
        connected: true,
        userId: Number(userId) || userId,
        email: entry.email,
        savedAt: new Date(entry.savedAt).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
        hasData: !!entry.data
    };
}

/**
 * Xoá phiên (logout / cookie hết hạn / thông tin đăng nhập không hợp lệ).
 */
function clearSession(userId) {
    return store.delete(String(userId));
}

module.exports = { saveSession, getSession, getStatus, clearSession, DEFAULT_TTL_MS };
