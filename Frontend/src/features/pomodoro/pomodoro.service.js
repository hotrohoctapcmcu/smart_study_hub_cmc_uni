/**
 * UniStudy CMC - Pomodoro Service
 * Quản lý logic đồng hồ Pomodoro chính xác theo timestamp (không phụ thuộc setInterval 1s)
 * - Toàn app dùng chung một phiên duy nhất (Singleton)
 * - Tự động tính toán lại thời gian khi chuyển tab / thu nhỏ trình duyệt
 * - Đảm bảo chỉ ghi nhận lịch sử đúng 1 lần khi hết giờ
 */
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  getHistory,
  saveHistoryItem,
  clearHistory
} from "./pomodoro.storage.js";

export const DEFAULT_POMODORO_CONFIG = {
  defaultWorkMinutes: 25,
  defaultBreakMinutes: 5,
  minMinutes: 1,
  maxMinutes: 120
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
    // Kiểm tra xem phiên có bị hết hạn trong lúc người dùng đóng tab / rời app không
    checkAndProcessCompletion();
    if (currentSession && currentSession.state === "running") {
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
  return {
    state: "idle", // "idle" | "running" | "paused" | "study_completed" | "break_running" | "break_paused" | "break_completed"
    mode: "study", // "study" | "break"
    workDurationMinutes: DEFAULT_POMODORO_CONFIG.defaultWorkMinutes,
    breakDurationMinutes: DEFAULT_POMODORO_CONFIG.defaultBreakMinutes,
    targetEndTime: null, // Timestamp ms kết thúc
    remainingMs: DEFAULT_POMODORO_CONFIG.defaultWorkMinutes * 60 * 1000,
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
  listeners.forEach((fn) => {
    try {
      fn(getState());
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
    // Hết giờ
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
      // Tính thời gian thực học = cộng dồn tới thời điểm kết thúc
      let studyMs = currentSession.actualStudyMs || 0;
      if (currentSession.lastResumeTime) {
        studyMs += Math.max(0, Math.min(now, currentSession.targetEndTime) - currentSession.lastResumeTime);
      }
      const actualSeconds = Math.round(studyMs / 1000);

      saveHistoryItem({
        id: `pomo-${currentSession.startTime || now}`,
        createdAt: new Date(currentSession.startTime || now).toISOString(),
        workDurationMinutes: currentSession.workDurationMinutes,
        actualStudySeconds: Math.max(actualSeconds, currentSession.workDurationMinutes * 60),
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
 * Bắt đầu một phiên học mới
 * @param {number} workMinutes 
 * @param {number} breakMinutes 
 */
export function startSession(workMinutes, breakMinutes) {
  const wMin = Math.max(1, parseInt(workMinutes, 10) || DEFAULT_POMODORO_CONFIG.defaultWorkMinutes);
  const bMin = Math.max(1, parseInt(breakMinutes, 10) || DEFAULT_POMODORO_CONFIG.defaultBreakMinutes);
  const now = Date.now();
  const totalMs = wMin * 60 * 1000;

  currentSession = {
    state: "running",
    mode: "study",
    workDurationMinutes: wMin,
    breakDurationMinutes: bMin,
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
 * Tạm dừng phiên đang chạy
 */
export function pauseSession() {
  if (!currentSession) return;
  const now = Date.now();

  if (currentSession.state === "running") {
    // Cộng dồn thời gian thực học của chặng vừa rồi
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
 * Bắt đầu giờ nghỉ sau khi hoàn thành phiên học
 */
export function startBreakSession() {
  if (!currentSession) return;
  const bMin = currentSession.breakDurationMinutes || DEFAULT_POMODORO_CONFIG.defaultBreakMinutes;
  const now = Date.now();
  const totalMs = bMin * 60 * 1000;

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
  const wMin = currentSession.workDurationMinutes || DEFAULT_POMODORO_CONFIG.defaultWorkMinutes;
  const bMin = currentSession.breakDurationMinutes || DEFAULT_POMODORO_CONFIG.defaultBreakMinutes;
  startSession(wMin, bMin);
}

/**
 * Kết thúc phiên:
 * - Nếu isEarly = true: Lưu thời gian thực học với trạng thái "Kết thúc sớm"
 * - Reset về trạng thái idle
 */
export function endSession(isEarly = false) {
  if (!currentSession) return;
  const now = Date.now();

  // Nếu đang học dở và kết thúc sớm thì ghi lịch sử
  if (isEarly && currentSession.mode === "study" && !currentSession.hasRecordedHistory) {
    let studyMs = currentSession.actualStudyMs || 0;
    if (currentSession.state === "running" && currentSession.lastResumeTime) {
      studyMs += Math.max(0, now - currentSession.lastResumeTime);
    }
    const actualSeconds = Math.round(studyMs / 1000);

    // Chỉ lưu nếu đã thực học trên 5 giây
    if (actualSeconds >= 5) {
      saveHistoryItem({
        id: `pomo-${currentSession.startTime || now}`,
        createdAt: new Date(currentSession.startTime || now).toISOString(),
        workDurationMinutes: currentSession.workDurationMinutes,
        actualStudySeconds: actualSeconds,
        status: "Kết thúc sớm"
      });
    }
  }

  stopInterval();
  clearActiveSession();

  const wMin = currentSession.workDurationMinutes;
  const bMin = currentSession.breakDurationMinutes;
  currentSession = createDefaultSession();
  currentSession.workDurationMinutes = wMin;
  currentSession.breakDurationMinutes = bMin;
  currentSession.remainingMs = wMin * 60 * 1000;

  notifyListeners();
}

/**
 * Cập nhật cấu hình thời gian khi ở trạng thái idle
 */
export function setDurations(workMinutes, breakMinutes) {
  if (!currentSession) currentSession = createDefaultSession();
  if (currentSession.state !== "idle" && currentSession.state !== "study_completed" && currentSession.state !== "break_completed") {
    // Không cho phép đổi khi đang chạy hoặc tạm dừng
    return false;
  }
  const wMin = Math.max(1, parseInt(workMinutes, 10) || DEFAULT_POMODORO_CONFIG.defaultWorkMinutes);
  const bMin = Math.max(1, parseInt(breakMinutes, 10) || DEFAULT_POMODORO_CONFIG.defaultBreakMinutes);
  currentSession.workDurationMinutes = wMin;
  currentSession.breakDurationMinutes = bMin;
  currentSession.remainingMs = wMin * 60 * 1000;
  saveActiveSession(currentSession);
  notifyListeners();
  return true;
}

/**
 * Lấy thông tin thời gian còn lại đã định dạng
 */
export function getRemainingTime() {
  if (!currentSession) return { minutes: 25, seconds: 0, text: "25:00", progress: 0 };

  let totalMs = 0;
  if (currentSession.mode === "study") {
    totalMs = (currentSession.workDurationMinutes || 25) * 60 * 1000;
  } else {
    totalMs = (currentSession.breakDurationMinutes || 5) * 60 * 1000;
  }

  const remainingMs = Math.max(0, currentSession.remainingMs || 0);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  const progress = totalMs > 0 ? Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100)) : 0;

  return {
    minutes,
    seconds,
    text: `${mm}:${ss}`,
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
    displayTime: time.text,
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
