'use strict';

const { createPortalWorkflow } = require('../../CRWEB/shared/portal-workflow');
const { APP_ORIGIN, isAppUrl } = require('../app-origin');

function registerSyncBridge({ electron = require('electron'), fetchImpl = globalThis.fetch,
    apiBase = APP_ORIGIN,
    connectIU = options => require('./iu').connectIU(options),
    outlook = require('../../CRWEB/modules/OUTLOOK') } = {}) {
    if (!electron?.ipcMain) return false;
    async function request(path, body, signal) {
        const response = await fetchImpl(`${apiBase}/api/v1${path}`, body === undefined ? { signal } : {
            signal,
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok || data?.success === false) throw new Error('Portal request failed');
        return data?.data ?? data;
    }
    const workflow = createPortalWorkflow({
        iu: { status: ({ signal }) => request('/sync/iu/status', undefined, signal), connect: connectIU },
        edux: {
            status: ({ signal }) => request('/sync/edux/status', undefined, signal),
            connect: ({ email, password, signal } = {}) => {
                if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
                    throw Object.assign(new Error('EDUX credentials required'), { code: 'credentials_required' });
                }
                return request('/sync/edux/session', { email: email.trim(), password }, signal);
            }
        },
        outlook: { status: () => outlook.status(), connect: options => outlook.connect(options) }
    });
    electron.ipcMain.handle('sync:connect-all', (event, options = {}) => {
        if (!isAppUrl(event?.senderFrame?.url)) {
            throw new Error('Nguồn yêu cầu đồng bộ không hợp lệ.');
        }
        const onProgress = snapshot => {
            // Send only to the invoking, validated renderer, never a broadcast.
            if (!event.senderFrame?.isDestroyed?.()) event.senderFrame?.send?.('sync:connection-progress', snapshot);
        };
        return workflow.connectAll({ iu: { timeoutMs: options?.iu?.timeoutMs },
            outlook: { timeoutMs: options?.outlook?.timeoutMs },
            edux: { email: options?.edux?.email, password: options?.edux?.password,
                timeoutMs: options?.edux?.timeoutMs }, onProgress });
    });
    return true;
}

module.exports = { registerSyncBridge };
