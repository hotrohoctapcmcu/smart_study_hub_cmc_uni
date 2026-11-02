'use strict';

const SOURCES = ['iu', 'edux', 'outlook'];
const timeoutBudget = (value, fallback, maximum) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};
const OUTLOOK_FAILURES = Object.freeze({
    OUTLOOK_LOGIN_REQUIRED: {
        statusCode: 401, requiresLogin: true,
        message: 'Phiên Outlook chưa sẵn sàng hoặc đã hết hạn. Hãy đăng nhập tài khoản trường trong cửa sổ Outlook.'
    },
    OUTLOOK_ACCESS_DENIED: {
        statusCode: 403, requiresLogin: true,
        message: 'Tài khoản chưa có quyền đọc email Outlook. Hãy kết nối lại bằng tài khoản trường và kiểm tra quyền Mail.Read.'
    },
    OUTLOOK_LOGIN_CANCELLED: {
        statusCode: 409,
        message: 'Đã đóng hoặc hủy cửa sổ Outlook trước khi kết nối xong. Bấm đồng bộ lại và hoàn tất đăng nhập Microsoft.'
    },
    OUTLOOK_LOGIN_TIMEOUT: {
        statusCode: 504,
        message: 'Outlook chưa trả dữ liệu trong thời gian chờ. Hãy hoàn tất đăng nhập Microsoft và kiểm tra kết nối mạng rồi thử lại.'
    },
    OUTLOOK_NETWORK_ERROR: {
        statusCode: 502,
        message: 'Không tải được Outlook. Kiểm tra kết nối mạng tới outlook.office.com và thử lại.'
    },
    OUTLOOK_CAPTURE_UNAVAILABLE: {
        statusCode: 503,
        message: 'Không khởi tạo được phiên đọc Outlook. Đóng cửa sổ Outlook của ứng dụng rồi kết nối lại.'
    },
    OUTLOOK_ELECTRON_REQUIRED: {
        statusCode: 409,
        message: 'Đăng nhập Outlook cần ứng dụng máy tính. Hãy mở UniStudy CMC và kết nối lại Outlook.'
    },
    OUTLOOK_INVALID_RESPONSE: {
        statusCode: 502,
        message: 'Outlook trả dữ liệu email chưa đọc được. Mở hộp thư Outlook, chờ tải xong rồi thử đồng bộ lại.'
    }
});

