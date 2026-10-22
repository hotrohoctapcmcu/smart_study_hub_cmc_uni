/**
 * UniStudy CMC - In-Memory Session State
 * Một nguồn dữ liệu phiên duy nhất (Single Source of Truth).
 * Tuyệt đối không seed dữ liệu giả. Dữ liệu thật chỉ đến từ input người dùng hoặc backend sau này.
 */
import { calculateRemainingTime } from "../shared/utils/date.js";
import { getSchoolEmails, markAllSchoolEmailsAsRead } from "../features/school-email/school-email.service.js";
import { resetAiChat } from "../features/ai-tutor/ai-tutor.store.js";

const listeners = new Set();

export const state = {
  // Hồ sơ sinh viên: null nếu chưa đồng bộ thật
  studentProfile: null,

  // Lịch học từ trường (trống khi chưa đồng bộ backend)
  schoolEvents: [],

  // Lịch tự học do người dùng tạo cục bộ
  studyEvents: [],

  // Kế hoạch học tập (Study Plans)
  studyPlans: [],

  // Lựa chọn ưu tiên khi xảy ra xung đột (conflict resolution: { [conflictKey]: "school" | "study" })
  conflictResolutions: {},

  // Công việc & Deadline người dùng tự nhập
  tasks: [],

  // Lịch thi do người dùng tự nhập
  exams: [],

  // Thông báo (sinh từ nhắc deadline cục bộ hoặc thông báo hệ thống)
  notifications: [],

  // Sidebar state
  sidebarCollapsed: false, // true = compact mode (desktop/tablet)
  mobileDrawerOpen: false,

  // Global search input
  searchQuery: "",

  // Mini chat panel
  miniChatOpen: false,

  // Tab Picker modal mở từ dấu +
  tabPickerOpen: false,

  // Active modal name / data
  activeModal: null,

  // Đếm version để trigger re-render
  version: 0
};

/**
 * Đăng ký lắng nghe thay đổi state
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Phát tín hiệu cập nhật state
 */
export function notifyStateChange() {
  state.version++;
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error("Lỗi listener state:", e);
    }
  });
}

/**
 * Đặt lại state khi Đăng xuất (Logout)
 */
export function resetSessionState() {
  state.studentProfile = null;
  state.schoolEvents = [];
  state.studyEvents = [];
  state.studyPlans = [];
  state.conflictResolutions = {};
  state.tasks = [];
  state.exams = [];
  state.notifications = [];
  state.searchQuery = "";
  state.miniChatOpen = false;
  state.tabPickerOpen = false;
  state.activeModal = null;
  try {
    resetAiChat();
  } catch (err) {
    console.warn("[State] Lỗi đặt lại hội thoại trợ lý AI:", err);
  }
  notifyStateChange();
}

/* ============================================================
   MUTATIONS CỤC BỘ — CÔNG VIỆC (TASKS)
============================================================ */

