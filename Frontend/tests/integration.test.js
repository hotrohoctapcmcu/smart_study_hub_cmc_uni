/**
 * UniStudy CMC - End-to-End Integration Test Suite
 * Kiểm thử toàn bộ các cổng nghiệm thu G0 - G5 theo TEST_PLAN.md
 */
import { state, addLocalStudySession, deleteLocalStudySession, addLocalTask, updateLocalTask, deleteLocalTask, addLocalExam, deleteLocalExam, markNotificationAsRead, resetSessionState } from "../src/app/state.js";
import { workspaceState, getActiveTab, setActiveTab, createNewTab, closeTab, changeCurrentTabRoute, updateActiveTabLocalState, resetWorkspaceTabs } from "../src/app/workspace.js";
import { syncState, toggleSourceSelection, selectAllSources, deselectAllSources, resetSyncState } from "../src/app/sync-state.js";
import { findScheduleConflicts } from "../src/features/schedule/schedule.conflicts.js";
import { openSchoolPortals } from "../src/features/sync/sync.auth-window.js";
import { ROUTES } from "../src/app/routes.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("====================================================");
console.log("      UNISTUDY CMC - INTEGRATION TEST (G0 - G5)     ");
console.log("====================================================\n");

// --- G0: Khung chung & Điều hướng ---
console.log("[G0] KIỂM TRA KHUNG CHUNG VÀ TABS");
assert(!("screen" in state), "G0-02: Không còn màn hình Landing, vào thẳng Workspace");

const initialTab = getActiveTab();
assert(initialTab && initialTab.routeId === "dashboard", "G0-02: Mặc định tab 1 là Dashboard");

// Sidebar đổi route trong tab hiện tại (không tạo tab mới)
changeCurrentTabRoute("schedule");
assert(getActiveTab().routeId === "schedule", "G0-05: Sidebar đổi route của tab hiện tại thành schedule");
assert(workspaceState.tabs.length === 1, "G0-05: Sidebar không tự tạo thêm tab");

// Tab picker (+) tạo tab mới
const newTab = createNewTab("tasks");
assert(workspaceState.tabs.length === 2, "G0-07: Tab mới được tạo");
assert(getActiveTab().id === newTab.id && getActiveTab().routeId === "tasks", "G0-07: Tab mới được active đúng");

// Giữ state khi đổi tab
setActiveTab("tab-1");
assert(getActiveTab().routeId === "schedule", "G0-08: Tab 1 giữ nguyên route schedule");
setActiveTab(newTab.id);
assert(getActiveTab().routeId === "tasks", "G0-08: Tab 2 giữ nguyên route tasks");

// Đóng tab
closeTab(newTab.id);
assert(workspaceState.tabs.length === 1, "G0-09: Đóng tab thành công");
assert(getActiveTab().id === "tab-1", "G0-09: Tự động chuyển về tab còn lại");

// Đóng tab cuối cùng (tab-1 đang ở route schedule) -> chuyển về Tổng quan (dashboard)
closeTab("tab-1");
assert(workspaceState.tabs.length === 1, "G0-09b: Đóng tab cuối cùng giữ lại đúng 1 tab");
assert(getActiveTab().routeId === "dashboard", "G0-09b: Đóng tab cuối cùng tự động chuyển về Tổng quan dashboard");

