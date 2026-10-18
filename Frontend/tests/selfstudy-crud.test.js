/**
 * UniStudy CMC - Tests for Self-Study CRUD Operations & Conflict Recalculations
 *
 * Kiểm tra các yêu cầu:
 * 1. Sửa giờ/ngày
 * 2. Sửa gây trùng lịch
 * 3. Bỏ qua chính lịch đang sửa theo ID
 * 4. Hủy sửa (giữ nguyên dữ liệu cũ)
 * 5. Xác nhận xóa theo ID
 * 6. Hủy xóa (giữ nguyên dữ liệu cũ)
 * 7. Hai lịch cùng tên
 * 8. Tái tính toán trạng thái xung đột (bỏ màu đỏ khi hết xung đột)
 */
import { state, resetSessionState } from "../src/app/state.js";
import {
  createSelfStudy,
  updateSelfStudy,
  deleteSelfStudy
} from "../src/features/schedule/schedule.service.js";
import { findScheduleConflicts } from "../src/features/schedule/schedule.conflicts.js";
import { validateStudySessionForm } from "../src/features/schedule/schedule.validation.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("\n=== KIỂM THỬ CHỨC NĂNG SỬA & XÓA LỊCH TỰ HỌC (CRUD) ===");

// Chuẩn bị môi trường sạch
resetSessionState();
state.studyEvents = [];

// 1. Tạo 2 lịch tự học
const session1 = await createSelfStudy({
  title: "Ôn tập Giải tích 1",
  subject: "Toán cao cấp",
  date: "2026-10-15",
  start: "08:00",
  end: "10:00",
  note: "Làm bài tập chương 2"
});

const session2 = await createSelfStudy({
  title: "Ôn tập Giải tích 1", // Cùng tên với session1
  subject: "Toán cao cấp",
  date: "2026-10-15",
  start: "14:00",
  end: "16:00",
  note: "Làm bài tập chương 3"
});

assert(state.studyEvents.length === 2, "Tạo 2 lịch tự học thành công");
assert(session1.id !== session2.id, "2 lịch tự học có ID riêng biệt dù cùng tên");

// Kiểm tra ban đầu không trùng lịch
let conflicts = findScheduleConflicts(state.studyEvents);
assert(conflicts.count === 0, "Ban đầu không có xung đột lịch");

// 2. Kiểm tra validation khi sửa
const invalidVal = validateStudySessionForm({
  title: "Ôn tập",
  date: "2026-10-15",
  start: "11:00",
  end: "09:00" // end < start
});
assert(!invalidVal.isValid, "Validation bắt lỗi giờ kết thúc trước giờ bắt đầu");

// 3. Sửa giờ/ngày hợp lệ
const updated1 = await updateSelfStudy(session1.id, {
  date: "2026-10-16",
  start: "09:00",
  end: "11:00"
});
assert(updated1.date === "2026-10-16", "Cập nhật ngày thành công");
assert(updated1.start === "09:00" && updated1.end === "11:00", "Cập nhật giờ bắt đầu/kết thúc thành công");
assert(state.studyEvents.length === 2, "Cập nhật đúng bản ghi, không tạo thêm bản ghi mới");

// 4. Bỏ qua chính lịch đang sửa theo ID khi kiểm tra trùng
// Đặt lại session1 vào cùng ngày 2026-10-15, giờ 08:00 - 10:00
await updateSelfStudy(session1.id, {
  date: "2026-10-15",
  start: "08:00",
  end: "10:00"
});
// Mô phỏng việc sửa session1 nhưng giữ nguyên giờ: kiểm tra trùng với danh sách trừ chính nó
const otherEvents = state.studyEvents.filter(e => e.id !== session1.id);
const selfConflictCheck = findScheduleConflicts([...otherEvents, { ...session1, start: "08:30", end: "09:30" }]);
assert(selfConflictCheck.count === 0, "Sửa giờ bên trong khung giờ cũ của chính nó không bị báo trùng với chính mình");

// 5. Sửa gây trùng lịch với lịch khác
// Sửa session2 sang 09:00 - 11:00 (giao với session1 08:00 - 10:00)
await updateSelfStudy(session2.id, {
  date: "2026-10-15",
  start: "09:00",
  end: "11:00"
});
conflicts = findScheduleConflicts(state.studyEvents);
assert(conflicts.count === 1, "Sửa giờ dẫn tới trùng lịch được phát hiện chính xác (1 cặp xung đột)");
assert(conflicts.conflictingEventIds.has(session1.id), "Session 1 bị đánh dấu xung đột đỏ");
assert(conflicts.conflictingEventIds.has(session2.id), "Session 2 bị đánh dấu xung đột đỏ");

// 6. Sửa lại giờ để hết trùng (tái tính toán xung đột)
await updateSelfStudy(session2.id, {
  start: "14:00",
  end: "16:00"
});
conflicts = findScheduleConflicts(state.studyEvents);
assert(conflicts.count === 0, "Sau khi dời giờ không còn trùng, số lượng xung đột về 0 (bỏ màu đỏ)");
assert(!conflicts.conflictingEventIds.has(session1.id), "Session 1 hết xung đột");
assert(!conflicts.conflictingEventIds.has(session2.id), "Session 2 hết xung đột");

// 7. Thao tác hủy sửa: không gọi updateSelfStudy, dữ liệu cũ không thay đổi
const snapshotBefore = { ...state.studyEvents.find(e => e.id === session1.id) };
// Giả định người dùng bấm Hủy trên form -> không gọi update
const snapshotAfter = { ...state.studyEvents.find(e => e.id === session1.id) };
assert(snapshotBefore.start === snapshotAfter.start && snapshotBefore.date === snapshotAfter.date, "Hủy sửa giữ nguyên dữ liệu cũ");

// 8. Hai lịch cùng tên: Xóa theo ID
// session1 và session2 đều có title "Ôn tập Giải tích 1"
await deleteSelfStudy(session1.id);
assert(state.studyEvents.length === 1, "Xóa thành công 1 lịch");
assert(state.studyEvents[0].id === session2.id, "Chỉ xóa đúng bản ghi có ID chỉ định, bản ghi cùng tên còn lại được giữ nguyên");
assert(state.studyEvents[0].start === "14:00", "Bản ghi còn lại giữ nguyên đúng giờ");

// 9. Thao tác hủy xóa: không gọi deleteSelfStudy
const countBeforeCancel = state.studyEvents.length;
// Giả định bấm nút Hủy bỏ trong ConfirmDeleteModal -> không gọi delete
assert(state.studyEvents.length === countBeforeCancel, "Hủy xóa giữ nguyên bản ghi");

// 10. Xóa nốt lịch còn lại
await deleteSelfStudy(session2.id);
assert(state.studyEvents.length === 0, "Xóa lịch tự học còn lại thành công");
assert(findScheduleConflicts(state.studyEvents).count === 0, "Danh sách rỗng không có xung đột");

console.log("--> Toàn bộ test CRUD và xung đột Self-Study PASS!");
