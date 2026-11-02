'use strict';

const { randomUUID } = require('node:crypto');
const { loi: fail } = require('../utils/error');

function createLearningJobs() {
    const jobs = new Map();
    const activeJobs = new Map();
    function startJob(key, work) {
        if (activeJobs.has(key)) return { ...jobs.get(activeJobs.get(key)) };
        for (const [id, entry] of jobs) if (!['running', 'queued'].includes(entry.status) && Date.now() - entry.finished > 3600000) jobs.delete(id);
        if (activeJobs.size >= 5) throw fail('Đang xử lý 5 yêu cầu. Hãy đợi một yêu cầu hoàn tất.', 429);
        const jobId = randomUUID();
        const entry = { jobId, status: 'running', message: 'Đang chuẩn bị dữ liệu…', progress: null };
        jobs.set(jobId, entry); activeJobs.set(key, jobId);
        const update = (message, progress = null, details = {}) => Object.assign(entry, { message, progress, ...details });
        Promise.resolve().then(() => work(update)).then(result => {
            Object.assign(entry, { status: 'completed', message: 'Đã lưu dữ liệu.', result, finished: Date.now() });
        }, error => {
            Object.assign(entry, { status: 'failed', message: error.message, error: error.message, finished: Date.now() });
        }).finally(() => activeJobs.delete(key));
        return { ...entry };
    }
    function job(id) {
        const entry = jobs.get(id);
        if (!entry) throw fail('Phiên xử lý không còn. Mở lại môn học để xem dữ liệu đã lưu hoặc thử lại.', 404);
        const { finished, ...view } = entry;
        return view;
    }

    return { jobs, activeJobs, startJob, job };
}

module.exports = { createLearningJobs };
