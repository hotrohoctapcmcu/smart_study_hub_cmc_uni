'use strict';

// Adapted to this project's main-process/API boundary from the Outlook Web +
// Graph approach in https://github.com/vtishan/thoiGianBieu (a786189).
// Credentials remain in the Electron partition or main-process memory.
const { normalizeMessage, findMessages, hasEmptyMailbox } = require('./parser');
const GRAPH = 'https://graph.microsoft.com/v1.0';
const INBOX = 'https://outlook.office.com/mail/inbox';
const PARTITION = 'persist:cmc-outlook';
const OUTLOOK_HOSTS = new Set(['graph.microsoft.com', 'outlook.office.com', 'outlook.office365.com', 'outlook.cloud.microsoft', 'outlook.live.com']);
const error = (message, statusCode = 401, code = 'OUTLOOK_LOGIN_REQUIRED') => Object.assign(new Error(message), { statusCode, code });
const cancelled = () => error('Đã hủy kết nối Outlook.', 409, 'OUTLOOK_LOGIN_CANCELLED');
const navigationAborted = failure => failure?.code === 'ERR_ABORTED' || failure?.errno === -3 || /\bERR_ABORTED\b/.test(failure?.message || '');

function createOutlookClient({ fetchImpl = globalThis.fetch, tokenProvider = () => process.env.OUTLOOK_ACCESS_TOKEN || '', electronProvider = () => { try { return require('electron'); } catch { return null; } } } = {}) {
    let bearer = '', expires = 0, account = '', pending = null, cached = [], capturedAt = 0, disconnected = false, needsLogin = false, cancelCapture, captureState;
    function token() { return disconnected ? '' : tokenProvider() || (expires > Date.now() + 60000 ? bearer : ''); }
    function expireSession() {
        bearer = ''; expires = 0; account = ''; cached = []; capturedAt = 0; needsLogin = true;
    }
    function remember(headers, url) {
        try { if (new URL(url || INBOX).hostname !== 'graph.microsoft.com') return; }
        catch { return; }
        const auth = headers.Authorization || headers.authorization || '';
        if (!/^Bearer /i.test(auth)) return;
        try {
            const value = auth.slice(7), claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
            if (!/\bMail\.(?:Read|ReadWrite)\b/.test(String(claims.scp))) return;
            bearer = value; expires = Number(claims.exp) * 1000;
            account = claims.preferred_username || claims.upn || claims.unique_name || '';
        } catch { /* Opaque or unrelated tokens are not retained. */ }
    }
    async function graph(resource, signal) {
        const auth = token();
        if (!auth) throw error('Phiên Outlook cần đăng nhập lại.');
        const url = new URL(resource.startsWith('https:') ? resource : GRAPH + resource);
        if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/')) throw error('Đường dẫn Graph không hợp lệ.', 400, 'OUTLOOK_INVALID_RESPONSE');
        let response;
        try {
            const deadline = AbortSignal.timeout(25000);
            response = await fetchImpl(url.href, { headers: { Authorization: `Bearer ${auth}`, Prefer: 'outlook.body-content-type="text"' }, signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
        } catch {
            if (signal?.aborted) throw cancelled();
            throw error('Không kết nối được dịch vụ thư Outlook.', 502, 'OUTLOOK_NETWORK_ERROR');
        }
        if (!response.ok) {
            if ([401, 403].includes(response.status)) expireSession();
            throw error(response.status === 403 ? 'Tài khoản chưa cấp quyền Mail.Read. Hãy kết nối lại Outlook.' : `Không đọc được Outlook (HTTP ${response.status}).`, response.status === 401 || response.status === 403 ? response.status : 502,
                response.status === 403 ? 'OUTLOOK_ACCESS_DENIED' : response.status === 401 ? 'OUTLOOK_LOGIN_REQUIRED' : 'OUTLOOK_NETWORK_ERROR');
        }
        try { return await response.json(); }
        catch {
            if (signal?.aborted) throw cancelled();
            throw error('Outlook trả dữ liệu thư không hợp lệ.', 502, 'OUTLOOK_INVALID_RESPONSE');
        }
    }
    function capture({ interactive = false, messageId, timeoutMs, signal } = {}) {
        if (signal?.aborted) return Promise.reject(cancelled());
        if (pending) {
            const state = captureState;
            if (interactive) {
                state.interactive = true;
                state.promote?.(timeoutMs);
            }
            if (!signal) return pending;
            const onAbort = () => {
                state.cancelled = cancelled();
                cancelCapture?.(state.cancelled);
            };
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) onAbort();
            return pending.finally(() => signal.removeEventListener('abort', onAbort));
        }
        const electron = electronProvider();
        if (!electron?.BrowserWindow) return Promise.reject(error('Mở ứng dụng UniStudy CMC để kết nối Outlook.', 409, 'OUTLOOK_ELECTRON_REQUIRED'));
        const state = { interactive };
        captureState = state;
        cancelCapture = failure => { state.cancelled = failure; };
        // Reserve the operation before awaiting app readiness, so simultaneous
        // callers cannot open multiple windows for the same Outlook session.
        pending = Promise.resolve().then(async () => {
            await electron.app.whenReady();
            if (state.cancelled) throw state.cancelled;
            if (signal?.aborted) throw cancelled();
            return new Promise((resolve, reject) => {
                const win = new electron.BrowserWindow({ width: 1100, height: 820, show: state.interactive, title: 'Kết nối Outlook trường', autoHideMenuBar: true,
                    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
                const wc = win.webContents, requests = new Map(), messages = new Map();
                // Microsoft sign-in expects a supported browser UA. Keep Chromium's
                // actual version while removing this application's Electron tokens.
                try {
                    const ua = wc.getUserAgent?.();
                    if (ua) wc.setUserAgent(ua.replace(/\s(?:Electron|hotrohoctap)\/[^\s]+/gi, ''));
                } catch { /* Older test transports may not expose the UA APIs. */ }
                let done = false, quiet, loginTimer, timer;
                const onAbort = () => finish(cancelled());
                const finish = (failure) => {
                    if (done) return;
                    done = true; clearTimeout(timer); clearTimeout(quiet); clearTimeout(loginTimer);
                    cancelCapture = null;
                    signal?.removeEventListener('abort', onAbort);
                    try { wc.debugger.detach(); } catch { /* window already closed */ }
                    if (!win.isDestroyed()) win.destroy();
                    if (failure) {
                        if ([401, 403].includes(failure.statusCode)) expireSession();
                        reject(failure);
                    } else { cached = [...messages.values()]; capturedAt = Date.now(); needsLogin = false; resolve(cached); }
                };
                cancelCapture = finish;
                const setDeadline = value => {
                    clearTimeout(timer);
                    const requestedTimeout = Number(value);
                    const captureTimeout = Number.isFinite(requestedTimeout) && requestedTimeout > 0
                        ? Math.min(requestedTimeout, 180000) : state.interactive ? 180000 : 40000;
                    timer = setTimeout(() => finish(error('Outlook chưa trả dữ liệu. Kiểm tra đăng nhập và kết nối mạng.', 504, 'OUTLOOK_LOGIN_TIMEOUT')), captureTimeout);
                };
                state.promote = value => {
                    if (done || win.isDestroyed()) return;
                    clearTimeout(loginTimer);
                    win.show?.(); win.focus?.();
                    setDeadline(value);
                };
                setDeadline(timeoutMs);
                signal?.addEventListener('abort', onAbort, { once: true });
                const inspect = async (id, url) => {
                    let parsedUrl;
                    try { parsedUrl = new URL(url); } catch { return; }
                    if (parsedUrl.protocol !== 'https:' || !OUTLOOK_HOSTS.has(parsedUrl.hostname)) return;
                    if (!/messages|service\.svc|\$batch|startupdata\.ashx/i.test(parsedUrl.pathname)) return;
                    try {
                        const response = await wc.debugger.sendCommand('Network.getResponseBody', { requestId: id });
                        const body = JSON.parse(response.base64Encoded ? Buffer.from(response.body, 'base64').toString() : response.body);
                        for (const mail of findMessages(body)) {
                            const previous = messages.get(mail.id);
                            messages.set(mail.id, previous?.body && !mail.body ? previous : mail);
                        }
                        const empty = (Array.isArray(body.value) && body.value.length === 0 && /messages/i.test(url)) || hasEmptyMailbox(body);
                        if (messages.size || empty) { clearTimeout(quiet); quiet = setTimeout(() => finish(), 1800); }
                    } catch { /* Response may have been evicted; observe the next one. */ }
                };
                wc.setWindowOpenHandler(() => ({ action: 'deny' }));
                try { wc.debugger.attach('1.3'); } catch { finish(error('Không mở được phiên đọc Outlook.', 503, 'OUTLOOK_CAPTURE_UNAVAILABLE')); return; }
                wc.debugger.on('message', (_event, method, params) => {
                    if (method === 'Network.requestWillBeSent') {
                        requests.set(params.requestId, params.request.url);
                        remember(params.request.headers || {}, params.request.url);
                    } else if (method === 'Network.requestWillBeSentExtraInfo') remember(params.headers || {}, requests.get(params.requestId));
                    else if (method === 'Network.responseReceived') requests.set(params.requestId, params.response.url);
                    else if (method === 'Network.loadingFinished') { inspect(params.requestId, requests.get(params.requestId) || ''); requests.delete(params.requestId); }
                });
                wc.debugger.sendCommand('Network.enable').catch(() => finish(error('Không mở được phiên đọc Outlook.', 503, 'OUTLOOK_CAPTURE_UNAVAILABLE')));
                wc.on('did-navigate', (_event, url) => {
                    if (!state.interactive && /login\.(microsoftonline|live)\.com/i.test(url)) loginTimer = setTimeout(() => finish(error('Phiên Outlook hết hạn. Hãy chọn Kết nối Outlook.')), 5000);
                });
                wc.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
                    if (isMainFrame !== false && code !== -3) finish(error('Không tải được trang Outlook.', 502, 'OUTLOOK_NETWORK_ERROR'));
                });
                wc.on('did-finish-load', () => { if (token()) { clearTimeout(quiet); quiet = setTimeout(() => finish(), 2500); } });
                win.on('closed', () => finish(cancelled()));
                win.loadURL(messageId ? `${INBOX}/id/${encodeURIComponent(messageId)}` : INBOX).catch(failure => {
                    // Chromium aborts the original navigation during normal SSO
                    // redirects. Continue observing the redirected page instead.
                    if (!navigationAborted(failure)) finish(error('Không mở được Outlook.', 502, 'OUTLOOK_NETWORK_ERROR'));
                });
            });
        }).finally(() => { pending = null; captureState = null; cancelCapture = null; });
        return pending;
    }
    async function listMessages({ top = 100, interactive = false, timeoutMs, signal } = {}) {
        if (interactive || (!token() && Date.now() - capturedAt > 10000)) await capture({ interactive, timeoutMs, signal });
        if (token()) {
          try {
            const messages = [];
            const pages = new Set();
            const limit = Math.max(1, Math.min(500, Number(top) || 100));
            let next = `/me/mailFolders/inbox/messages?$top=${Math.min(limit, 100)}&$select=id,subject,from,receivedDateTime,bodyPreview,body,isRead,webLink&$orderby=receivedDateTime%20desc`;
            while (next && messages.length < limit) {
                if (pages.has(next) || pages.size >= 10) throw error('Outlook trả phân trang không hợp lệ.', 502, 'OUTLOOK_INVALID_RESPONSE');
                pages.add(next);
                const data = await graph(next, signal);
                if (!Array.isArray(data.value)) throw error('Outlook trả danh sách thư không hợp lệ.', 502, 'OUTLOOK_INVALID_RESPONSE');
                const normalized = data.value.map(normalizeMessage).filter(Boolean);
                if (data.value.length && !normalized.length) throw error('Không đọc được định dạng thư Outlook.', 502, 'OUTLOOK_INVALID_RESPONSE');
                messages.push(...normalized);
                next = data['@odata.nextLink'];
            }
            needsLogin = false;
            return { messages: messages.slice(0, limit), account, source: 'microsoft-graph' };
          } catch (failure) {
            if (tokenProvider() || ![401, 403].includes(failure.statusCode)) throw failure;
            bearer = ''; expires = 0;
            if (!capturedAt || Date.now() - capturedAt > 10000) await capture({ timeoutMs, signal });
          }
        }
        return { messages: cached, account, source: 'outlook-web' };
    }
    async function getMessage(id) {
        if (token()) return normalizeMessage(await graph(`/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,receivedDateTime,body,bodyPreview,isRead,webLink`));
        const messages = await capture({ messageId: id });
        const mail = messages.find(item => item.id === id);
        if (!mail?.body) throw error('Outlook chỉ trả bản xem trước. Mở thư gốc trong Outlook để xem đầy đủ.', 409, 'OUTLOOK_INVALID_RESPONSE');
        return mail;
    }
    async function logout() {
        cancelCapture?.(cancelled()); disconnected = true;
        bearer = ''; expires = 0; account = ''; cached = []; capturedAt = 0; needsLogin = false;
        const electron = electronProvider();
        if (electron?.session) await electron.session.fromPartition(PARTITION).clearStorageData();
        return true;
    }
    return { listMessages, getMessage, connect: (options = {}) => { disconnected = false; return listMessages({ ...options, interactive: !tokenProvider() }); }, logout,
        status: () => ({ connected: !needsLogin && Boolean(token() || capturedAt), source: needsLogin ? null : token() ? 'microsoft-graph' : capturedAt ? 'outlook-web' : null, account, configuredToken: Boolean(tokenProvider()), requiresLogin: needsLogin }) };
}

module.exports = { ...createOutlookClient(), createOutlookClient };
