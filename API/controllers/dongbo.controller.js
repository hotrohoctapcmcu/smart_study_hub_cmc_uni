'use strict';

const service = require('../services/dongbo.service');
const { spreadHandler } = require('../utils/response');

module.exports = {
    sources: spreadHandler(req => service.sources()),
    start: spreadHandler(req => service.start(req.body || {}), 202),
    all: spreadHandler(req => service.syncAll(req.body || {})),
    status: spreadHandler(req => service.status(req.query.jobId)),
    currentCourses: spreadHandler(req => service.currentCourses()),
    refresh: spreadHandler(req => service.refresh(req.body)),
    saveIuSession: spreadHandler(req => service.saveIuSession(req.body), 201),
    iuStatus: spreadHandler(req => service.iuStatus()),
    clearIuSession: spreadHandler(req => service.clearIuSession()),
    pullAndSaveIU: spreadHandler(req => service.pullAndSaveIU(req.body || {})),
    pullIuGroup: spreadHandler(req => service.pullIuGroup(req.body)),
    saveEduxSession: spreadHandler(req => service.saveEduxSession(req.body), 201),
    eduxStatus: spreadHandler(req => service.eduxStatus()),
    clearEduxSession: spreadHandler(req => service.clearEduxSession()),
    pullAndSaveEdux: spreadHandler(req => service.pullAndSaveEdux(req.body || {}))
};
