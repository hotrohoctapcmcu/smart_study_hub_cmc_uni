'use strict';

function registerOutlookBridge() {
    const { ipcMain } = require('electron');
    const outlook = require('../CRWEB/OUTLOOK');
    ipcMain.handle('outlook:connect', async event => {
        const url = new URL(event.senderFrame.url);
        if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '8080') throw new Error('Nguồn yêu cầu Outlook không hợp lệ.');
        const result = await outlook.connect();
        // Mail data is subsequently read by the API from this same main-process client.
        return { connected: true, source: result.source, account: result.account };
    });
}

module.exports = { registerOutlookBridge };
