'use strict';

const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');
const {
    fetchAndNormalizeTimeBlocks,
    mergeOverlappingBlocks,
    calculateFreeSlots
} = require('./timemap.service');

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

function createTimeMapController({ getDb, userId = NGUOI_DUNG_ID } = {}) {
    if (typeof getDb !== 'function') {
        throw new TypeError('getDb phải là một hàm.');
    }

    async function getTimeMap(req, res, next) {
        try {
            const from = req.query.from;
            const to = req.query.to;
            const fetched = await fetchAndNormalizeTimeBlocks({
                db: getDb(),
                userId,
                from,
                to
            });
            const mergedBlocks = mergeOverlappingBlocks(fetched);
            const timeBlocks = calculateFreeSlots(mergedBlocks, from, to);

            res.json({
                success: true,
                data: groupBlocksByDate(timeBlocks),
                meta: {
                    sources: fetched.sources,
                    warnings: fetched.warnings
                }
            });
        } catch (err) {
            next(err);
        }
    }

    return { getTimeMap };
}

module.exports = { createTimeMapController, groupBlocksByDate };
