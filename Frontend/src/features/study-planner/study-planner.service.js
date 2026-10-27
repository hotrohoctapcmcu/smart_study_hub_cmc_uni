/**
 * UniStudy CMC - Study Planner Service
 * Đề xuất lịch học bằng AI, xem trước, xác nhận và quản lý thẻ kế hoạch.
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { requestAssistant, getLocalStudyData } from "../ai-tutor/ai-tutor.service.js";
import { fetchStudySchedules } from "../schedule/schedule.service.js";
import { state, addLocalStudyPlan, updateLocalStudyPlan, deleteLocalStudyPlan } from "../../app/state.js";

export const FREE_SLOT_OPTIONS = {
  evening: {
    id: "evening",
    label: "Buổi tối (19:00 – 22:00)",
    days: ["Thứ 2", "Thứ 4", "Thứ 6", "Chủ nhật"],
    defaultTime: "19:30 – 21:30"
  },
  morning: {
    id: "morning",
    label: "Buổi sáng (07:30 – 11:30)",
    days: ["Thứ 2", "Thứ 3", "Thứ 5", "Thứ 7"],
    defaultTime: "08:00 – 10:00"
  },
  afternoon: {
    id: "afternoon",
    label: "Buổi chiều (13:30 – 17:30)",
    days: ["Thứ 3", "Thứ 5", "Thứ 6", "Thứ 7"],
    defaultTime: "14:00 – 16:00"
  },
  weekend: {
    id: "weekend",
    label: "Cuối tuần (Thứ 7, CN)",
    days: ["Thứ 7 (Sáng)", "Thứ 7 (Chiều)", "Chủ nhật (Sáng)", "Chủ nhật (Chiều)"],
    defaultTime: "08:30 – 11:30"
  }
};

/**
 * Kiểm tra dữ liệu đầu vào của biểu mẫu đề xuất kế hoạch
 */
export function validatePlannerInput(preferences = {}) {
  const errors = [];
  const subject = preferences.subject ? preferences.subject.trim() : "";
  const targetHours = Number(preferences.targetHours);

  if (!subject) {
    errors.push("Vui lòng nhập môn học ưu tiên cần ôn tập.");
  } else if (subject.length < 2) {
    errors.push("Tên môn học phải có ít nhất 2 ký tự.");
  }

  if (isNaN(targetHours) || targetHours <= 0) {
    errors.push("Mục tiêu số giờ học mỗi tuần phải lớn hơn 0.");
  } else if (targetHours > 50) {
    errors.push("Mục tiêu số giờ học mỗi tuần không vượt quá 50 giờ.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Lấy bản xem trước từ AI thật; chỉ lưu lịch sau khi người học xác nhận.
 */
export async function generateAIStudySchedule(preferences = {}) {
  const validation = validatePlannerInput(preferences);
  if (!validation.isValid) {
    return {
      success: false,
      validationError: true,
      errors: validation.errors,
      message: validation.errors[0]
    };
  }
  const subject = preferences.subject.trim();
  const freeSlotKey = preferences.freeSlot || "evening";
  const slotDef = FREE_SLOT_OPTIONS[freeSlotKey] || FREE_SLOT_OPTIONS.evening;
  const targetHours = Number(preferences.targetHours) || 10;
  const windows = {
    evening: ["19:00", "22:00"], morning: ["07:30", "11:30"],
    afternoon: ["13:30", "17:30"], weekend: ["07:00", "22:00"]
  };
  const [freeStartTime, freeEndTime] = windows[freeSlotKey] || windows.evening;
  const startDate = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const endDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  const response = await requestAssistant(ENDPOINTS.ai.plan, {
    subject, startDate, endDate, freeStartTime, freeEndTime, targetHours,
    durationMinutes: 120, ...(freeSlotKey === "weekend" ? { daysOfWeek: [7, 8] } : {}),
    studyData: getLocalStudyData()
  });
  if (!response.success) return response;
  const proposed = response.data?.sessions || [];
  if (!proposed.length) return { success: false, message: response.data?.message || "Chưa có buổi học phù hợp. Hãy chọn khung giờ khác." };
  const sessions = proposed.map(session => ({
    ...session, day: session.date, time: `${session.start} – ${session.end}`,
    duration: `${session.durationMinutes} phút`, topic: session.title, tag: "AI đề xuất"
  }));

  const planData = {
    title: `Lộ trình ôn tập: ${subject}`,
    subject,
    freeSlot: freeSlotKey,
    freeSlotLabel: slotDef.label,
    targetHours,
    note: preferences.note ? preferences.note.trim() : `Kế hoạch tự học phân bổ ${targetHours}h/tuần vào ${slotDef.label}.`,
    statusLabel: "Kế hoạch học tập đề xuất",
    sessions
  };

  const savedPlan = addLocalStudyPlan(planData);
  updateLocalStudyPlan(savedPlan.id, { isMock: false, preview: true, persisted: false });

  return {
    success: true,
    data: getStudyPlanById(savedPlan.id),
    message: "Đã tạo bản xem trước. Hãy xác nhận để lưu vào lịch tự học."
  };
}

export async function confirmStudyPlan(planId) {
  const plan = getStudyPlanById(planId);
  if (!plan || plan.isMock) return { success: false, message: "Hãy tạo lại kế hoạch bằng AI trước khi xác nhận." };
  if (plan.persisted) return { success: true, data: plan };
  const response = await requestAssistant(ENDPOINTS.ai.confirmPlan, {
    confirmed: true, sessions: plan.sessions
  });
  if (!response.success) return response;
  updateLocalStudyPlan(planId, { preview: false, persisted: true, statusLabel: "Đã lưu vào lịch tự học" });
  try { await fetchStudySchedules(); } catch { /* Lịch đã lưu; tải lại ở trang Thời khóa biểu. */ }
  return { success: true, data: getStudyPlanById(planId) };
}

/**
 * Lấy toàn bộ danh sách kế hoạch học tập hiện có
 */
export function getStudyPlans() {
  return state.studyPlans || [];
}

/**
 * Lấy chi tiết một kế hoạch học tập theo ID
 */
export function getStudyPlanById(planId) {
  return (state.studyPlans || []).find((p) => p.id === planId) || null;
}

/**
 * Cập nhật một kế hoạch học tập
 */
export function updateStudyPlan(planId, updates) {
  return updateLocalStudyPlan(planId, updates);
}

/**
 * Xóa một kế hoạch học tập
 */
export function deleteStudyPlan(planId) {
  deleteLocalStudyPlan(planId);
}
