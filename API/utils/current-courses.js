'use strict';

// Timetable is the authority. Joined EDUX subjects include previous semesters.
const text = value => String(value ?? '').trim();
const normalized = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[_\s]+/g, ' ');
const realCode = value => /^(?:SUB|MON)_\d+$/i.test(text(value)) ? '' : normalized(value);
const withoutCohort = value => value.replace(/\s*(?:[-–—]\s*k(?:hoa)?\s*\d+|\(\s*k(?:hoa)?\s*\d+\s*\))\s*$/, '').trim();
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value).slice(0, 10)) ? text(value).slice(0, 10) : '';
const vietnamToday = now => new Date(new Date(now).getTime() + 7 * 3600000).toISOString().slice(0, 10);

function matchCourse(scope, item = {}) {
    if (!scope?.resolved) return null;
    const code = realCode(item.subjectCode ?? item.subject_code ?? item.ma_mon);
    const name = normalized(item.subjectName ?? item.subject_name ?? item.name ?? item.subject ?? item.ten_mon);
    // External EDUX UUIDs must never be compared to internal SQLite subject ids.
    const exact = scope.courses.find(course => code && realCode(course.subjectCode) === code) ||
        scope.courses.find(course => name && normalized(course.subjectName) === name);
    if (exact) return exact;
    // EDUX can suffix a course with its cohort, e.g. "Công nghệ phần mềm - K4",
    // while IU uses the base name. Ignore only this explicit cohort annotation;
    // different topics, advanced courses and different named cohorts stay apart.
    const base = withoutCohort(name);
    const candidates = scope.courses.filter(course => {
        const courseName = normalized(course.subjectName);
        return base && withoutCohort(courseName) === base && (name === base || courseName === base);
    });
    return candidates.length === 1 ? candidates[0] : null;
}

async function getCurrentCourseScope(db, userId, { now = new Date() } = {}) {
    const empty = { resolved: false, semester: null, academicYear: null, courses: [],
        message: 'Chưa xác định được môn đang học. Hãy đồng bộ thời khóa biểu IU.' };
    if (typeof db?.layThoiKhoaBieu !== 'function') return empty;
    const rows = (await db.layThoiKhoaBieu(userId) || []).filter(row =>
        (!row.source || row.source === 'IU') && date(row.start_date) && date(row.end_date));
    if (!rows.length) return empty;
    const today = vietnamToday(now);
    const day = new Date(`${today}T00:00:00Z`);
    const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
    const sunday = new Date(Date.parse(`${monday}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
    const groups = new Map();
    for (const row of rows) {
        const semester = text(row.semester), academicYear = text(row.academic_year);
        if (!semester || !academicYear) continue;
        const key = `${academicYear}|${semester}`;
        const group = groups.get(key) || { semester, academicYear, rows: [], start: '9999-99-99', end: '' };
        group.rows.push(row);
        group.start = [group.start, date(row.start_date)].sort()[0];
        group.end = [group.end, date(row.end_date)].sort().at(-1);
        groups.set(key, group);
    }
    // Latest starting term wins when the portal supplies overlapping term ranges.
    const term = [...groups.values()].filter(group => group.start <= sunday && group.end >= monday)
        .sort((a, b) => b.start.localeCompare(a.start))[0];
    let chosen;
    if (term) chosen = term.rows;
    else {
        // Legacy IU rows are individual lesson dates. Aggregate by subject so a
        // weekend or a day without classes does not hide an ongoing course.
        const ranges = new Map();
        for (const row of rows.filter(item => !text(item.semester) || !text(item.academic_year))) {
            const key = row.subject_id ?? (realCode(row.subject_code) || normalized(row.subject_name));
            const range = ranges.get(key) || { start: '9999-99-99', end: '', rows: [] };
            range.start = [range.start, date(row.start_date)].sort()[0];
            range.end = [range.end, date(row.end_date)].sort().at(-1);
            range.rows.push(row); ranges.set(key, range);
        }
        chosen = [...ranges.values()].filter(range => range.start <= sunday && range.end >= monday).flatMap(range => range.rows);
    }
    const courses = [...new Map(chosen.map(row => [String(row.subject_id ?? row.subject_code ?? row.subject_name), {
        subjectId: row.subject_id ?? null, subjectCode: text(row.subject_code), subjectName: text(row.subject_name)
    }])).values()].filter(course => course.subjectName || course.subjectCode)
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'vi'));
    return { resolved: true, semester: term?.semester || null, academicYear: term?.academicYear || null,
        courses, message: courses.length ? 'Các môn đang học theo thời khóa biểu hiện tại.' : 'Tuần này chưa có môn học trong thời khóa biểu.' };
}

module.exports = { getCurrentCourseScope, matchCourse };
