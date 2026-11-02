'use strict';

function sessionSegments(row) {
    let segments;
    try { segments = JSON.parse(row.focus_segments || 'null'); } catch { segments = null; }
    if (Array.isArray(segments) && segments.length) return segments.map(segment => [Date.parse(segment.start), Date.parse(segment.end)]).filter(([a, b]) => Number.isFinite(a) && b > a);
    const start = Date.parse(row.started_at);
    const seconds = row.actual_study_seconds ?? Number(row.total_focus_minutes || 0) * 60;
    return Number.isFinite(start) && seconds > 0 ? [[start, start + seconds * 1000]] : [];
}

function unionMilliseconds(intervals, from = -Infinity, to = Infinity) {
    const sorted = intervals.map(([a, b]) => [Math.max(a, from), Math.min(b, to)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let total = 0, end = -Infinity;
    for (const [a, b] of sorted) { total += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
    return total;
}

function requestedRange(from, to) {
    if (!from && !to) return null;
    const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!valid(from) || !valid(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) throw Object.assign(new Error('Khoảng ngày phải hợp lệ, tối đa 366 ngày.'), { statusCode: 400 });
    return { startDate: from, endDate: new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10) };
}

module.exports = { sessionSegments, unionMilliseconds, requestedRange };
