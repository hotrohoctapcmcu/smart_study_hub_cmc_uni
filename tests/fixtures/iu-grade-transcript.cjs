'use strict';
// Numeric regression fixture matching the IU recap supplied in the bug report.
// Names/owners are synthetic; no portal sessions or personal profile data.
const values = [
    ['DB', 4, 5.2, 'D+', 3, 1], ['CODE', 4, 8.4, 'B+', 3, 1],
    ['MATH', 3, 5.2, 'D+', 3, 2], ['SKILLS', 2, 9, 'A+', 3, 1],
    ['OOP', 4, 7, 'B', 3, 1], ['DISCRETE', 3, 0, 'F', 3, 1],
    ['MATH', 3, 0, 'F', 2, 1], ['HISTORY', 2, 4.6, 'D', 2, 1],
    ['PHILOSOPHY', 3, 5.2, 'D+', 2, 1], ['BASICS', 3, 8.6, 'A', 1, 1],
    ['PASS1', 8, 5.3, 'P', 2, 1], ['PASS2', 1, 5.2, 'P', 3, 1],
    ['PASS3', 1, 8.8, 'P', 1, 1], ['PASS4', 1, 6.5, 'P', 1, 1]
];
const points = { 'A+': 4, A: 4, 'B+': 3.5, B: 3, 'D+': 1.5, D: 1, F: 0, P: 0 };
module.exports = values.map(([code, credits, score, letter, semester, attempt], index) => ({
    grade_id: index + 1, student_id: 1, subject_id: code, subject_code: code,
    subject_name: `Subject ${code}`, credits, final_score: score, letter_grade: letter,
    score_4: points[letter], semester: `${semester}_2025_2026`, academic_year: '',
    attempt_number: attempt, is_passed: letter === 'F' ? 0 : 1, source: 'IU'
}));
