'use strict';

// Keep both existing response shapes: nested data and top-level fields.
const dataHandler = (callback, status = 200, message) => async (req, res, next) => {
    try {
        const data = await callback(req);
        res.status(status).json({
            success: true,
            ...(message && { message }),
            ...(data !== undefined && { data })
        });
    } catch (error) {
        next(error);
    }
};

const spreadHandler = (callback, status = 200) => async (req, res, next) => {
    try {
        res.status(status).json({ success: true, ...await callback(req) });
    } catch (error) {
        next(error);
    }
};

const binaryHandler = callback => async (req, res, next) => {
    try {
        await callback(req, res);
    } catch (error) {
        next(error);
    }
};

module.exports = { dataHandler, spreadHandler, binaryHandler };
