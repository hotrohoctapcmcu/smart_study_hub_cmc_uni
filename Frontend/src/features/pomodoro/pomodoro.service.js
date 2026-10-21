/**
 * UniStudy CMC - Pomodoro Service (Sprint 2 Nâng cấp)
 * Quản lý logic đồng hồ Pomodoro chính xác theo timestamp (không phụ thuộc setInterval 1s)
 * - Chọn giờ, phút, giây
 * - Nút chọn nhanh 15, 25, 45 phút
 * - Nút chọn thời gian nghỉ (5, 10, 15 phút hoặc tùy chỉnh)
 * - Bắt đầu, tạm dừng, tiếp tục và kết thúc
 * - Lưu và khôi phục phiên đang học cùng lịch sử phiên
 * - Dùng chung dữ liệu với Dashboard và Tiến độ
 */
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  getHistory,
  saveHistoryItem,
  clearHistory,
  getTotalPomodoroStudySeconds,
  getPomodoroStats
} from "./pomodoro.storage.js";

export { getTotalPomodoroStudySeconds, getPomodoroStats };

export const DEFAULT_POMODORO_CONFIG = {
  defaultWorkHours: 0,
  defaultWorkMinutes: 25,
  defaultWorkSeconds: 0,
  defaultBreakMinutes: 5,
  defaultBreakSeconds: 0
};

// Trạng thái phiên hiện tại trong RAM
let currentSession = null;
let timerIntervalId = null;
const listeners = new Set();

/**
 * Khởi tạo service khi nạp module
 */
function initService() {
  const saved = loadActiveSession();
  if (saved) {
    currentSession = saved;
    checkAndProcessCompletion();
    if (currentSession && (currentSession.state === "running" || currentSession.state === "break_running")) {
      startInterval();
    }
  } else {
    currentSession = createDefaultSession();
  }

  // Đăng ký sự kiện visibilitychange và window focus để cập nhật lại thời gian chính xác
  if (typeof window !== "undefined") {
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleAppFocusWake();
      }
    });
    window.addEventListener("focus", handleAppFocusWake);
  }
}

function createDefaultSession() {
  const totalWorkSec = 25 * 60;
  return {
    state: "idle", // "idle" | "running" | "paused" | "study_completed" | "break_running" | "break_paused" | "break_completed"
    mode: "study", // "study" | "break"
    workHours: 0,
    workMinutes: 25,
    workSeconds: 0,
    breakMinutes: 5,
    breakSeconds: 0,
    totalWorkSeconds: totalWorkSec,
    totalBreakSeconds: 5 * 60,
    targetEndTime: null, // Timestamp ms kết thúc
    remainingMs: totalWorkSec * 1000,
    startTime: null,
    lastResumeTime: null,
    actualStudyMs: 0,
    hasRecordedHistory: false
  };
}

/**
 * Đăng ký listener nhận thông báo mỗi nhịp đếm hoặc đổi trạng thái
 */
export function subscribePomodoro(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  const s = getState();
  listeners.forEach((fn) => {
    try {
      fn(s);
    } catch (err) {
      console.error("[Pomodoro Service] Lỗi listener:", err);
    }
  });
}

function startInterval() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(() => {
    tick();
  }, 500);
}

function stopInterval() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

/**
 * Nhịp đếm thời gian
 */
function tick() {
  if (!currentSession || (currentSession.state !== "running" && currentSession.state !== "break_running")) {
    stopInterval();
    return;
  }

  const now = Date.now();
  const remaining = Math.max(0, currentSession.targetEndTime - now);
  currentSession.remainingMs = remaining;

  if (remaining <= 0) {
    handleTimeExpired();
  } else {
    notifyListeners();
  }
}

/**
 * Xử lý khi hết giờ
 */
