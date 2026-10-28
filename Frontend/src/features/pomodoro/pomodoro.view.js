/**
 * UniStudy CMC - Pomodoro View (Sprint 2 Nâng cấp)
 * Giao diện đồng hồ tập trung Pomodoro tích hợp sticker Cáo CMC
 * Hỗ trợ chọn giờ, phút, giây, nút chọn nhanh 15/25/45m, chọn thời gian nghỉ
 */
import { getState } from "./pomodoro.service.js";
import { ASSETS } from "../../shared/config/assets.js";
import { formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { escapeHtml } from "../../shared/utils/validation.js";

export function renderPomodoroView() {
  const pState = getState();
  const isRunning = pState.state === "running" || pState.state === "break_running";
  const isPaused = pState.state === "paused" || pState.state === "break_paused";
  const isStudyCompleted = pState.state === "study_completed";
  const isBreakCompleted = pState.state === "break_completed";
  const isBreakMode = pState.mode === "break";

  // Sticker Cáo CMC theo trạng thái
  let foxImageSrc = ASSETS.fox.pomodoro || ASSETS.fox.study;
  let motivationalText = "Hãy tập trung cao độ để hoàn thành mục tiêu học tập!";
  let badgeModeLabel = "Phiên học tập";

  if (isStudyCompleted) {
    foxImageSrc = ASSETS.fox.quizSuccess;
    motivationalText = "Xuất sắc! Bạn đã hoàn thành trọn vẹn phiên tập trung. Hãy nghỉ ngơi một chút nhé!";
    badgeModeLabel = "Đã hoàn thành";
  } else if (isBreakMode || isBreakCompleted) {
    foxImageSrc = ASSETS.fox.wave;
    motivationalText = "Thư giãn mắt và uống chút nước để nạp lại năng lượng!";
    badgeModeLabel = isBreakCompleted ? "Hết giờ nghỉ" : "Giờ nghỉ ngơi";
  } else if (isPaused) {
    foxImageSrc = ASSETS.fox.study;
    motivationalText = "Đang tạm dừng. Hãy bấm Tiếp tục khi bạn sẵn sàng quay lại học nhé!";
  }

  const isLocked = isRunning || isPaused;

  const totalMs = ((pState.mode === "study" ? pState.totalWorkSeconds : pState.totalBreakSeconds) || 25 * 60) * 1000;
  const remainingMs = typeof pState.remainingMs === "number" ? Math.max(0, pState.remainingMs) : totalMs;
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1;
  const dashOffset = (722.57 * (1 - ratio)).toFixed(2);

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
        <span>Bắt đầu giờ nghỉ (${pState.breakMinutes} phút)</span>
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
          <span class="eyebrow"><svg><use href="#i-clock"></use></svg> Trợ lý năng suất UniStudy CMC</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Bộ đếm tập trung Pomodoro</h1>
        </div>
      </div>

      <!-- Main Timer Card -->
      <div class="pomo-timer-card">
        <!-- Cụm trung tâm: Đồng hồ vòng tròn và Sticker Cáo CMC -->
        <div class="pomo-core-display" style="display: flex; align-items: center; justify-content: center; gap: 40px; width: 100%; max-width: 720px; margin: 10px 0 24px; flex-wrap: wrap;">
          <!-- Cột bên: Sticker Cáo CMC linh động (đặt bên cạnh hoặc phía dưới, không đè lên đồng hồ) -->
          <div class="pomo-fox-container" style="width: 160px; height: 160px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            <img src="${foxImageSrc}" alt="Linh vật Cáo CMC Pomodoro" class="pomo-fox-img" style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(91, 33, 182, 0.12));" />
          </div>

          <!-- Đồng hồ vòng tròn SVG với bộ đếm ở chính giữa -->
          <div class="pomo-clock-wrap" style="display: flex; flex-direction: column; align-items: center;">
            <div class="pomo-circle-wrap" style="position: relative; width: 280px; height: 280px; max-width: 100%; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <svg class="pomo-circle-svg" viewBox="0 0 280 280" style="position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible;" aria-hidden="true">
                <defs>
                  <linearGradient id="pomoGradStudy" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#7c3aed" />
                    <stop offset="100%" stop-color="#9333ea" />
                  </linearGradient>
                  <linearGradient id="pomoGradBreak" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f97316" />
                    <stop offset="100%" stop-color="#ea580c" />
                  </linearGradient>
                </defs>
                <circle class="pomo-circle-track" cx="140" cy="140" r="115" style="fill: none; stroke: var(--ink-100, #e2e8f0); stroke-width: 13px;" />
                <circle 
                  id="pomoCircleProgress" 
                  class="pomo-circle-bar ${isBreakMode ? "bar-break" : ""}" 
                  cx="140" 
                  cy="140" 
                  r="115" 
                  style="fill: none; stroke: url(${isBreakMode ? "#pomoGradBreak" : "#pomoGradStudy"}); stroke-width: 13px; stroke-linecap: round; stroke-dasharray: 722.57; stroke-dashoffset: ${dashOffset}; transition: stroke-dashoffset 0.4s ease;" 
                />
              </svg>
              <div class="pomo-circle-center" style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; padding: 20px; box-sizing: border-box; width: 100%; height: 100%;">
                <span class="pomo-mode-badge ${isBreakMode || isBreakCompleted ? "badge-break" : "badge-study"}" id="pomoCenterBadge" style="margin-bottom: 6px;">
                  <svg style="width:14px;height:14px;display:inline-block;vertical-align:middle;"><use href="${isBreakMode || isBreakCompleted ? "#i-spark" : "#i-clock"}"></use></svg>
                  <span>${badgeModeLabel}</span>
                </span>
                <div class="pomo-countdown-text" id="pomoCountdownDisplay" style="font-size: clamp(2.4rem, 5.5vw, 3.6rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; color: var(--ink-950); font-variant-numeric: tabular-nums; margin: 4px 0;">${pState.displayTime}</div>
                <span class="pomo-circle-sub" style="font-size: 0.8rem; color: var(--ink-500); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">${isBreakMode ? "Giờ nghỉ ngơi" : "Tập trung học tập"}</span>
              </div>
            </div>
            <p class="pomo-motivational-quote" style="margin: 0; font-size: 0.9rem; color: var(--ink-600); text-align: center; max-width: 380px; line-height: 1.45;">${motivationalText}</p>
          </div>
        </div>

        <!-- DẢI NÚT CHỌN NHANH (15, 25, 45 phút) -->
        <div class="pomo-quick-bar" style="margin-bottom:16px;">
          <div style="font-size:0.82rem;font-weight:700;color:var(--ink-600);margin-bottom:8px;">Chọn nhanh thời gian học:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="button secondary small pomo-quick-btn ${pState.workMinutes === 15 && !pState.workHours && !pState.workSeconds ? "active" : ""}" data-quick-work="15" ${isLocked ? "disabled" : ""}>
              ⚡ 15 phút (Ôn bài ngắn)
            </button>
            <button type="button" class="button secondary small pomo-quick-btn ${pState.workMinutes === 25 && !pState.workHours && !pState.workSeconds ? "active" : ""}" data-quick-work="25" ${isLocked ? "disabled" : ""}>
              🎯 25 phút (Tiêu chuẩn)
            </button>
            <button type="button" class="button secondary small pomo-quick-btn ${pState.workMinutes === 45 && !pState.workHours && !pState.workSeconds ? "active" : ""}" data-quick-work="45" ${isLocked ? "disabled" : ""}>
              🔥 45 phút (Tập trung sâu)
            </button>
          </div>
        </div>

        <!-- DẢI NÚT CHỌN THỜI GIAN NGHỈ -->
        <div class="pomo-break-bar" style="margin-bottom:18px;">
          <div style="font-size:0.82rem;font-weight:700;color:var(--ink-600);margin-bottom:8px;">Chọn thời gian nghỉ:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="button ghost small pomo-quick-break-btn ${pState.breakMinutes === 5 ? "active" : ""}" data-quick-break="5" ${isLocked ? "disabled" : ""}>
              ☕ Nghỉ 5 phút
            </button>
            <button type="button" class="button ghost small pomo-quick-break-btn ${pState.breakMinutes === 10 ? "active" : ""}" data-quick-break="10" ${isLocked ? "disabled" : ""}>
              🧘 Nghỉ 10 phút
            </button>
            <button type="button" class="button ghost small pomo-quick-break-btn ${pState.breakMinutes === 15 ? "active" : ""}" data-quick-break="15" ${isLocked ? "disabled" : ""}>
              🌱 Nghỉ dài 15 phút
            </button>
          </div>
        </div>

        <!-- CÀI ĐẶT ÂM THANH CHUÔNG BÁO POMODORO -->
        <div class="pomo-sound-bar" style="display:flex;align-items:center;justify-content:space-between;background:var(--page);border:1px solid var(--ink-200);border-radius:var(--radius-md);padding:10px 16px;margin-bottom:18px;width:100%;max-width:720px;box-sizing:border-box;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:8px;background:var(--violet-100);color:var(--violet-700);display:flex;align-items:center;justify-content:center;">
              <svg style="width:18px;height:18px;"><use href="#i-bell"></use></svg>
            </div>
            <div>
              <div style="font-size:0.85rem;font-weight:700;color:var(--ink-900);">Chuông báo kết thúc phiên (amthanh.mp3)</div>
              <div style="font-size:0.75rem;color:var(--ink-500);">${pState.soundEnabled !== false ? "Tự động phát chuông khi hoàn thành phiên học hoặc kết thúc giờ nghỉ" : "Âm thanh chuông báo đang tắt"}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <button type="button" class="button ${pState.soundEnabled !== false ? "primary" : "ghost"} small" id="pomoToggleSoundBtn" title="Bật/Tắt âm thanh chuông báo">
              <svg style="width:14px;height:14px;"><use href="#i-bell"></use></svg>
              <span>${pState.soundEnabled !== false ? "Bật chuông" : "Tắt chuông"}</span>
            </button>
          </div>
        </div>

        <!-- Cài đặt thời lượng chi tiết: Giờ, Phút, Giây (Form) -->
        <div class="pomo-settings-bar">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div class="pomo-setting-group">
              <label for="pomoHoursInput">Giờ:</label>
              <input 
                type="number" 
                id="pomoHoursInput" 
                min="0" 
                max="12" 
                value="${pState.workHours || 0}" 
                style="width:68px;"
                ${isLocked ? "disabled" : ""}
              />
            </div>
            <div class="pomo-setting-group">
              <label for="pomoMinutesInput">Phút:</label>
              <input 
                type="number" 
                id="pomoMinutesInput" 
                min="0" 
                max="59" 
                value="${pState.workMinutes !== undefined ? pState.workMinutes : 25}" 
                style="width:68px;"
                ${isLocked ? "disabled" : ""}
              />
            </div>
            <div class="pomo-setting-group">
              <label for="pomoSecondsInput">Giây:</label>
              <input 
                type="number" 
                id="pomoSecondsInput" 
                min="0" 
                max="59" 
                value="${pState.workSeconds || 0}" 
                style="width:68px;"
                ${isLocked ? "disabled" : ""}
              />
            </div>
            <div class="pomo-setting-group" style="margin-left:auto;">
              <label for="pomoBreakDurationInput">Thời gian nghỉ (phút):</label>
              <input 
                type="number" 
                id="pomoBreakDurationInput" 
                min="1" 
                max="60" 
                value="${pState.breakMinutes || 5}" 
                style="width:78px;"
                ${isLocked ? "disabled" : ""}
              />
            </div>
          </div>
        </div>

        <!-- Cụm nút điều khiển hành động -->
        <div class="pomo-actions-bar" style="margin-top:20px;">
          ${actionsHtml}
        </div>
      </div>

      <!-- Khu vực lịch sử phiên học -->
      <div class="pomo-history-card">
        <p role="status">${escapeHtml(pState.syncStatus.pending ? 'Đang lưu lịch sử...' : pState.syncStatus.error || 'Lịch sử đã sẵn sàng.')}</p>
        <button type="button" class="button ghost small" id="retryPomodoroSyncBtn">Đồng bộ lịch sử</button>
        <div class="pomo-history-header">
          <div>
            <h3><svg><use href="#i-calendar"></use></svg> Lịch sử phiên học</h3>
            <span class="muted small">Ghi nhận các phiên học tập thực tế và đồng bộ sang Dashboard & Tiến độ</span>
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
