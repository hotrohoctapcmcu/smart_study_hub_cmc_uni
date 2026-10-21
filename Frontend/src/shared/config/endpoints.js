/**
 * UniStudy CMC - API Endpoints Registry
 * Khai báo tập trung method và path theo API Backend Sprint 1
 */
export const ENDPOINTS = {
  // Lịch học & thời khóa biểu
  schedules: {
    list: { method: "GET", path: "/api/v1/schedules" },
    today: { method: "GET", path: "/api/v1/schedules/today" },
    byDate: { method: "GET", path: "/api/v1/schedules/by-date" },
    byWeek: { method: "GET", path: "/api/v1/schedules/by-week" },
    create: { method: "POST", path: "/api/v1/schedules" },
    delete: { method: "DELETE", path: "/api/v1/schedules/:id" },
    checkConflicts: { method: "POST", path: "/api/v1/schedules/conflicts/check" },
    // Lịch tự học (Study Schedules)
    getStudy: { method: "GET", path: "/api/v1/schedules/study" },
    createStudy: { method: "POST", path: "/api/v1/schedules/study" },
    updateStudyStatus: { method: "PATCH", path: "/api/v1/schedules/study/:id/status" },
    deleteStudy: { method: "DELETE", path: "/api/v1/schedules/study/:id" },
    freeSlots: { method: "GET", path: "/api/v1/schedules/study/free-slots" }
  },
  // Công việc & Deadline
  tasks: {
    list: { method: "GET", path: "/api/v1/tasks" },
    upcoming: { method: "GET", path: "/api/v1/tasks/upcoming" },
    create: { method: "POST", path: "/api/v1/tasks" },
    update: { method: "PUT", path: "/api/v1/tasks/:id" },
    delete: { method: "DELETE", path: "/api/v1/tasks/:id" },
    updateStatus: { method: "PATCH", path: "/api/v1/tasks/:id/status" },
    getAllChecklist: { method: "GET", path: "/api/v1/tasks/checklist" },
    getChecklist: { method: "GET", path: "/api/v1/tasks/:taskId/checklist" },
    addChecklistItem: { method: "POST", path: "/api/v1/tasks/:taskId/checklist" },
    updateChecklistItem: { method: "PUT", path: "/api/v1/tasks/checklist/:itemId" },
    toggleChecklistItem: { method: "PATCH", path: "/api/v1/tasks/checklist/:itemId/done" },
    deleteChecklistItem: { method: "DELETE", path: "/api/v1/tasks/checklist/:itemId" }
  },
  // Thông báo & Nhắc nhở
  notifications: {
    list: { method: "GET", path: "/api/v1/notifications" },
    unreadCount: { method: "GET", path: "/api/v1/notifications/unread-count" },
    due: { method: "GET", path: "/api/v1/notifications/due" },
    create: { method: "POST", path: "/api/v1/notifications" },
    markRead: { method: "PATCH", path: "/api/v1/notifications/:id/read" },
    delete: { method: "DELETE", path: "/api/v1/notifications/:id" }
  },
  // Kỳ thi & kế hoạch ôn thi
  exams: {
    list: { method: "GET", path: "/api/v1/exams" },
    upcoming: { method: "GET", path: "/api/v1/exams/upcoming" },
    create: { method: "POST", path: "/api/v1/exams" },
    delete: { method: "DELETE", path: "/api/v1/exams/:id" },
    studyPlans: { method: "GET", path: "/api/v1/exams/study-plans" },
    createStudyPlan: { method: "POST", path: "/api/v1/exams/study-plans" },
    updateStudyPlanStatus: { method: "PATCH", path: "/api/v1/exams/study-plans/:id/status" },
    deleteStudyPlan: { method: "DELETE", path: "/api/v1/exams/study-plans/:id" }
  },
  // Hồ sơ sinh viên & Bảng điểm
  student: {
    getProfile: { method: "GET", path: "/api/v1/student/profile" },
    updateProfile: { method: "PUT", path: "/api/v1/student/profile" },
    getGrades: { method: "GET", path: "/api/v1/student/grades" },
    getSubjects: { method: "GET", path: "/api/v1/student/subjects" }
  },
  // Đồng bộ dữ liệu trường
  sync: {
    getSources: { method: "GET", path: "/api/v1/sync/sources" },
    startSync: { method: "POST", path: "/api/v1/sync" },
    getStatus: { method: "GET", path: "/api/v1/sync/status" },
    iuSaveSession: { method: "POST", path: "/api/v1/sync/iu/session" },
    iuPull: { method: "POST", path: "/api/v1/sync/iu/pull" },
    iuGroup: { method: "POST", path: "/api/v1/sync/iu/group" },
    iuStatus: { method: "GET", path: "/api/v1/sync/iu/status" }
  },
  // Dashboard
  dashboard: {
    get: { method: "GET", path: "/api/v1/dashboard" }
  }
};
