'use strict';

const { isAppUrl } = require('../app-origin');

function registerOutlookBridge() {
    const { ipcMain } = require('electron');
    const outlook = require('../../CRWEB/modules/OUTLOOK');
    ipcMain.handle('outlook:connect', async event => {
        if (!isAppUrl(event?.senderFrame?.url)) throw new Error('Nguồn yêu cầu Outlook không hợp lệ.');
        const result = await outlook.connect();
        // Mail data is subsequently read by the API from this same main-process client.
        return { connected: true, source: result.source, account: result.account };
    });
}

module.exports = { registerOutlookBridge };
