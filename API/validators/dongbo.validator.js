'use strict';

const { loi } = require('../utils/error');

function sources(sources) {
    return allSources(sources);
}

function jobId(jobId) {
    if (!jobId) throw loi('jobId là bắt buộc.');
}

function credentials(email, password) {
    if (!email || !password) throw loi('email và password là bắt buộc.');
}

function allSources(value = ['IU', 'EDUX', 'OUTLOOK']) {
    if (!Array.isArray(value) || !value.length || value.some(source => !['IU', 'EDUX', 'OUTLOOK'].includes(source))) {
        throw loi('Chọn ít nhất một nguồn hợp lệ: IU, EDUX hoặc OUTLOOK.');
    }
    return ['IU', 'EDUX', 'OUTLOOK'].filter(source => value.includes(source));
}

function syncRequest(body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw loi('Yêu cầu đồng bộ phải là một object.');
    return allSources(body.sources);
}

module.exports = { sources, jobId, credentials, allSources, syncRequest };
