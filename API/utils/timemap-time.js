'use strict';

const { taoLoi, parseNgay, parseGio } = require('../validators/timemap.validator');
const UTC7_OFFSET_MINUTES = 7 * 60;
const UTC7_OFFSET_MS = UTC7_OFFSET_MINUTES * 60 * 1000;

function formatNgay(epoch) {
    const date = new Date(epoch);
    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function congNgay(ngay, soNgay) {
    const parsed = parseNgay(ngay, 'ngày');
    return formatNgay(parsed.epoch + soNgay * 24 * 60 * 60 * 1000);
}

function localDateTimeToEpoch(ngay, gio) {
    const parsedDate = parseNgay(ngay, 'ngày dữ liệu');
    const parsedTime = parseGio(gio, 'Giờ dữ liệu');
    return parsedDate.epoch +
        ((parsedTime.hour * 60 + parsedTime.minute - UTC7_OFFSET_MINUTES) * 60 + parsedTime.second) * 1000;
}

function formatUtc7(epoch) {
    const local = new Date(epoch + UTC7_OFFSET_MS);
    const ngay = formatNgay(local.getTime());
    const gio = [
        String(local.getUTCHours()).padStart(2, '0'),
        String(local.getUTCMinutes()).padStart(2, '0'),
        String(local.getUTCSeconds()).padStart(2, '0')
    ].join(':');
    const milliseconds = local.getUTCMilliseconds();
    const fraction = milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : '';
    return `${ngay}T${gio}${fraction}+07:00`;
}

function buildLocalBlock({ id, type, date, start, end, title, isRequired }) {
    const startTime = localDateTimeToEpoch(date, start);
    const endTime = localDateTimeToEpoch(date, end);

    if (endTime <= startTime) {
        throw taoLoi(`Khoảng thời gian của ${id} không hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    return {
        id: String(id),
        type,
        startTime: formatUtc7(startTime),
        endTime: formatUtc7(endTime),
        title: String(title || type),
        isRequired: Boolean(isRequired)
    };
}

const vietnameseDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

function layNgayVietNam(timestamp) {
    const epoch = Date.parse(timestamp);
    if (!Number.isFinite(epoch)) {
        throw Object.assign(new Error('Block thời gian có startTime không hợp lệ.'), {
            statusCode: 500,
            code: 'TIMEMAP_INVALID_BLOCK'
        });
    }

    const parts = vietnameseDateFormatter.formatToParts(new Date(epoch));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function groupBlocksByDate(timeBlocks) {
    return timeBlocks.reduce((groups, block) => {
        const date = layNgayVietNam(block.startTime);
        if (!groups[date]) groups[date] = [];
        groups[date].push(block);
        return groups;
    }, {});
}


module.exports = { formatNgay, congNgay, localDateTimeToEpoch, formatUtc7, buildLocalBlock, groupBlocksByDate };
