'use strict';

const { dataHandler, cancellableDataHandler } = require('../utils/response');

function createTrolyaiController(service) {
    return {
        status: dataHandler(req => service.status()),
        ask: cancellableDataHandler((req, options) => service.ask(req.body, options)),
        plan: cancellableDataHandler((req, options) => service.plan(req.body, options)),
        confirmPlan: dataHandler(req => service.confirmPlan(req.body)),
        pomodoroGoals: cancellableDataHandler((req, options) => service.pomodoroGoals(req.body, options)),
        examPlan: cancellableDataHandler((req, options) => service.examPlan(req.body, options)),
        check: cancellableDataHandler((req, options) => service.check(req.body, options)),
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
        draftLeave: cancellableDataHandler((req, options) => service.draftLeave(req.body, options)),
        progressAdvice: cancellableDataHandler((req, options) => service.progressAdvice(req.body, options)),
        difficultNotes: cancellableDataHandler((req, options) => service.difficultNotes(req.body, options))
    };
}

module.exports = { createTrolyaiController };
