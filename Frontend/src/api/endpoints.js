export const ENDPOINTS = {
  // Health
  health: "/health",

  // Dashboard
  dashboard: "/dashboard",

  // Schedules
  schedules: {
    list: "/schedules",
    today: "/schedules/today",
    byDate: "/schedules/by-date",
    byWeek: "/schedules/by-week",
    study: "/schedules/study",
    conflicts: "/schedules/conflicts/check",
  },

  // Tasks
  tasks: {
    list: "/tasks",
    upcoming: "/tasks/upcoming",
    edux: "/tasks/edux",
    checklist: "/tasks/checklist",
  },

  // Student
  student: {
    profile: "/student/profile",
    grades: "/student/grades",
    subjects: "/student/subjects",
  },

  // Learning / Courses
  courses: {
    list: "/learning/courses",
    detail: "/learning/courses",
    source: "/learning/courses",
    summary: "/learning/courses",
    sync: "/learning/sync",
    summarize: "/learning/courses",
    jobs: "/learning/jobs",
    review: "/learning/cards",
  },

  // Documents
  documents: {
    list: "/documents",
    detail: "/documents",
    file: "/documents",
    tags: "/documents",
  },

  // Notebooks
  notebooks: {
    list: "/notebooks",
    detail: "/notebooks",
    export: "/notebooks",
  },

  // Notes
  notes: {
    list: "/notes",
    detail: "/notes",
    export: "/notes",
  },

  // Exams
  exams: {
    list: "/exams",
    upcoming: "/exams/upcoming",
    detail: "/exams",
    studyPlans: "/exams/study-plans",
  },

  // Notifications
  notifications: {
    list: "/notifications",
    unreadCount: "/notifications/unread-count",
    due: "/notifications/due",
    detail: "/notifications",
  },

  // Progress / Statistics
  progress: "/progress",

  // Timemap
  timemap: "/timemap",

  // Pomodoro
  pomodoro: "/pomodoro",

  // Email
  email: {
    list: "/email",
    status: "/email/status",
    sync: "/email/sync",
    session: "/email/session",
    read: "/email/read",
    detail: "/email",
    refresh: "/email",
    task: "/email",
    exam: "/email",
  },

  // Sync
  sync: {
    sources: "/sync/sources",
    start: "/sync",
    all: "/sync/all",
    status: "/sync/status",
    currentCourses: "/sync/current-courses",
    refresh: "/sync/refresh",
    iu: {
      session: "/sync/iu/session",
      status: "/sync/iu/status",
      pull: "/sync/iu/pull",
      group: "/sync/iu/group",
    },
    edux: {
      session: "/sync/edux/session",
      status: "/sync/edux/status",
      pull: "/sync/edux/pull",
    },
  },

  // Search
  search: "/search",

  // Tags
  tags: {
    task: "/tags/tasks",
    edux: "/tags/edux",
  },

  // AI
  ai: {
    status: "/ai/status",
    ask: "/ai/ask",
    conversations: "/ai/conversations",
    plan: "/ai/plan",
    planConfirm: "/ai/plan/confirm",
    pomodoroGoals: "/ai/pomodoro-goals",
    examPlan: "/ai/exam-plan",
    examPlanConfirm: "/ai/exam-plan/confirm",
    check: "/ai/check",
    summarize: "/ai/summarize",
    draftLeave: "/ai/draft-leave",
    progressAdvice: "/ai/progress-advice",
    difficultNotes: "/ai/difficult-notes",
  },

  // Quizzes
  quizzes: {
    list: "/ai/quizzes",
    detail: "/ai/quizzes",
    submit: "/ai/quizzes",
  },

  // Weaknesses
  weaknesses: {
    list: "/ai/weaknesses",
    analyze: "/ai/weaknesses/analyze",
  },
};
