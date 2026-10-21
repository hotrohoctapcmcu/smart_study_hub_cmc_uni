/**
 * UniStudy CMC - Automated Tests for Pomodoro Feature
 */
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  startBreakSession,
  startNextStudySession,
  setDurations,
  getRemainingTime,
  getState,
  clearAllHistory
} from "../src/features/pomodoro/pomodoro.service.js";
import { getHistory, clearHistory } from "../src/features/pomodoro/pomodoro.storage.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`POMODORO TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("\n=== KIỂM THỬ CHỨC NĂNG POMODORO (TIMER & STORAGE) ===");

// 1. Dọn dẹp ban đầu
clearAllHistory();
endSession(false);

const initial = getState();
assert(initial.state === "idle", "Trạng thái ban đầu là idle");
assert(initial.mode === "study", "Chế độ ban đầu là study");
assert(initial.workDurationMinutes === 25, "Thời gian học mặc định là 25 phút");
assert(initial.breakDurationMinutes === 5, "Thời gian nghỉ mặc định là 5 phút");

// 2. Kiểm tra thay đổi thời lượng hợp lệ
setDurations(30, 10);
const updatedDurations = getState();
assert(updatedDurations.workDurationMinutes === 30, "Đổi thời gian học thành 30 phút thành công");
assert(updatedDurations.breakDurationMinutes === 10, "Đổi thời gian nghỉ thành 10 phút thành công");

// 3. Khởi động phiên học
startSession(30, 10);
const runningState = getState();
assert(runningState.state === "running", "Bắt đầu phiên học: state chuyển sang running");
assert(runningState.mode === "study", "Chế độ học tập study đang chạy");
assert(runningState.targetEndTime > Date.now(), "Mốc kết thúc targetEndTime được tạo chính xác theo timestamp");

const remTime = getRemainingTime();
assert(remTime.minutes <= 30, "Số phút còn lại <= 30");

// Không cho đổi thời lượng khi đang chạy
const canChangeWhileRunning = setDurations(45, 15);
assert(!canChangeWhileRunning, "Khóa thay đổi thời lượng khi phiên đang chạy");

// 4. Tạm dừng
pauseSession();
const pausedState = getState();
assert(pausedState.state === "paused", "Tạm dừng phiên học: state chuyển sang paused");
assert(pausedState.targetEndTime === null, "Khi tạm dừng, targetEndTime được gán null để tránh trôi thời gian");
assert(pausedState.remainingMs > 0, "Thời gian còn lại được bảo toàn");

// 5. Tiếp tục
resumeSession();
const resumedState = getState();
assert(resumedState.state === "running", "Tiếp tục phiên học: state trở lại running");
assert(resumedState.targetEndTime !== null, "targetEndTime được tính toán lại chính xác dựa trên remainingMs");

// 6. Kết thúc sớm
endSession(true);
const endedEarlyState = getState();
assert(endedEarlyState.state === "idle", "Kết thúc sớm: state trở về idle");

// 7. Chuyển sang phiên nghỉ và kiểm tra
startSession(1, 1);
startBreakSession();
const breakState = getState();
assert(breakState.mode === "break", "Chuyển sang chế độ nghỉ ngơi break");
assert(breakState.state === "break_running", "Giờ nghỉ đang chạy: break_running");

endSession(false);
const resetState = getState();
assert(resetState.state === "idle", "Reset hoàn toàn phiên về idle");

// 8. Kiểm tra xóa lịch sử
clearAllHistory();
assert(getHistory().length === 0, "Xóa toàn bộ lịch sử thành công");

// 9. Kiểm tra âm thanh chuông báo và file asset
import("../src/shared/config/assets.js").then(({ ASSETS }) => {
  assert(ASSETS.sounds && ASSETS.sounds.pomodoro === "assets/amthanh.mp3", "Asset âm thanh Pomodoro được cấu hình đúng: assets/amthanh.mp3");
  const s = getState();
  assert(typeof s.soundEnabled === "boolean", "Trạng thái soundEnabled có trong state");
  console.log("--> Toàn bộ test Pomodoro & Âm thanh PASS!\n");
});

