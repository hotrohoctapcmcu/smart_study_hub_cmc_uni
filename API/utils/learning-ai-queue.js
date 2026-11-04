'use strict';

function createWorkQueue(limit = 5) {
    let active = 0;
    const pending = [];
    function drain() {
        while (active < limit && pending.length) {
            const { work, resolve, reject } = pending.shift();
            active++;
            Promise.resolve().then(work).then(resolve, reject).finally(() => { active--; drain(); });
        }
    }
    return { run: work => new Promise((resolve, reject) => { pending.push({ work, resolve, reject }); drain(); }) };
}

// Shared provider cap across manual course workers and AI Tutor summaries.
const learningAiQueue = createWorkQueue(5);
module.exports = { createWorkQueue, learningAiQueue };