// Kiểm tra danh mục phân nhóm NAVIGATION_SECTIONS dùng chung
import { NAVIGATION_SECTIONS } from "../src/app/routes.js";
assert(NAVIGATION_SECTIONS.length === 5, "G0-Nav: NAVIGATION_SECTIONS có đúng 5 nhóm");
assert(NAVIGATION_SECTIONS[0].id === "overview" && NAVIGATION_SECTIONS[0].routeIds[0] === "dashboard", "G0-Nav: Tổng quan nằm riêng ở đầu");
assert(NAVIGATION_SECTIONS[1].title === "HỌC TẬP & LỊCH TRÌNH" && NAVIGATION_SECTIONS[1].routeIds.length === 4, "G0-Nav: Nhóm Học tập & Lịch trình có 4 mục");
assert(NAVIGATION_SECTIONS[2].title === "CÔNG CỤ" && ['quiz', 'weaknesses', 'exam-plan-ai', 'leave-letter'].every(id => NAVIGATION_SECTIONS[2].routeIds.includes(id)), "G0-Nav: Nhóm Công cụ có đủ các luồng Sprint 3");
assert(NAVIGATION_SECTIONS[3].routeIds.includes("progress") && NAVIGATION_SECTIONS[3].routeIds.includes("notifications"), "G0-Nav: Phía cuối danh sách là Tiến độ & Thông báo");
assert(NAVIGATION_SECTIONS[4].routeIds.includes("sync") && NAVIGATION_SECTIONS[4].routeIds.includes("profile"), "G0-Nav: Footer cố định là Đồng bộ dữ liệu & Hồ sơ cá nhân");

// Đồng bộ nguồn (IU + EduX, mỗi nguồn có trạng thái riêng)
console.log("\n[G0] KIỂM TRA NGUỒN ĐỒNG BỘ");
assert(syncState.selectedSources.length === 2, "G0-10: Mặc định chọn 2 nguồn IU + EduX");
assert(syncState.selectedSources.includes("iu"), "G0-10: Nguồn mặc định có IU");
assert(syncState.selectedSources.includes("edux"), "G0-10: Nguồn mặc định có EduX");
assert(syncState.sourceStatuses.iu === "unconnected" && syncState.sourceStatuses.edux === "unconnected",
  "G0-10: Hai nguồn có trạng thái riêng, cùng bắt đầu ở unconnected");
toggleSourceSelection("iu");
assert(syncState.selectedSources.length === 1, "G0-11: Bỏ chọn IU còn 1");
toggleSourceSelection("edux");
assert(syncState.selectedSources.length === 0, "G0-11: Bỏ chọn cả 2 còn 0");
selectAllSources();
assert(syncState.selectedSources.length === 2, "G0-11: Chọn lại tất cả (IU + EduX)");
deselectAllSources();
assert(syncState.selectedSources.length === 0, "G0-11: Bỏ chọn tất cả");
const blockedResult = openSchoolPortals([]);
assert(!blockedResult.success, "G0-11: Không có nguồn nào được chọn thì chặn mở cổng");
selectAllSources();

// --- G1: Thời khóa biểu & Xung đột lịch ---
console.log("\n[G1] KIỂM TRA THỜI KHÓA BIỂU & XUNG ĐỘT LỊCH");
const s1 = addLocalStudySession({
  title: "Ôn Cấu trúc dữ liệu",
  subject: "CTDL",
  date: "2026-10-20",
  start: "08:00",
  end: "10:00"
});
assert(state.studyEvents.length === 1, "G1: Thêm buổi tự học 1 thành công");

const s2 = addLocalStudySession({
  title: "Luyện bài tập C++",
  subject: "CTDL",
  date: "2026-10-20",
  start: "09:30",
  end: "11:30"
});
assert(state.studyEvents.length === 2, "G1: Thêm buổi tự học 2 (trùng giờ) thành công");

const conflictCheck = findScheduleConflicts(state.studyEvents);
assert(conflictCheck.count === 1, "G1: Phát hiện chính xác 1 cặp xung đột lịch");
assert(conflictCheck.conflictingEventIds.has(s1.id), "G1: Buổi học 1 bị đánh dấu xung đột đỏ");
assert(conflictCheck.conflictingEventIds.has(s2.id), "G1: Buổi học 2 cũng bị đánh dấu xung đột đỏ (khắc phục lỗi ảnh 08)");

deleteLocalStudySession(s2.id);
assert(findScheduleConflicts(state.studyEvents).count === 0, "G1: Xóa buổi trùng thì hết xung đột");