function handleTimeExpired() {
  stopInterval();
  const now = Date.now();

  if (currentSession.mode === "study") {
    // Hoàn thành phiên học
    if (!currentSession.hasRecordedHistory) {
      let studyMs = currentSession.actualStudyMs || 0;
      if (currentSession.lastResumeTime) {
        studyMs += Math.max(0, Math.min(now, currentSession.targetEndTime) - currentSession.lastResumeTime);
      }
      const actualSeconds = Math.round(studyMs / 1000);

      saveHistoryItem({
        id: `pomo-${currentSession.startTime || now}`,
        createdAt: new Date(currentSession.startTime || now).toISOString(),
        workDurationMinutes: Math.max(1, Math.round(currentSession.totalWorkSeconds / 60)),
        actualStudySeconds: Math.max(actualSeconds, currentSession.totalWorkSeconds),
        status: "Hoàn thành"
      });
      currentSession.hasRecordedHistory = true;
    }

    currentSession.state = "study_completed";
    currentSession.remainingMs = 0;
    currentSession.targetEndTime = null;
    saveActiveSession(currentSession);
    notifyListeners();
  } else if (currentSession.mode === "break") {
    // Hoàn thành giờ nghỉ
    currentSession.state = "break_completed";
    currentSession.remainingMs = 0;
    currentSession.targetEndTime = null;
    saveActiveSession(currentSession);
    notifyListeners();
  }
}

/**
 * Kiểm tra hoàn thành khi quay lại app
 */
function checkAndProcessCompletion() {
  if (!currentSession) return;
  if (currentSession.state === "running" || currentSession.state === "break_running") {
    const now = Date.now();
    if (currentSession.targetEndTime && now >= currentSession.targetEndTime) {
      handleTimeExpired();
    } else if (currentSession.targetEndTime) {
      currentSession.remainingMs = Math.max(0, currentSession.targetEndTime - now);
    }
  }
}

function handleAppFocusWake() {
  checkAndProcessCompletion();
  notifyListeners();
}

/**
 * Bắt đầu phiên học mới với Giờ, Phút, Giây
 */
export function startSession(hours = 0, minutes = 25, seconds = 0, breakMinutes = 5, breakSeconds = 0) {
  const h = Math.max(0, parseInt(hours, 10) || 0);
  const m = Math.max(0, parseInt(minutes, 10) || 0);
  const s = Math.max(0, parseInt(seconds, 10) || 0);
  const bMin = Math.max(0, parseInt(breakMinutes, 10) || 5);
  const bSec = Math.max(0, parseInt(breakSeconds, 10) || 0);

  let totalWorkSec = h * 3600 + m * 60 + s;
  if (totalWorkSec <= 0) {
    totalWorkSec = 25 * 60; // Mặc định 25 phút nếu nhập 0
  }

  let totalBreakSec = bMin * 60 + bSec;
  if (totalBreakSec <= 0) {
    totalBreakSec = 5 * 60;
  }

  const now = Date.now();
  const totalMs = totalWorkSec * 1000;

  currentSession = {
    state: "running",
    mode: "study",
    workHours: h,
    workMinutes: m,
    workSeconds: s,
    breakMinutes: bMin,
    breakSeconds: bSec,
    totalWorkSeconds: totalWorkSec,
    totalBreakSeconds: totalBreakSec,
    targetEndTime: now + totalMs,
    remainingMs: totalMs,
    startTime: now,
    lastResumeTime: now,
    actualStudyMs: 0,
    hasRecordedHistory: false
  };

  saveActiveSession(currentSession);
  startInterval();
  notifyListeners();
}

/**
 * Chọn nhanh thời gian học: 15, 25, 45 phút
 */
export function setQuickWorkMinutes(minutes) {
  const m = parseInt(minutes, 10) || 25;
  if (!currentSession) currentSession = createDefaultSession();
  if (currentSession.state === "running" || currentSession.state === "paused") {
    return false; // Không đổi khi đang chạy/tạm dừng
  }
  currentSession.workHours = 0;
  currentSession.workMinutes = m;
  currentSession.workSeconds = 0;
  currentSession.totalWorkSeconds = m * 60;
  currentSession.remainingMs = m * 60 * 1000;
  saveActiveSession(currentSession);
  notifyListeners();
  return true;
}

