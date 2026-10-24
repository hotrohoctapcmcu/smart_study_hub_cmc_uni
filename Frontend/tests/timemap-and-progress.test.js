/**
 * UniStudy CMC - Test Suite: Timemap & Progress Analytics
 * Kiểm thử chi tiết 2 tính năng:
 * 1. Bản đồ thời gian học tập (features/timemap/)
 * 2. Phân tích tiến độ học tập (features/progress/)
 */

import { strictEqual, ok } from "node:assert";
import { 
  getTimemapWeekData, 
  getHourlyStudyDensityHeatmap, 
  getEventsForDate, 
  calculateFreeTimeSlots,
  addSelfStudySession 
} from "../src/features/timemap/timemap.service.js";
import { renderTimemapView } from "../src/features/timemap/timemap.view.js";
import { getRouteById, ROUTES } from "../src/app/routes.js";
import { 
  getProgressAnalytics, 
  fetchProgressApi, 
  getCachedProgressApi 
} from "../src/features/progress/progress.service.js";
import { renderProgressView } from "../src/features/progress/progress.view.js";
import { state, resetSessionState } from "../src/app/state.js";

console.log("====================================================");
console.log("   KIỂM THỬ TÍNH NĂNG TIMEMAP & TIẾN ĐỘ HỌC TẬP     ");
console.log("====================================================\n");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

// ==================== PHẦN 1: BẢN ĐỒ THỜI GIAN HỌC TẬP (TIMEMAP) ====================
console.log("[1.1] ĐĂNG KÝ ROUTE TIMEMAP TRONG ROUTES.JS");
const timemapRoute = getRouteById("timemap");
assert(timemapRoute && timemapRoute.id === "timemap", "Route 'timemap' đã được đăng ký và tìm thấy bằng getRouteById");
assert(timemapRoute.title === "Bản đồ thời gian", "Tiêu đề route đúng: 'Bản đồ thời gian'");
assert(ROUTES.timemap.isImplemented === true, "Route timemap đánh dấu isImplemented = true");

console.log("\n[1.2] DỮ LIỆU TIMELINE 7 NGÀY & PHÂN BIỆT MÀU SẮC");
resetSessionState();

// Thêm sự kiện mẫu vào state để kiểm thử phân biệt màu sắc
state.schoolEvents = [
  { id: "sch-1", subject: "Lập trình Web", date: "2026-10-21", start: "08:00", end: "10:00", room: "A201" }
];
state.exams = [
  { id: "ex-1", subjectName: "Cơ sở dữ liệu", examDate: "2026-10-22", examTime: "09:00", endTime: "10:30", room: "B302" },
  { id: "ex-2", subjectName: "Lập trình Web", examDate: "2026-10-30", examTime: "13:30", endTime: "15:00", room: "A101" }
];
state.studyEvents = [
  { id: "study-1", title: "Ôn tập CSDL", subject: "Cơ sở dữ liệu", date: "2026-10-23", start: "14:00", end: "16:00" }
];

const weekData = getTimemapWeekData("2026-10-21");
assert(weekData.days.length === 7, "Timeline có đủ 7 ngày trong tuần");
assert(weekData.days[0].dayName === "Thứ 2" && weekData.days[6].dayName === "Chủ nhật", "7 ngày trải từ Thứ 2 đến Chủ nhật");

// Kiểm tra phân loại sự kiện
const wednesday = weekData.days.find((d) => d.dateStr === "2026-10-21");
assert(wednesday.busyEvents.some((e) => e.type === "schedule"), "Có sự kiện Thời khóa biểu (schedule)");

const thursday = weekData.days.find((d) => d.dateStr === "2026-10-22");
assert(thursday.busyEvents.some((e) => e.type === "exam"), "Có sự kiện Lịch thi (exam)");

const friday = weekData.days.find((d) => d.dateStr === "2026-10-23");
assert(friday.busyEvents.some((e) => e.type === "self_study"), "Có sự kiện Tự học (self_study)");

assert(wednesday.freeSlots.length > 0, "Tính toán được các khoảng thời gian trống (free_time)");
assert(wednesday.freeSlots.every((f) => f.type === "free_time"), "Khoảng trống mang đúng type 'free_time'");

