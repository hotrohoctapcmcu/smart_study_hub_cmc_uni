/**
 * UniStudy CMC - Exams Service
 * Interface dịch vụ theo API Backend Sprint 1
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { state, notifyStateChange } from "../../app/state.js";
import { getStudentSubjects } from "../tasks/tasks.service.js";

/**
 * Mã môn do hệ thống tự sinh (không phải mã thật của trường) — vd "SUB_123",
 * "MON_456". Hiển thị mã này chỉ gây khó hiểu nên UI bỏ qua.
 */
export function isGeneratedSubjectCode(code) {
  return /^(SUB|MON)_\d+$/i.test(String(code || "").trim());
}

/**
 * Chuẩn hóa 1 bản ghi kỳ thi từ backend thành đối tượng UI
 */
export function mapExamFromBackend(e) {
  const examId = Number(e.exam_id ?? e.id);
  const rawDate = e.exam_date ? String(e.exam_date).slice(0, 10) : "";
  const rawTime = e.exam_time ? String(e.exam_time).slice(0, 5) : "08:00";
  const code = isGeneratedSubjectCode(e.subject_code) ? "" : (e.subject_code || "");

  return {
    id: `exam-${examId}`,
    examId,
    subject: e.subject_name || code || "Kỳ thi",
    code,
    subjectId: e.subject_id,
    date: rawDate,
    start: rawTime,
    duration: Number(e.duration_minutes) || 90,
    room: e.room || "Chưa xếp phòng",
    scope: e.exam_format || e.notes || "",
    source: "Trường",
    isLocalDraft: false,
    studyMilestones: []
  };
}

/**
 * Tải danh sách kỳ thi từ Backend API và cập nhật vào state.exams
 */
export async function fetchExamsFromApi() {
  const res = await apiRequest(ENDPOINTS.exams.list);
  if (!res.success) {
    if (res.unavailable) return state.exams;
    throw new Error(res.error || "Không thể tải danh sách kỳ thi từ máy chủ.");
  }

  const rows = res.data?.data ?? res.data ?? [];
  if (Array.isArray(rows)) {
    state.exams = rows.map(mapExamFromBackend);
    notifyStateChange();
    return state.exams;
  }
  return state.exams;
}

/**
 * Tạo kỳ thi mới trên Backend API
 */
export async function createExamApi(examData) {
  let subjectId = examData.subjectId;
  if (!subjectId) {
    try {
      const subjects = await getStudentSubjects();
      if (subjects.length > 0) {
        const query = (examData.subject || "").toLowerCase();
        const codeQuery = (examData.code || "").toLowerCase();
        const found = subjects.find(
          (s) =>
            (codeQuery && s.subject_code && s.subject_code.toLowerCase() === codeQuery) ||
            (s.subject_name && s.subject_name.toLowerCase().includes(query))
        );
        subjectId = found ? found.subject_id : subjects[0].subject_id;
      }
    } catch {
      subjectId = 1;
    }
  }

  const payload = {
    subjectId: Number(subjectId) || 1,
    examDate: examData.date,
    examTime: examData.start || "08:00",
    room: examData.room || "Chưa xếp phòng",
    durationMinutes: Number(examData.duration) || 90,
    examFormat: examData.scope || ""
  };

  const res = await apiRequest(ENDPOINTS.exams.create, { body: payload });
  if (!res.success) {
    throw new Error(res.error || "Lỗi tạo kỳ thi trên máy chủ.");
  }

  await fetchExamsFromApi();
  return res.data;
}

/**
 * Xóa kỳ thi trên Backend API
 */
export async function deleteExamApi(examId) {
  const numericId = String(examId).replace(/^exam-(school-)?/, "");
  if (numericId && !isNaN(Number(numericId))) {
    const res = await apiRequest(ENDPOINTS.exams.delete, {
      params: { id: numericId }
    });
    if (!res.success) {
      throw new Error(res.error || "Lỗi xóa kỳ thi trên máy chủ.");
    }
    await fetchExamsFromApi();
    return true;
  }
  return false;
}


/**
 * Cập nhật kỳ thi đã có trên Backend API.
 * Chỉ gọi được với kỳ thi đã lưu ở server (có examId số); kỳ thi nháp cục bộ
 * vẫn chỉ sửa trong state.
 */
export async function updateExamApi(examData) {
  const numericId = String(examData.examId ?? examData.id ?? "").replace(/^exam-/, "");
  if (!numericId || isNaN(Number(numericId))) return false;

  const payload = {};
  if (examData.subject !== undefined) payload.subjectId = examData.subjectId;
  if (examData.date !== undefined) payload.examDate = examData.date;
  if (examData.start !== undefined) payload.examTime = examData.start;
  if (examData.room !== undefined) payload.room = examData.room;
  if (examData.duration !== undefined) payload.durationMinutes = Number(examData.duration) || 90;
  if (examData.scope !== undefined) payload.examFormat = examData.scope;

  // subjectId rỗng sẽ làm backend bỏ qua (COALESCE) — không gửi null.
  if (!payload.subjectId) delete payload.subjectId;

  const res = await apiRequest(ENDPOINTS.exams.update, {
    params: { id: numericId },
    body: payload
  });
  if (!res.success) {
    throw new Error(res.error || "Lỗi cập nhật kỳ thi trên máy chủ.");
  }
  await fetchExamsFromApi();
  return true;
}
