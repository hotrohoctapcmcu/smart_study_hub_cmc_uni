import { formatDateISO, addDays, startOfWeek } from "../utils/date";
const today = formatDateISO(),
  week = startOfWeek();
export const mockProfile = {
  full_name: "Nguyễn Văn Tuấn",
  student_code: "BIT250000",
  class_name: "BIT25",
  email: "student@cmc-u.edu.vn",
  major: "Công nghệ thông tin",
  phone: "",
};
export const mockSubjects = [
  { subject_id: 1, subject_name: "Lập trình C#", subject_code: "CS101" },
  { subject_id: 2, subject_name: "Cơ sở dữ liệu", subject_code: "DB201" },
  { subject_id: 3, subject_name: "Phát triển Web", subject_code: "WEB201" },
  {
    subject_id: 4,
    subject_name: "Tiếng Anh chuyên ngành",
    subject_code: "ENG101",
  },
];
export const mockSchedules = [
  {
    timetable_id: 1,
    ...mockSubjects[0],
    class_name: "BIT25",
    room: "P.302 · Tòa C",
    start_time: "08:00",
    end_time: "09:30",
    study_date: today,
  },
  {
    timetable_id: 2,
    ...mockSubjects[1],
    class_name: "BIT25",
    room: "P.205 · Tòa B",
    start_time: "10:00",
    end_time: "11:30",
    study_date: today,
  },
  {
    timetable_id: 3,
    ...mockSubjects[2],
    class_name: "BIT25",
    room: "P.201 · Tòa A",
    start_time: "13:00",
    end_time: "14:30",
    study_date: today,
  },
  {
    timetable_id: 4,
    ...mockSubjects[3],
    class_name: "BIT25",
    room: "P.501 · Tòa C",
    start_time: "15:00",
    end_time: "16:30",
    study_date: today,
  },
  ...[0, 1, 2, 4]
    .filter((i) => formatDateISO(addDays(week, i)) !== today)
    .map((i, j) => ({
      timetable_id: 10 + i,
      ...mockSubjects[j],
      class_name: "BIT25",
      room: "P.302",
      start_time: j % 2 ? "10:00" : "08:00",
      end_time: j % 2 ? "11:30" : "09:30",
      study_date: formatDateISO(addDays(week, i)),
    })),
];
export const mockStudySchedules = [
  {
    schedule_id: 1,
    title: "Ôn chương 3 · Lập trình hướng đối tượng",
    ...mockSubjects[0],
    study_date: today,
    start_time: "19:00",
    end_time: "20:00",
    notes: "Ôn lại kế thừa và đa hình, làm bài thực hành.",
    status: "PLANNED",
  },
];
export const mockTasks = [
  {
    assignment_id: 1,
    ...mockSubjects[0],
    title: "Làm bài tập Chương 3",
    description: "Hoàn thành bài 1 đến bài 5 về lập trình hướng đối tượng.",
    deadline: today + "T23:59",
    priority: "URGENT",
    status: "PENDING",
    completed_at: null,
    tags: ["Quan trọng"],
  },
  {
    assignment_id: 2,
    ...mockSubjects[1],
    title: "Ôn SQL cho bài kiểm tra",
    description: "Ôn JOIN, GROUP BY và truy vấn con.",
    deadline: today + "T21:00",
    priority: "HIGH",
    status: "IN_PROGRESS",
    completed_at: null,
  },
  {
    assignment_id: 3,
    ...mockSubjects[2],
    title: "Nộp báo cáo nhóm",
    description: "Kiểm tra nội dung trước khi nộp.",
    deadline: formatDateISO(addDays(new Date(), 1)) + "T23:59",
    priority: "MEDIUM",
    status: "PENDING",
    completed_at: null,
  },
  {
    assignment_id: 4,
    ...mockSubjects[2],
    title: "Đọc tài liệu Web Framework",
    description: "Ghi lại các điểm cần ôn.",
    deadline: formatDateISO(addDays(new Date(), 2)) + "T20:00",
    priority: "LOW",
    status: "PENDING",
    completed_at: null,
  },
  {
    assignment_id: 5,
    ...mockSubjects[3],
    title: "Ôn từ vựng chuyên ngành",
    description: "Ôn 20 từ mới.",
    deadline: today + "T18:00",
    priority: "LOW",
    status: "COMPLETED",
    completed_at: today + "T12:00",
  },
  {
    assignment_id: 6,
    ...mockSubjects[0],
    title: "Hoàn thành bài thực hành C#",
    description: "",
    deadline: today + "T17:00",
    priority: "HIGH",
    status: "COMPLETED",
    completed_at: today + "T11:00",
  },
];
export const mockEduxTasks = [
  {
    id: "edux-1",
    title: "Quiz chương 3: OOP",
    subject: "Lập trình C#",
    subjectId: "1",
    subjectCode: "CS101",
    chapter: "Chương 3",
    highestScore: null,
    progress: "0/10",
    status: "Chưa làm",
    description: "Ôn tập các tính chất của lập trình hướng đối tượng.",
  },
];
export const mockDocuments = [
  {
    id: "doc-1",
    title: "C# Chương 3.pdf",
    type: "pdf",
    size: 2516582,
    subject: "Lập trình C#",
    uploadedAt: today,
    tags: ["OOP"],
  },
  {
    id: "doc-2",
    title: "Ghi chú SQL.docx",
    type: "docx",
    size: 1280000,
    subject: "Cơ sở dữ liệu",
    uploadedAt: today,
    tags: ["Cần ôn"],
  },
  {
    id: "doc-3",
    title: "Slide OOP.pptx",
    type: "pptx",
    size: 3250000,
    subject: "Lập trình C#",
    uploadedAt: today,
    tags: [],
  },
  {
    id: "doc-4",
    title: "Web Framework.pdf",
    type: "pdf",
    size: 1800000,
    subject: "Phát triển Web",
    uploadedAt: today,
    tags: [],
  },
  {
    id: "doc-5",
    title: "Thiết kế cơ sở dữ liệu.pdf",
    type: "pdf",
    size: 2200000,
    subject: "Cơ sở dữ liệu",
    uploadedAt: today,
    tags: [],
  },
  {
    id: "doc-6",
    title: "Tiếng Anh CNTT.docx",
    type: "docx",
    size: 1100000,
    subject: "Tiếng Anh chuyên ngành",
    uploadedAt: today,
    tags: [],
  },
];
export const mockCourses = mockSubjects.map((s, i) => ({
  id: String(s.subject_id),
  subject: s.subject_name,
  subjectCode: s.subject_code,
  chapters: [
    { id: "ch-" + i, title: "Chương 1 · Kiến thức nền tảng" },
    { id: "ch2-" + i, title: "Chương 2 · Thực hành" },
  ],
  cards:
    i === 0
      ? [
          {
            id: "card-1",
            front: "Bốn tính chất cơ bản của OOP là gì?",
            back: "Đóng gói, kế thừa, đa hình và trừu tượng.",
          },
          {
            id: "card-2",
            front: "Đóng gói giúp ích gì?",
            back: "Ẩn chi tiết triển khai và bảo vệ trạng thái của đối tượng.",
          },
        ]
      : [],
  summary: {
    text: "Ôn tập lý thuyết, thực hành bài tập và ghi chú các phần chưa hiểu.",
  },
  progress: [76, 62, 58, 45][i],
}));
export const mockExams = [
  {
    exam_id: 1,
    ...mockSubjects[0],
    exam_date: formatDateISO(addDays(new Date(), 17)),
    start_time: "08:00",
    end_time: "09:30",
    room: "P.302",
    notes: "Mang thẻ sinh viên.",
  },
  {
    exam_id: 2,
    ...mockSubjects[1],
    exam_date: formatDateISO(addDays(new Date(), 21)),
    start_time: "10:00",
    room: "P.205",
    notes: "",
  },
];
export const mockNotifications = [
  {
    notification_id: 1,
    title: "Đừng quên bài tập C# nhé!",
    content: "Bài tập Chương 3 đến hạn vào tối nay.",
    is_read: 0,
    created_at: today + "T08:00",
    link: "/tasks",
  },
  {
    notification_id: 2,
    title: "Một tuần học tập mới",
    content: "Xem lịch học và sắp xếp kế hoạch cho tuần này.",
    is_read: 0,
    created_at: today + "T07:00",
    link: "/schedule",
  },
];
export const mockProgress = {
  total_hours: 24,
  study_sessions: 8,
  completion_rate: 76,
  documents_opened: 5,
  daily_hours: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((name, i) => ({
    name,
    hours: [2, 4, 3, 5, 4, 4, 2][i],
  })),
  subject_progress: mockSubjects.map((s, i) => ({
    subject_name: s.subject_name,
    progress: [80, 72, 60, 50][i],
  })),
  time_allocation: mockSubjects.map((s, i) => ({
    subject_name: s.subject_name,
    hours: [9, 7, 5, 3][i],
  })),
};
export const mockEmails = [
  {
    id: "mail-1",
    subject: "Thông báo lịch kiểm tra giữa kỳ",
    sender: "daotao@cmc-u.edu.vn",
    body: "Các em sinh viên thân mến,\n\nVui lòng kiểm tra lịch thi giữa kỳ trên hệ thống IU và chuẩn bị thẻ sinh viên khi dự thi.\n\nChúc các em học tập tốt!",
    receivedAt: today + "T09:15",
    read: false,
  },
  {
    id: "mail-2",
    subject: "Tài liệu ôn tập môn Cơ sở dữ liệu",
    sender: "giangvien@cmc-u.edu.vn",
    body: "Tài liệu ôn tập đã được cập nhật trên EDUX. Các em hoàn thành bài tập trước buổi học tiếp theo nhé.",
    receivedAt: today + "T08:30",
    read: true,
  },
];
export const mockNotes = [
  {
    id: "note-1",
    title: "Những điều cần nhớ về OOP",
    subject: "Lập trình C#",
    chapter: "Chương 3",
    content:
      "Đóng gói · Kế thừa · Đa hình · Trừu tượng.\n\nThực hành thêm các ví dụ về interface.",
    tags: ["Cần ôn"],
    isDifficult: true,
    updatedAt: today,
  },
];
export const mockNotebooks = [
  {
    id: "book-1",
    title: "Sổ tay học kỳ 1",
    subject: "Tổng hợp",
    content: "Ghi lại mục tiêu và kiến thức quan trọng trong học kỳ.",
    tags: [],
    updatedAt: today,
  },
];
export const mockQuizzes = [
  {
    id: "quiz-1",
    title: "Ôn tập OOP",
    subject: "Lập trình C#",
    questions: [
      {
        id: "q1",
        question: "Tính chất nào giúp che giấu chi tiết triển khai?",
        options: ["Đóng gói", "Kế thừa", "Đa hình", "Tất cả"],
        correct: 0,
      },
      {
        id: "q2",
        question: "Tính chất nào cho phép tái sử dụng lớp cha?",
        options: ["Trừu tượng", "Kế thừa", "Đóng gói", "Không có"],
        correct: 1,
      },
    ],
  },
];
export const mockDashboard = {
  profile: mockProfile,
  todaySchedules: mockSchedules.filter((s) => s.study_date === today),
  upcomingDeadlines: mockTasks.filter((t) => t.status !== "COMPLETED"),
  upcomingExams: mockExams,
  unreadRemindersCount: 2,
};
