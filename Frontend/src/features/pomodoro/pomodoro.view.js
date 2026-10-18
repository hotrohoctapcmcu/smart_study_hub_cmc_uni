/**
 * UniStudy CMC - Pomodoro View
 * Giao diện đồng hồ tập trung Pomodoro tích hợp sticker Cáo CMC
 */
import { getState } from "./pomodoro.service.js";
import { ASSETS } from "../../shared/config/assets.js";
import { formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";

export function renderPomodoroView() {
  const pState = getState();
  const isRunning = pState.state === "running" || pState.state === "break_running";
  const isPaused = pState.state === "paused" || pState.state === "break_paused";
  const isStudyCompleted = pState.state === "study_completed";
  const isBreakCompleted = pState.state === "break_completed";
  const isBreakMode = pState.mode === "break";

  // Chọn sticker Cáo CMC phù hợp với từng trạng thái
  let foxImageSrc = ASSETS.fox.pomodoro || ASSETS.fox.study;
  let motivationalText = "Hãy tập trung cao độ để hoàn thành mục tiêu học tập!";
  let badgeModeLabel = "Phiên học tập";

  if (isStudyCompleted) {
    foxImageSrc = ASSETS.fox.quizSuccess;
    motivationalText = "Xuất sắc! Bạn đã hoàn thành trọn vẹn phiên tập trung. Hãy nghỉ ngơi một chút nhé!";
    badgeModeLabel = "Đã hoàn thành phiên học";
  } else if (isBreakMode || isBreakCompleted) {
    foxImageSrc = ASSETS.fox.wave;
    motivationalText = "Thư giãn mắt và uống chút nước để nạp lại năng lượng!";
    badgeModeLabel = isBreakCompleted ? "Hết giờ nghỉ ngơi" : "Giờ nghỉ ngơi";
  } else if (isPaused) {
    foxImageSrc = ASSETS.fox.study;
    motivationalText = "Đang tạm dừng. Hãy bấm Tiếp tục khi bạn sẵn sàng quay lại học nhé!";
  }

  // Khóa ô nhập thời gian khi đang chạy hoặc tạm dừng
  const isLocked = isRunning || isPaused;

  // Render các nút hành động tương ứng với trạng thái
  let actionsHtml = "";
  if (pState.state === "idle") {
    actionsHtml = `
      <button type="button" class="button primary pomo-btn-start" id="pomoStartBtn">
        <svg><use href="#i-play"></use></svg>
        <span>Bắt đầu học</span>
      </button>
    `;
  } else if (pState.state === "running") {
    actionsHtml = `
      <button type="button" class="button secondary pomo-btn-pause" id="pomoPauseBtn">
        <svg><use href="#i-clock"></use></svg>
        <span>Tạm dừng</span>
      </button>
      <button type="button" class="button ghost-danger pomo-btn-stop" id="pomoStopBtn">
        <svg><use href="#i-close"></use></svg>
        <span>Kết thúc sớm</span>
      </button>
    `;
  } else if (pState.state === "paused") {
    actionsHtml = `
      <button type="button" class="button primary pomo-btn-resume" id="pomoResumeBtn">
        <svg><use href="#i-play"></use></svg>
        <span>Tiếp tục</span>
      </button>
      <button type="button" class="button ghost-danger pomo-btn-stop" id="pomoStopBtn">
        <svg><use href="#i-close"></use></svg>
        <span>Kết thúc sớm</span>
      </button>
    `;
  } else if (isStudyCompleted) {
    actionsHtml = `
      <button type="button" class="button primary pomo-btn-break" id="pomoStartBreakBtn">
        <svg><use href="#i-spark"></use></svg>
        <span>Bắt đầu giờ nghỉ (${pState.breakDurationMinutes} phút)</span>
      </button>
      <button type="button" class="button ghost pomo-btn-skip-break" id="pomoSkipBreakBtn">
        <span>Bỏ qua nghỉ & Học tiếp</span>
      </button>
    `;
  } else if (pState.state === "break_running") {
    actionsHtml = `
      <button type="button" class="button secondary pomo-btn-pause" id="pomoPauseBtn">
        <svg><use href="#i-clock"></use></svg>
        <span>Tạm dừng nghỉ</span>
      </button>
      <button type="button" class="button ghost-danger pomo-btn-stop" id="pomoStopBtn">
        <svg><use href="#i-close"></use></svg>
        <span>Kết thúc giờ nghỉ</span>
      </button>
    `;
  } else if (pState.state === "break_paused") {
    actionsHtml = `
      <button type="button" class="button primary pomo-btn-resume" id="pomoResumeBtn">
        <svg><use href="#i-play"></use></svg>
        <span>Tiếp tục nghỉ</span>
      </button>
      <button type="button" class="button ghost-danger pomo-btn-stop" id="pomoStopBtn">
        <svg><use href="#i-close"></use></svg>
        <span>Kết thúc giờ nghỉ</span>
      </button>
    `;
  } else if (isBreakCompleted) {
    actionsHtml = `
      <button type="button" class="button primary pomo-btn-start" id="pomoNextStudyBtn">
        <svg><use href="#i-play"></use></svg>
        <span>Bắt đầu phiên học mới</span>
      </button>
    `;
  }

  // Render bảng lịch sử các phiên học
  const historyList = pState.history || [];
  let historyContentHtml = "";

  if (historyList.length === 0) {
    historyContentHtml = `
      <div class="pomo-history-empty">
        ${renderEmptyState({
          icon: "i-clock",
          title: "Chưa có phiên học nào",
          description: "Hãy bắt đầu phiên Pomodoro đầu tiên để rèn luyện thói quen học tập tập trung!"
        })}
      </div>
    `;
  } else {
    const rowsHtml = historyList
      .map((item, idx) => {
        const isSuccess = item.status === "Hoàn thành";
        const actualMins = Math.floor(item.actualStudySeconds / 60);
        const actualSecs = item.actualStudySeconds % 60;
        const actualStr = actualMins > 0 ? `${actualMins} phút ${actualSecs}s` : `${actualSecs} giây`;

        return `
          <tr class="pomo-history-row">
            <td class="col-num">#${historyList.length - idx}</td>
            <td class="col-date">${formatDateTimeVN(item.createdAt)}</td>
            <td class="col-target">${item.workDurationMinutes} phút</td>
            <td class="col-actual"><strong>${actualStr}</strong></td>
            <td class="col-status">
              <span class="pomo-status-tag ${isSuccess ? "tag-completed" : "tag-early"}">
                ${isSuccess ? "✓ Hoàn thành" : "✕ Kết thúc sớm"}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    historyContentHtml = `
      <div class="pomo-table-responsive">
        <table class="pomo-history-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-date">Thời gian</th>
              <th class="col-target">Thời lượng đặt</th>
              <th class="col-actual">Thực học</th>
              <th class="col-status">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="pomodoro-page">
      <!-- Header Trang -->
      <div class="pomodoro-header">
        <div>
          <div class="eyebrow" style="color:var(--violet-700);margin-bottom:4px;">
            Trợ lý năng suất UniStudy CMC
          </div>
          <h1>Bộ đếm tập trung Pomodoro</h1>
        </div>
      </div>

      <!-- Main Timer Card -->
      <div class="pomo-timer-card">
        <!-- Huy hiệu chế độ -->
        <div class="pomo-badge-wrap">
          <span class="pomo-mode-badge ${isBreakMode || isBreakCompleted ? "badge-break" : "badge-study"}">
            <svg style="width:14px;height:14px;"><use href="${isBreakMode || isBreakCompleted ? "#i-spark" : "#i-clock"}"></use></svg>
            <span>${badgeModeLabel}</span>
          </span>
        </div>

        <!-- Cụm trung tâm: Đồng hồ số đếm ngược và Sticker Cáo CMC -->
        <div class="pomo-core-display">
          <!-- Cột bên: Sticker Cáo CMC linh động -->
          <div class="pomo-fox-container">
            <img src="${foxImageSrc}" alt="Linh vật Cáo CMC Pomodoro" class="pomo-fox-img" />
          </div>

          <!-- Đồng hồ số trung tâm -->
          <div class="pomo-clock-wrap">
            <div class="pomo-countdown-text" id="pomoCountdownDisplay">${pState.displayTime}</div>
            <div class="pomo-progress-bar-bg">
              <div class="pomo-progress-bar-fill ${isBreakMode ? "fill-break" : ""}" style="width: ${pState.progress}%;"></div>
            </div>
            <p class="pomo-motivational-quote">${motivationalText}</p>
          </div>
        </div>

        <!-- Cài đặt thời lượng (Form) -->
        <div class="pomo-settings-bar">
          <div class="pomo-setting-group">
            <label for="pomoWorkDurationInput">Thời gian học (phút):</label>
            <input 
              type="number" 
              id="pomoWorkDurationInput" 
              min="1" 
              max="120" 
              value="${pState.workDurationMinutes}" 
              ${isLocked ? "disabled title='Cần kết thúc phiên hiện tại để đổi thời gian'" : ""}
            />
          </div>
          <div class="pomo-setting-group">
            <label for="pomoBreakDurationInput">Thời gian nghỉ (phút):</label>
            <input 
              type="number" 
              id="pomoBreakDurationInput" 
              min="1" 
              max="60" 
              value="${pState.breakDurationMinutes}" 
              ${isLocked ? "disabled title='Cần kết thúc phiên hiện tại để đổi thời gian'" : ""}
            />
          </div>
        </div>

        <!-- Cụm nút điều khiển hành động -->
        <div class="pomo-actions-bar">
          ${actionsHtml}
        </div>
      </div>

      <!-- Khu vực lịch sử phiên học -->
      <div class="pomo-history-card">
        <div class="pomo-history-header">
          <div>
            <h3><svg><use href="#i-calendar"></use></svg> Lịch sử phiên học</h3>
            <span class="muted small">Ghi nhận các phiên học tập thực tế của bạn</span>
          </div>
          ${
            historyList.length > 0
              ? `<button type="button" class="button ghost small" id="pomoClearHistoryBtn" title="Xóa toàn bộ lịch sử phiên học">
                   <svg><use href="#i-trash"></use></svg>
                   <span>Xóa lịch sử</span>
                 </button>`
              : ""
          }
        </div>

        <div class="pomo-history-body">
          ${historyContentHtml}
        </div>
      </div>
    </div>
  `;
}