/**
 * Chọn thời gian nghỉ: 5, 10, 15 phút hoặc tùy chỉnh
 */
export function setQuickBreakMinutes(minutes) {
  const m = Math.max(1, parseInt(minutes, 10) || 5);
  if (!currentSession) currentSession = createDefaultSession();
  currentSession.breakMinutes = m;
  currentSession.breakSeconds = 0;
  currentSession.totalBreakSeconds = m * 60;
  saveActiveSession(currentSession);
  notifyListeners();
  return true;
}

/**
 * Cập nhật giá trị giờ, phút, giây thủ công khi ở trạng thái idle
 */
export function setTimeValues(hours = 0, minutes = 25, seconds = 0, breakMinutes = 5) {
  if (!currentSession) currentSession = createDefaultSession();
  if (currentSession.state === "running" || currentSession.state === "paused") {
    return false;
  }
  const h = Math.max(0, parseInt(hours, 10) || 0);
  const m = Math.max(0, parseInt(minutes, 10) || 0);
  const s = Math.max(0, parseInt(seconds, 10) || 0);
  const bMin = Math.max(1, parseInt(breakMinutes, 10) || 5);

  let totalSec = h * 3600 + m * 60 + s;
  if (totalSec <= 0) totalSec = 25 * 60;

  currentSession.workHours = h;
  currentSession.workMinutes = m;
  currentSession.workSeconds = s;
  currentSession.breakMinutes = bMin;
  currentSession.breakSeconds = 0;
  currentSession.totalWorkSeconds = totalSec;
  currentSession.totalBreakSeconds = bMin * 60;
  currentSession.remainingMs = totalSec * 1000;

  saveActiveSession(currentSession);
  notifyListeners();
  return true;
}

/**
 * Cập nhật thời lượng học và nghỉ (phút) tương thích với test suite
 */
export function setDurations(workMinutes = 25, breakMinutes = 5) {
  return setTimeValues(0, workMinutes, 0, breakMinutes);
}

/**
 * Tạm dừng phiên đang chạy
 */
export function pauseSession() {
  if (!currentSession) return;
  const now = Date.now();

  if (currentSession.state === "running") {
    if (currentSession.lastResumeTime) {
      currentSession.actualStudyMs = (currentSession.actualStudyMs || 0) + (now - currentSession.lastResumeTime);
      currentSession.lastResumeTime = null;
    }
    currentSession.remainingMs = Math.max(0, currentSession.targetEndTime - now);
    currentSession.targetEndTime = null;
    currentSession.state = "paused";
    stopInterval();
    saveActiveSession(currentSession);
    notifyListeners();
  } else if (currentSession.state === "break_running") {
    currentSession.remainingMs = Math.max(0, currentSession.targetEndTime - now);
    currentSession.targetEndTime = null;
    currentSession.state = "break_paused";
    stopInterval();
    saveActiveSession(currentSession);
    notifyListeners();
  }
}

/**
 * Tiếp tục phiên đang tạm dừng
 */
export function resumeSession() {
  if (!currentSession) return;
  const now = Date.now();

  if (currentSession.state === "paused") {
    currentSession.targetEndTime = now + currentSession.remainingMs;
    currentSession.lastResumeTime = now;
    currentSession.state = "running";
    saveActiveSession(currentSession);
    startInterval();
    notifyListeners();
  } else if (currentSession.state === "break_paused") {
    currentSession.targetEndTime = now + currentSession.remainingMs;
    currentSession.state = "break_running";
    saveActiveSession(currentSession);
    startInterval();
    notifyListeners();
  }
}

/**
 * Bắt đầu giờ nghỉ
 */
