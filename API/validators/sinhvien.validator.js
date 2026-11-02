const { loi } = require('../utils/error');

function profile(body) {
    if (!body || !Object.keys(body).length) throw loi('Không có dữ liệu cập nhật.');
}

module.exports = { profile };
