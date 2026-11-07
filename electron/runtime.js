'use strict';

const fs = require('node:fs');
const path = require('node:path');

function configurePackagedRuntime(app, env = process.env) {
    if (!app.isPackaged) return null;
    const userData = path.resolve(env.SMART_STUDY_USER_DATA || path.join(app.getPath('appData'), 'SmartStudyHubCMC'));
    fs.mkdirSync(userData, { recursive: true });
    app.setPath('userData', userData);
    const data = path.join(userData, 'data');
    fs.mkdirSync(data, { recursive: true });
    Object.assign(env, {
        NODE_ENV: 'production', SMART_STUDY_PACKAGED: '1',
        DB_PATH: path.join(data, 'unistudy.db'),
        DOCUMENTS_PATH: path.join(data, 'documents'),
        EDUX_ACCOUNTS_PATH: path.join(data, 'edux-accounts'),
        EDUX_COOKIE_PATH: path.join(data, 'edux-cookie.txt'),
        GEMINI_SESSION_DIR: path.join(data, 'gemini-session')
    });
    return { userData, data };
}

module.exports = { configurePackagedRuntime };
