'use strict';

const { loi: fail } = require('../utils/error');
const text = (value, fallback = '') => String(value ?? fallback).trim();

function pomodoro(data) {
    const start = Date.parse(data.startTime || data.createdAt);
    const seconds = Number(data.actualStudySeconds);
    const end = data.endTime ? Date.parse(data.endTime) : start + seconds * 1000;
    if (!text(data.id) || !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(seconds) || seconds < 0 || seconds > 86400 || end < start || seconds * 1000 > end - start + 1000) throw fail('Thời gian Pomodoro không hợp lệ.');
    let segments = data.focusSegments;
    if (!Array.isArray(segments) || !segments.length) segments = seconds ? [{ start: new Date(start).toISOString(), end: new Date(start + seconds * 1000).toISOString() }] : [];
    if (segments.length > 500) throw fail('Quá nhiều lần tạm dừng.');
    let last = start;
    let segmentMs = 0;
    segments = segments.map(segment => {
        const a = Date.parse(segment.start), b = Date.parse(segment.end);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a < last || b <= a || b > end + 1000) throw fail('Khoảng tập trung Pomodoro không hợp lệ.');
        last = b; segmentMs += b - a;
        return { start: new Date(a).toISOString(), end: new Date(b).toISOString() };
    });
    if (Math.abs(segmentMs / 1000 - seconds) > 1) throw fail('Thời lượng tập trung không khớp các khoảng học.');
    const context = data.learningContext ?? {};
    if (!context || typeof context !== 'object' || Array.isArray(context)) throw fail('Mục tiêu phiên học không hợp lệ.');
    const shortText = (key, limit) => {
        if (context[key] == null) return '';
        if (typeof context[key] !== 'string' || context[key].trim().length > limit) throw fail(`${key} phải là chuỗi tối đa ${limit} ký tự.`);
        return context[key].trim();
    };
    const subjectId = context.subjectId == null || context.subjectId === '' ? null : Number(context.subjectId);
    if (subjectId !== null && (!Number.isSafeInteger(subjectId) || subjectId <= 0)) throw fail('Môn học của phiên không hợp lệ.');
    const taskId = shortText('taskId', 200);
    const taskSource = taskId ? context.taskSource : null;
    if (taskId && !['PERSONAL', 'EDUX'].includes(taskSource)) throw fail('Nguồn công việc không hợp lệ.');
    const outcome = context.outcome || 'UNRECORDED';
    if (!['DONE', 'CONTINUE', 'UNRECORDED'].includes(outcome)) throw fail('Kết quả phiên học không hợp lệ.');
    if (data.completeTask !== undefined && typeof data.completeTask !== 'boolean') throw fail('completeTask phải là boolean.');
    if (data.completeTask && (!taskId || outcome !== 'DONE')) throw fail('Chỉ hoàn thành công việc khi đã xác nhận đạt mục tiêu.');
    const learningContext = { subjectId, subjectName: shortText('subjectName', 200), taskId, taskSource,
        goal: shortText('goal', 300), outcome, reflection: shortText('reflection', 1000), nextStep: shortText('nextStep', 500) };
    if (context.topic !== undefined) learningContext.topic = shortText('topic', 200);
    if (context.microGoals !== undefined) {
        if (!Array.isArray(context.microGoals) || context.microGoals.length > 5) throw fail('Các bước của phiên tối đa 5 mục tiêu nhỏ.');
        let totalMinutes = 0;
        learningContext.microGoals = context.microGoals.map((step, index) => {
            if (!step || typeof step.title !== 'string' || !step.title.trim() || step.title.trim().length > 180
                || !Number.isInteger(step.minutes) || step.minutes < 1 || typeof step.doneWhen !== 'string' || !step.doneWhen.trim() || step.doneWhen.trim().length > 250
                || typeof step.completed !== 'boolean') throw fail('Mục tiêu nhỏ không hợp lệ.');
            totalMinutes += step.minutes;
            return { id: `step-${index + 1}`, title: step.title.trim(), minutes: step.minutes, doneWhen: step.doneWhen.trim(), completed: step.completed };
        });
        if (totalMinutes > (Number(data.workDurationMinutes) || 25)) throw fail('Tổng thời gian các bước vượt quá thời lượng phiên.');
    }
    return { start, seconds, end, segments, learningContext };
}

function documentMeta(header) {
    try { return JSON.parse(decodeURIComponent(header || '')); }
    catch { throw fail('Thông tin tệp tải lên không hợp lệ.'); }
}

module.exports = { pomodoro, documentMeta };
