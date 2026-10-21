import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import {
  state,
  addLocalStudySession,
  updateLocalStudySession,
  deleteLocalStudySession,
  notifyStateChange
} from "../../app/state.js";

/**
 * Lấy danh sách lịch học chính khóa từ server
 */
export async function getSchedules() {
  return await apiRequest(ENDPOINTS.schedules.list);
}

/**
 * Chuẩn hóa 1 bản ghi lịch tự học từ Backend thành đối tượng UI
 */
export function mapStudyScheduleFromBackend(s) {
  const scheduleId = Number(s.schedule_id ?? s.id);
  const rawDate = s.study_date ? String(s.study_date).slice(0, 10) : "";
  const rawStart = s.start_time ? String(s.start_time).slice(0, 5) : "08:00";
  const rawEnd = s.end_time ? String(s.end_time).slice(0, 5) : "10:00";

  return {
    id: `study-${scheduleId}`,
    scheduleId,
    title: s.title || "Tự học",
    subject: s.subject_name || s.subject_code || "Tự học",
    subjectId: s.subject_id,
    date: rawDate,
    start: rawStart,
    end: rawEnd,
    note: s.notes || "",
    source: "Tự thêm",
    isLocalDraft: false
  };
}

/**
 * Tải danh sách lịch tự học từ Backend và nạp vào state.studyEvents
 */
export async function fetchStudySchedules() {
  const res = await apiRequest(ENDPOINTS.schedules.getStudy);
  if (!res.success) {
    if (res.unavailable) return state.studyEvents;
    throw new Error(res.error || "Không thể lấy lịch tự học từ máy chủ.");
  }
  const rows = res.data?.data ?? res.data ?? [];
  if (Array.isArray(rows)) {
    state.studyEvents = rows.map(mapStudyScheduleFromBackend);
    notifyStateChange();
    return state.studyEvents;
  }
  return state.studyEvents;
}

/**
 * Thêm mới lịch tự học và lưu lên Backend API
 */
export async function createSelfStudy(sessionData) {
  // Cập nhật optimistic local trước
  const localEvent = addLocalStudySession(sessionData);

  const payload = {
    title: sessionData.title || "Tự học",
    studyDate: sessionData.date,
    startTime: sessionData.start,
    endTime: sessionData.end,
    subjectId: sessionData.subjectId ? Number(sessionData.subjectId) : null,
    notes: sessionData.note || sessionData.notes || "",
    forceSave: 1
  };

  try {
    const res = await apiRequest(ENDPOINTS.schedules.createStudy, { body: payload });
    if (res.success) {
      await fetchStudySchedules();
    }
  } catch (err) {
    console.warn("[Schedule] Lỗi lưu lịch tự học lên server:", err);
  }

  return localEvent;
}

/**
 * Cập nhật lịch tự học theo ID
 */
export async function updateSelfStudy(id, changes) {
  const updated = updateLocalStudySession(id, changes);
  return updated;
}

/**
 * Xóa lịch tự học theo ID và xóa trên Backend API
 */
export async function deleteSelfStudy(id) {
  deleteLocalStudySession(id);

  const numericId = String(id).replace(/^study-/, "");
  if (numericId && !isNaN(Number(numericId))) {
    try {
      await apiRequest(ENDPOINTS.schedules.deleteStudy, {
        params: { id: numericId }
      });
      await fetchStudySchedules();
    } catch (err) {
      console.warn("[Schedule] Lỗi xóa lịch tự học trên server:", err);
    }
  }
  return true;
}

/**
 * Gửi yêu cầu kiểm tra xung đột lên server
 */
export async function checkScheduleConflicts(studyDate, startTime, endTime, excludeScheduleId = null) {
  return await apiRequest(ENDPOINTS.schedules.checkConflicts, {
    body: {
      studyDate,
      startTime,
      endTime,
      excludeScheduleId
    }
  });
}

