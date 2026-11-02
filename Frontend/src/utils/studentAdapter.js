export function mapStudent(profile) {
  if (!profile) return {};
  return {
    fullName: profile.full_name || profile.fullName || profile.name || "",
    studentCode: profile.student_code || profile.studentCode || "",
    className: profile.class_name || profile.className || "",
    email: profile.email || "",
    avatar: profile.avatar_url || profile.avatarUrl || profile.avatar || null,
    major: profile.major || "",
    phone: profile.phone || "",
    school: profile.school || "",
    faculty: profile.faculty || profile.department || "",
    cohort: profile.cohort || (profile.enrollment_year ? `Khóa ${profile.enrollment_year}` : ""),
    dateOfBirth: profile.dob || profile.date_of_birth || profile.dateOfBirth || "",
    gender: profile.gender || "",
    address: profile.address || "",
    slogan: profile.slogan || "",
    completedCredits: profile.total_passed_credits ?? profile.total_credits_earned ?? profile.completed_credits ?? profile.completedCredits ?? null,
    totalCredits: profile.total_program_credits ?? profile.totalCredits ?? null,
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
    passed: g.is_passed ?? g.passed ?? null,
    attempt: g.attempt_number ?? g.attempt ?? 1,
  }));
}

export function mapSubjects(subjects = []) {
  return subjects.map((s) => ({
    id: s.id || s.subject_id,
    name: s.subject_name || s.subjectName || s.name || s.subject || "",
    code: s.subject_code || s.subjectCode || s.code || "",
    credit: s.credits ?? s.credit ?? s.soTinChi ?? 0,
    instructor: s.lecturer_name || s.instructor || s.teacher || "",
    semester: s.semester || "",
    status: s.status || "",
    progress: s.progress ?? null,
  }));
}
