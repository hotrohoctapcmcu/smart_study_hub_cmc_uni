/**
 * UniStudy CMC - Progress View (Sprint 2 & Refactored)
 * Phân tích tiến độ học tập và bản đồ thời gian
 */
import { getProgressAnalytics } from "./progress.service.js";
import { formatDateISO } from "../../shared/utils/date.js";
import { escapeHtml } from "../../shared/utils/validation.js";

/**
 * Render Biểu đồ Ngày dưới dạng trục toạ độ tung - hoành chuyên nghiệp
 * Trục tung (Y): Số phút học thực tế (phân độ rõ ràng: 0m, 15m, 30m, 45m, 60m...)
 * Trục hoành (X): 24 mốc giờ trong ngày kèm nhãn
 */
function renderDayCoordinateChart(data) {
  const values = data.chart.values || [];
  const labels = data.chart.labels || [];
  const rawMax = Math.max(...values, 30);
  const maxY = Math.ceil(rawMax / 15) * 15; // 30, 45, 60...
  const yTicks = [maxY, Math.round(maxY * 0.75), Math.round(maxY * 0.5), Math.round(maxY * 0.25), 0];

  const chartHeight = 200;
  const paddingBottom = 34;
  const paddingTop = 22;
  const plotHeight = chartHeight - paddingBottom - paddingTop;
  const slotWidth = 48;
  const chartWidth = Math.max(1160, values.length * slotWidth + 48);

  // Tính tọa độ các điểm toạ độ (X, Y)
  const points = values.map((val, idx) => {
    const x = idx * slotWidth + 28;
    const y = paddingTop + plotHeight - (val / maxY) * plotHeight;
    return { x, y, val, label: labels[idx], tooltip: data.chart.tooltips[idx] };
  });

  // Tạo đường biểu diễn và vùng diện tích SVG
  let linePath = "";
  let areaPath = "";
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    points.slice(1).forEach((pt) => {
      linePath += ` L ${pt.x} ${pt.y}`;
    });

    const baselineY = paddingTop + plotHeight;
    areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  }

  // Các đường lưới ngang gióng từ trục Y
  const gridLinesHtml = yTicks.map((tick) => {
    const y = paddingTop + plotHeight - (tick / maxY) * plotHeight;
    return `<line class="chart-grid-line" x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="var(--ink-100)" stroke-dasharray="4 4" />`;
  }).join("");

  // Các điểm toạ độ và nhãn trục hoành
  const pointsHtml = points.map((pt, idx) => {
    const isHighlight = data.chart.highlightIndices.includes(idx);
    const hasValue = pt.val > 0;
    const hourLabel = String(idx).padStart(2, "0") + ":00";
    return `
      <g class="chart-point-interactive" data-hour-idx="${idx}" tabindex="0">
        <title>${escapeHtml(pt.tooltip || `${pt.label}: ${pt.val} phút`)}</title>
        <!-- Đường gióng trục hoành mờ -->
        <line x1="${pt.x}" y1="${paddingTop}" x2="${pt.x}" y2="${paddingTop + plotHeight}" stroke="${hasValue ? "var(--violet-200)" : "var(--ink-50)"}" stroke-width="${hasValue ? "1.5" : "1"}" stroke-dasharray="${hasValue ? "none" : "2 2"}" />
        
        <!-- Điểm toạ độ -->
        <circle class="chart-dot" cx="${pt.x}" cy="${pt.y}" r="${isHighlight ? 5.5 : hasValue ? 4.5 : 3}" 
          fill="${isHighlight ? "#d97706" : hasValue ? "var(--violet-600)" : "var(--ink-300)"}" 
          stroke="white" stroke-width="2" />
        
        <!-- Bong bóng giá trị phút -->
        ${hasValue ? `
          <text class="chart-val-text ${isHighlight ? "chart-val-highlight" : ""}" x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="${isHighlight ? "#b45309" : "var(--violet-700)"}">${pt.val}m</text>
        ` : ""}
        
        <!-- Nhãn mốc giờ trục hoành (X-Axis) -->
        <text class="chart-x-label" x="${pt.x}" y="${chartHeight - 8}" text-anchor="middle" font-size="11" font-weight="${idx % 2 === 0 ? "700" : "500"}" fill="${idx % 2 === 0 ? "var(--ink-800)" : "var(--ink-500)"}">${hourLabel}</text>
      </g>
    `;
  }).join("");

  return `
    <div class="line-chart-outer-container">
      <!-- Trục tung (Y-Axis) -->
      <div class="line-chart-y-axis-column" style="height:${chartHeight}px;">
        ${yTicks.map((tick) => `<span>${tick}m</span>`).join("")}
      </div>

      <!-- Vùng vẽ trục hoành và đồ thị toạ độ -->
      <div class="line-chart-scroll-viewport" id="progressBarChartScrollContainer">
        <svg class="line-chart-svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}">
          <defs>
            <linearGradient id="purpleAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="var(--violet-600)" stop-opacity="0.35" />
              <stop offset="100%" stop-color="var(--violet-600)" stop-opacity="0.02" />
            </linearGradient>
          </defs>

          <!-- Các đường lưới ngang gióng từ trục Y -->
          ${gridLinesHtml}

          <!-- Đường trục hoành đáy -->
          <line x1="0" y1="${paddingTop + plotHeight}" x2="${chartWidth}" y2="${paddingTop + plotHeight}" stroke="var(--ink-200)" stroke-width="1.5" />

          <!-- Vùng diện tích gradient -->
          ${areaPath ? `<path class="chart-area" d="${areaPath}" />` : ""}

          <!-- Đường biểu diễn tiến độ -->
          ${linePath ? `<path class="chart-line" d="${linePath}" />` : ""}

          <!-- Các điểm toạ độ & nhãn trục hoành -->
          ${pointsHtml}
        </svg>
      </div>
    </div>
  `;
}

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

      <!-- 5 Thẻ chỉ số phân tích tiến độ thực tế -->
      <div class="progress-metrics-grid">
        <!-- Card 1: Tỷ lệ hoàn thành bài tập -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--emerald-600);background:var(--emerald-50);">
              <svg><use href="#i-tasks"></use></svg>
            </span>
            <span class="status-pill ${data.hasTaskData ? "violet" : "neutral"}">
              ${data.hasTaskData ? `${data.taskCompletionRate}%` : "Chưa có"}
            </span>
          </div>
          <div class="metric-value-text">
            ${data.hasTaskData ? `${data.completedTasks}/${data.totalTasks}` : "0"} <small style="font-size:1rem;font-weight:600;">task</small>
          </div>
          <div class="metric-label-text">Tỷ lệ bài tập hoàn thành</div>
          <div class="metric-sub-note">
            ${
              data.hasTaskData
                ? `Đạt ${data.taskCompletionRate}% · Còn ${data.inProgressTasks} việc cần làm`
                : "Chưa có bài tập nào được giao"
            }
          </div>
        </div>

        <!-- Card 2: Bài tập quá hạn -->
        <div class="progress-metric-card ${data.overdueTasks > 0 ? "metric-card-warning" : ""}">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:${data.overdueTasks > 0 ? "var(--rose-600)" : "var(--ink-500)"};background:${data.overdueTasks > 0 ? "var(--rose-50)" : "var(--ink-50)"};">
              <svg><use href="#i-clock"></use></svg>
            </span>
            <span class="status-pill ${data.overdueTasks > 0 ? "red" : "neutral"}">
              ${data.overdueTasks > 0 ? "Cần chú ý" : "Kịp hạn"}
            </span>
          </div>
          <div class="metric-value-text" style="${data.overdueTasks > 0 ? "color:var(--rose-600);" : ""}">
            ${data.overdueTasks} <small style="font-size:1rem;font-weight:600;">bài</small>
          </div>
          <div class="metric-label-text">Bài tập quá hạn</div>
          <div class="metric-sub-note">
            ${
              data.overdueTasks > 0
                ? `Cần ưu tiên hoàn thành ${data.overdueTasks} bài quá hạn`
                : "Không có bài tập nào bị quá hạn"
            }
          </div>
        </div>

        <!-- Card 3: Giờ học tích lũy -->
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
          <div class="metric-label-text">Giờ học trong ${currentPeriod === "day" ? "ngày" : currentPeriod === "week" ? "tuần" : "tháng"}</div>
          <div class="metric-sub-note">
            ${
              data.hasStudyData
                ? `Thời gian thực tế: ${data.totalStudyMinutes} phút (${data.pomodoroSessions} phiên)`
                : "Chưa ghi nhận giờ học trong kỳ"
            }
          </div>
        </div>

        <!-- Card 4: Điểm GPA -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--blue-600);background:var(--blue-50);">
              <svg><use href="#i-cap"></use></svg>
            </span>
            <span class="status-pill ${data.gpa >= 3.2 ? "violet" : data.gpa > 0 ? "neutral" : "neutral"}">
              ${data.gpa >= 3.6 ? "Xuất sắc" : data.gpa >= 3.2 ? "Giỏi" : data.gpa >= 2.5 ? "Khá" : data.gpa > 0 ? "Trung bình" : "Chưa có"}
            </span>
          </div>
          <div class="metric-value-text">
            ${data.gpa > 0 ? data.gpa.toFixed(2) : "0.00"} <small style="font-size:1rem;font-weight:600;">/ 4.0</small>
          </div>
          <div class="metric-label-text">Điểm trung bình (GPA)</div>
          <div class="metric-sub-note">
            ${data.gpa10 > 0 ? `Thang 10: ${data.gpa10.toFixed(2)}/10` : "Dữ liệu từ cổng đào tạo trường"}
          </div>
        </div>

        <!-- Card 5: Kỳ thi sắp tới -->
        <div class="progress-metric-card">
          <div class="metric-top">
            <span class="metric-icon-wrap" style="color:var(--amber-600);background:var(--amber-50);">
              <svg><use href="#i-exam"></use></svg>
            </span>
            <span class="status-pill ${data.upcomingExamsCount > 0 ? "orange" : "neutral"}">
              ${data.upcomingExamsCount > 0 ? `${data.upcomingExamsCount} môn` : "Trống"}
            </span>
          </div>
          <div class="metric-value-text">
            ${data.upcomingExamsCount} <small style="font-size:1rem;font-weight:600;">kỳ thi</small>
          </div>
          <div class="metric-label-text">Kỳ thi sắp tới</div>
          <div class="metric-sub-note">
            ${
              data.nextExam
                ? `Gần nhất: ${escapeHtml(data.nextExam.subject_name || data.nextExam.subjectName || "Kỳ thi")}`
                : "Không có kỳ thi nào sắp tới"
            }
          </div>
        </div>
      </div>

      <!-- Thẻ nhận xét thông minh từ Trợ lý AI khi có kết quả -->
      ${
        data.aiFeedback
          ? `
        <div class="progress-ai-card">
          <div class="progress-ai-head">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="progress-ai-icon">
                <svg><use href="#i-spark"></use></svg>
              </span>
              <div>
                <h3 style="margin:0;font-size:1.05rem;color:var(--ink-950);font-weight:700;">Nhận xét từ Trợ lý AI</h3>
                <span class="muted tiny">Đánh giá tiến độ học tập và đề xuất định hướng cá nhân</span>
              </div>
            </div>
            <span class="status-pill violet">AI Smart Feedback</span>
          </div>
          <div class="progress-ai-body">
            <p class="progress-ai-text">${escapeHtml(data.aiFeedback)}</p>
          </div>
        </div>
      `
          : ""
      }

      <!-- Biểu đồ phân bổ thời lượng học (Chiếm toàn bộ diện tích) -->
      <div class="progress-charts-grid single-chart">
        <!-- Biểu đồ phân bổ giờ học -->
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
                ${currentPeriod === "day" ? "Biểu đồ Ngày (Trục toạ độ 24 giờ)" : currentPeriod === "week" ? "Biểu đồ Tuần" : "Biểu đồ Tháng"}
              </span>
            </div>
          </div>

          ${
            currentPeriod === "day"
              ? renderDayCoordinateChart(data)
              : `
              <div class="progress-bar-chart" id="progressBarChartScrollContainer">
                ${data.chart.labels
                  .map((label, idx) => {
                    const val = data.chart.values[idx] || 0;
                    const isHighlight = data.chart.highlightIndices.includes(idx);
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
            `
          }

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
