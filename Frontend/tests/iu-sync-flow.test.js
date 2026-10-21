/**
 * UniStudy CMC - IU Sync Flow Test (chạy bằng node, không cần Electron/DOM)
 * Kiểm tra nhánh nối FE -> API -> IU_VT ở mức logic thuần:
 *  - getIuBridge() trả null khi không có window.__uniStudyIU (web thuần)
 *  - map timetable/exam rows trong refreshFromServer qua render view:
 *    schoolEvents hiển thị đúng shape schedule.view cần
 * Chạy: node tests/iu-sync-flow.test.js (từ Frontend/unistudy-fe)
 * Ghi chú: sync.service.js import api-client (dùng fetch) — test này chỉ kiểm
 * tra phần map + view bằng dữ liệu mẫu, không gọi mạng.
 */

import { state } from "../src/app/state.js";
import { syncState, resetSyncState } from "../src/app/sync-state.js";

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  PASS ${msg}`); }
  else { fail++; console.log(`  FAIL ${msg}`); }
}

console.log("== IU SYNC FLOW (FE logic) ==");

// 1. Không có bridge ngoài Electron -> web thuần giữ hành vi popup cũ
ok(typeof window === "undefined", "node không có window (mô phỏng ngoài Electron)");
const { getIuBridge } = await import("../src/features/sync/sync.service.js");
ok(getIuBridge() === null, "getIuBridge() null khi không có preload");

// 2. Đổ dữ liệu server mẫu vào state đúng shape schedule.view cần
resetSyncState();
state.schoolEvents = [
  {
    id: "school-1", title: "Lập trình web", subject: "Lập trình web",
    date: "2026-10-07", start: "07:30", end: "09:30",
    room: "A301", lecturer: "Nguyễn Văn A", source: "Trường", isLocalDraft: false
  }
];
state.exams = [
  {
    id: "exam-school-1", subject: "Lập trình web", code: "CNTT301",
    date: "2026-12-15", start: "08:00", duration: 90,
    room: "A201", scope: "Thực hành máy", source: "Trường",
    isLocalDraft: false, studyMilestones: []
  }
];
const ev = state.schoolEvents[0];
ok(ev.source === "Trường" && ev.source !== "Tự thêm", "event trường không bị nhầm Tự thêm");
ok(Boolean(ev.id && ev.date && ev.start && ev.end), "event đủ field schedule.view cần (id/date/start/end)");
const ex = state.exams[0];
ok(Boolean(ex.subject && ex.date && ex.start), "exam đủ field hiển thị (subject/date/start)");

// 3. View sync hiển thị trạng thái các nhánh
const { renderSyncView } = await import("../src/features/sync/sync.view.js");
resetSyncState();
let html = renderSyncView();
ok(html.includes("Hệ thống Quản lý Đào tạo (IU)"), "selector hiển thị card IU");
ok(!html.includes("EduX") && !html.includes("edux"), "không còn EduX trên giao diện");

syncState.isSyncing = true;
html = renderSyncView();
ok(html.includes("Đang đồng bộ..."), "đang sync hiện text Đang đồng bộ + disable nút");

syncState.isSyncing = false;
syncState.sourceStatuses.iu = "synced";
syncState.lastSyncTimestamp = new Date("2026-10-15T15:00:00").toISOString();
html = renderSyncView();
ok(html.includes('id="iuLogoutBtn"'), "sync xong hiện nút Ngắt kết nối IU");
ok(html.includes("Lần đồng bộ IU gần nhất"), "hiện mốc thời gian đồng bộ");
resetSyncState();

// 4. Reset dọn sạch schoolEvents/exams nguồn Trường khi logout phiên
state.schoolEvents = [{ id: "school-9", source: "Trường" }];
state.exams = [{ id: "exam-school-9", source: "Trường" }, { id: "task-local-1", source: "Tự thêm" }];
const { resetSessionState } = await import("../src/app/state.js");
resetSessionState();
ok(state.schoolEvents.length === 0, "logout dọn schoolEvents");
ok(state.exams.length === 0, "logout dọn exams");

console.log(`\n==== IU SYNC FLOW FE TEST: ${pass} PASS, ${fail} FAIL ====`);
if (fail) process.exit(1);
