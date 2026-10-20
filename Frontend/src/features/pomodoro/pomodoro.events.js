/**
 * UniStudy CMC - Pomodoro Events (Sprint 2 Nâng cấp)
 * Gắn sự kiện điều khiển đồng hồ:
 * - Chọn nhanh 15, 25, 45 phút
 * - Chọn thời gian nghỉ 5, 10, 15 phút
 * - Nhập Giờ, Phút, Giây
 * - Bắt đầu, Tạm dừng, Tiếp tục, Kết thúc sớm
 */
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  startBreakSession,
  startNextStudySession,
  setQuickWorkMinutes,
  setQuickBreakMinutes,
  setTimeValues,
  clearAllHistory,
  subscribePomodoro
} from "./pomodoro.service.js";
import { renderPomodoroView } from "./pomodoro.view.js";

let unsubscribeService = null;

export function attachPomodoroEvents(containerEl) {
  if (unsubscribeService) {
    unsubscribeService();
    unsubscribeService = null;
  }

  unsubscribeService = subscribePomodoro(() => {
    if (document.body.contains(containerEl)) {
      containerEl.innerHTML = renderPomodoroView();
      bindDomEvents(containerEl);
    } else if (unsubscribeService) {
      unsubscribeService();
      unsubscribeService = null;
    }
  });

  bindDomEvents(containerEl);
}

function bindDomEvents(containerEl) {
  // 1. Nút chọn nhanh: 15, 25, 45 phút
  const quickBtns = containerEl.querySelectorAll("[data-quick-work]");
  quickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-quick-work"), 10);
      setQuickWorkMinutes(mins);
    });
  });

  // 2. Nút chọn nhanh thời gian nghỉ: 5, 10, 15 phút
  const quickBreakBtns = containerEl.querySelectorAll("[data-quick-break]");
  quickBreakBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-quick-break"), 10);
      setQuickBreakMinutes(mins);
    });
  });

  // 3. Inputs Giờ, Phút, Giây & Phút nghỉ
  const hoursInput = containerEl.querySelector("#pomoHoursInput");
  const minutesInput = containerEl.querySelector("#pomoMinutesInput");
  const secondsInput = containerEl.querySelector("#pomoSecondsInput");
  const breakInput = containerEl.querySelector("#pomoBreakDurationInput");

  const syncTimeFromInputs = () => {
    const h = parseInt(hoursInput?.value, 10) || 0;
    const m = parseInt(minutesInput?.value, 10) || 0;
    const s = parseInt(secondsInput?.value, 10) || 0;
    const bMin = parseInt(breakInput?.value, 10) || 5;
    setTimeValues(h, m, s, bMin);
  };

  if (hoursInput) hoursInput.addEventListener("change", syncTimeFromInputs);
  if (minutesInput) minutesInput.addEventListener("change", syncTimeFromInputs);
  if (secondsInput) secondsInput.addEventListener("change", syncTimeFromInputs);
  if (breakInput) breakInput.addEventListener("change", syncTimeFromInputs);

  // 4. Nút Bắt đầu học
  const startBtn = containerEl.querySelector("#pomoStartBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const h = parseInt(hoursInput?.value, 10) || 0;
      const m = parseInt(minutesInput?.value, 10) || 0;
      const s = parseInt(secondsInput?.value, 10) || 0;
      const bMin = parseInt(breakInput?.value, 10) || 5;
      const totalSec = h * 3600 + m * 60 + s;
      if (totalSec <= 0) {
        startSession(0, 25, 0, bMin, 0);
      } else {
        startSession(h, m, s, bMin, 0);
      }
    });
  }

  // 5. Nút Tạm dừng
  const pauseBtn = containerEl.querySelector("#pomoPauseBtn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      pauseSession();
    });
  }

  // 6. Nút Tiếp tục
  const resumeBtn = containerEl.querySelector("#pomoResumeBtn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      resumeSession();
    });
  }

  // 7. Nút Kết thúc sớm
  const stopBtn = containerEl.querySelector("#pomoStopBtn");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      const ok = window.confirm("Bạn có chắc chắn muốn kết thúc phiên học hiện tại? Thời gian thực học sẽ được lưu vào lịch sử.");
      if (ok) {
        endSession(true);
      }
    });
  }

  // 8. Nút Bắt đầu giờ nghỉ
  const breakBtn = containerEl.querySelector("#pomoStartBreakBtn");
  if (breakBtn) {
    breakBtn.addEventListener("click", () => {
      startBreakSession();
    });
  }

  // 9. Nút Bỏ qua giờ nghỉ
  const skipBreakBtn = containerEl.querySelector("#pomoSkipBreakBtn");
  if (skipBreakBtn) {
    skipBreakBtn.addEventListener("click", () => {
      startNextStudySession();
    });
  }

  // 10. Nút Bắt đầu phiên học mới sau giờ nghỉ
  const nextStudyBtn = containerEl.querySelector("#pomoNextStudyBtn");
  if (nextStudyBtn) {
    nextStudyBtn.addEventListener("click", () => {
      startNextStudySession();
    });
  }

  // 11. Xóa lịch sử
  const clearBtn = containerEl.querySelector("#pomoClearHistoryBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const ok = window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử phiên Pomodoro?");
      if (ok) {
        clearAllHistory();
      }
    });
  }
}

export function unmountPomodoroEvents() {
  if (unsubscribeService) {
    unsubscribeService();
    unsubscribeService = null;
  }
}