// Provider credentials and raw responses stay inside the adapters.
function createPortalWorkflow(adapters) {
    let connecting = null;
    let syncing = null;
    const listeners = new Set();
    let connectionSnapshot = null;
    const failure = (source, error) => ({
        status: 'FAILED', ok: false, connected: false,
        message: error?.code === 'credentials_required'
            ? 'Cần nhập email và mật khẩu EDUX.'
            : error?.code === 'connection_timeout'
                ? `Kết nối ${source.toUpperCase()} quá thời gian chờ. Hãy kiểm tra cửa sổ đăng nhập và thử lại.`
                : `Không thể kết nối ${source.toUpperCase()}. Vui lòng thử lại hoặc kiểm tra đăng nhập.`,
        ...(['credentials_required', 'connection_timeout'].includes(error?.code) ? { code: error.code } : {}),
        // Only expose allowlisted diagnoses; portal exceptions can contain
        // cookies, bearer tokens or whole HTTP responses in their messages.
        ...(source === 'outlook' && Object.hasOwn(OUTLOOK_FAILURES, error?.code)
            ? { ...OUTLOOK_FAILURES[error.code], code: error.code } : {})
    });
    function emit() {
        const snapshot = { status: 'CONNECTING', results: Object.fromEntries(
            Object.entries(connectionSnapshot).map(([source, result]) => [source, { ...result }])) };
        for (const listener of listeners) { try { listener(snapshot); } catch { /* observers cannot interrupt authentication */ } }
    }
    function bounded(run, timeoutMs) {
        const controller = new AbortController();
        let timer;
        return Promise.race([
            Promise.resolve().then(() => run(controller.signal)),
            new Promise((_, reject) => { timer = setTimeout(() => {
                const error = Object.assign(new Error('Connection timed out'), { code: 'connection_timeout' });
                reject(error);
                controller.abort(error);
            }, timeoutMs); })
        ]).finally(() => clearTimeout(timer));
    }
    function connectAll(options = {}) {
        const listener = typeof options.onProgress === 'function' ? options.onProgress : null;
        if (listener) listeners.add(listener);
        if (connecting) { if (listener && connectionSnapshot) emit(); return connecting; }
        connectionSnapshot = Object.fromEntries(SOURCES.map(source => [source, {
            status: 'CHECKING', message: `Đang kiểm tra phiên ${source.toUpperCase()}.`
        }]));
        connecting = (async () => {
            emit();
            await Promise.all(SOURCES.map(async source => {
                const adapter = adapters[source];
                const sourceOptions = options[source] || {};
                const maximum = source === 'edux' ? 45000 : 180000;
                const timeoutMs = timeoutBudget(sourceOptions.timeoutMs, maximum, maximum);
                try {
                    const status = adapter.status ? await bounded(signal => adapter.status({ signal }),
                        timeoutBudget(options.statusTimeoutMs, 8000, 8000)) : null;
                    if (!status?.connected) {
                        connectionSnapshot[source] = { status: 'CONNECTING', message: source === 'edux'
                            ? 'Đang đăng nhập EDUX.' : `Đang đăng nhập ${source.toUpperCase()}. Hoàn tất đăng nhập trong cửa sổ Microsoft nếu được yêu cầu.` };
                        emit();
                        const response = await bounded(signal => adapter.connect({ ...sourceOptions, timeoutMs, signal }), timeoutMs);
                        if (response?.ok === false || response?.connected === false) throw new Error('Connection canceled');
                    }
                    connectionSnapshot[source] = { status: 'CONNECTED', ok: true, connected: true, message: `Đã kết nối ${source.toUpperCase()}.` };
                } catch (error) { connectionSnapshot[source] = failure(source, error); }
                emit();
            }));
            // Stable source ordering regardless of which portal finishes first.
            const results = Object.fromEntries(SOURCES.map(source => [source, connectionSnapshot[source]]));
            return { ok: SOURCES.every(source => results[source].ok), results };
        })().finally(() => { connecting = null; listeners.clear(); connectionSnapshot = null; });
        return connecting;
    }
    function syncAll(options = {}) {
        if (syncing) return syncing;
        syncing = (async () => {
            const selected = Array.isArray(options.sources)
                ? SOURCES.filter(source => options.sources.some(value => String(value).toLowerCase() === source)) : SOURCES;
            const results = {};
            async function sync(source) {
                try {
                    if (!adapters[source]?.sync) throw new Error('Sync adapter unavailable');
                    const response = await adapters[source].sync(options[source] || {});
                    if (response?.ok === false) throw new Error('Sync failed');
                    if (Array.isArray(response?.thatBai) && response.thatBai.length) {
                        const warningCount = response.thatBai.length;
                        results[source] = { ok: false, synced: true, partial: true, warningCount,
                            message: `Đã đồng bộ một phần ${source.toUpperCase()}; ${warningCount} nhóm dữ liệu chưa lấy được.` };
                        return;
                    }
                    results[source] = { ok: true, synced: true, message: `Đã đồng bộ ${source.toUpperCase()}.` };
                } catch (error) {
                    results[source] = { ok: false, synced: false, message: `Không thể đồng bộ ${source.toUpperCase()}.`,
                        statusCode: Number(error?.statusCode) || 500 };
                }
            }
            // These adapters can share one SQLite connection: keep writes ordered.
            for (const source of selected) await sync(source);
            return { ok: selected.every(source => results[source].ok), results };
        })().finally(() => { syncing = null; });
        return syncing;
    }
    return { connectAll, loginAll: connectAll, syncAll };
}

let defaultWorkflow;
function loginAll(options) {
    if (!defaultWorkflow) defaultWorkflow = createPortalWorkflow({
        iu: { connect: async opts => {
            const result = await require('../modules/IU').loginIU(opts);
            if (!result?.count) throw new Error('IU session unavailable');
            return { connected: true };
        } },
        edux: { connect: opts => require('../modules/EDUX/login').loginEdux({ ...opts, luu: false }) },
        outlook: { status: () => require('../modules/OUTLOOK').status(), connect: opts => require('../modules/OUTLOOK').connect(opts) }
    });
    return defaultWorkflow.connectAll(options);
}

module.exports = { createPortalWorkflow, loginAll };
