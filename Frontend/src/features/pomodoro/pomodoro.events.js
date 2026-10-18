/**
 * UniStudy CMC - Pomodoro Events
 * Gắn sự kiện điều khiển đồng hồ, thay đổi cấu hình và dọn dẹp lifecycle
 */
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  startBreakSession,
  startNextStudySession,
  setDurations,
  clearAllHistory,
  subscribePomodoro
} from "./pomodoro.service.js";
import { renderPomodoroView } from "./pomodoro.view.js?v=4";

let unsubscribeService = null;

export function attachPomodoroEvents(containerEl) {
  // Dọn listener cũ nếu có
  if (unsubscribeService) {
    unsubscribeService();
    unsubscribeService = null;
  }

  // Lắng nghe cập nhật từ service để tự động re-render view
  unsubscribeService = subscribePomodoro(() => {
    // Chỉ cập nhật hiển thị đồng hồ nếu view vẫn còn tồn tại trong DOM
    if (document.body.contains(containerEl)) {
      containerEl.innerHTML = renderPomodoroView();
      // Gắn lại sự kiện sau khi re-render
      bindDomEvents(containerEl);
    } else if (unsubscribeService) {
      unsubscribeService();
      unsubscribeService = null;
    }
  });

  bindDomEvents(containerEl);
}

function bindDomEvents(containerEl) {
  // 1. Nút Bắt đầu học
  const startBtn = containerEl.querySelector("#pomoStartBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const workInput = containerEl.querySelector("#pomoWorkDurationInput");
      const breakInput = containerEl.querySelector("#pomoBreakDurationInput");
      const wMin = parseInt(workInput?.value, 10) || 25;
      const bMin = parseInt(breakInput?.value, 10) || 5;

      if (wMin <= 0 || bMin <= 0) {
        alert("Thời gian học và thời gian nghỉ phải là số nguyên lớn hơn 0 phút.");
        return;
      }
      startSession(wMin, bMin);
    });
  }

  // 2. Nút Tạm dừng
  const pauseBtn = containerEl.querySelector("#pomoPauseBtn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      pauseSession();
    });
  }

  // 3. Nút Tiếp tục
  const resumeBtn = containerEl.querySelector("#pomoResumeBtn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      resumeSession();
    });
  }

  // 4. Nút Kết thúc sớm (có xác nhận)
  const stopBtn = containerEl.querySelector("#pomoStopBtn");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      const confirmEnd = window.confirm("Bạn có chắc chắn muốn kết thúc phiên hiện tại? Thời gian thực học sẽ được lưu vào lịch sử.");
      if (confirmEnd) {
        endSession(true);
      }
    });
  }

  // 5. Nút Bắt đầu giờ nghỉ
  const breakBtn = containerEl.querySelector("#pomoStartBreakBtn");
  if (breakBtn) {
    breakBtn.addEventListener("click", () => {
      startBreakSession();
    });
  }

  // 6. Nút Bỏ qua giờ nghỉ
  const skipBreakBtn = containerEl.querySelector("#pomoSkipBreakBtn");
  if (skipBreakBtn) {
    skipBreakBtn.addEventListener("click", () => {
      startNextStudySession();
    });
  }

  // 7. Nút Bắt đầu phiên học mới sau khi nghỉ xong
  const nextStudyBtn = containerEl.querySelector("#pomoNextStudyBtn");
  if (nextStudyBtn) {
    nextStudyBtn.addEventListener("click", () => {
      startNextStudySession();
    });
  }

  // 8. Thay đổi thời lượng khi ở trạng thái idle
  const workInput = containerEl.querySelector("#pomoWorkDurationInput");
  const breakInput = containerEl.querySelector("#pomoBreakDurationInput");

  if (workInput) {
    workInput.addEventListener("change", () => {
      const wVal = parseInt(workInput.value, 10);
      const bVal = parseInt(breakInput?.value, 10) || 5;
      if (wVal <= 0) {
        workInput.value = 25;
        alert("Thời gian học phải lớn hơn 0 phút.");
        return;
      }
      setDurations(wVal, bVal);
    });
  }

  if (breakInput) {
    breakInput.addEventListener("change", () => {
      const wVal = parseInt(workInput?.value, 10) || 25;
      const bVal = parseInt(breakInput.value, 10);
      if (bVal <= 0) {
        breakInput.value = 5;
        alert("Thời gian nghỉ phải lớn hơn 0 phút.");
        return;
      }
      setDurations(wVal, bVal);
    });
  }

  // 9. Nút Xóa lịch sử (có xác nhận)
  const clearBtn = containerEl.querySelector("#pomoClearHistoryBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const confirmClear = window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử phiên học Pomodoro trên trình duyệt này?");
      if (confirmClear) {
        clearAllHistory();
      }
    });
  }
}

/**
 * Dọn dẹp listener khi unmount trang
 */
export function unmountPomodoroEvents() {
  if (unsubscribeService) {
    unsubscribeService();
    unsubscribeService = null;
  }
}
