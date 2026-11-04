'use strict';

const { createLearningService } = require('./learning.service');

function createLearningRuntime(options = {}) {
    let database;
    const service = createLearningService({ getDb: () => database, ...options });
    const setDb = value => { database = value; };
    const backgroundSync = async () => {
        try { return await service.startSync({ automatic: true, summarize: false }); }
        catch (error) { return { skipped: true, message: error.message }; }
    };
    return { service, setDb, backgroundSync };
}

module.exports = { ...createLearningRuntime(), createLearningRuntime };
