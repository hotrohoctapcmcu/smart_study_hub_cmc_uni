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

// One shared queue across automatic sync and manually started courses.
const learningAiQueue = createWorkQueue(5);
module.exports = { createWorkQueue, learningAiQueue };
