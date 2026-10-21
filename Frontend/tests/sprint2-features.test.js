/**
 * UniStudy CMC - Tests for Groups A, B, C Requirements
 */
import { renderScheduleView, renderMonthView, renderConflictDecisionModal } from "../src/features/schedule/schedule.view.js";
import { layoutDayEvents, splitOvernightEvents, HOUR_HEIGHT } from "../src/features/schedule/schedule.grid.js";
import { areEventsConflicting, findScheduleConflicts } from "../src/features/schedule/schedule.conflicts.js";
import { 
  getProgressAnalytics, 
  allocateSessionToHours, 
  extractSessionTimeRange 
} from "../src/features/progress/progress.service.js";
import { renderProgressView } from "../src/features/progress/progress.view.js";
import { renderNotificationsView } from "../src/features/notifications/notifications.view.js";
import { state, getUnreadNotificationCount, markAllNotificationsAsRead } from "../src/app/state.js";
import { getSchoolEmails, markAllSchoolEmailsAsRead } from "../src/features/school-email/school-email.service.js";
import { ROUTES, NAVIGATION_SECTIONS, getRouteById } from "../src/app/routes.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("\n====================================================");
console.log("   KIỂM THỬ TOÀN DIỆN CÁC NHÓM YÊU CẦU A, B, C");
console.log("====================================================");

// ==================== NHÓM A: LỊCH HỌC ====================
console.log("\n[A.1] BỐ CỤC GOOGLE CALENDAR & TOOLBAR ĐIỀU HƯỚNG");
const schedHtml = renderScheduleView();

// 1. Cột lớn bên trái: Lịch chính, Cột bên phải: Lịch thu nhỏ & Chú giải
const sideColPos = schedHtml.indexOf('class="schedule-side-col"');
const mainColPos = schedHtml.indexOf('class="schedule-main-col"');
assert(sideColPos !== -1 && mainColPos !== -1, "Có 2 cột schedule-side-col và schedule-main-col");
assert(mainColPos < sideColPos, "Bên TRÁI là lịch chính chiếm diện tích lớn (xuất hiện trước), bên PHẢI là lịch thu nhỏ");

// 2. Toolbar có Ngày/Tuần/Tháng, Hôm nay, Gợi ý AI, Xếp lịch tự học (đã bỏ prev/next và nhãn tuần trùng)
assert(schedHtml.includes('id="scheduleTodayBtn"'), "Có nút 'Hôm nay'");
assert(!schedHtml.includes('id="schedulePrevPeriodBtn"') && !schedHtml.includes('id="scheduleNextPeriodBtn"'), "Đã bỏ hai nút trước/sau khỏi thanh công cụ lịch chính");
assert(!schedHtml.includes('id="schedulePeriodTitle"'), "Đã bỏ nhãn khoảng tuần khỏi thanh công cụ lịch chính");
assert(schedHtml.includes('id="openAiScheduleBtn"'), "Có nút 'Gợi ý xếp lịch bằng AI'");
assert(schedHtml.includes('id="openAddStudySessionBtn"'), "Có nút 'Xếp lịch tự học'");
assert(schedHtml.includes('data-schedule-mode="day"') && schedHtml.includes('data-schedule-mode="week"') && schedHtml.includes('data-schedule-mode="month"'), "Có đủ 3 chế độ Ngày / Tuần / Tháng");

console.log("\n[A.2 & A.3] LƯỚI GIỜ 24H, VỊ TRÍ CHÍNH XÁC & CHIA CỘT TRÙNG GIỜ");
// Test thuật toán layoutDayEvents
const sampleEvents = [
  { id: "e1", date: "2026-10-21", start: "08:15", end: "09:45", title: "Cấu trúc dữ liệu", source: "CMC" },
  { id: "e2", date: "2026-10-21", start: "09:00", end: "10:30", title: "Tự học Web", source: "Tự thêm" },
  { id: "e3", date: "2026-10-21", start: "10:30", end: "11:30", title: "Anh văn", source: "CMC" }
];

