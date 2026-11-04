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

const cancellableDataHandler = callback => async (req, res, next) => {
    const controller = new AbortController();
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', close);
    try {
        const data = await callback(req, { signal: controller.signal });
        if (!res.destroyed) res.json({ success: true, data });
    } catch (error) { if (!res.destroyed) next(error); }
    finally { res.removeListener('close', close); }
};

module.exports = { dataHandler, spreadHandler, binaryHandler, cancellableDataHandler };
