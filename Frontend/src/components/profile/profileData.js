export const asNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const subjectKey = (row) => String(row.subjectCode || row.code || row.subjectId || row.id || row.subject || row.name);
export const isPassed = (grade) => ['F', 'NP'].includes(grade.grade) ? false : grade.grade === 'P' ? true
  : grade.passed !== null && grade.passed !== undefined ? Boolean(Number(grade.passed))
    : asNumber(grade.score) !== null && Number(grade.score) >= 4;

export function getScoreTone(score) {
  const value = asNumber(score);
  return value === null ? "pending" : value >= 8 ? "great" : value >= 6.5 ? "good" : value >= 5 ? "average" : "risk";
}

function weightedGpa(grades) {
  const scored = grades.filter((grade) => !['P', 'NP'].includes(grade.grade) && asNumber(grade.score) !== null);
  if (!scored.length) return null;
  const hasAllCredits = scored.every((grade) => asNumber(grade.credits) > 0);
  const weight = (grade) => hasAllCredits ? Number(grade.credits) : 1;
  return scored.reduce((total, grade) => total + Number(grade.score) * weight(grade), 0)
    / scored.reduce((total, grade) => total + weight(grade), 0);
}

function latestGradeMap(grades) {
  const latest = new Map();
  grades.forEach((grade) => {
    const key = subjectKey(grade);
    const previous = latest.get(key);
    const term = row => `${row.academicYear || String(row.semester).match(/20\d{2}\D+20\d{2}/)?.[0] || ''} ${String(row.semester).match(/^(\d+)/)?.[1] || row.semester}`;
    const newer = previous && term(grade).localeCompare(term(previous), 'vi', { numeric: true });
    if (!previous || newer > 0 || newer === 0 && Number(grade.attempt || 1) > Number(previous.attempt || 1)) latest.set(key, grade);
  });
  return latest;
}

export function buildStudyStats(grades = [], subjects = [], profile = {}, targetCredits) {
  // Display the backend's shared academic summary; preserve every attempt in the table.
  const latest = latestGradeMap(grades);
  const results = [...latest.values()];
  const completed = results.filter((grade) => asNumber(grade.score) !== null);
  const passed = results.filter(isPassed);
  const summary = profile.academicSummary;
  const gpa = summary ? summary.overall.cumulative10 : asNumber(profile.gpa10) ?? weightedGpa(results.filter(isPassed));
  const gpa4 = summary ? summary.overall.cumulative4 : asNumber(profile.gpa4);
  const uniqueSubjects = new Set([...subjects.map(subjectKey), ...results.map(subjectKey)]);
  const creditByCode = new Map(subjects.map((subject) => [subjectKey(subject), asNumber(subject.credit)]));
  const creditFor = (grade) => {
    const credits = asNumber(grade.credits) ?? creditByCode.get(subjectKey(grade)) ?? null;
    return credits > 0 ? credits : null;
  };
  const creditsKnown = passed.every((grade) => creditFor(grade) !== null);
  const completedCredits = asNumber(profile.completedCredits)
    ?? asNumber(summary?.overall.earnedCredits)
    ?? (creditsKnown ? passed.reduce((total, grade) => total + creditFor(grade), 0) : null);
  const subjectTotal = Math.max(uniqueSubjects.size, summary?.overall.subjectCount || 0);
  const programCredits = asNumber(profile.totalCredits);
  const personalCredits = asNumber(targetCredits);
  const totalCredits = programCredits > 0 ? programCredits : personalCredits > 0 ? personalCredits : null;
  const orderedTerms = buildSemesterRows(grades, summary).filter((term) => term.gpa !== null).sort((a, b) =>
    `${a.academicYear} ${a.semester}`.localeCompare(`${b.academicYear} ${b.semester}`, "vi", { numeric: true }));
  const gpaDelta = summary?.comparison?.average10Delta ?? (orderedTerms.length >= 2 ? orderedTerms.at(-1).gpa - orderedTerms.at(-2).gpa : null);
  return {
    gpa, gpaText: gpa === null ? "—" : gpa.toFixed(2), gpa4, gpa4Text: gpa4 === null ? '—' : gpa4.toFixed(2), gpaDelta,
    academicSummary: summary,
    subjectCompleted: summary?.overall.completedSubjects ?? completed.length, subjectTotal,
    subjectPercent: subjectTotal ? Math.round((summary?.overall.completedSubjects ?? completed.length) / subjectTotal * 100) : 0,
    classification: gpa === null ? "Chưa xếp loại" : gpa >= 9 ? "Xuất sắc" : gpa >= 8 ? "Giỏi" : gpa >= 6.5 ? "Khá" : gpa >= 5 ? "Trung bình" : "Cần cải thiện",
    completedCredits, totalCredits,
    requiredCredits: asNumber(profile.requiredCredits),
    availableBlockCredits: asNumber(profile.availableBlockCredits), blockEarnedCredits: asNumber(profile.blockEarnedCredits),
    creditPercent: totalCredits > 0 && completedCredits !== null ? Math.min(100, Math.round(completedCredits / totalCredits * 100)) : null,
    creditScope: programCredits > 0 ? "chương trình" : personalCredits > 0 ? "chương trình (tự nhập)" : "bảng điểm đã đồng bộ",
    passed: summary?.overall.passedSubjects ?? passed.length,
  };
}

