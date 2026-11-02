const { loi } = require('../utils/error');

function create(body) {
    const { targetType, targetId, title, remindTime } = body;
    if (!targetType || !targetId || !title || !remindTime) {
        throw loi('targetType, targetId, title và remindTime là bắt buộc.');
    }
}

function multiTier(body) {
    const { targetType, targetId, title, deadline } = body;
    if (!targetType || !targetId || !title || !deadline) {
        throw loi('targetType, targetId, title và deadline là bắt buộc.');
    }
}

function id(value) {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        throw loi('reminderId phải là số nguyên dương.');
    }
}

module.exports = { create, multiTier, id };