export function startBreakSession() {
  if (!currentSession) return;
  const totalBreakSec = currentSession.totalBreakSeconds || (currentSession.breakMinutes || 5) * 60;
  const now = Date.now();
  const totalMs = totalBreakSec * 1000;

  currentSession.mode = "break";
  currentSession.state = "break_running";
  currentSession.remainingMs = totalMs;
  currentSession.targetEndTime = now + totalMs;

  saveActiveSession(currentSession);
  startInterval();
  notifyListeners();
}

/**
 * Bỏ qua giờ nghỉ và bắt đầu phiên học tiếp theo
 */
export function startNextStudySession() {
  if (!currentSession) return;
  startSession(
    currentSession.workHours,
    currentSession.workMinutes,
    currentSession.workSeconds,
    currentSession.breakMinutes,
    currentSession.breakSeconds
  );
}

/**
 * Kết thúc phiên:
 * - Nếu isEarly = true: Lưu thời gian thực học với trạng thái "Kết thúc sớm"
 * - Reset về trạng thái idle
 */
export function endSession(isEarly = false) {
  if (!currentSession) return;
  const now = Date.now();

  if (isEarly && currentSession.mode === "study" && !currentSession.hasRecordedHistory) {
    let studyMs = currentSession.actualStudyMs || 0;
    if (currentSession.state === "running" && currentSession.lastResumeTime) {
      studyMs += Math.max(0, now - currentSession.lastResumeTime);
    }
    const actualSeconds = Math.round(studyMs / 1000);

    if (actualSeconds >= 5) {
      saveHistoryItem({
        id: `pomo-${currentSession.startTime || now}`,
        createdAt: new Date(currentSession.startTime || now).toISOString(),
        workDurationMinutes: Math.max(1, Math.round(currentSession.totalWorkSeconds / 60)),
        actualStudySeconds: actualSeconds,
        status: "Kết thúc sớm"
      });
    }
  }

  stopInterval();
  clearActiveSession();

  const h = currentSession.workHours;
  const m = currentSession.workMinutes;
  const s = currentSession.workSeconds;
  const bMin = currentSession.breakMinutes;
  const totalWorkSec = currentSession.totalWorkSeconds || 25 * 60;

  currentSession = createDefaultSession();
  currentSession.workHours = h;
  currentSession.workMinutes = m;
  currentSession.workSeconds = s;
  currentSession.breakMinutes = bMin;
  currentSession.totalWorkSeconds = totalWorkSec;
  currentSession.remainingMs = totalWorkSec * 1000;

  notifyListeners();
}

/**
 * Lấy thông tin thời gian còn lại đã định dạng
 */
export function getRemainingTime() {
  if (!currentSession) return { hours: 0, minutes: 25, seconds: 0, text: "25:00", progress: 0 };

  let totalMs = 0;
  if (currentSession.mode === "study") {
    totalMs = (currentSession.totalWorkSeconds || 25 * 60) * 1000;
  } else {
    totalMs = (currentSession.totalBreakSeconds || 5 * 60) * 1000;
  }

  const remainingMs = Math.max(0, currentSession.remainingMs || 0);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  let text = "";
  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    text = `${hh}:${mm}:${ss}`;
  } else {
    text = `${mm}:${ss}`;
  }

  const progress = totalMs > 0 ? Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100)) : 0;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    text,
    progress: Math.round(progress)
  };
}

/**
 * Lấy toàn bộ state hiện tại
 */
export function getState() {
  if (!currentSession) currentSession = createDefaultSession();
  const time = getRemainingTime();
  return {
    ...currentSession,
    workDurationMinutes: currentSession.workMinutes !== undefined ? currentSession.workMinutes : 25,
    breakDurationMinutes: currentSession.breakMinutes !== undefined ? currentSession.breakMinutes : 5,
    displayTime: time.text,
    hoursLeft: time.hours,
    minutesLeft: time.minutes,
    secondsLeft: time.seconds,
    progress: time.progress,
    history: getHistory()
  };
}

/**
 * Xóa toàn bộ lịch sử học tập
 */
export function clearAllHistory() {
  clearHistory();
  notifyListeners();
}

// Khởi chạy service
initService();
