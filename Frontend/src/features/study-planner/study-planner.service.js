/**
 * UniStudy CMC - Study Planner Service
 * Quản lý logic đề xuất lịch học, tạo kế hoạch mô phỏng và CRUD kế hoạch học tập.
 */
import { APP_CONFIG } from "../../shared/config/app.config.js";
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
 * Sinh danh sách các buổi học mô phỏng theo thông tin người dùng nhập
 */
export function generateMockSessions(subject, freeSlotKey, targetHours) {
  const slotDef = FREE_SLOT_OPTIONS[freeSlotKey] || FREE_SLOT_OPTIONS.evening;
  const hours = Number(targetHours) || 10;
  
  // Tính số buổi cần xếp (mỗi buổi 2-3h)
  const sessionDuration = slotDef.id === "weekend" ? 3 : 2;
  const sessionCount = Math.max(1, Math.min(slotDef.days.length, Math.round(hours / sessionDuration)));

  const sessionTemplates = [
    { topic: "Lý thuyết cốt lõi & sơ đồ tư duy", tag: "Lý thuyết" },
    { topic: "Thực hành bài tập & giải đề trắc nghiệm", tag: "Thực hành" },
    { topic: "Tổng hợp kiến thức & giải quyết thắc mắc", tag: "Ôn tập" },
    { topic: "Luyện đề thi thử & kiểm tra lại phần sai", tag: "Luyện đề" },
    { topic: "Thực hành chuyên sâu & chuẩn bị bài tập lớn", tag: "Nâng cao" }
  ];

  const sessions = [];
  for (let i = 0; i < sessionCount; i++) {
    const day = slotDef.days[i % slotDef.days.length];
    const template = sessionTemplates[i % sessionTemplates.length];
    sessions.push({
      id: `sess-${i + 1}`,
      day,
      time: slotDef.defaultTime,
      duration: `${sessionDuration} giờ`,
      topic: `${subject}: ${template.topic}`,
      tag: template.tag
    });
  }

  return sessions;
}

/**
 * Gọi phân tích và đề xuất kế hoạch:
 * - Nếu backend AI được cấu hình: kết nối API backend thật.
 * - Nếu ở chế độ mock (chưa kết nối API): tạo kế hoạch mô phỏng, ghi rõ chưa kết nối AI.
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



  // Chế độ mô phỏng (Mock mode) - tạo kế hoạch mô phỏng theo input người dùng
  // Giả lập độ trễ xử lý ngắn để hiển thị loading state
  await new Promise((resolve) => setTimeout(resolve, 350));

  const subject = preferences.subject.trim();
  const freeSlotKey = preferences.freeSlot || "evening";
  const slotDef = FREE_SLOT_OPTIONS[freeSlotKey] || FREE_SLOT_OPTIONS.evening;
  const targetHours = Number(preferences.targetHours) || 10;
  const sessions = generateMockSessions(subject, freeSlotKey, targetHours);

  const planData = {
    title: `Lộ trình ôn tập: ${subject}`,
    subject,
    freeSlot: freeSlotKey,
    freeSlotLabel: slotDef.label,
    targetHours,
    note: preferences.note ? preferences.note.trim() : `Kế hoạch tự học phân bổ ${targetHours}h/tuần vào ${slotDef.label}.`,
    isMock: true,
    statusLabel: "Kế hoạch mô phỏng — chưa kết nối AI",
    sessions
  };

  const savedPlan = addLocalStudyPlan(planData);

  return {
    success: true,
    isMock: true,
    data: savedPlan,
    message: "Đã tạo kế hoạch mô phỏng thành công (Kế hoạch mô phỏng — chưa kết nối AI)."
  };
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
