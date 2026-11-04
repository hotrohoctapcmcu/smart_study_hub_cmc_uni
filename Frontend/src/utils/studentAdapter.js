export function mapStudent(profile) {
  if (!profile) return {};
  const studentCode = profile.student_code || profile.studentCode || "";
  const encodedYear = String(studentCode).trim().match(/^B[A-Z]{2}(\d{2})\d{4}$/i);
  const cohort = encodedYear ? `Khóa ${2000 + Number(encodedYear[1])}`
    : profile.cohort || (profile.enrollment_year ? `Khóa ${profile.enrollment_year}` : "");
  return {
    fullName: profile.full_name || profile.fullName || profile.name || "",
    studentCode,
    className: profile.class_name || profile.className || "",
    email: profile.email || "",
    avatar: profile.avatar_url || profile.avatarUrl || profile.avatar || null,
    major: profile.major || "",
    phone: profile.phone || "",
    school: profile.school || "",
    faculty: profile.faculty || profile.department || "",
    cohort,
    dateOfBirth: profile.dob || profile.date_of_birth || profile.dateOfBirth || "",
    gender: profile.gender || "",
    address: profile.address || "",
    slogan: profile.slogan || "",
    completedCredits: profile.total_passed_credits ?? profile.total_credits_earned ?? profile.completed_credits ?? profile.completedCredits ?? null,
    totalCredits: profile.total_program_credits ?? profile.totalCredits ?? null,
    requiredCredits: profile.required_program_credits ?? null,
    availableBlockCredits: profile.available_block_credits ?? null,
    blockEarnedCredits: profile.block_earned_credits ?? null,
    programName: profile.program_name || '',
    curriculumSyncedAt: profile.curriculum_synced_at || null,
    academicSummary: profile.academic_summary ?? profile.academicSummary ?? null,
    gpa10: profile.gpa_10_scale ?? null,
    gpa4: profile.gpa_4_scale ?? null,
  };
}

export function mapGrades(grades = []) {
  return grades.map((g) => ({
    id: g.grade_id ?? g.id ?? g.subject_id,
    subjectId: g.subject_id ?? g.subjectId,
    subject: g.subject_name || g.subjectName || g.subject || "",
    subjectCode: g.subject_code || g.subjectCode || "",
    score: g.final_score ?? g.score ?? g.diem ?? null,
    grade: g.letter_grade || g.grade || "",
    semester: g.hocKy || g.semester || g.hoc_ky || "",
    academicYear: g.academic_year || g.academicYear || "",
    credits: g.credits ?? g.credit ?? null,
    score4: g.score_4 ?? g.score4 ?? null,
    passed: g.is_passed ?? g.passed ?? null,
    attempt: g.attempt_number ?? g.attempt ?? 1,
  }));
}

export function mapSubjects(subjects = []) {
  return subjects.map((s) => ({
    id: s.id || s.subject_id,
    name: s.subject_name || s.subjectName || s.name || s.subject || "",
    code: s.subject_code || s.subjectCode || s.code || "",
    credit: s.credits ?? s.credit ?? s.soTinChi ?? null,
    instructor: s.lecturer_name || s.instructor || s.teacher || "",
    semester: s.semester || "",
    status: s.status || "",
    progress: s.progress ?? null,
    block: s.block_name || '',
    blockCode: s.block_code || '',
    portalStatus: s.portal_status || '',
  }));
}
