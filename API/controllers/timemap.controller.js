'use strict';

const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const {
    fetchAndNormalizeTimeBlocks,
    mergeOverlappingBlocks,
    calculateFreeSlots
} = require('../services/timemap.service');

const { groupBlocksByDate } = require('../utils/timemap-time');

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
