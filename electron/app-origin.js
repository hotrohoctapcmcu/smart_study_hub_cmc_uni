'use strict';

const APP_ORIGIN = 'studyhub://app';

function isAppUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'studyhub:' && url.hostname === 'app'
            && !url.port && !url.username && !url.password;
    } catch {
        return false;
    }
}

module.exports = { APP_ORIGIN, isAppUrl };
