export function mapExam(row) {
  if (!row) return null;
  const startTime = row.start_time || row.exam_time || row.examTime || "";
  const durationMinutes = Number(row.duration_minutes ?? row.durationMinutes);
  const match = /^(\d{2}):(\d{2})/.exec(startTime);
  let endTime = row.end_time || row.endTime || "";
  if (!endTime && match && Number.isFinite(durationMinutes) && durationMinutes > 0) {
    const endMinutes = Number(match[1]) * 60 + Number(match[2]) + durationMinutes;
    endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  }
  return {
    ...row,
    id: row.exam_id ?? row.id,
    subjectId: row.subject_id ?? row.subjectId,
    subjectName: row.subject_name || "",
    subjectCode: row.subject_code || "",
    examName: row.exam_name || row.examName || "",
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : null,
    examDate: row.exam_date || row.date || "",
    startTime,
    endTime,
    room: row.room || "",
    notes: row.notes || "",
  };
}

export function mapExams(rows = []) {
  return rows.map(mapExam).filter(Boolean);
}

export function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.notification_id ?? row.id,
    title: row.title || "",
    content: row.content || row.message || "",
    type: row.type || "info",
    isRead: row.is_read ?? row.read ?? false,
    createdAt: row.created_at || row.createdAt || "",
    link: row.link || null,
  };
}

export function mapNotifications(rows = []) {
  return rows.map(mapNotification).filter(Boolean);
}

export function mapProgress(progress) {
  if (!progress) return {};
  return {
    totalHours: progress.total_hours ?? progress.totalHours ?? 0,
    studySessions: progress.study_sessions ?? progress.studySessions ?? 0,
    completionRate: progress.completion_rate ?? progress.completionRate ?? 0,
    documentsOpened: progress.documents_opened ?? progress.documentsOpened ?? 0,
    dailyHours: progress.daily_hours ?? progress.dailyHours ?? [],
    subjectProgress:
      progress.subject_progress ?? progress.subjectProgress ?? [],
    timeAllocation: progress.time_allocation ?? progress.timeAllocation ?? [],
  };
}

export function mapCourse(course) {
  if (!course) return null;
  return {
    id: course.id,
    subject: course.subject || "",
    subjectCode: course.subject_code || "",
    chapters: course.chapters || [],
    cards: course.cards || [],
    summary: course.summary || {},
  };
}

export function mapCourses(rows = []) {
  return rows.map(mapCourse).filter(Boolean);
}

export function mapDocument(doc) {
  if (!doc) return null;
  return {
    id: doc.document_id ?? doc.id,
    title: doc.title || "",
    type: doc.type || "pdf",
    size: doc.size || 0,
    url: doc.url || doc.file_url || "",
    uploadedAt: doc.uploaded_at || doc.uploadedAt || "",
    subject: doc.subject || "",
    tags: doc.tags || [],
  };
}

export function mapDocuments(rows = []) {
  return rows.map(mapDocument).filter(Boolean);
}
