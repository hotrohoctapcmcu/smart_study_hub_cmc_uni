'use strict';

const { randomUUID } = require('node:crypto');
const { loi: fail } = require('../utils/error');

function createLearningJobs() {
    const jobs = new Map();
    const activeJobs = new Map();
    const waiting = [];
    let running = false;
    function positions() {
        let position = running ? 2 : 1;
        for (const task of waiting) jobs.get(task.jobId).queuePosition = position++;
    }
    function next() {
        if (running || !waiting.length) return;
        const { key, jobId, work } = waiting.shift();
        const entry = jobs.get(jobId);
        running = true;
        Object.assign(entry, { status: 'running', queuePosition: 1, message: 'Đang chuẩn bị dữ liệu…' });
        positions();
        const update = (message, progress = null, details = {}) => Object.assign(entry, { message, progress, ...details });
        Promise.resolve().then(() => work(update)).then(result => {
            const partial = entry.kind === 'sync' && Boolean(result?.failures?.length);
            Object.assign(entry, { status: partial ? 'partial' : 'completed',
                message: partial ? 'Đã quét một phần học liệu. Xem các môn hoặc slide chưa tải được.' : entry.kind === 'sync' ? 'Đã đồng bộ slide. Tóm tắt AI chỉ chạy khi bạn yêu cầu.' : 'Đã lưu bản tóm tắt và Flashcard.',
                queuePosition: null, result, finished: Date.now() });
        }, error => {
            Object.assign(entry, { status: 'failed', message: error.message, error: error.message, queuePosition: null, finished: Date.now() });
        }).finally(() => { activeJobs.delete(key); running = false; positions(); next(); });
    }
    function startJob(key, work, metadata = {}) {
        if (activeJobs.has(key)) return { ...jobs.get(activeJobs.get(key)) };
        for (const [id, entry] of jobs) if (!['running', 'queued'].includes(entry.status) && Date.now() - entry.finished > 3600000) jobs.delete(id);
        if (activeJobs.size >= 50) throw fail('Hàng đợi đang có 50 yêu cầu. Hãy đợi một yêu cầu hoàn tất.', 429);
        const jobId = randomUUID();
        const entry = { ...metadata, jobId, status: 'queued', message: 'Đang chờ đến lượt xử lý.', progress: null, queuePosition: null };
        jobs.set(jobId, entry); activeJobs.set(key, jobId);
        waiting.push({ key, jobId, work }); positions(); next();
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
