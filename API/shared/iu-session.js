/**
 * API/shared/iu-session.js
 * ===================================================================================
 * KHO PHIÊN IU SERVER-SIDE (IN-MEMORY)
 * ===================================================================================
 * Lưu cookie + session + data IU sau khi client/Electron đăng nhập xong và đã
 * TẮT trình duyệt. Các endpoint khác tái dùng cookie này để gọi portal IU mà
 * không cần mở lại cửa sổ đăng nhập.
 *
 * Lưu ý: RAM-only (mất khi restart server), cookie có TTL mặc định 6 giờ.
 * EduX chưa update — kho này chỉ phục vụ nhánh IU.
 * ===================================================================================
 */

const DEFAULT_TTL_MS = Number(process.env.IU_SESSION_TTL_MS) > 0
    ? Number(process.env.IU_SESSION_TTL_MS)
    : 24 * 60 * 60 * 1000; // 24 giờ

// userId -> { cookie, session, data, savedAt, expiresAt }
const store = new Map();

function now() {
    return Date.now();
}

function isExpired(entry) {
    return !entry || entry.expiresAt <= now();
}

/**
 * Lưu phiên IU của một user.
 * @param {number|string} userId
 * @param {Object} opts - { cookie, session?, data?, ttlMs? }
 */
function saveSession(userId, { cookie, session = null, data = null, ttlMs = DEFAULT_TTL_MS } = {}) {
    if (!userId) throw Object.assign(new Error('userId là bắt buộc.'), { statusCode: 400 });
    if (!cookie) throw Object.assign(new Error('cookie là bắt buộc.'), { statusCode: 400 });
    const savedAt = now();
    const lifetimeMs = Number(ttlMs) > 0 ? Number(ttlMs) : DEFAULT_TTL_MS;
    store.set(String(userId), {
        cookie,
        session,
        data,
        savedAt,
        ttlMs: lifetimeMs,
        expiresAt: savedAt + lifetimeMs
    });
    return getStatus(userId);
}

/**
 * Lấy phiên còn hạn của user (null nếu chưa có / hết hạn).
 */
function getSession(userId) {
    const entry = store.get(String(userId));
    if (!entry) return null;
    if (isExpired(entry)) {
        store.delete(String(userId));
        return null;
    }
    // Gia hạn phiên còn hoạt động; tránh ngắt kết nối khi người dùng vẫn đang dùng app.
    entry.expiresAt = now() + entry.ttlMs;
    return entry;
}

/**
 * Trạng thái phiên (để FE hiển thị, không lộ cookie).
 */
function getStatus(userId) {
    const entry = getSession(userId);
    if (!entry) return { connected: false, userId: Number(userId) || userId };
    return {
        connected: true,
        userId: Number(userId) || userId,
        savedAt: new Date(entry.savedAt).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
        hasSession: !!entry.session,
        hasData: !!entry.data
    };
}

/**
 * Xoá phiên (logout / cookie hỏng).
 */
function clearSession(userId) {
    return store.delete(String(userId));
}

module.exports = { saveSession, getSession, getStatus, clearSession, DEFAULT_TTL_MS };
