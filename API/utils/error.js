'use strict';

const loi = (message, statusCode = 400) =>
    Object.assign(new Error(message), { statusCode });

function kiemTra(condition, message) {
    if (!condition) throw loi(message);
}

module.exports = { loi, kiemTra };
