'use strict';

function enrollmentYearFromCode(studentCode) {
    // CMC undergraduate code: B + two-letter major + YY + four-digit sequence.
    const match = String(studentCode ?? '').trim().match(/^B[A-Z]{2}(\d{2})\d{4}$/i);
    return match ? 2000 + Number(match[1]) : null;
}

function resolveEnrollmentYear(studentCode, suppliedYear) {
    const encodedYear = enrollmentYearFromCode(studentCode);
    if (encodedYear !== null) return encodedYear;
    const year = /^\d{4}$/.test(String(suppliedYear ?? '').trim()) ? Number(suppliedYear) : null;
    return year >= 1900 && year <= 2099 ? year : null;
}

module.exports = { enrollmentYearFromCode, resolveEnrollmentYear };
