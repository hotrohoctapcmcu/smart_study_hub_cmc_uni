'use strict';

const { dataHandler } = require('../utils/response');

function createTrolyaiController(service) {
    return {
        status: dataHandler(req => service.status()),
        ask: dataHandler(req => service.ask(req.body)),
        plan: dataHandler(req => service.plan(req.body)),
        confirmPlan: dataHandler(req => service.confirmPlan(req.body)),
        examPlan: dataHandler(req => service.examPlan(req.body)),
        check: dataHandler(req => service.check(req.body)),
        summarize: async (req, res, next) => {
            const controller = new AbortController();
            const close = () => { if (!res.writableEnded) controller.abort(); };
            res.on('close', close);
            try { const data = await service.summarize(req.body, { signal: controller.signal }); res.status(data?.jobId ? 202 : 200).json({ success: true, data }); }
            catch (error) { next(error); }
            finally { res.removeListener('close', close); }
        },
        summaryJob: dataHandler(req => service.summaryJob(req.params.id)),
        cancelSummary: dataHandler(req => service.cancelSummary(req.params.id)),
        draftLeave: dataHandler(req => service.draftLeave(req.body)),
        progressAdvice: dataHandler(req => service.progressAdvice(req.body)),
        difficultNotes: dataHandler(req => service.difficultNotes(req.body))
    };
}

module.exports = { createTrolyaiController };
