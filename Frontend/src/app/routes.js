/**
 * UniStudy CMC - Route Registry
 * Quản lý danh sách route tập trung theo NAVIGATION_MAP.md và SPRINT_1.md
 */
export const ROUTES = {
  // Trong workspace - Sprint 1
  dashboard: {
    id: "dashboard",
    title: "Tổng quan",
    icon: "i-grid",
    isImplemented: true,
    inSidebar: true,
    description: "Bảng tổng hợp học tập, lịch học hôm nay và deadline"
  },
  schedule: {
    id: "schedule",
    title: "Lịch học",
    icon: "i-calendar",
    isImplemented: true,
    inSidebar: true,
    description: "Thời khóa biểu thông minh, lịch tự học và cảnh báo trùng"
  },
  tasks: {
    id: "tasks",
    title: "Công việc",
    icon: "i-tasks",
    isImplemented: true,
    inSidebar: true,
    description: "Quản lý bài tập, deadline và danh sách việc cần làm"
  },
  "study-planner": {
    id: "study-planner",
    title: "Kế hoạch học tập",
    icon: "i-plan",
    isImplemented: true,
    inSidebar: true,
    description: "Đề xuất lịch tự học dựa trên thời gian rảnh"
  },
  studyPlanner: {
    id: "study-planner",
    title: "Kế hoạch học tập",
    icon: "i-plan",
    isImplemented: true,
    inSidebar: true,
    description: "Đề xuất lịch tự học dựa trên thời gian rảnh"
  },
  exams: {
    id: "exams",
    title: "Kế hoạch ôn thi",
    icon: "i-exam",
    isImplemented: true,
    inSidebar: true,
    description: "Lịch thi học kỳ và lộ trình ôn tập môn thi"
  },
  documents: {
    id: "documents",
    title: "Tài liệu",
    icon: "i-folder",
    isImplemented: true,
    inSidebar: true,
    description: "Kho giáo trình, slide bài giảng, textbook và sổ tay cá nhân"
  },
  "school-email": {
    id: "school-email",
    title: "Email trường",
    icon: "i-bell",
    isImplemented: true,
    inSidebar: true,
    description: "Đồng bộ và phân tích hòm thư sinh viên CMC"
  },
  schoolEmail: {
    id: "school-email",
    title: "Email trường",
    icon: "i-bell",
    isImplemented: true,
    inSidebar: true,
    description: "Đồng bộ và phân tích hòm thư sinh viên CMC"
  },
  "ai-tutor": {
    id: "ai-tutor",
    title: "Trợ lý AI",
    icon: "i-spark",
    isImplemented: false,
    inSidebar: true,
    description: "Hỏi đáp kiến thức và giải bài tập cùng trợ lý AI"
  },
  aiTutor: {
    id: "ai-tutor",
    title: "Trợ lý AI",
    icon: "i-spark",
    isImplemented: false,
    inSidebar: true,
    description: "Hỏi đáp kiến thức và giải bài tập cùng trợ lý AI"
  },
  quiz: {
    id: "quiz",
    title: "Quiz AI",
    icon: "i-quiz",
    isImplemented: false,
    inSidebar: true,
    description: "Tự động sinh bộ câu hỏi trắc nghiệm ôn tập"
  },
  flashcards: {
    id: "flashcards",
    title: "Flashcard",
    icon: "i-cards",
    isImplemented: false,
    inSidebar: true,
    description: "Ôn tập kiến thức qua thẻ ghi nhớ thông minh"
  },
  pomodoro: {
    id: "pomodoro",
    title: "Pomodoro",
    icon: "i-clock",
    isImplemented: true,
    inSidebar: true,
    description: "Bộ đếm thời gian tập trung học tập"
  },
  progress: {
    id: "progress",
    title: "Tiến độ",
    icon: "i-chart",
    isImplemented: true,
    inSidebar: true,
    description: "Biểu đồ phân tích hiệu suất và bản đồ thời gian học tập"
  },
  notifications: {
    id: "notifications",
    title: "Thông báo",
    icon: "i-bell",
    isImplemented: true,
    inSidebar: true,
    description: "Cảnh báo deadline và thông báo đào tạo"
  },
  sync: {
    id: "sync",
    title: "Đồng bộ dữ liệu",
    icon: "i-refresh",
    isImplemented: true,
    inSidebar: false,
    description: "Kết nối cổng thông tin đào tạo CMC University"
  },
  profile: {
    id: "profile",
    title: "Hồ sơ cá nhân",
    icon: "i-user",
    isImplemented: true,
    inSidebar: false,
    description: "Thông tin sinh viên và cấu hình nguồn dữ liệu"
  }
};

/**
 * Danh mục phân nhóm điều hướng dùng chung cho cả Sidebar và Hộp chọn Tab mới
 */
export const NAVIGATION_SECTIONS = [
  {
    id: "overview",
    title: "", // Mục Tổng quan nằm riêng ở đầu
    icon: "i-grid",
    routeIds: ["dashboard"]
  },
  {
    id: "study",
    title: "HỌC TẬP & LỊCH TRÌNH",
    icon: "i-calendar",
    routeIds: ["schedule", "tasks", "study-planner", "exams"]
  },
  {
    id: "tools",
    title: "CÔNG CỤ",
    icon: "i-spark",
    routeIds: ["documents", "pomodoro", "ai-tutor", "quiz", "flashcards"]
  },
  {
    id: "bottom",
    title: "", // Phía cuối danh sách sidebar
    modalTitle: "TIẾN ĐỘ & THÔNG BÁO",
    icon: "i-bell",
    routeIds: ["progress", "notifications"]
  },
  {
    id: "account",
    title: "TÀI KHOẢN",
    icon: "i-user",
    isFooter: true,
    routeIds: ["sync", "profile"]
  }
];

/**
 * Lấy route theo id
 */
export function getRouteById(routeId) {
  return ROUTES[routeId] || Object.values(ROUTES).find((r) => r.id === routeId) || ROUTES.dashboard;
}
