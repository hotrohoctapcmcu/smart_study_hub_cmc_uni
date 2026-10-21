/**
 * UniStudy CMC - Progress View (Sprint 2 & Refactored)
 * Phân tích tiến độ học tập và bản đồ thời gian
 */
import { getProgressAnalytics } from "./progress.service.js";
import { formatDateISO } from "../../shared/utils/date.js";
import { escapeHtml } from "../../shared/utils/validation.js";

export function renderProgressView(uiState = {}) {
  const currentPeriod = (uiState.period === "day" || uiState.period === "month") ? uiState.period : "week";
  const selectedDateStr = uiState.selectedDate || formatDateISO(new Date());

  const data = getProgressAnalytics(currentPeriod, selectedDateStr);

  // Tìm giá trị max trong biểu đồ hiện tại để tính % chiều cao
  const maxVal = Math.max(...data.chart.values, currentPeriod === "day" ? 30 : 1.0);

  return `
    <div class="progress-page-container">
      <!-- Header -->
      <div class="progress-header">
        <div>
          <span class="eyebrow"><svg><use href="#i-chart"></use></svg> Báo cáo học tập cá nhân</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Phân tích tiến độ & Bản đồ thời gian</h1>
        </div>

        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <!-- Chu kỳ xem: Chỉ [Ngày] [Tuần] [Tháng] -->
          <div class="progress-period-tabs" role="tablist">
            <button type="button" class="view-mode-btn ${currentPeriod === "day" ? "active" : ""}" data-period="day">Ngày</button>
            <button type="button" class="view-mode-btn ${currentPeriod === "week" ? "active" : ""}" data-period="week">Tuần</button>
            <button type="button" class="view-mode-btn ${currentPeriod === "month" ? "active" : ""}" data-period="month">Tháng</button>
          </div>

          <!-- Bộ chọn thời gian & Điều hướng trước / sau -->
          <div class="schedule-date-navigator">
            <button type="button" class="icon-button schedule-nav-arrow" id="progressPrevBtn" aria-label="Khoảng thời gian trước" title="Khoảng thời gian trước">
              <svg><use href="#i-chevron-left"></use></svg>
            </button>
            <input 
              type="date" 
              id="progressDatePicker" 
              class="schedule-date-input"
              aria-label="Chọn ngày xem tiến độ"
              value="${selectedDateStr}" 
            />
            <button type="button" class="icon-button schedule-nav-arrow" id="progressNextBtn" aria-label="Khoảng thời gian kế tiếp" title="Khoảng thời gian kế tiếp">
              <svg><use href="#i-chevron-right"></use></svg>
            </button>
          </div>

          <span class="schedule-period-badge">
            ${escapeHtml(data.periodTitle)}
          </span>
        </div>
      </div>

      <!-- 4 Thẻ chỉ số tổng quan (Metric Cards) -->
      <div class="progress-metrics-grid">
        <!-- Card 1: Tổng thời gian học trong chu kỳ -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--violet-600);background:var(--violet-50);">
              <svg><use href="#i-clock"></use></svg>
            </span>
            <span class="badge-draft">Tích lũy: ${data.cumulative.totalHours}h</span>
          </div>
          <div class="metric-value-text">
            ${currentPeriod === "day" ? data.totalStudyMinutes : data.totalStudyHours} 
            <small style="font-size:1rem;font-weight:600;">${currentPeriod === "day" ? "phút" : "giờ"}</small>
          </div>
          <div class="metric-label-text">Thời lượng học trong ${currentPeriod === "day" ? "ngày" : currentPeriod === "week" ? "tuần" : "tháng"}</div>
          <div class="metric-sub-note">
            ${
              data.hasStudyData
                ? `Thời gian thực tế: ${data.totalStudyMinutes} phút`
                : data.hasZeroDurationSession
                ? "Đã có phiên nhưng chưa tích lũy thời gian thực tế"
                : "Chưa có dữ liệu học tập trong khoảng này"
            }
          </div>
        </div>

        <!-- Card 2: Phiên Pomodoro hoàn thành trong chu kỳ -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--orange-600);background:var(--orange-50);">
              <svg><use href="#i-spark"></use></svg>
            </span>
            <span class="badge-draft">Tích lũy: ${data.cumulative.completedSessions} phiên</span>
          </div>
          <div class="metric-value-text">${data.pomodoroSessions} <small style="font-size:1rem;font-weight:600;">phiên</small></div>
          <div class="metric-label-text">Phiên hoàn thành trong kỳ</div>
          <div class="metric-sub-note">
            ${
              data.pomodoroSessions > 0
                ? `Tính theo mốc kết thúc trong ${escapeHtml(data.periodTitle)}`
                : "Chưa có phiên Pomodoro hoàn thành trong kỳ"
            }
          </div>
        </div>

        <!-- Card 3: Tiến độ Task & Deadline -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--emerald-600);background:var(--emerald-50);">
              <svg><use href="#i-tasks"></use></svg>
            </span>
            <span class="status-pill ${data.hasTaskData ? "violet" : "neutral"}">
              ${data.hasTaskData ? `${data.taskCompletionRate}%` : "Chưa có dữ liệu"}
            </span>
          </div>
          <div class="metric-value-text">
            ${data.completedTasks}/${data.totalTasks} <small style="font-size:1rem;font-weight:600;">task</small>
          </div>
          <div class="metric-label-text">Bài tập & Deadline</div>
          <div class="metric-sub-note">
            ${
              data.hasTaskData
                ? `Còn ${data.inProgressTasks} công việc đang thực hiện`
                : "Chưa có công việc để tính tiến độ"
            }
          </div>
        </div>

        <!-- Card 4: Chuỗi duy trì mục tiêu -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--blue-600);background:var(--blue-50);">
              <svg><use href="#i-check"></use></svg>
            </span>
            <span class="status-pill ${data.hasStudyData ? "violet" : "neutral"}">
              ${data.hasStudyData ? "Đang duy trì" : "Bắt đầu"}
            </span>
          </div>
          <div class="metric-value-text">${data.habits.streakDays} <small style="font-size:1rem;font-weight:600;">ngày</small></div>
          <div class="metric-label-text">Chuỗi duy trì mục tiêu</div>
          <div class="metric-sub-note">
            ${data.hasStudyData ? "Có ghi nhận phiên học trong chu kỳ" : "Chưa có dữ liệu học tập"}
          </div>
        </div>
      </div>

      <!-- Biểu đồ phân bổ thời lượng học (Chiếm toàn bộ diện tích) -->
      <div class="progress-charts-grid single-chart">
        <!-- Biểu đồ cột phân bổ giờ học -->
        <div class="progress-card progress-chart-full">
          <div class="progress-card-head">
            <div>
              <h2 style="font-size:1.15rem;margin:0 0 4px;color:var(--ink-950);">${escapeHtml(data.chart.title)}</h2>
              <span class="muted small">${escapeHtml(data.periodTitle)} · Đơn vị: ${data.chart.unit}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              ${
                currentPeriod === "day"
                  ? `
                <div class="day-chart-scroll-actions" style="display:flex;align-items:center;gap:6px;">
                  <button type="button" class="nav-arrow-btn" id="scrollDayChartLeftBtn" title="Cuộn xem giờ trước" aria-label="Cuộn xem giờ trước">
                    <svg><use href="#i-chevron-left"></use></svg>
                  </button>
                  <button type="button" class="nav-arrow-btn" id="scrollDayChartRightBtn" title="Cuộn xem giờ sau" aria-label="Cuộn xem giờ sau">
                    <svg><use href="#i-chevron-right"></use></svg>
                  </button>
                </div>
              `
                  : ""
              }
              <span class="status-pill violet">
                ${currentPeriod === "day" ? "Biểu đồ Ngày (24 giờ)" : currentPeriod === "week" ? "Biểu đồ Tuần" : "Biểu đồ Tháng"}
              </span>
            </div>
          </div>

          <div class="progress-bar-chart ${currentPeriod === "day" ? "chart-scrollable" : ""}" id="progressBarChartScrollContainer">
            ${data.chart.labels
              .map((label, idx) => {
                const val = data.chart.values[idx] || 0;
                const isHighlight = data.chart.highlightIndices.includes(idx);
                // Cột có giá trị 0 có chiều cao bằng 0 (bỏ min-height tạo cột giả)
                const heightPercent = val > 0 ? Math.min(100, Math.max(8, Math.round((val / maxVal) * 100))) : 0;
                const subLabel = data.chart.subLabels[idx] || "";

                return `
                <div class="bar-chart-column ${isHighlight ? "highlight" : ""}" title="${escapeHtml(data.chart.tooltips[idx] || "")}">
                  <div class="bar-value-bubble" style="${val === 0 ? "opacity:0.4;" : isHighlight ? "font-weight:800;color:var(--violet-700);" : ""}">
                    ${val > 0 ? val + (data.chart.unit === "phút" ? "m" : "h") : "0"}
                  </div>
                  <div class="bar-fill-track">
                    <div class="bar-fill-inner ${isHighlight ? "best-bar" : ""}" style="height:${heightPercent}%;"></div>
                  </div>
                  <span class="bar-label-text">${escapeHtml(label)}</span>
                  ${subLabel ? `<span class="bar-sub-text">${escapeHtml(subLabel)}</span>` : ""}
                </div>
              `;
              })
              .join("")}
          </div>

          ${
            data.chart.insight
              ? `
              <div class="progress-insight-box">
                <svg style="color:var(--violet-600);width:18px;height:18px;flex-shrink:0;"><use href="#i-spark"></use></svg>
                <span class="small" style="color:var(--ink-900);">${escapeHtml(data.chart.insight)}</span>
              </div>
            `
              : !data.hasStudyData
              ? `
              <div class="progress-empty-hint">
                <span class="muted small">Chưa có dữ liệu học tập trong ${escapeHtml(data.periodTitle)}. Hãy bắt đầu một phiên Pomodoro để tích lũy.</span>
              </div>
            `
              : ""
          }
        </div>
      </div>

      <!-- Phân tích tiến độ theo từng môn học -->
      <div class="progress-card">
        <div class="progress-card-head">
          <div>
            <h2 style="font-size:1.15rem;margin:0 0 4px;color:var(--ink-950);">Tiến độ theo môn học</h2>
            <span class="muted small">Tỷ lệ hoàn thành nhiệm vụ và bài tập theo các môn học</span>
          </div>
        </div>

        ${
          !data.hasTaskData
            ? `
            <div style="padding:28px 16px;text-align:center;background:var(--ink-50);border-radius:var(--radius-md);">
              <p class="muted small" style="margin:0;">Chưa có công việc để tính tiến độ. Bạn có thể thêm công việc mới tại mục Công việc.</p>
            </div>
          `
            : `
            <div class="subject-progress-grid">
              ${data.subjects
                .map((sub) => {
                  const hasRate = sub.completionRate !== null;
                  const rateVal = hasRate ? sub.completionRate : 0;
                  return `
                <div class="subject-progress-item">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="color:var(--ink-950);font-size:0.95rem;">${escapeHtml(sub.name)}</strong>
                    <span class="status-pill ${hasRate ? "violet" : "neutral"}" style="font-size:0.75rem;">
                      ${hasRate ? rateVal + "%" : "Chưa có task"}
                    </span>
                  </div>
                  <div class="progress-track" style="height:8px;background:var(--ink-100);border-radius:99px;overflow:hidden;margin-bottom:6px;">
                    <div class="progress-bar-fill" style="width:${rateVal}%;height:100%;background:linear-gradient(90deg, var(--violet-600), var(--violet-400));border-radius:99px;"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--ink-600);">
                    <span>${sub.totalTasks > 0 ? `Đã làm: ${sub.completedTasks}/${sub.totalTasks} task` : "0 task"}</span>
                    <span>${escapeHtml(sub.statusLabel)}</span>
                  </div>
                </div>
              `;
                })
                .join("")}
            </div>
          `
        }
      </div>
    </div>
  `;
}
