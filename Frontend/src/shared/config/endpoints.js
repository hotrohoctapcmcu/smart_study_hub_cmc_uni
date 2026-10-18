/**
 * UniStudy CMC - API Endpoints Registry
 * Khai báo tập trung method và path theo API_CONTRACT.md & API_FUNCTION_MAP.md
 */
export const ENDPOINTS = {
  // Lịch học & thời khóa biểu
  schedules: {
    list: { method: "GET", path: "/api/v1/schedules" },
    checkConflicts: { method: "POST", path: "/api/v1/schedules/conflicts/check" }
  },
  // Công việc & Deadline
  tasks: {
    list: { method: "GET", path: "/api/v1/tasks" },
    create: { method: "POST", path: "/api/v1/tasks" },
    update: { method: "PUT", path: "/api/v1/tasks/:id" },
    delete: { method: "DELETE", path: "/api/v1/tasks/:id" },
    updateStatus: { method: "PATCH", path: "/api/v1/tasks/:id/status" },
    getChecklist: { method: "GET", path: "/api/v1/tasks/:taskId/checklist" },
    addChecklistItem: { method: "POST", path: "/api/v1/tasks/:taskId/checklist" },
    updateChecklistItem: { method: "PUT", path: "/api/v1/checklist/:itemId" },
    deleteChecklistItem: { method: "DELETE", path: "/api/v1/checklist/:itemId" }
  },
  // Thông báo
  notifications: {
    list: { method: "GET", path: "/api/v1/notifications" },
    unreadCount: { method: "GET", path: "/api/v1/notifications/unread-count" },
    markRead: { method: "PATCH", path: "/api/v1/notifications/:id/read" },
    markAllRead: { method: "PATCH", path: "/api/v1/notifications/read-all" }
  },
  // Kỳ thi & kế hoạch ôn thi
  exams: {
    list: { method: "GET", path: "/api/v1/exams" },
    upcoming: { method: "GET", path: "/api/v1/exams/upcoming" },
    getById: { method: "GET", path: "/api/v1/exams/:id" }
  },
  // Hồ sơ sinh viên
  student: {
    getProfile: { method: "GET", path: "/api/v1/student/profile" },
    updateProfile: { method: "PUT", path: "/api/v1/student/profile" }
  },
  // Đồng bộ dữ liệu trường
  sync: {
    getSources: { method: "GET", path: "/api/v1/sync/sources" },
    startSync: { method: "POST", path: "/api/v1/sync" },
    getStatus: { method: "GET", path: "/api/v1/sync/status" },
    // Nhánh IU tự động (Electron bridge -> API -> IU_VT -> DB)
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
