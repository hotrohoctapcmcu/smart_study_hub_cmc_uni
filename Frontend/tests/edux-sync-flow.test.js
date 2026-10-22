/**
 * UniStudy CMC - EDUX Sync Flow Test (chạy bằng node, không cần Electron/DOM)
 *
 * Kiểm tra nhánh FE của EDUX ở mức logic thuần:
 *  - mapEduxAssignment() chuẩn hoá đúng shape task mà tasks.view/dashboard cần
 *  - mergeEduxTasks() thay bài EduX cũ nhưng giữ nguyên task người dùng tự nhập
 *  - state không bao giờ chứa mật khẩu EduX
 *  - sync view hiển thị form đăng nhập khi chưa có phiên, và nút đồng bộ khi đã có
 *
 * Chạy: node tests/edux-sync-flow.test.js (từ Frontend/)
 */

import { state } from "../src/app/state.js";
import { syncState, resetSyncState } from "../src/app/sync-state.js";
import { mapEduxAssignment, mergeEduxTasks } from "../src/features/sync/sync.service.js";
import { renderSyncView } from "../src/features/sync/sync.view.js";

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  PASS ${msg}`); }
  else { fail++; console.log(`  FAIL ${msg}`); }
}

console.log("== EDUX SYNC FLOW (FE logic) ==");

const mau = {
  id: "edux-sub-1-model-9",
  title: "Chương 3: Cây nhị phân",
  subject: "Cấu trúc dữ liệu và giải thuật",
  subjectId: "sub-1",
  subjectCode: "CTDL",
  modelId: "model-9",
  chapter: "Chương 3",
  due: null,
  status: "Đang làm",
  priority: "Trung bình",
  description: "Bài tập AI môn CTDL",
  progress: { daHoc: 2, tongSo: 5, phanTram: 40 },
  highestScore: 8,
  source: "EDUX"
};

// 1. Map 1 bài EduX -> task frontend
const task = mapEduxAssignment(mau);
ok(task.id === mau.id, "giữ id ổn định để chống trùng giữa các lần đồng bộ");
ok(task.title === mau.title && task.subject === mau.subject, "map đúng title/subject");
ok(task.due === null, "không bịa deadline khi EduX không trả hạn nộp");
ok(task.source === "EDUX" && task.isLocalDraft === false, "đánh dấu nguồn EDUX, không phải bản nháp");
ok(task.status === "Đang làm", "giữ đúng trạng thái frontend dùng");
ok(task.highestScore === 8 && task.progress.daHoc === 2, "giữ điểm cao nhất và tiến độ");
ok(Array.isArray(task.checklist) && task.checklist.length === 0, "checklist rỗng để UI không vỡ");

// 2. Gộp vào state: thay bài EduX cũ, giữ task người dùng
state.tasks = [
  { id: "task-local-1", title: "Việc tự nhập", subject: "Cá nhân", due: "2026-11-01T10:00", status: "Chưa làm", checklist: [], isLocalDraft: true },
  { id: "edux-cu", title: "Bài EduX cũ", subject: "CTDL", due: null, status: "Chưa làm", checklist: [], source: "EDUX", isLocalDraft: false }
];
const soBai = mergeEduxTasks([mau]);
ok(soBai === 1, "merge trả về đúng số bài EduX");
ok(state.tasks.length === 2, "bài EduX cũ bị thay thế, không nhân đôi");
ok(state.tasks.some((t) => t.id === "task-local-1"), "task người dùng tự nhập được giữ nguyên");
ok(!state.tasks.some((t) => t.id === "edux-cu"), "bài EduX cũ đã bị loại bỏ");
ok(state.tasks.filter((t) => t.source === "EDUX").length === 1, "chỉ còn đúng 1 bài EduX");

// 3. Không lưu mật khẩu trong state
const stateText = JSON.stringify(syncState) + JSON.stringify(state);
ok(!/password|matKhau|At25107/i.test(stateText), "state không chứa mật khẩu EduX");

// 4. View theo trạng thái
resetSyncState();
state.tasks = [];
let html = renderSyncView();
ok(html.includes('id="eduxLoginForm"'), "chưa đăng nhập -> hiện form EduX");
ok(html.includes('id="eduxPasswordInput"') && html.includes('type="password"'), "ô mật khẩu đúng kiểu password");
ok(!html.includes("Ngắt kết nối EduX"), "chưa có phiên -> không hiện nút ngắt kết nối");

syncState.sourceStatuses.edux = "portal_opened";
syncState.eduxEmail = "sv@st.cmcu.edu.vn";
html = renderSyncView();
ok(html.includes('id="eduxSyncBtn"'), "đã đăng nhập -> hiện nút Đồng bộ EduX");
ok(html.includes('id="eduxLogoutBtn"'), "đã đăng nhập -> hiện nút Ngắt kết nối EduX");
ok(html.includes("sv@st.cmcu.edu.vn"), "hiển thị email phiên EduX");
ok(!html.includes('id="eduxLoginForm"'), "đã có phiên -> ẩn form đăng nhập");

syncState.sourceStatuses.edux = "error";
syncState.sourceMessages.edux = "Đồng bộ EduX thất bại: sai mật khẩu";
html = renderSyncView();
ok(html.includes("Đồng bộ EduX thất bại"), "hiện thông báo lỗi riêng của EduX");
ok(html.includes("Lỗi kết nối"), "trạng thái lỗi hiển thị đúng nhãn");

// 5. Bỏ chọn EduX -> không render khối đăng nhập
resetSyncState();
syncState.selectedSources = ["iu"];
html = renderSyncView();
ok(!html.includes('id="eduxLoginForm"'), "bỏ chọn EduX thì ẩn khối đăng nhập");

resetSyncState();
console.log(`\n==== EDUX SYNC FLOW FE TEST: ${pass} PASS, ${fail} FAIL ====`);
if (fail) process.exit(1);
