'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLearningJobs } = require('../services/learning.jobs.service');
const wait = async (queue, id) => {
    const until = Date.now() + 3000;
    while (Date.now() < until) {
        const job = queue.job(id);
        if (!['queued', 'running'].includes(job.status)) return job;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Queue did not finish');
};

test('FIFO runs complete jobs in order, deduplicates queued requests and advances after a failure', async () => {
    const queue = createLearningJobs(), events = [];
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    const first = queue.startJob('sync:a', async update => {
        events.push('start:a'); update('Quét A', { done: 0, total: 1 }, { phase: 'materials' });
        await barrier; events.push('fail:a'); throw new Error('Source unavailable');
    }, { kind: 'sync', courseId: 'a' });
    const second = queue.startJob('sync:b', async () => { events.push('sync:b'); return { failures: [] }; }, { kind: 'sync', courseId: 'b' });
    const duplicate = queue.startJob('sync:b', () => { throw new Error('Duplicate should not execute'); });
    const third = queue.startJob('summary:c', async () => { events.push('summary:c'); return {}; }, { kind: 'summary', courseId: 'c' });
    assert.equal(duplicate.jobId, second.jobId); assert.equal(queue.job(first.jobId).status, 'running');
    assert.equal(queue.job(second.jobId).status, 'queued'); assert.equal(queue.job(second.jobId).queuePosition, 2);
    assert.equal(queue.job(third.jobId).queuePosition, 3);
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(events, ['start:a']);
    release();
    assert.equal((await wait(queue, first.jobId)).status, 'failed');
    assert.equal((await wait(queue, third.jobId)).status, 'completed');
    assert.deepEqual(events, ['start:a', 'fail:a', 'sync:b', 'summary:c']);
    assert.equal(queue.activeJobs.size, 0);
});

test('incomplete scans remain partial rather than reporting a fully successful sync', async () => {
    const queue = createLearningJobs();
    const started = queue.startJob('sync', async () => ({ failures: [{ stage: 'course', message: 'No assigned material' }] }), { kind: 'sync' });
    const result = await wait(queue, started.jobId);
    assert.equal(result.status, 'partial'); assert.equal(result.result.failures.length, 1);
    assert.match(result.message, /một phần/); assert.equal(result.queuePosition, null);
});
