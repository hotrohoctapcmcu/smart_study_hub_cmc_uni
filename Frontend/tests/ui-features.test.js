/**
 * UniStudy CMC - Tests for UI Fixes (5 Areas)
 */
import { getState, startSession, endSession, setDurations } from "../src/features/pomodoro/pomodoro.service.js";
import { renderPomodoroView } from "../src/features/pomodoro/pomodoro.view.js";
import { renderScheduleView } from "../src/features/schedule/schedule.view.js";
import { renderTasksView, renderTaskModal, renderTaskDetailModal } from "../src/features/tasks/tasks.view.js";
import { validateTask } from "../src/features/tasks/tasks.validation.js";
import { renderDocumentsView, DOCUMENT_CATEGORIES } from "../src/features/documents/documents.view.js";
import { getDocuments, addDocument, getNotes, createNote, updateNote, deleteNote } from "../src/features/documents/documents.service.js";
import { state, addLocalTask, updateLocalTask } from "../src/app/state.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("\n====================================================");
console.log("   KIỂM THỬ 5 KHU VỰC GIAO DIỆN (POMODORO, LỊCH, TASKS, DOCS, NOTES)");
console.log("====================================================");

// 1. POMODORO
console.log("\n[1] POMODORO - VÒNG TRÒN SVG & RESPONSIVE");
endSession(false);
const pomoHtml = renderPomodoroView();
assert(pomoHtml.includes('class="pomo-circle-svg"'), "Có SVG vòng tròn tiến độ");
assert(pomoHtml.includes('id="pomoCircleProgress"'), "Có phần tử stroke SVG cập nhật tiến độ");
assert(pomoHtml.includes('stroke-dasharray: 722.57') || pomoHtml.includes('stroke-dasharray="722.57"'), "Vòng tròn có chu vi 2*pi*r chuẩn 722.57");
assert(pomoHtml.includes('id="pomoCountdownDisplay"'), "Số thời gian nằm trong bộ đếm");
assert(pomoHtml.includes('class="pomo-fox-container"'), "Sticker Cáo CMC được bố trí riêng");
assert(pomoHtml.includes('data-quick-work="15"') && pomoHtml.includes('data-quick-work="25"') && pomoHtml.includes('data-quick-work="45"'), "Đầy đủ các nút chọn nhanh 15, 25, 45 phút");
assert(pomoHtml.includes('id="pomoHoursInput"') && pomoHtml.includes('id="pomoMinutesInput"') && pomoHtml.includes('id="pomoSecondsInput"'), "Đầy đủ các ô nhập giờ, phút, giây");

// 2. LỊCH HỌC
console.log("\n[2] LỊCH HỌC - BỐ CỤC 2 CỘT & BỎ CỤM ĐIỀU HƯỚNG TRÊN TOOLBAR CHÍNH");
const schedHtml = renderScheduleView();
assert(schedHtml.includes('class="schedule-body-layout"'), "Có bố cục 2 cột schedule-body-layout");
assert(schedHtml.includes('class="schedule-main-col"'), "Có cột lịch chính lớn bên trái");
assert(schedHtml.includes('class="schedule-side-col"'), "Có cột lịch nhỏ & chú giải bên phải");
assert(!schedHtml.includes('id="schedulePrevDateBtn"'), "Đã bỏ nút tua trước trên thanh công cụ chính");
assert(!schedHtml.includes('id="scheduleNextDateBtn"'), "Đã bỏ nút tua kế tiếp trên thanh công cụ chính");
assert(!schedHtml.includes('id="scheduleDatePicker"'), "Đã bỏ ô nhập/chọn datepicker trên thanh công cụ chính");
assert(!schedHtml.includes('class="schedule-period-badge"'), "Đã bỏ nhãn khoảng thời gian trên thanh công cụ chính");
assert(schedHtml.includes('id="miniCalPrevBtn"') && schedHtml.includes('id="miniCalNextBtn"'), "Lịch nhỏ có đầy đủ nút chuyển tháng");
assert(schedHtml.includes('id="miniCalTitle"'), "Lịch nhỏ có tiêu đề tháng/năm rõ ràng");
assert(schedHtml.includes('class="schedule-legend-card"'), "Có bảng chú giải màu sắc");

// 3. CÔNG VIỆC
console.log("\n[3] CÔNG VIỆC - FORM GỌN & HOÀN THÀNH THUẬN TIỆN");
const taskFormHtml = renderTaskModal();
const titlePos = taskFormHtml.indexOf("1. Tên công việc");
const timePos = taskFormHtml.indexOf("2. Thời gian thực hiện");
const chkPos = taskFormHtml.indexOf("3. Danh sách mục cần làm");
const descPos = taskFormHtml.indexOf("4. Mô tả chi tiết");