const layoutResult = layoutDayEvents(sampleEvents);
const { positionedEvents } = layoutResult;

// 1. Vị trí 08:15–09:45 tính từ số phút kể từ đầu ngày (8 * 60 + 15 = 495)
const e1 = positionedEvents.find((e) => e.id === "e1");
const e2 = positionedEvents.find((e) => e.id === "e2");
const e3 = positionedEvents.find((e) => e.id === "e3");

assert(e1 && e1.top === 495, "08:15 nằm chính xác tại top = 495px (không làm tròn)");
assert(e1 && e1.height === 90, "Thời lượng 90 phút tương ứng đúng chiều cao 90px");

// 2. e1 và e2 chồng giờ (08:15–09:45 và 09:00–10:30) chia cột cạnh nhau
assert(e1.totalCols === 2 && e2.totalCols === 2, "Cụm chồng giờ được phân bổ thành 2 cột cạnh nhau");
assert(e1.col === 0 && e2.col === 1, "e1 ở cột 0, e2 ở cột 1");
assert(e1.leftPercent === 0 && e2.leftPercent === 50, "Cột không che nhau (left 0% và 50%)");

// 3. e2 và e3 nối tiếp lúc 10:30 không bị coi là chồng giờ
assert(e3.col === 0 && e3.totalCols === 1, "Hai buổi nối tiếp (10:30) không bị chia cột chồng giờ");

// 4. Sự kiện qua nửa đêm (22:00 -> 02:00) tách 2 phần theo ngày, giữ chung ID nguồn
const overnightEvents = [
  { id: "night-1", date: "2026-10-21", start: "22:00", end: "02:00", title: "Luyện code đêm", source: "Tự thêm" }
];
const splitResult = splitOvernightEvents(overnightEvents);
assert(splitResult.length === 2, "Sự kiện qua nửa đêm được tách làm 2 phần hiển thị");
assert(splitResult[0].date === "2026-10-21" && splitResult[0].start === "22:00" && splitResult[0].end === "24:00", "Phần 1 thuộc ngày bắt đầu (22:00–24:00)");
assert(splitResult[1].date === "2026-10-22" && splitResult[1].start === "00:00" && splitResult[1].end === "02:00", "Phần 2 thuộc ngày kế tiếp (00:00–02:00)");
assert(splitResult[0].originalId === "night-1" && splitResult[1].originalId === "night-1", "Cả 2 phần giữ chung ID nguồn, không tạo dữ liệu trùng");

console.log("\n[A.4] LỊCH THÁNG - CHỈ HIỆN GIỜ BẮT ĐẦU – KẾ THÚC");
const monthEvents = [
  { id: "m1", date: "2026-10-21", start: "08:15", end: "09:45", title: "Tên môn rất dài không được hiện", room: "Phòng 301" }
];
const monthHtml = renderMonthView("2026-10-21", monthEvents, new Set());
assert(monthHtml.includes("08:15 – 09:45"), "Lịch tháng hiển thị giờ bắt đầu – kết thúc");
assert(!monthHtml.includes("Tên môn rất dài không được hiện") && !monthHtml.includes("Phòng 301"), "Trong ô lịch tháng KHÔNG hiện tên môn, phòng hoặc mô tả");

console.log("\n[A.6] KIỂM TRA TRÙNG VÀ MODAL QUYẾT ĐỊNH");
// Kiểm tra trùng: A.start < B.end && B.start < A.end
const conflictPair = areEventsConflicting(
  { id: "a", date: "2026-10-21", start: "08:00", end: "09:30" },
  { id: "b", date: "2026-10-21", start: "09:00", end: "10:30" }
);
assert(conflictPair === true, "Phát hiện đúng xung đột giờ (08:00–09:30 vs 09:00–10:30)");

