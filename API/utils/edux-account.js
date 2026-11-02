'use strict';

const fs = require('node:fs');
const path = require('node:path');

function accountDirectory() {
    return process.env.EDUX_ACCOUNTS_PATH || path.join(process.env.DB_PATH
        ? path.dirname(path.resolve(process.env.DB_PATH)) : path.resolve(__dirname, '../../data'), 'edux-accounts');
}

// This local application remembers the account as requested by its owner.
// Credentials stay on disk; only the session's public status leaves this module.
function createEduxAccounts({ directory = accountDirectory, sessions = require('./edux-session'),
    login = require('./edux-client').dangNhapEDUX, clock = Date.now } = {}) {
    const pending = new Map(), revisions = new Map(), retryAt = new Map();
    const filename = userId => path.join(typeof directory === 'function' ? directory() : directory, `${encodeURIComponent(userId)}.json`);
    const revision = userId => revisions.get(String(userId)) || 0;
    function bump(userId) { const next = revision(userId) + 1; revisions.set(String(userId), next); return next; }
    function read(userId) {
        try {
            const value = JSON.parse(fs.readFileSync(filename(userId), 'utf8'));
            return typeof value.email === 'string' && value.email && typeof value.password === 'string' && value.password ? value : null;
        } catch { return null; }
    }
    function write(userId, account) {
        const file = filename(userId), temporary = file + '.tmp';
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(temporary, JSON.stringify(account), { mode: 0o600 });
            fs.renameSync(temporary, file);
        } catch {
            fs.rmSync(temporary, { force: true });
            throw Object.assign(new Error('Không lưu được tài khoản EDUX trên máy này.'), { statusCode: 500 });
        }
    }
    async function connect(userId, { email, password }) {
        const version = bump(userId);
        let session;
        try { session = await login({ email, password }); }
        catch (error) {
            if (version === revision(userId) && error.statusCode === 401) sessions.clearSession(userId);
            throw error;
        }
        if (version !== revision(userId)) throw Object.assign(new Error('Kết nối EDUX đã bị hủy.'), { statusCode: 409 });
        write(userId, { email: session.email || email.trim(), password });
        // Invalidate a restore that started while this manual login was running.
        bump(userId);
        retryAt.delete(String(userId));
        return sessions.saveSession(userId, session);
    }
    function restore(userId) {
        const key = String(userId);
        if (sessions.getSession(userId)) return Promise.resolve(sessions.getSession(userId));
        if (pending.has(key)) return pending.get(key);
        if ((retryAt.get(key) || 0) > clock()) return Promise.resolve(null);
        const account = read(userId);
        if (!account) return Promise.resolve(null);
        const version = revision(userId);
        const task = (async () => {
            try {
                const session = await login(account);
                if (version !== revision(userId)) return sessions.getSession(userId);
                sessions.saveSession(userId, session);
                return sessions.getSession(userId);
            } catch {
                // A disconnected portal must not stop the rest of the local app.
                if (version === revision(userId)) retryAt.set(key, clock() + 30000);
                return null;
            }
        })().finally(() => pending.delete(key));
        pending.set(key, task);
        return task;
    }
    function disconnect(userId) {
        bump(userId);
        fs.rmSync(filename(userId), { force: true });
        retryAt.delete(String(userId));
        sessions.clearSession(userId);
    }
    return { connect, restore, disconnect };
}

module.exports = { ...createEduxAccounts(), createEduxAccounts, accountDirectory };
