'use strict';

const GRADE_POINTS = { 'A+': 4, A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0 };
const number = value => value === null || value === undefined || String(value).trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const round = value => value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100;

function gradeTerm(semester, academicYear) {
    const text = String(semester || '').slice(0, 80);
    const yearText = String(academicYear || '').slice(0, 60);
    const year = yearText.match(/(20\d{2})\D+(20\d{2})/) || text.match(/(20\d{2})\D+(20\d{2})/);
    const term = text.match(/(?:h[oọ]c\s*k[ỳy]|hk)\s*(\d+)/i)?.[1] || text.match(/^(\d{1,2})(?:\D|$)/)?.[1] || text;
    return { semester: term.slice(0, 40), academicYear: year ? `${year[1]}-${year[2]}` : yearText.slice(0, 30),
        order: (year ? Number(year[1]) : 0) * 100 + (Number(term) || 0) };
}
function normalizedGrade(row) {
    const term = gradeTerm(row.semester ?? row.hoc_ky, row.academic_year ?? row.academicYear);
    const letter = String(row.letter_grade ?? row.grade ?? '').trim().toUpperCase();
    const score = number(row.final_score ?? row.score);
    const passFail = ['P', 'NP'].includes(letter);
    const explicitPassed = row.is_passed ?? row.passed;
    return { ...term, key: String(row.subject_id ?? row.subjectId ?? row.subject_code ?? row.subjectCode ?? row.grade_id),
        subject: String(row.subject_name ?? row.subject ?? '').slice(0, 120), subjectCode: String(row.subject_code ?? row.subjectCode ?? '').slice(0, 30),
        credits: number(row.credits), score,
        score4: passFail ? null : number(row.score_4 ?? row.score4) ?? GRADE_POINTS[letter] ?? null,
        letter, passFail, completed: passFail || score !== null,
        passed: ['F', 'NP'].includes(letter) ? false : letter === 'P' ? true
            : explicitPassed !== null && explicitPassed !== undefined ? Number(explicitPassed) === 1 : score !== null && score >= 4,
        attempt: number(row.attempt_number ?? row.attempt) ?? 1, examAttempt: number(row.exam_attempt) ?? 1,
        id: number(row.grade_id ?? row.id) ?? 0 };
}
function compare(a, b) { return a.order - b.order || a.attempt - b.attempt || a.examAttempt - b.examAttempt || a.id - b.id; }
function latestBySubject(rows) {
    const selected = new Map();
    for (const row of rows) {
        if (!row.completed) continue;
        const previous = selected.get(row.key);
        if (!previous || compare(row, previous) >= 0) selected.set(row.key, row);
    }
    return [...selected.values()].sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
}
function average(rows, field) {
    if (!rows.length || rows.some(row => !(row.credits > 0) || row[field] === null)) return null;
    const credits = rows.reduce((sum, row) => sum + row.credits, 0);
    return credits ? round(rows.reduce((sum, row) => sum + row[field] * row.credits, 0) / credits) : null;
}
function totals(rows, perSemester = false) {
    const graded = rows.filter(row => !row.passFail && row.score !== null);
    const passed = graded.filter(row => row.passed);
    return {
        // IU's semester recap shows a passed-credit mean on scale 10; its overall
        // "Tong diem" mean includes failed graded credits. Keep these scopes explicit.
        average10: average(perSemester ? passed : graded, 'score'), average4: average(graded, 'score4'),
        cumulative10: average(passed, 'score'), cumulative4: average(passed, 'score4'),
        gradedCredits: graded.reduce((sum, row) => sum + (row.credits || 0), 0),
        earnedCredits: passed.reduce((sum, row) => sum + (row.credits || 0), 0),
        passFailCredits: rows.filter(row => row.passFail && row.passed).reduce((sum, row) => sum + (row.credits || 0), 0),
        subjectCount: rows.length, completedSubjects: rows.filter(row => row.completed).length,
        passedSubjects: rows.filter(row => row.passed).length, failedSubjects: rows.filter(row => !row.passed && row.completed).length
    };
}
function summarizeGrades(grades = []) {
    const all = grades.map(normalizedGrade);
    const latest = latestBySubject(all);
    const groups = new Map();
    for (const row of all) {
        const key = `${row.academicYear}|${row.semester}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    const semesters = [...groups.entries()].map(([key, rows]) => ({ key, semester: rows[0].semester,
        academicYear: rows[0].academicYear, order: rows[0].order, ...totals(latestBySubject(rows), true) })).sort((a, b) => a.order - b.order);
    const histories = new Map();
    for (const row of all.filter(row => !row.passFail && row.score !== null).sort(compare)) {
        if (!histories.has(row.key)) histories.set(row.key, []);
        histories.get(row.key).push(row);
    }
    const retakes = [...histories.values()].filter(rows => rows.length > 1).map(rows => {
        const first = rows[0], last = rows.at(-1);
        return { subject: last.subject, subjectCode: last.subjectCode,
            previousSemester: `${first.academicYear} HK${first.semester}`.trim(), latestSemester: `${last.academicYear} HK${last.semester}`.trim(),
            previousScore: first.score, latestScore: last.score, improvement: round(last.score - first.score), passed: last.passed };
    });
    const last = semesters.at(-1), previous = semesters.at(-2);
    return { source: 'calculated_from_synced_iu_grades', policy: 'IU: P/NP excluded from GPA; latest completed result per subject; cumulative means use passed graded credits.',
        overall: totals(latest), semesters, retakes,
        comparison: last && previous ? { latestSemester: last.key, previousSemester: previous.key,
            average10Delta: last.average10 === null || previous.average10 === null ? null : round(last.average10 - previous.average10),
            average4Delta: last.average4 === null || previous.average4 === null ? null : round(last.average4 - previous.average4) } : null,
        needsReview: latest.filter(row => !row.passFail && row.score !== null && (!row.passed || row.score < 5.5)).map(row => ({ subject: row.subject,
            subjectCode: row.subjectCode, semester: `${row.academicYear} HK${row.semester}`.trim(), score: row.score, passed: row.passed })),
        gradeCount: grades.length, note: 'Điểm lịch sử là bằng chứng kết quả học tập, không phải kết luận cố định về năng lực. Không suy ra điểm cho môn chưa có kết quả.' };
}

module.exports = { summarizeGrades, gradeTerm, GRADE_POINTS };