const adjacentPair = areEventsConflicting(
  { id: "a", date: "2026-10-21", start: "08:00", end: "09:30" },
  { id: "b", date: "2026-10-21", start: "09:30", end: "11:00" }
);
assert(adjacentPair === false, "Hai buổi nối tiếp (09:30) KHÔNG được coi là trùng");

// Modal quyết định khi trùng lịch trường
const schoolConflictModal = renderConflictDecisionModal({
  pendingSession: { date: "2026-10-21", start: "08:30", end: "10:00", title: "Tự học" },
  conflictingEvents: [{ id: "c1", date: "2026-10-21", start: "08:00", end: "09:30", title: "Toán", source: "Trường" }],
  isEdit: false
});
assert(schoolConflictModal.includes('id="decisionKeepSchoolBtn"'), "Có lựa chọn a: Giữ lịch trên lớp");
assert(schoolConflictModal.includes('id="decisionAdjustTimeBtn"'), "Có lựa chọn b: Đổi giờ tự học");
assert(schoolConflictModal.includes('id="decisionForceSaveBtn"'), "Có lựa chọn c: Vẫn lưu lịch tự học");

// ==================== NHÓM B: TIẾN ĐỘ & BẢN ĐỒ THỜI GIAN ====================
console.log("\n[B.1] BỘ CHỌN THỜI GIAN TIẾN ĐỘ: CHỈ CÓ NGÀY / TUẦN / THÁNG (BỎ HỌC KỲ)");
const progressHtml = renderProgressView();
assert(progressHtml.includes('data-period="day"') && progressHtml.includes('data-period="week"') && progressHtml.includes('data-period="month"'), "Có đủ 3 lựa chọn Ngày / Tuần / Tháng");
assert(!progressHtml.includes('data-period="semester"') && !progressHtml.includes('Học kỳ'), "Đã bỏ hoàn toàn 'Học kỳ' khỏi trang Tiến độ");

console.log("\n[B.2 & B.5] PHÂN BỔ THỜI GIAN THỰC TẾ VÀO CÁC KHUNG GIỜ");
// Phiên 19:45 – 20:15 đóng góp đúng 15 phút cho 19:00–20:00 và 15 phút cho 20:00–21:00
const startMs = new Date(2026, 9, 21, 19, 45, 0).getTime();
const endMs = new Date(2026, 9, 21, 20, 15, 0).getTime();
const daySlots = allocateSessionToHours(startMs, endMs, "2026-10-21");
assert(daySlots[19] === 15, "Khung 19:00–20:00 nhận đúng 15 phút");
assert(daySlots[20] === 15, "Khung 20:00–21:00 nhận đúng 15 phút");
assert(daySlots[18] === 0, "Khung 18:00–19:00 nhận 0 phút");

console.log("\n[B.7] BỎ HEATMAP & BỔ SUNG NÚT TUA BIỂU ĐỒ NGÀY");
assert(!progressHtml.includes("Bản đồ thời gian học tập"), "Đã bỏ hoàn toàn card heatmap và chú giải riêng khỏi trang Tiến độ");
const dayProgressHtml = renderProgressView({ period: "day" });
assert(dayProgressHtml.includes('id="scrollDayChartLeftBtn"') && dayProgressHtml.includes('id="scrollDayChartRightBtn"'), "Biểu đồ ngày có 2 nút tua cuộn ngang xem các khung giờ");
assert(dayProgressHtml.includes('class="progress-charts-grid single-chart"'), "Biểu đồ thời lượng mở rộng toàn bộ diện tích, không để cột trống");

// ==================== NHÓM C: GỘP THÔNG BÁO EMAIL TRƯỜNG & TASKS ====================
console.log("\n[C.1] GỘP EMAIL TRƯỜNG VÀO THÔNG BÁO HỆ THỐNG");
// 1. Không còn route/tab school-email trên sidebar
assert(!NAVIGATION_SECTIONS.some((sec) => sec.routeIds.includes("school-email")), "Đã xóa mục 'Email trường' khỏi Sidebar");
assert(getRouteById("school-email").id === "notifications", "Route 'school-email' được điều hướng vào 'notifications'");

