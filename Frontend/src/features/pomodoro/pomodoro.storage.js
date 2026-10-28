/**
 * UniStudy CMC - Pomodoro Storage Layer
 * Quản lý lưu trữ phiên đang chạy và lịch sử phiên học trên localStorage (có in-memory fallback)
 * Thiết kế trừu tượng hóa để dễ dàng kết nối API backend sau này mà không phải sửa UI
 */

const STORAGE_KEYS = {
  ACTIVE_SESSION: "unistudy_pomodoro_active_session",
  HISTORY: "unistudy_pomodoro_history",
  SOUND_ENABLED: "unistudy_pomodoro_sound_enabled"
};

// In-memory fallback khi chạy trong môi trường không có localStorage (như test runner)
const memoryStore = new Map();

function getStorage() {
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return {
    getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
    setItem: (key, val) => memoryStore.set(key, String(val)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear()
  };
}

/**
 * Lấy phiên Pomodoro đang hoạt động từ storage
 * @returns {object|null}
 */
export function loadActiveSession() {
  try {
    const raw = getStorage().getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi đọc active session:", err);
    return null;
  }
}

/**
 * Lưu phiên Pomodoro đang hoạt động vào storage
 * @param {object} session
 */
export function saveActiveSession(session) {
  try {
    if (!session) {
      getStorage().removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      return;
    }
    getStorage().setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi lưu active session:", err);
  }
}

/**
 * Xóa phiên Pomodoro đang hoạt động
 */
export function clearActiveSession() {
  try {
    getStorage().removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi xóa active session:", err);
  }
}

/**
 * Lấy lịch sử các phiên học (mới nhất ở trên)
 * @returns {Array<object>}
 */
export function getHistory() {
  try {
    const raw = getStorage().getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi đọc lịch sử Pomodoro:", err);
    return [];
  }
}

/**
 * Thêm một bản ghi phiên học vào lịch sử
 * @param {object} historyItem
 * @returns {Array<object>} Danh sách lịch sử cập nhật
 */
export function saveHistoryItem(historyItem) {
  try {
    const history = getHistory();
    // Đảm bảo không ghi đè hoặc trùng id
    const item = {
      ...historyItem,
      id: historyItem.id || `pomo-${Date.now()}`,
      createdAt: historyItem.createdAt || new Date().toISOString(),
      workDurationMinutes: historyItem.workDurationMinutes || 25,
      actualStudySeconds: Math.max(0, historyItem.actualStudySeconds || 0),
      status: historyItem.status || "Hoàn thành", // "Hoàn thành" | "Kết thúc sớm"
      notes: historyItem.notes || ""
    };
    const updated = [item, ...history.filter(previous => previous.id !== item.id)];
    const limited = updated;
    getStorage().setItem(STORAGE_KEYS.HISTORY, JSON.stringify(limited));
    return limited;
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi ghi lịch sử Pomodoro:", err);
    return getHistory();
  }
}

export function replacePomodoroHistory(history) {
  getStorage().setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

/**
 * Xóa toàn bộ lịch sử phiên học
 */
export function clearHistory() {
  try {
    getStorage().removeItem(STORAGE_KEYS.HISTORY);
    return [];
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi xóa lịch sử Pomodoro:", err);
    return [];
  }
}

/**
 * Tính tổng thời gian thực tế đã học từ các phiên Pomodoro (đơn vị: giây)
 */
export function getTotalPomodoroStudySeconds() {
  const history = getHistory();
  return history.reduce((sum, item) => sum + (item.actualStudySeconds || 0), 0);
}

/**
 * Thống kê tổng hợp Pomodoro dùng chung cho Dashboard và Tiến độ
 */
export function getPomodoroStats() {
  const history = getHistory();
  const totalSeconds = history.reduce((sum, item) => sum + (item.actualStudySeconds || 0), 0);
  const completedCount = history.filter((item) => item.status === "Hoàn thành").length;
  const earlyStoppedCount = history.filter((item) => item.status === "Kết thúc sớm").length;
  return {
    totalSessions: history.length,
    completedSessions: completedCount,
    earlyStoppedSessions: earlyStoppedCount,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    totalHours: Number((totalSeconds / 3600).toFixed(1)),
    history
  };
}

/**
 * Kiểm tra trạng thái bật/tắt âm thanh chuông báo Pomodoro
 * @returns {boolean}
 */
export function isPomodoroSoundEnabled() {
  try {
    const raw = getStorage().getItem(STORAGE_KEYS.SOUND_ENABLED);
    if (raw === null) return true; // Mặc định bật âm thanh
    return raw === "true";
  } catch {
    return true;
  }
}

/**
 * Lưu trạng thái bật/tắt âm thanh chuông báo Pomodoro
 * @param {boolean} enabled
 */
export function setPomodoroSoundEnabled(enabled) {
  try {
    getStorage().setItem(STORAGE_KEYS.SOUND_ENABLED, String(!!enabled));
  } catch (err) {
    console.error("[Pomodoro Storage] Lỗi lưu cấu hình âm thanh:", err);
  }
}