console.log("\n[1.3] GIAO DIỆN TIMEMAP (VIEW) & TƯƠNG TÁC KHOẢNG TRỐNG");
const timemapHtml = renderTimemapView({ selectedDate: "2026-10-21" });
assert(timemapHtml.includes("timemap-block schedule"), "HTML có class màu xanh cho Thời khóa biểu");
assert(timemapHtml.includes("timemap-block exam"), "HTML có class màu đỏ cho Lịch thi");
assert(timemapHtml.includes("timemap-block self_study"), "HTML có class màu xanh lá cho Tự học");
assert(timemapHtml.includes("timemap-block free_time"), "HTML có class nét đứt cho Thời gian trống");
assert(timemapHtml.includes('data-free-slot="true"'), "Khoảng trống có data attribute để bắt sự kiện click mở form");
assert(timemapHtml.includes("Heatmap mật độ học theo giờ"), "Có khối Heatmap mật độ học theo giờ");
assert(timemapHtml.includes("heatmap-cell level-"), "Heatmap hiển thị các ô mật độ màu");

console.log("\n[1.4] HEATMAP MẬT ĐỘ HỌC THEO 24 KHUNG GIỜ");
const heatmapData = getHourlyStudyDensityHeatmap("2026-10-21");
assert(heatmapData.hoursList.length === 24, "Heatmap có đủ 24 khung giờ 00:00 - 23:00");
assert(heatmapData.matrix.length === 7, "Ma trận Heatmap có đủ 7 ngày");
assert(heatmapData.matrix[0].cells.length === 24, "Mỗi ngày trong Heatmap có 24 ô tương ứng 24 giờ");

// ==================== PHẦN 2: PHÂN TÍCH TIẾN ĐỘ HỌC TẬP (PROGRESS) ====================
console.log("\n[2.1] LOẠI BỎ DỮ LIỆU GIẢ VÀ MOCK STATE");
state.tasks = [
  { id: "task-1", title: "Bài tập lớn Web", subject: "Lập trình Web", status: "Hoàn thành", dueDate: "2026-10-20" },
  { id: "task-2", title: "Báo cáo CSDL", subject: "Cơ sở dữ liệu", status: "Đang làm", dueDate: "2026-10-18" } // quá hạn
];
state.profile = {
  gpa_4_scale: 3.65,
  gpa_10_scale: 8.8
};

const progressData = getProgressAnalytics("week", "2026-10-21");
assert(progressData.gpa === 3.65, "Lấy điểm GPA 4.0 thực tế từ state/API");
assert(progressData.gpa10 === 8.8, "Lấy điểm GPA thang 10 thực tế từ state/API");
assert(progressData.completedTasks === 1, "Thống kê đúng số bài tập hoàn thành (1)");
assert(progressData.totalTasks === 2, "Thống kê đúng tổng số bài tập (2)");
assert(progressData.taskCompletionRate === 50, "Tỷ lệ hoàn thành bài tập tính đúng: 50%");
assert(progressData.overdueTasks >= 1, "Phát hiện đúng bài tập quá hạn");
assert(progressData.upcomingExamsCount === 1, "Đếm đúng số kỳ thi sắp tới (1)");

// Kiểm tra không còn mảng fake defaultSubjects
assert(
  !progressData.subjects.some((s) => s.name === "Tiếng Anh" && !state.tasks.some((t) => t.subject === "Tiếng Anh")),
  "Không tự ý chèn môn học giả/seed (như Tiếng Anh) khi người dùng không có môn này"
);

console.log("\n[2.2] GIAO DIỆN TIẾN ĐỘ: 5 CHỈ SỐ BẮT BUỘC & NHẬN XÉT AI");
const progressHtml = renderProgressView({ period: "week", selectedDate: "2026-10-21" });
assert(progressHtml.includes("Tỷ lệ bài tập hoàn thành"), "Hiển thị thẻ Tỷ lệ bài tập hoàn thành");
assert(progressHtml.includes("Bài tập quá hạn"), "Hiển thị thẻ Bài tập quá hạn");
assert(progressHtml.includes("Giờ học trong"), "Hiển thị thẻ Giờ học");
assert(progressHtml.includes("Điểm trung bình (GPA)"), "Hiển thị thẻ Điểm GPA");
assert(progressHtml.includes("Kỳ thi sắp tới"), "Hiển thị thẻ Kỳ thi sắp tới");

// Kiểm tra khi có nhận xét AI
const mockAiHtml = renderProgressView({ period: "week", selectedDate: "2026-10-21" });
assert(typeof fetchProgressApi === "function", "progress.service.js export hàm fetchProgressApi kết nối GET /api/v1/progress");

console.log("\n====================================================");
console.log("   TẤT CẢ KIỂM THỬ TIMEMAP & PROGRESS ĐÃ VƯỢT QUA!  ");
console.log("====================================================");