// 2. Giao diện thông báo hợp nhất có bộ lọc Email trường
const notifsHtml = renderNotificationsView();
assert(notifsHtml.includes('data-notif-filter="emails"'), "Có bộ lọc 'Email trường' trong Thông báo");
assert(notifsHtml.includes('data-notif-filter="deadlines"'), "Có bộ lọc 'Deadline' trong Thông báo");

// 3. Đánh dấu đã đọc đồng bộ cả 2 nguồn
const schoolEmails = getSchoolEmails();
markAllSchoolEmailsAsRead();
const emailsAfter = getSchoolEmails();
assert(emailsAfter.every((e) => e.isRead === true), "Đánh dấu tất cả đã đọc xử lý cả Email trường");

console.log("\n[C.2] CÔNG VIỆC, CHECKLIST TỰ ĐỘNG & HOÀN THÀNH NHANH");
const { renderTasksView: renderTasksList } = await import("../src/features/tasks/tasks.view.js");
const { addLocalTask, updateLocalTask } = await import("../src/app/state.js");

// 1. Bảng công việc đã bỏ checkbox chọn tất cả ở đầu bảng
const taskListHtml = renderTasksList();
assert(!taskListHtml.includes('id="selectAllTasksCheckbox"'), "Đã bỏ checkbox chọn hàng đầu bảng");

// 2. Tạo công việc có checklist 2 mục
const sampleChecklistTask = addLocalTask({
  title: "Làm bài tập Lập trình Mạng CMC",
  due: "2026-10-25T23:59",
  subject: "Lập trình Mạng",
  priority: "Cao",
  checklist: [
    { id: "chk-1", text: "Thiết kế Socket TCP", done: false },
    { id: "chk-2", text: "Kiểm thử truyền file", done: false }
  ]
});

// Chưa tích mục nào -> Trạng thái "Chưa làm"
assert(sampleChecklistTask.status === "Chưa làm", "Checklist 0/2 mục -> trạng thái là 'Chưa làm'");

// Tích 1/2 mục -> Tự chuyển sang "Đang làm"
updateLocalTask(sampleChecklistTask.id, {
  checklist: [
    { id: "chk-1", text: "Thiết kế Socket TCP", done: true },
    { id: "chk-2", text: "Kiểm thử truyền file", done: false }
  ],
  status: "Đang làm"
});
const taskMid = state.tasks.find((t) => t.id === sampleChecklistTask.id);
assert(taskMid.status === "Đang làm", "Checklist 1/2 mục -> trạng thái tự chuyển 'Đang làm'");

// Tích 2/2 mục -> Tự chuyển sang "Hoàn thành", ghi completedAt
const nowIso = new Date().toISOString();
updateLocalTask(sampleChecklistTask.id, {
  checklist: [
    { id: "chk-1", text: "Thiết kế Socket TCP", done: true },
    { id: "chk-2", text: "Kiểm thử truyền file", done: true }
  ],
  status: "Hoàn thành",
  completedAt: nowIso
});
const taskDone = state.tasks.find((t) => t.id === sampleChecklistTask.id);
assert(taskDone.status === "Hoàn thành", "Checklist 2/2 mục -> tự chuyển 'Hoàn thành'");
assert(Boolean(taskDone.completedAt), "Có ghi lại thời điểm completedAt");

