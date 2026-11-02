'use strict';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const BLOCK_PRIORITY = {
    exam: 4,
    class: 3,
    pomodoro: 2,
    'self-study': 1,
    'free-time': 0
};


function taoLoi(message, statusCode = 400, code = 'TIMEMAP_INVALID_INPUT') {
    return Object.assign(new Error(message), { statusCode, code });
}

function parseNgay(value, tenThamSo) {
    if (typeof value !== 'string') {
        throw taoLoi(`${tenThamSo} phải có định dạng YYYY-MM-DD.`);
    }

    const match = DATE_ONLY_PATTERN.exec(value);
    if (!match) {
        throw taoLoi(`${tenThamSo} phải có định dạng YYYY-MM-DD.`);
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);

    if (
        year < 1000 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw taoLoi(`${tenThamSo} không phải ngày hợp lệ.`);
    }

    return { value, epoch: date.getTime() };
}

function parseGio(value, label) {
    const match = TIME_PATTERN.exec(String(value || ''));
    if (!match) {
        throw taoLoi(`${label} phải có định dạng HH:mm hoặc HH:mm:ss.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    if (hour > 23 || minute > 59 || second > 59) {
        throw taoLoi(`${label} không phải giờ hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    return {
        hour,
        minute,
        second,
        text: `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`
    };
}

function parseTimeBlock(block, index) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
        throw taoLoi(`timeBlocks[${index}] phải là object.`, 400, 'TIMEMAP_INVALID_BLOCK');
    }

    if (!Object.prototype.hasOwnProperty.call(BLOCK_PRIORITY, block.type)) {
        throw taoLoi(`timeBlocks[${index}] có type không được hỗ trợ.`, 400, 'TIMEMAP_INVALID_BLOCK');
    }

    if (block.id === undefined || block.id === null || String(block.id).trim() === '') {
        throw taoLoi(`timeBlocks[${index}].id là bắt buộc.`, 400, 'TIMEMAP_INVALID_BLOCK');
    }
    if (typeof block.title !== 'string' || typeof block.isRequired !== 'boolean') {
        throw taoLoi(
            `timeBlocks[${index}] phải có title dạng chuỗi và isRequired dạng boolean.`,
            400,
            'TIMEMAP_INVALID_BLOCK'
        );
    }

    const timezoneSpecified = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
    if (!timezoneSpecified(block.startTime) || !timezoneSpecified(block.endTime)) {
        throw taoLoi(
            `timeBlocks[${index}] phải có startTime/endTime kèm múi giờ.`,
            400,
            'TIMEMAP_INVALID_BLOCK'
        );
    }

    const startEpoch = Date.parse(block.startTime);
    const endEpoch = Date.parse(block.endTime);
    if (!Number.isFinite(startEpoch) || !Number.isFinite(endEpoch) || endEpoch <= startEpoch) {
        throw taoLoi(
            `timeBlocks[${index}] có khoảng thời gian không hợp lệ.`,
            400,
            'TIMEMAP_INVALID_BLOCK'
        );
    }

    return {
        block,
        id: String(block.id),
        priority: BLOCK_PRIORITY[block.type],
        startEpoch,
        endEpoch
    };
}

module.exports = { taoLoi, parseNgay, parseGio, parseTimeBlock };
