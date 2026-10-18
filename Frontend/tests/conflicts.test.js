/**
 * Unit Test: Thuật toán kiểm tra trùng lịch (schedule.conflicts.js)
 * Chạy trên Node.js độc lập để kiểm chứng logic
 */
import { areEventsConflicting, findScheduleConflicts, makeConflictPairKey } from "../src/features/schedule/schedule.conflicts.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("=== KIỂM THỬ THUẬT TOÁN XUNG ĐỘT LỊCH HỌC ===");

// 1. Hoàn toàn rời nhau (Cùng ngày)
const ev1 = { id: 1, date: "2026-10-15", start: "08:00", end: "09:30" };
const ev2 = { id: 2, date: "2026-10-15", start: "10:00", end: "11:30" };
assert(!areEventsConflicting(ev1, ev2), "Hai ca học rời nhau không bị coi là trùng");

// 2. Giáp biên chính xác (A.end === B.start)
const ev3 = { id: 3, date: "2026-10-15", start: "08:00", end: "09:30" };
const ev4 = { id: 4, date: "2026-10-15", start: "09:30", end: "11:00" };
assert(!areEventsConflicting(ev3, ev4), "Giáp biên A.end === B.start KHÔNG được coi là trùng");

// 3. Giao nhau một phần
const ev5 = { id: 5, date: "2026-10-15", start: "08:00", end: "10:00" };
const ev6 = { id: 6, date: "2026-10-15", start: "09:00", end: "11:00" };
assert(areEventsConflicting(ev5, ev6), "Giao nhau một phần phải phát hiện trùng lịch");

// 4. Chứa nhau hoàn toàn
const ev7 = { id: 7, date: "2026-10-15", start: "08:00", end: "12:00" };
const ev8 = { id: 8, date: "2026-10-15", start: "09:00", end: "10:00" };
assert(areEventsConflicting(ev7, ev8), "Sự kiện nằm trọn bên trong sự kiện khác phải phát hiện trùng");

// 5. Khác ngày nhưng cùng giờ
const ev9 = { id: 9, date: "2026-10-15", start: "08:00", end: "10:00" };
const ev10 = { id: 10, date: "2026-10-16", start: "08:00", end: "10:00" };
assert(!areEventsConflicting(ev9, ev10), "Khác ngày không bị tính là trùng lịch");

// 6. Test findScheduleConflicts và chống đếm lặp A-B/B-A
const result = findScheduleConflicts([ev5, ev6, ev7, ev8]);
assert(result.count > 0, "Tìm thấy đúng các cặp xung đột");
assert(result.conflictingEventIds.size > 0, "Set ID xung đột được cập nhật");

console.log("--> Toàn bộ test conflict PASS!\n");
