'use strict';

// Adapted to this project's main-process/API boundary from the Outlook Web +
// Graph approach in https://github.com/vtishan/thoiGianBieu (a786189).
// Credentials remain in the Electron partition or main-process memory.
const { normalizeMessage, findMessages, hasEmptyMailbox } = require('./parser');
const GRAPH = 'https://graph.microsoft.com/v1.0';
const INBOX = 'https://outlook.office.com/mail/inbox';
const PARTITION = 'persist:cmc-outlook';
const error = (message, statusCode = 401) => Object.assign(new Error(message), { statusCode });

function createOutlookClient({ fetchImpl = globalThis.fetch, tokenProvider = () => process.env.OUTLOOK_ACCESS_TOKEN || '', electronProvider = () => { try { return require('electron'); } catch { return null; } } } = {}) {
    let bearer = '', expires = 0, account = '', pending = null, cached = [], capturedAt = 0, disconnected = false, cancelCapture;
    function token() { return disconnected ? '' : tokenProvider() || (expires > Date.now() + 60000 ? bearer : ''); }
    function remember(headers, url) {
        if (new URL(url || INBOX).hostname !== 'graph.microsoft.com') return;
        const auth = headers.Authorization || headers.authorization || '';
        if (!/^Bearer /i.test(auth)) return;
        try {
            const value = auth.slice(7), claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
            if (!/\bMail\.(?:Read|ReadWrite)\b/.test(String(claims.scp))) return;
            bearer = value; expires = Number(claims.exp) * 1000;
            account = claims.preferred_username || claims.upn || claims.unique_name || '';
        } catch { /* Opaque or unrelated tokens are not retained. */ }
    }
    async function graph(resource) {
        const auth = token();
        if (!auth) throw error('Phiên Outlook cần đăng nhập lại.');
        const url = new URL(resource.startsWith('https:') ? resource : GRAPH + resource);
        if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/')) throw error('Đường dẫn Graph không hợp lệ.', 400);
        const response = await fetchImpl(url.href, { headers: { Authorization: `Bearer ${auth}`, Prefer: 'outlook.body-content-type="text"' }, signal: AbortSignal.timeout(25000) });
        if (!response.ok) {
            if (response.status === 401) { bearer = ''; expires = 0; }
            throw error(response.status === 403 ? 'Tài khoản chưa cấp quyền Mail.Read. Hãy kết nối lại Outlook.' : `Không đọc được Outlook (HTTP ${response.status}).`, response.status === 401 || response.status === 403 ? response.status : 502);
        }
        return response.json();
    }
    async function capture({ interactive = false, messageId } = {}) {
        if (pending) return pending;
        const electron = electronProvider();
        if (!electron?.BrowserWindow) throw error('Mở ứng dụng Electron và chọn Kết nối Outlook; bản headless cần OUTLOOK_ACCESS_TOKEN có quyền Mail.Read.', 409);
        await electron.app.whenReady();
        pending = new Promise((resolve, reject) => {
            const win = new electron.BrowserWindow({ width: 1100, height: 820, show: interactive, title: 'Kết nối Outlook trường', autoHideMenuBar: true,
                webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
            const wc = win.webContents, requests = new Map(), messages = new Map();
            let done = false, quiet, loginTimer;
            const finish = (failure) => {
                if (done) return;
                done = true; clearTimeout(timer); clearTimeout(quiet); clearTimeout(loginTimer);
                cancelCapture = null;
                try { wc.debugger.detach(); } catch { /* window already closed */ }
                if (!win.isDestroyed()) win.destroy();
                if (failure) reject(failure);
                else { cached = [...messages.values()]; capturedAt = Date.now(); resolve(cached); }
            };
            cancelCapture = finish;
            const timer = setTimeout(() => finish(error('Outlook chưa trả dữ liệu. Kiểm tra đăng nhập và kết nối mạng.', 504)), interactive ? 180000 : 40000);
            const inspect = async (id, url) => {
                let parsedUrl;
                try { parsedUrl = new URL(url); } catch { return; }
                if (!['graph.microsoft.com', 'outlook.office.com', 'outlook.office365.com'].includes(parsedUrl.hostname)) return;
                if (!/messages|service\.svc|\$batch/i.test(url)) return;
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
            try { wc.debugger.attach('1.3'); } catch { finish(error('Không mở được phiên đọc Outlook.', 503)); return; }
            wc.debugger.on('message', (_event, method, params) => {
                if (method === 'Network.requestWillBeSent') {
                    requests.set(params.requestId, params.request.url);
                    remember(params.request.headers || {}, params.request.url);
                } else if (method === 'Network.requestWillBeSentExtraInfo') remember(params.headers || {}, requests.get(params.requestId));
                else if (method === 'Network.responseReceived') requests.set(params.requestId, params.response.url);
                else if (method === 'Network.loadingFinished') { inspect(params.requestId, requests.get(params.requestId) || ''); requests.delete(params.requestId); }
            });
            wc.debugger.sendCommand('Network.enable').catch(() => {});
            wc.on('did-navigate', (_event, url) => {
                if (!interactive && /login\.(microsoftonline|live)\.com/i.test(url)) loginTimer = setTimeout(() => finish(error('Phiên Outlook hết hạn. Hãy chọn Kết nối Outlook.')), 5000);
            });
            wc.on('did-finish-load', () => { if (token()) { clearTimeout(quiet); quiet = setTimeout(() => finish(), 2500); } });
            win.on('closed', () => finish(error('Đã đóng cửa sổ trước khi kết nối Outlook xong.', 409)));
            win.loadURL(messageId ? `${INBOX}/id/${encodeURIComponent(messageId)}` : INBOX).catch(() => finish(error('Không mở được Outlook.', 502)));
        }).finally(() => { pending = null; });
        return pending;
    }
    async function listMessages({ top = 100, interactive = false } = {}) {
        if (interactive || (!token() && Date.now() - capturedAt > 10000)) await capture({ interactive });
        if (token()) {
          try {
            const messages = [];
            const pages = new Set();
            const limit = Math.max(1, Math.min(500, Number(top) || 100));
            let next = `/me/mailFolders/inbox/messages?$top=${Math.min(limit, 100)}&$select=id,subject,from,receivedDateTime,bodyPreview,body,isRead,webLink&$orderby=receivedDateTime%20desc`;
            while (next && messages.length < limit) {
                if (pages.has(next) || pages.size >= 10) throw error('Outlook trả phân trang không hợp lệ.', 502);
                pages.add(next);
                const data = await graph(next);
                if (!Array.isArray(data.value)) throw error('Outlook trả danh sách thư không hợp lệ.', 502);
                const normalized = data.value.map(normalizeMessage).filter(Boolean);
                if (data.value.length && !normalized.length) throw error('Không đọc được định dạng thư Outlook.', 502);
                messages.push(...normalized);
                next = data['@odata.nextLink'];
            }
            return { messages: messages.slice(0, limit), account, source: 'microsoft-graph' };
          } catch (failure) {
            if (tokenProvider() || ![401, 403].includes(failure.statusCode)) throw failure;
            bearer = ''; expires = 0;
            if (!capturedAt || Date.now() - capturedAt > 10000) await capture();
          }
        }
        return { messages: cached, account, source: 'outlook-web' };
    }
    async function getMessage(id) {
        if (token()) return normalizeMessage(await graph(`/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,receivedDateTime,body,bodyPreview,isRead,webLink`));
        const messages = await capture({ messageId: id });
        const mail = messages.find(item => item.id === id);
        if (!mail?.body) throw error('Outlook chỉ trả bản xem trước. Mở thư gốc trong Outlook để xem đầy đủ.', 409);
        return mail;
    }
    async function logout() {
        cancelCapture?.(error('Đã ngắt kết nối Outlook.', 409)); disconnected = true;
        bearer = ''; expires = 0; account = ''; cached = []; capturedAt = 0;
        const electron = electronProvider();
        if (electron?.session) await electron.session.fromPartition(PARTITION).clearStorageData();
        return true;
    }
    return { listMessages, getMessage, connect: () => { disconnected = false; return listMessages({ interactive: !tokenProvider() }); }, logout,
        status: () => ({ connected: Boolean(token() || capturedAt), source: token() ? 'microsoft-graph' : capturedAt ? 'outlook-web' : null, account, configuredToken: Boolean(tokenProvider()) }) };
}

module.exports = { ...createOutlookClient(), createOutlookClient };
