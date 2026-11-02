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
    return { start, seconds, end, segments };
}

function documentMeta(header) {
    try { return JSON.parse(decodeURIComponent(header || '')); }
    catch { throw fail('Thông tin tệp tải lên không hợp lệ.'); }
}

module.exports = { pomodoro, documentMeta };