// --- G2: Công việc, Deadline & Checklist ---
console.log("\n[G2] KIỂM TRA CÔNG VIỆC, DEADLINE & CHECKLIST");
const t1 = addLocalTask({
  title: "Hoàn thành Lab 1",
  subject: "Lập trình Web",
  due: "2026-10-22T23:59",
  priority: "Cao",
  status: "Đang làm",
  checklist: [{ text: "Viết HTML", done: true }, { text: "Viết CSS", done: false }]
});
assert(state.tasks.length === 1, "G2: Thêm task thành công");
assert(t1.isLocalDraft, "G2: Task mang nhãn bản nháp cục bộ chưa lưu server");

updateLocalTask(t1.id, { status: "Hoàn thành" });
assert(state.tasks[0].status === "Hoàn thành", "G2: Cập nhật trạng thái Hoàn thành thành công");

// --- G3: Thông báo nhắc deadline đa tầng ---
console.log("\n[G3] KIỂM TRA THÔNG BÁO NHẮC DEADLINE");
// Thêm task sắp đến hạn trong 2 giờ (sử dụng local datetime format như datetime-local input)
const targetDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
const pad = (n) => String(n).padStart(2, "0");
const nearDue = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;

const t2 = addLocalTask({
  title: "Nộp báo cáo gấp",
  subject: "CSDL",
  due: nearDue,
  priority: "Cao",
  status: "Đang làm"
});
assert(state.notifications.length > 0, "G3: Tự động kích hoạt thông báo nhắc hạn nộp 3 giờ");
const unreadNotifs = state.notifications.filter(n => !n.read);
assert(unreadNotifs.length > 0, "G3: Có thông báo chưa đọc");
markNotificationAsRead(unreadNotifs[0].id);
assert(state.notifications.find(n => n.id === unreadNotifs[0].id).read, "G3: Đánh dấu đã đọc thành công");

// --- G4: Kỳ thi & Lộ trình ---
console.log("\n[G4] KIỂM TRA KỲ THI & KẾ HOẠCH ÔN THI");
const ex1 = addLocalExam({
  subject: "Cơ sở dữ liệu",
  code: "DBI202",
  date: "2026-10-28",
  start: "08:00",
  duration: 90,
  room: "A205",
  studyMilestones: [{ title: "Ôn tập SQL", targetDate: "2026-10-25" }]
});
assert(state.exams.length === 1, "G4: Thêm kỳ thi thủ công thành công");
assert(ex1.source === "Tự thêm", "G4: Nguồn là Tự thêm, không gán CMC Sync giả");

// --- G5: Hồ sơ cá nhân & Đăng xuất ---
console.log("\n[G5] KIỂM TRA HỒ SƠ & THOÁT PHIÊN (LOGOUT)");
state.studentProfile = {
  name: "Sinh viên CMC Test",
  studentId: "24IT999",
  major: "CNTT",
  classGroup: "24IT1",
  email: "test@cmcu.edu.vn"
};
assert(state.studentProfile.name === "Sinh viên CMC Test", "G5: Hồ sơ cá nhân được cập nhật bản nháp cục bộ");

// Logout
resetSessionState();
resetWorkspaceTabs();
resetSyncState();
assert(!("screen" in state), "G5: Logout ở lại Workspace, không quay về Landing");
assert(state.studentProfile === null, "G5: Dọn sạch thông tin sinh viên");
assert(state.tasks.length === 0, "G5: Dọn sạch tasks trong phiên");
assert(state.studyEvents.length === 0, "G5: Dọn sạch lịch tự học trong phiên");
assert(workspaceState.tabs.length === 1, "G5: Khôi phục tab mặc định");

console.log("\n====================================================");
console.log("       TẤT CẢ TEST INTEGRATION G0-G5 ĐÃ ĐẠT!        ");
console.log("====================================================");