export function buildCourseRows(subjects = [], grades = []) {
  const gradesByCode = latestGradeMap(grades);
  const merged = subjects.map((subject) => ({ subject, grade: gradesByCode.get(subjectKey(subject)) }));
  const knownCodes = new Set(subjects.map(subjectKey));
  grades.forEach((grade) => {
    if (!knownCodes.has(subjectKey(grade))) {
      merged.push({ subject: { id: grade.subjectId || grade.id, name: grade.subject, code: grade.subjectCode, credit: grade.credits }, grade });
      knownCodes.add(subjectKey(grade));
    }
  });
  return merged.map(({ subject, grade }) => {
    const score = grade?.score ?? subject.score ?? null;
    const completed = asNumber(score) !== null || ['P', 'NP'].includes(grade?.grade || subject.grade);
    const status = completed ? isPassed(grade || subject) ? "Đã hoàn thành" : "Chưa đạt"
      : subject.status === "COMPLETED" ? "Đã hoàn thành" : subject.status === "PLANNED" ? "Chưa bắt đầu"
        : subject.status === "DROPPED" ? "Đã hủy" : "Đang học";
    return {
      ...subject, score, status,
      grade: grade?.grade || subject.grade || "",
      semester: grade?.semester || subject.semester || "",
      instructor: subject.instructor || "Chưa cập nhật",
      progress: asNumber(subject.progress) ?? (completed ? 100 : null),
    };
  });
}

export function buildSemesterRows(grades = [], summary) {
  if (summary?.semesters) return summary.semesters.map(row => ({ ...row, subjects: row.subjectCount, credits: row.gradedCredits,
    gpa: row.average10, gpa4: row.average4, passed: row.passedSubjects, failed: row.failedSubjects }));
  const groups = new Map();
  grades.forEach((grade) => {
    const key = `${grade.academicYear || ""}|${grade.semester || "Chưa xác định"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(grade);
  });
  return [...groups.entries()].map(([key, rows]) => ({
    key, semester: rows[0].semester || "Chưa xác định", academicYear: rows[0].academicYear || "",
    subjects: rows.length,
    credits: rows.every((row) => asNumber(row.credits) > 0) ? rows.reduce((total, row) => total + Number(row.credits), 0) : null,
    gpa: weightedGpa(rows), passed: rows.filter(isPassed).length,
    failed: rows.filter((row) => asNumber(row.score) !== null && !isPassed(row)).length,
  }));
}

export function readProfilePreferences(studentCode) {
  try { return JSON.parse(localStorage.getItem(`ssh-profile:${studentCode || "student"}`) || "{}"); }
  catch { return {}; }
}

export function saveProfilePreferences(studentCode, preferences) {
  localStorage.setItem(`ssh-profile:${studentCode || "student"}`, JSON.stringify(preferences));
}
