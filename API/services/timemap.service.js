'use strict';

const { taoLoi, parseNgay, parseTimeBlock } = require('../validators/timemap.validator');
const { formatNgay, congNgay, localDateTimeToEpoch, formatUtc7 } = require('../utils/timemap-time');
const { fetchAndNormalizeTimeBlocks } = require('./timemap-source.service');

function subtractInterval(intervals, occupiedStart, occupiedEnd) {
    const remaining = [];

    for (const interval of intervals) {
        if (occupiedEnd <= interval.start || occupiedStart >= interval.end) {
            remaining.push(interval);
            continue;
        }

        if (occupiedStart > interval.start) {
            remaining.push({ start: interval.start, end: occupiedStart });
        }
        if (occupiedEnd < interval.end) {
            remaining.push({ start: occupiedEnd, end: interval.end });
        }
    }

    return remaining;
}

function mergeOverlappingBlocks(timeBlocks) {
    // Nhận được cả mảng cũ lẫn kết quả giàu metadata của Giai đoạn 1.
    const blocks = Array.isArray(timeBlocks) ? timeBlocks : timeBlocks?.timeBlocks;
    if (!Array.isArray(blocks)) {
        throw taoLoi('timeBlocks phải là một mảng hoặc kết quả từ fetchAndNormalizeTimeBlocks.', 400, 'TIMEMAP_INVALID_BLOCKS');
    }

    const parsedBlocks = blocks.map(parseTimeBlock);
    const sortedByPriority = [...parsedBlocks].sort((left, right) =>
        right.priority - left.priority ||
        left.startEpoch - right.startEpoch ||
        right.endEpoch - left.endEpoch ||
        left.id.localeCompare(right.id)
    );

    const accepted = [];
    for (const candidate of sortedByPriority) {
        let remaining = [{ start: candidate.startEpoch, end: candidate.endEpoch }];

        for (const kept of accepted) {
            remaining = subtractInterval(remaining, kept.startEpoch, kept.endEpoch);
            if (remaining.length === 0) break;
        }

        remaining.forEach((interval, index) => {
            accepted.push({
                ...candidate,
                startEpoch: interval.start,
                endEpoch: interval.end,
                partIndex: index + 1,
                partCount: remaining.length
            });
        });
    }

    return accepted
        .sort((left, right) =>
            left.startEpoch - right.startEpoch ||
            left.endEpoch - right.endEpoch ||
            right.priority - left.priority ||
            left.id.localeCompare(right.id)
        )
        .map(item => ({
            ...item.block,
            id: item.partCount > 1 ? `${item.id}:part-${item.partIndex}` : item.id,
            startTime: formatUtc7(item.startEpoch),
            endTime: formatUtc7(item.endEpoch)
        }));
}

function calculateFreeSlots(mergedBlocks, fromDate, toDate) {
    if (!Array.isArray(mergedBlocks)) {
        throw taoLoi('mergedBlocks phải là một mảng.', 400, 'TIMEMAP_INVALID_BLOCKS');
    }

    const from = parseNgay(fromDate, 'fromDate');
    const to = parseNgay(toDate, 'toDate');
    if (from.epoch > to.epoch) {
        throw taoLoi('fromDate phải nhỏ hơn hoặc bằng toDate.');
    }

    const busyBlocks = mergedBlocks.map(parseTimeBlock);
    const result = [...mergedBlocks];

    for (let dayEpoch = from.epoch; dayEpoch <= to.epoch; dayEpoch += 24 * 60 * 60 * 1000) {
        const date = formatNgay(dayEpoch);
        const dayStart = localDateTimeToEpoch(date, '00:00:00');
        const dayEnd = localDateTimeToEpoch(congNgay(date, 1), '00:00:00');
        const intervals = busyBlocks
            .filter(block => block.startEpoch < dayEnd && block.endEpoch > dayStart)
            .map(block => ({
                start: Math.max(block.startEpoch, dayStart),
                end: Math.min(block.endEpoch, dayEnd)
            }))
            .sort((left, right) => left.start - right.start || left.end - right.end);

        let cursor = dayStart;
        for (const interval of intervals) {
            if (interval.start > cursor) {
                result.push({
                    id: `free-time:${date}:${cursor}`,
                    type: 'free-time',
                    startTime: formatUtc7(cursor),
                    endTime: formatUtc7(interval.start),
                    title: 'Thời gian trống',
                    isRequired: false
                });
            }
            cursor = Math.max(cursor, interval.end);
        }

        if (cursor < dayEnd) {
            result.push({
                id: `free-time:${date}:${cursor}`,
                type: 'free-time',
                startTime: formatUtc7(cursor),
                endTime: formatUtc7(dayEnd),
                title: 'Thời gian trống',
                isRequired: false
            });
        }
    }

    return result.sort((left, right) =>
        Date.parse(left.startTime) - Date.parse(right.startTime) ||
        Date.parse(left.endTime) - Date.parse(right.endTime) ||
        left.id.localeCompare(right.id)
    );
}

module.exports = { fetchAndNormalizeTimeBlocks, mergeOverlappingBlocks, calculateFreeSlots };
