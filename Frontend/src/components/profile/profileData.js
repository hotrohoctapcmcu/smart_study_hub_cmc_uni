export const asNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const subjectKey = (row) => String(row.subjectCode || row.code || row.subjectId || row.id || row.subject || row.name);
export const isPassed = (grade) => grade.passed !== null && grade.passed !== undefined
  ? Boolean(Number(grade.passed))
  : asNumber(grade.score) !== null && Number(grade.score) >= 5;

export function getScoreTone(score) {
  const value = asNumber(score);
  return value === null ? "pending" : value >= 8 ? "great" : value >= 6.5 ? "good" : value >= 5 ? "average" : "risk";
}

function weightedGpa(grades) {
  const scored = grades.filter((grade) => asNumber(grade.score) !== null);
  if (!scored.length) return null;
  const hasAllCredits = scored.every((grade) => asNumber(grade.credits) > 0);
  const weight = (grade) => hasAllCredits ? Number(grade.credits) : 1;
  return scored.reduce((total, grade) => total + Number(grade.score) * weight(grade), 0)
    / scored.reduce((total, grade) => total + weight(grade), 0);
}

export function buildStudyStats(grades = [], subjects = [], profile = {}, targetCredits) {
  // Accumulated statistics use one result per subject; the table retains every attempt.
  const latest = new Map();
  grades.forEach((grade) => {
    const key = subjectKey(grade);
    const previous = latest.get(key);
    if (!previous || Number(grade.attempt || 1) > Number(previous.attempt || 1)) latest.set(key, grade);
  });
  const results = [...latest.values()];
  const completed = results.filter((grade) => asNumber(grade.score) !== null);
  const passed = results.filter(isPassed);
  const gpa = weightedGpa(results);
  const uniqueSubjects = new Set([...subjects.map(subjectKey), ...results.map(subjectKey)]);
  const creditByCode = new Map(subjects.map((subject) => [subjectKey(subject), asNumber(subject.credit)]));
  const creditFor = (grade) => {
    const credits = asNumber(grade.credits) ?? creditByCode.get(subjectKey(grade)) ?? null;
    return credits > 0 ? credits : null;
  };
  const creditsKnown = passed.every((grade) => creditFor(grade) !== null);
  const completedCredits = asNumber(profile.completedCredits)
    ?? (creditsKnown ? passed.reduce((total, grade) => total + creditFor(grade), 0) : null);
  const registeredCredits = subjects.length && subjects.every((subject) => asNumber(subject.credit) > 0)
    ? subjects.reduce((total, subject) => total + Number(subject.credit), 0)
    : results.length && results.every((grade) => creditFor(grade) > 0)
      ? results.reduce((total, grade) => total + creditFor(grade), 0) : null;
  const totalCredits = asNumber(targetCredits) ?? asNumber(profile.totalCredits) ?? registeredCredits;
  const orderedTerms = buildSemesterRows(grades).filter((term) => term.gpa !== null).sort((a, b) =>
    `${a.academicYear} ${a.semester}`.localeCompare(`${b.academicYear} ${b.semester}`, "vi", { numeric: true }));
  const gpaDelta = orderedTerms.length >= 2 ? orderedTerms.at(-1).gpa - orderedTerms.at(-2).gpa : null;
  return {
    gpa, gpaText: gpa === null ? "—" : gpa.toFixed(1), gpaDelta,
    subjectCompleted: completed.length, subjectTotal: uniqueSubjects.size,
    subjectPercent: uniqueSubjects.size ? Math.round(completed.length / uniqueSubjects.size * 100) : 0,
    classification: gpa === null ? "Chưa xếp loại" : gpa >= 9 ? "Xuất sắc" : gpa >= 8 ? "Giỏi" : gpa >= 6.5 ? "Khá" : gpa >= 5 ? "Trung bình" : "Cần cải thiện",
    completedCredits, totalCredits,
    creditPercent: totalCredits > 0 && completedCredits !== null ? Math.min(100, Math.round(completedCredits / totalCredits * 100)) : null,
    creditScope: targetCredits || profile.totalCredits ? "chương trình" : "tín chỉ đã đồng bộ",
    passed: passed.length,
  };
}

export function buildCourseRows(subjects = [], grades = []) {
  const gradesByCode = new Map(grades.map((grade) => [subjectKey(grade), grade]));
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
    const completed = asNumber(score) !== null;
    const status = completed ? "Đã hoàn thành" : subject.status === "PLANNED" ? "Chưa bắt đầu" : "Đang học";
    return {
      ...subject, score, status,
      grade: grade?.grade || subject.grade || "",
      semester: grade?.semester || subject.semester || "",
      instructor: subject.instructor || "Chưa cập nhật",
      progress: asNumber(subject.progress) ?? (completed ? 100 : null),
    };
  });
}

export function buildSemesterRows(grades = []) {
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