assert(titlePos !== -1 && timePos !== -1 && chkPos !== -1 && descPos !== -1, "Form có đủ 4 phần theo thứ tự");
assert(titlePos < timePos && timePos < chkPos && chkPos < descPos, "Thứ tự form chuẩn: 1) Tên -> 2) Thời gian -> 3) Checklist -> 4) Mô tả");
assert(taskFormHtml.includes('name="startTime"') && taskFormHtml.includes('name="due"'), "Có trường Bắt đầu và Hạn hoàn thành");

// Validation thời gian: startTime > due phải báo lỗi
const invalidTime = validateTask({
  title: "Làm bài tập",
  startTime: "2026-10-25T15:00",
  due: "2026-10-25T10:00"
});
assert(!invalidTime.isValid && invalidTime.errors.due, "Validation chặn khi Hạn hoàn thành trước Bắt đầu");

const validTime = validateTask({
  title: "Làm bài tập",
  startTime: "2026-10-25T10:00",
  due: "2026-10-25T15:00"
});
assert(validTime.isValid, "Validation chấp nhận khi Hạn hoàn thành sau Bắt đầu");

// Khung chi tiết công việc
const sampleTask = {
  id: "test-task-1",
  title: "Bài tập lớn môn Web",
  startTime: "2026-10-21T08:00",
  due: "2026-10-24T23:59",
  status: "Đang làm",
  priority: "Cao",
  checklist: [
    { id: "c1", text: "Thiết kế giao diện", done: true },
    { id: "c2", text: "Viết logic client", done: false }
  ]
};
const detailHtml = renderTaskDetailModal(sampleTask);
assert(detailHtml.includes('id="taskDetailViewModal"'), "Render được khung chi tiết công việc");
assert(detailHtml.includes('class="interactive-chk-box"'), "Checklist có checkbox tương tác trực tiếp");

// Bảng danh sách công việc có quick-complete checkbox
state.tasks = [sampleTask];
const tasksViewHtml = renderTasksView();
assert(tasksViewHtml.includes('class="task-quick-complete-box"'), "Bảng công việc có checkbox hoàn thành nhanh");
assert(tasksViewHtml.includes('data-open-task-detail="test-task-1"'), "Nhấn dòng/tiêu đề mở chi tiết");

// 4. KHO TÀI LIỆU
console.log("\n[4] KHO TÀI LIỆU - PHÂN LOẠI & KHOẢNG CÁCH");
assert(!DOCUMENT_CATEGORIES.includes("Textbook điện tử"), "Không chứa Textbook điện tử đã bỏ");
const docsViewHtml = renderDocumentsView({ docTab: "docs" });
assert(docsViewHtml.includes('class="doc-quick-category-bar"'), "Có dải chọn nhanh loại tài liệu");
assert(docsViewHtml.includes('id="docCategorySelect"'), "Có dropdown loại tài liệu");
assert(docsViewHtml.includes('id="docSearchInput"'), "Có ô tìm kiếm tài liệu");

// 5. SỔ TAY GHI CHÚ
console.log("\n[5] SỔ TAY GHI CHÚ - ĐẢO BỐ CỤC (TRANG GIẤY BÊN TRÁI, DANH SÁCH BÊN PHẢI)");
const notesViewHtml = renderDocumentsView({ docTab: "notes" });
const paperEditorPos = notesViewHtml.indexOf('class="notes-paper-editor"');
const pagesSidebarPos = notesViewHtml.indexOf('class="notes-sidebar-pages"');
assert(paperEditorPos !== -1 && pagesSidebarPos !== -1, "Có cột soạn thảo và cột danh sách trang");
assert(paperEditorPos < pagesSidebarPos, "Trang giấy soạn thảo nằm bên TRÁI (xuất hiện trước trong DOM)");
assert(notesViewHtml.includes('id="saveNoteManualBtn"'), "Có nút Lưu trên đầu trang giấy");
assert(notesViewHtml.includes('id="deleteCurrentNoteBtn"'), "Có nút Xóa trên đầu trang giấy");
assert(notesViewHtml.includes('id="paperSaveStatus"'), "Có thanh trạng thái lưu trên đầu trang giấy");
assert(notesViewHtml.includes('id="createNewNoteBtn"'), "Có nút Tạo trang mới trong cột danh sách bên phải");

console.log("\n====================================================");
console.log("   TẤT CẢ TEST UI FEATURES 5 KHU VỰC ĐÃ VƯỢT QUA 100%!");
console.log("====================================================\n");
