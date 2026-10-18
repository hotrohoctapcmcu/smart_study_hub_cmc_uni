/**
 * Unit Test: Date & Time Utilities (date.js)
 */
import { 
  timeStringToMinutes, 
  minutesToTimeString, 
  formatDateISO, 
  formatDateVN, 
  getDaysOfWeek,
  shiftDateByDays,
  shiftDateByMonths
} from "../src/shared/utils/date.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("=== KIỂM THỬ DATE UTILITIES ===");

assert(timeStringToMinutes("08:30") === 510, "08:30 đổi thành 510 phút");
assert(timeStringToMinutes("00:00") === 0, "00:00 đổi thành 0 phút");
assert(timeStringToMinutes("23:59") === 1439, "23:59 đổi thành 1439 phút");

assert(minutesToTimeString(510) === "08:30", "510 phút đổi lại thành 08:30");
assert(minutesToTimeString(0) === "00:00", "0 phút đổi lại thành 00:00");

const testDate = new Date(2026, 9, 15); // 15/10/2026
assert(formatDateISO(testDate) === "2026-10-15", "formatDateISO ra đúng chuỗi YYYY-MM-DD");
assert(formatDateVN(testDate) === "15/10/2026", "formatDateVN ra đúng chuỗi DD/MM/YYYY");

const weekDays = getDaysOfWeek("2026-10-15");
assert(weekDays.length === 7, "Tuần luôn có đủ 7 ngày");
assert(weekDays[0].dayName === "Thứ 2", "Ngày đầu tuần là Thứ 2");
assert(weekDays[6].dayName === "Chủ nhật", "Ngày cuối tuần là Chủ nhật");

// Kiểm thử chuyển ngày / tuần
assert(shiftDateByDays("2026-01-31", 1) === "2026-02-01", "Chuyển +1 ngày qua cuối tháng đúng");
assert(shiftDateByDays("2026-03-01", -1) === "2026-02-28", "Chuyển -1 ngày qua đầu tháng đúng");
assert(shiftDateByDays("2026-12-31", 1) === "2027-01-01", "Chuyển +1 ngày qua cuối năm đúng");
assert(shiftDateByDays("2027-01-01", -1) === "2026-12-31", "Chuyển -1 ngày qua đầu năm đúng");
assert(shiftDateByDays("2026-12-28", 7) === "2027-01-04", "Chế độ Tuần: +7 ngày qua cuối năm đúng");
assert(shiftDateByDays("2027-01-04", -7) === "2026-12-28", "Chế độ Tuần: -7 ngày về năm cũ đúng");

// Kiểm thử chuyển tháng
assert(shiftDateByMonths("2026-05-15", 1) === "2026-06-15", "Chế độ Tháng: +1 tháng bình thường đúng");
assert(shiftDateByMonths("2026-05-15", -1) === "2026-04-15", "Chế độ Tháng: -1 tháng bình thường đúng");
assert(shiftDateByMonths("2026-01-31", 1) === "2026-02-28", "Chế độ Tháng: 31/01 + 1 tháng clamp về 28/02 đúng");
assert(shiftDateByMonths("2026-03-31", -1) === "2026-02-28", "Chế độ Tháng: 31/03 - 1 tháng clamp về 28/02 đúng");
assert(shiftDateByMonths("2026-08-31", 1) === "2026-09-30", "Chế độ Tháng: 31/08 + 1 tháng clamp về 30/09 đúng");
assert(shiftDateByMonths("2026-12-15", 1) === "2027-01-15", "Chế độ Tháng: +1 tháng qua năm mới đúng");
assert(shiftDateByMonths("2027-01-15", -1) === "2026-12-15", "Chế độ Tháng: -1 tháng về năm cũ đúng");

console.log("--> Toàn bộ test date utilities PASS!\n");