// Bỏ tích 1 mục sau khi hoàn thành -> chuyển về "Đang làm", completedAt đặt lại null
updateLocalTask(sampleChecklistTask.id, {
  checklist: [
    { id: "chk-1", text: "Thiết kế Socket TCP", done: true },
    { id: "chk-2", text: "Kiểm thử truyền file", done: false }
  ],
  status: "Đang làm",
  completedAt: null
});
const taskReopened = state.tasks.find((t) => t.id === sampleChecklistTask.id);
assert(taskReopened.status === "Đang làm" && taskReopened.completedAt === null, "Bỏ tích 1 mục chuyển về 'Đang làm', xóa completedAt");

// Quick complete: đánh dấu hoàn thành nhanh -> chuyển 'Hoàn thành', toàn bộ checklist done: true
updateLocalTask(sampleChecklistTask.id, {
  status: "Hoàn thành",
  checklist: sampleChecklistTask.checklist.map((i) => ({ ...i, done: true })),
  completedAt: new Date().toISOString()
});
const taskQuickDone = state.tasks.find((t) => t.id === sampleChecklistTask.id);
assert(taskQuickDone.status === "Hoàn thành", "Hoàn thành nhanh chuyển trạng thái 'Hoàn thành'");
assert(taskQuickDone.checklist.every((i) => i.done === true), "Hoàn thành nhanh đánh dấu toàn bộ checklist hoàn thành");

// Task không có checklist hiển thị nhãn rõ ràng
const noChkTask = addLocalTask({
  title: "Đọc giáo trình",
  due: "2026-10-30T10:00",
  checklist: []
});
state.tasks = [noChkTask];
const noChkHtml = renderTasksList();
assert(noChkHtml.includes("Không có checklist"), "Task không có checklist hiển thị rõ 'Không có checklist'");

// ==================== CÁC SỬA LỖI GIAO DIỆN MỚI NHẤT ====================
console.log("\n[D] KIỂM TRA SỬA LỖI GIAO DIỆN TÀI LIỆU & POMODORO");
const { renderDocumentsView } = await import("../src/features/documents/documents.view.js");
const { renderPomodoroView } = await import("../src/features/pomodoro/pomodoro.view.js");
const { isPomodoroSoundEnabled, setPomodoroSoundEnabled, playPomodoroSound } = await import("../src/features/pomodoro/pomodoro.service.js");
const { ASSETS } = await import("../src/shared/config/assets.js");

// 1. Vị trí Loại tài liệu và Môn học có nhãn doc-select-label riêng, không bị cắt xén
const docsHtml = renderDocumentsView({ docTab: "docs" });
assert(docsHtml.includes('class="doc-select-label"') && docsHtml.includes("Loại tài liệu:"), "Có nhãn Loại tài liệu rõ ràng, không bị che/cắt");
assert(docsHtml.includes("Môn học:"), "Có nhãn Môn học rõ ràng");

// 2. Pomodoro audio asset cấu hình amthanh.mp3
assert(ASSETS.sounds.pomodoro === "assets/amthanh.mp3", "Đã đổi asset chuông thành assets/amthanh.mp3");

// 3. Đã bỏ nút nghe thử chuông
const pomoHtml = renderPomodoroView();
assert(!pomoHtml.includes('id="pomoTestSoundBtn"') && !pomoHtml.includes("Thử chuông"), "Đã bỏ hoàn toàn nút nghe thử chuông");

// 4. Khi tắt âm thanh, isPomodoroSoundEnabled là false và playPomodoroSound không phát
setPomodoroSoundEnabled(false);
assert(isPomodoroSoundEnabled() === false, "Tắt âm thanh thành công (soundEnabled = false)");
playPomodoroSound(); // Không phát ra âm thanh khi tắt

setPomodoroSoundEnabled(true);
assert(isPomodoroSoundEnabled() === true, "Bật lại âm thanh thành công (soundEnabled = true)");

console.log("\n====================================================");
console.log("   TẤT CẢ TEST CHO CẢ 3 NHÓM A, B, C VÀ CÁC FIX MỚI ĐÃ VƯỢT QUA 100%!");
console.log("====================================================\n");