export function addLocalTask(taskData) {
  const newTask = {
    id: `task-local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: taskData.title.trim(),
    subject: taskData.subject?.trim() || "Chưa phân loại",
    due: taskData.due, // "YYYY-MM-DDTHH:mm"
    priority: taskData.priority || "Trung bình", // "Cao" | "Trung bình" | "Thấp"
    status: taskData.status || "Chưa làm", // "Chưa làm" | "Đang làm" | "Hoàn thành"
    checklist: Array.isArray(taskData.checklist) ? taskData.checklist : [],
    isLocalDraft: true,
    createdAt: new Date().toISOString()
  };
  state.tasks.unshift(newTask);
  triggerTaskDeadlineNotifications();
  notifyStateChange();
  return newTask;
}

export function updateLocalTask(taskId, updates) {
  const idx = state.tasks.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    state.tasks[idx] = {
      ...state.tasks[idx],
      ...updates,
      isLocalDraft: true
    };
    triggerTaskDeadlineNotifications();
    notifyStateChange();
    return state.tasks[idx];
  }
  return null;
}

export function deleteLocalTask(taskId) {
  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  // Dọn thông báo liên quan đến task này
  state.notifications = state.notifications.filter((n) => n.relatedTaskId !== taskId);
  notifyStateChange();
}

/* ============================================================
   MUTATIONS CỤC BỘ — LỊCH TỰ HỌC (STUDY EVENTS)
============================================================ */

export function addLocalStudySession(sessionData) {
  const newSession = {
    id: `study-local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: sessionData.title.trim(),
    subject: sessionData.subject?.trim() || "Tự học",
    date: sessionData.date, // "YYYY-MM-DD"
    start: sessionData.start, // "HH:mm"
    end: sessionData.end, // "HH:mm"
    note: sessionData.note?.trim() || "",
    source: "Tự thêm",
    isLocalDraft: true,
    createdAt: new Date().toISOString()
  };
  state.studyEvents.push(newSession);
  notifyStateChange();
  return newSession;
}

export function updateLocalStudySession(sessionId, updates) {
  const idx = state.studyEvents.findIndex((s) => s.id === sessionId);
  if (idx !== -1) {
    state.studyEvents[idx] = {
      ...state.studyEvents[idx],
      ...updates,
      isLocalDraft: true
    };
    notifyStateChange();
    return state.studyEvents[idx];
  }
  return null;
}

export function deleteLocalStudySession(sessionId) {
  state.studyEvents = state.studyEvents.filter((s) => s.id !== sessionId);
  notifyStateChange();
}

/* ============================================================
   MUTATIONS CỤC BỘ — KẾ HOẠCH HỌC TẬP (STUDY PLANS)
============================================================ */

export function addLocalStudyPlan(planData) {
  const newPlan = {
    id: `plan-local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: planData.title?.trim() || `Kế hoạch ôn tập: ${planData.subject.trim()}`,
    subject: planData.subject.trim(),
    freeSlot: planData.freeSlot || "evening",
    freeSlotLabel: planData.freeSlotLabel || "Buổi tối (19:00 – 22:00)",
    targetHours: Number(planData.targetHours) || 10,
    note: planData.note?.trim() || "",
    isMock: true,
    statusLabel: "Kế hoạch học tập đề xuất",
    sessions: Array.isArray(planData.sessions) ? planData.sessions : [],
    createdAt: new Date().toISOString()
  };
  state.studyPlans.unshift(newPlan);
  notifyStateChange();
  return newPlan;
}

export function updateLocalStudyPlan(planId, updates) {
  const idx = state.studyPlans.findIndex((p) => p.id === planId);
  if (idx !== -1) {
    state.studyPlans[idx] = {
      ...state.studyPlans[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    notifyStateChange();
    return state.studyPlans[idx];
  }
  return null;
}

export function deleteLocalStudyPlan(planId) {
  state.studyPlans = state.studyPlans.filter((p) => p.id !== planId);
  notifyStateChange();
}

/* ============================================================
   MUTATIONS CỤC BỘ — KỲ THI (EXAMS)
============================================================ */

export function addLocalExam(examData) {
  const newExam = {
    id: `exam-local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    subject: examData.subject.trim(),
    code: examData.code?.trim() || "",
    date: examData.date, // "YYYY-MM-DD"
    start: examData.start, // "HH:mm"
    duration: parseInt(examData.duration, 10) || 60,
    room: examData.room?.trim() || "Chưa xếp phòng",
    scope: examData.scope?.trim() || "",
    source: "Tự thêm",
    isLocalDraft: true,
    // Lộ trình ôn thi tự tạo
    studyMilestones: Array.isArray(examData.studyMilestones) ? examData.studyMilestones : []
  };
  state.exams.push(newExam);
  notifyStateChange();
  return newExam;
}

export function updateLocalExam(examId, updates) {
  const idx = state.exams.findIndex((e) => e.id === examId);
  if (idx !== -1) {
    state.exams[idx] = {
      ...state.exams[idx],
      ...updates,
      isLocalDraft: true
    };
    notifyStateChange();
    return state.exams[idx];
  }
  return null;
}

export function deleteLocalExam(examId) {
  state.exams = state.exams.filter((e) => e.id !== examId);
  notifyStateChange();
}

/* ============================================================
   MUTATIONS CỤC BỘ — THÔNG BÁO & NHẮC DEADLINE ĐA TẦNG
============================================================ */

/**
 * Tự động tạo thông báo nhắc nhở hạn nộp theo 3 mốc (1 ngày, 3 giờ, 1 giờ)
 * Chống trùng theo Task ID + Phiên bản mốc
 */
export function triggerTaskDeadlineNotifications() {
  const now = new Date();

  state.tasks.forEach((task) => {
    // Không nhắc task đã hoàn thành
    if (task.status === "Hoàn thành" || !task.due) return;

    const dueTime = new Date(task.due);
    if (isNaN(dueTime.getTime())) return;

    const diffHours = (dueTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Mốc 1: Dưới hoặc bằng 24h (1 ngày)
    if (diffHours > 3 && diffHours <= 24) {
      createNotificationIfNotExists(task.id, "24h", {
        type: "deadline",
        title: "Sắp đến hạn trong 24 giờ",
        body: `Công việc "${task.title}" môn ${task.subject} còn khoảng ${Math.ceil(diffHours)} giờ nữa là đến hạn nộp.`,
        relatedTaskId: task.id
      });
    }
    // Mốc 2: Dưới hoặc bằng 3h
    else if (diffHours > 1 && diffHours <= 3) {
      createNotificationIfNotExists(task.id, "3h", {
        type: "deadline",
        title: "Hạn chót: Còn 3 giờ",
        body: `Công việc "${task.title}" môn ${task.subject} sẽ hết hạn trong vòng 3 giờ tới!`,
        relatedTaskId: task.id
      });
    }
    // Mốc 3: Dưới hoặc bằng 1h
    else if (diffHours > 0 && diffHours <= 1) {
      createNotificationIfNotExists(task.id, "1h", {
        type: "deadline",
        title: "CẢNH BÁO GẤP: Còn chưa đầy 1 giờ",
        body: `Công việc "${task.title}" môn ${task.subject} sắp hết hạn nộp bài (${task.due}). Vui lòng hoàn thành ngay!`,
        relatedTaskId: task.id
      });
    }
  });
}

function createNotificationIfNotExists(taskId, milestoneKey, notifData) {
  const key = `${taskId}_${milestoneKey}`;
  const exists = state.notifications.some((n) => n.dedupKey === key);
  if (!exists) {
    state.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      dedupKey: key,
      read: false,
      createdAt: new Date().toISOString(),
      ...notifData
    });
  }
}

export function markNotificationAsRead(notifId) {
  const item = state.notifications.find((n) => n.id === notifId);
  if (item) {
    item.read = true;
    notifyStateChange();
  }
}

export function markAllNotificationsAsRead() {
  state.notifications.forEach((n) => {
    n.read = true;
  });
  try {
    markAllSchoolEmailsAsRead();
  } catch (err) {
    console.warn("[State] Lỗi cập nhật trạng thái email:", err);
  }
  notifyStateChange();
}

/**
 * Đếm số lượng thông báo chưa đọc thật sự (bao gồm thông báo hệ thống và email trường)
 */
export function getUnreadNotificationCount() {
  const notifUnread = state.notifications.filter((n) => !n.read).length;
  let emailUnread = 0;
  try {
    const emails = getSchoolEmails();
    emailUnread = emails.filter((m) => !m.isRead).length;
  } catch {
    emailUnread = 0;
  }
  return notifUnread + emailUnread;
}
