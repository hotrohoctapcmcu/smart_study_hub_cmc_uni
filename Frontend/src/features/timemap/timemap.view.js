/**
 * UniStudy CMC - Timemap View
 * ===================================================================================
 * Giao diện Bản đồ thời gian học tập:
 * - Timeline 7 ngày trực quan với phân loại màu sắc 4 nhóm:
 *   + Xanh dương: Thời khóa biểu chính khóa
 *   + Đỏ cam: Lịch thi học kỳ
 *   + Xanh lá: Lịch tự học
 *   + Nét đứt: Thời gian trống (bấm để thêm buổi tự học)
 * - Heatmap mật độ học theo 24 khung giờ x 7 ngày
 * - Form popup thêm buổi tự học nhanh khi bấm khoảng trống
 * ===================================================================================
 */

import { getTimemapWeekData, getHourlyStudyDensityHeatmap } from "./timemap.service.js";
import { escapeHtml } from "../../shared/utils/validation.js";
import { formatDateISO } from "../../shared/utils/date.js";
import { state } from "../../app/state.js";

export function renderTimemapView(uiState = {}) {
  const selectedDate = uiState.selectedDate || formatDateISO(new Date());
  const weekData = getTimemapWeekData(selectedDate);
  const heatmapData = getHourlyStudyDensityHeatmap(selectedDate);

  const hoursList = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  // Danh sách môn học hiện có để đưa vào dropdown form
  const availableSubjects = Array.from(
    new Set([
      ...(state.tasks || []).map((t) => t.subject).filter(Boolean),
      ...(state.schoolEvents || []).map((e) => e.subject).filter(Boolean),
      ...(state.exams || []).map((e) => e.subjectName || e.subject).filter(Boolean)
    ])
  );

  return `
    <div class="timemap-container">
      <!-- 1. Thanh công cụ đầu trang (Header & Navigation) -->
      <div class="timemap-header">
        <div>
          <span class="eyebrow"><svg><use href="#i-calendar"></use></svg> Quản lý thời gian toàn diện</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Bản đồ thời gian học tập</h1>
        </div>

        <div class="timemap-toolbar">
          <button type="button" class="timemap-today-btn" id="timemapTodayBtn">Hôm nay</button>

          <!-- Bộ điều hướng tuần -->
          <div class="timemap-date-nav">
            <button type="button" class="icon-button" id="timemapPrevBtn" title="Tuần trước" aria-label="Tuần trước">
              <svg><use href="#i-chevron-left"></use></svg>
            </button>
            <input 
              type="date" 
              id="timemapDatePicker" 
              class="schedule-date-input" 
              value="${selectedDate}" 
              aria-label="Chọn ngày xem bản đồ thời gian"
            />
            <button type="button" class="icon-button" id="timemapNextBtn" title="Tuần sau" aria-label="Tuần sau">
              <svg><use href="#i-chevron-right"></use></svg>
            </button>
          </div>

          <span class="timemap-range-badge">${escapeHtml(weekData.weekRangeTitle)}</span>

          <button type="button" class="button primary" id="timemapOpenAddModalBtn">
            <svg style="width:16px;height:16px;"><use href="#i-plus"></use></svg>
            Thêm buổi tự học
          </button>
        </div>
      </div>

      <!-- 2. Chú giải phân loại màu sắc sự kiện (Color Legend Bar) -->
      <div class="timemap-legend-bar">
        <span class="timemap-legend-title">Phân biệt màu sự kiện:</span>
        <div class="legend-item schedule" title="Lớp học theo thời khóa biểu chính khóa của trường">
          <span class="legend-dot"></span>
          <span>Thời khóa biểu (${weekData.summary.totalScheduleHours}h)</span>
        </div>
        <div class="legend-item exam" title="Lịch thi học kỳ">
          <span class="legend-dot"></span>
          <span>Lịch thi (${weekData.summary.totalExamCount} môn)</span>
        </div>
        <div class="legend-item selfstudy" title="Các buổi tự học cá nhân">
          <span class="legend-dot"></span>
          <span>Tự học (${weekData.summary.totalSelfStudyHours}h)</span>
        </div>
        <div class="legend-item freetime" title="Khoảng thời gian trống — Bấm vào để thêm buổi tự học">
          <span class="legend-dot"></span>
          <span>Thời gian trống (~${weekData.summary.totalFreeHours}h rảnh · Bấm để thêm)</span>
        </div>
      </div>

      <!-- 3. Timeline 7 ngày (7-Day Timeline Grid) -->
      <div class="timemap-card">
        <div class="timemap-card-head">
          <div>
            <h2 style="font-size:1.15rem;margin:0 0 4px;color:var(--ink-950);">Lịch trình 7 ngày chi tiết</h2>
            <span class="muted small">Hiển thị lịch học, thi cử và gợi ý các khung giờ rảnh</span>
          </div>
          <span class="status-pill violet">Khung giờ hoạt động: 07:00 – 22:00</span>
        </div>

        <div class="timemap-timeline-wrapper">
          <div class="timemap-grid-table">
            <!-- Header hàng ngày (Thứ 2 - CN) -->
            <div class="timemap-grid-header">
              <div class="timemap-time-corner">Giờ</div>
              ${weekData.days
                .map(
                  (d) => `
                <div class="timemap-day-header-col ${d.isToday ? "is-today" : ""}">
                  <span class="timemap-day-name">${escapeHtml(d.dayName)}</span>
                  <span class="timemap-day-date">${escapeHtml(d.dateFormatted)}</span>
                </div>
              `
                )
                .join("")}
            </div>

            <!-- Cột mốc giờ bên trái -->
            <div class="timemap-time-col">
              ${hoursList
                .map(
                  (h) => `
                <div class="timemap-hour-mark">${String(h).padStart(2, "0")}:00</div>
              `
                )
                .join("")}
            </div>

            <!-- 7 Cột nội dung ngày -->
            ${weekData.days
              .map(
                (d) => `
              <div class="timemap-day-track ${d.isToday ? "is-today" : ""}">
                ${d.allTimelineItems
                  .map((item) => {
                    const topPx = Math.max(0, ((item.startMin - 7 * 60) / 60) * 56);
                    const durHours = Math.max(0.4, (item.endMin - item.startMin) / 60);
                    const heightPx = Math.max(26, durHours * 56 - 4);

                    if (item.type === "free_time") {
                      return `
                        <div 
                          class="timemap-block free_time" 
                          style="top:${topPx}px;height:${heightPx}px;"
                          data-free-slot="true"
                          data-date="${escapeHtml(item.date)}"
                          data-start="${escapeHtml(item.start)}"
                          data-end="${escapeHtml(item.end)}"
                          title="Khoảng trống: ${item.start} – ${item.end} (${item.durationMinutes} phút). Bấm vào để thêm buổi tự học!"
                        >
                          <span class="free-slot-add-btn">
                            <svg><use href="#i-plus"></use></svg>
                            <span>Rảnh ${Math.round(item.durationMinutes / 60 * 10) / 10}h · Bấm để thêm</span>
                          </span>
                        </div>
                      `;
                    }

                    return `
                      <div 
                        class="timemap-block ${item.colorType}" 
                        style="top:${topPx}px;height:${heightPx}px;"
                        title="${escapeHtml(item.title)} (${item.start} – ${item.end})${item.room ? ` · Phòng: ${item.room}` : ""}"
                      >
                        <div class="block-time-range">${escapeHtml(item.start)} – ${escapeHtml(item.end)}</div>
                        <div class="block-title">${escapeHtml(item.title)}</div>
                        ${item.room ? `<div class="block-sub">📍 ${escapeHtml(item.room)}</div>` : ""}
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>

      <!-- 4. Heatmap mật độ học theo giờ (Hourly Study Density Heatmap) -->
      <div class="timemap-card">
        <div class="timemap-card-head">
          <div>
            <h2 style="font-size:1.15rem;margin:0 0 4px;color:var(--ink-950);">Heatmap mật độ học theo giờ</h2>
            <span class="muted small">Phân bố thời lượng học tập trong 24 khung giờ mỗi ngày (Thứ 2 – Chủ nhật)</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="status-pill violet">Tổng: ${heatmapData.totalWeekHours} giờ học</span>
            <span class="status-pill neutral">${escapeHtml(heatmapData.peakInfo)}</span>
          </div>
        </div>

        <div class="timemap-heatmap-grid">
          <table class="timemap-heatmap-table">
            <thead>
              <tr>
                <th style="width:85px;text-align:right;padding-right:8px;font-size:0.75rem;color:var(--ink-500);">Thứ / Giờ</th>
                ${heatmapData.hoursList
                  .map(
                    (h) => `
                  <th style="font-size:0.7rem;font-weight:700;color:var(--ink-600);text-align:center;padding:4px 0;">
                    ${h % 2 === 0 ? `${h}h` : ""}
                  </th>
                `
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${heatmapData.matrix
                .map(
                  (row) => `
                <tr>
                  <td class="heatmap-day-label">${escapeHtml(row.dayName)} <small style="font-size:0.7rem;color:var(--ink-500);">(${row.dateShort})</small></td>
                  ${row.cells
                    .map(
                      (cell) => `
                    <td 
                      class="heatmap-cell level-${cell.level}" 
                      title="${escapeHtml(cell.tooltip)}"
                    ></td>
                  `
                    )
                    .join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Chú giải thang màu Heatmap -->
        <div class="timemap-heatmap-legend">
          <span>Mật độ học:</span>
          <span style="display:flex;align-items:center;gap:4px;">
            <span class="heatmap-legend-swatch level-0" style="background:var(--ink-100);"></span>
            <span>0m (Trống)</span>
          </span>
          <span style="display:flex;align-items:center;gap:4px;">
            <span class="heatmap-legend-swatch level-1" style="background:#ddd6fe;"></span>
            <span>1–25m</span>
          </span>
          <span style="display:flex;align-items:center;gap:4px;">
            <span class="heatmap-legend-swatch level-2" style="background:#a78bfa;"></span>
            <span>26–45m</span>
          </span>
          <span style="display:flex;align-items:center;gap:4px;">
            <span class="heatmap-legend-swatch level-3" style="background:#6d28d9;"></span>
            <span>>45m (Cao)</span>
          </span>
        </div>
      </div>

      <!-- 5. Modal Form thêm buổi tự học (Popup khi bấm khoảng trống hoặc nút Thêm) -->
      ${
        uiState.isModalOpen
          ? `
        <div class="timemap-modal-overlay" id="timemapModalOverlay">
          <div class="timemap-modal-content">
            <div class="timemap-modal-head">
              <h3>Thêm buổi tự học</h3>
              <button type="button" class="icon-button" id="timemapCloseModalBtn" aria-label="Đóng form">
                <svg><use href="#i-close"></use></svg>
              </button>
            </div>

            <form id="timemapAddSelfStudyForm">
              <div class="timemap-form-row">
                <label for="timemapModalTitle">Tiêu đề buổi học *</label>
                <input 
                  type="text" 
                  id="timemapModalTitle" 
                  name="title" 
                  required 
                  value="${escapeHtml(uiState.modalData?.title || "Tự học bài mới")}" 
                  placeholder="Ví dụ: Ôn tập chương 3, Giải bài tập lớn..." 
                />
              </div>

              <div class="timemap-form-row" style="margin-top:12px;">
                <label for="timemapModalSubject">Môn học</label>
                <input 
                  type="text" 
                  id="timemapModalSubject" 
                  name="subject" 
                  list="timemapSubjectsList"
                  value="${escapeHtml(uiState.modalData?.subject || (availableSubjects[0] || "Tự học"))}" 
                  placeholder="Nhập tên môn học..."
                />
                <datalist id="timemapSubjectsList">
                  ${availableSubjects.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("")}
                </datalist>
              </div>

              <div class="timemap-form-row" style="margin-top:12px;">
                <label for="timemapModalDate">Ngày học *</label>
                <input 
                  type="date" 
                  id="timemapModalDate" 
                  name="date" 
                  required 
                  value="${escapeHtml(uiState.modalData?.date || selectedDate)}" 
                />
              </div>

              <div class="timemap-form-two-col" style="margin-top:12px;">
                <div class="timemap-form-row">
                  <label for="timemapModalStart">Giờ bắt đầu *</label>
                  <input 
                    type="time" 
                    id="timemapModalStart" 
                    name="start" 
                    required 
                    value="${escapeHtml(uiState.modalData?.start || "08:00")}" 
                  />
                </div>
                <div class="timemap-form-row">
                  <label for="timemapModalEnd">Giờ kết thúc *</label>
                  <input 
                    type="time" 
                    id="timemapModalEnd" 
                    name="end" 
                    required 
                    value="${escapeHtml(uiState.modalData?.end || "10:00")}" 
                  />
                </div>
              </div>

              <div class="timemap-form-row" style="margin-top:12px;">
                <label for="timemapModalNote">Ghi chú / Mục tiêu</label>
                <textarea 
                  id="timemapModalNote" 
                  name="note" 
                  rows="2" 
                  placeholder="Mục tiêu cần hoàn thành trong buổi học này..."
                >${escapeHtml(uiState.modalData?.note || "")}</textarea>
              </div>

              <div class="timemap-modal-actions">
                <button type="button" class="button neutral" id="timemapCancelModalBtn">Hủy</button>
                <button type="submit" class="button primary">Lưu buổi tự học</button>
              </div>
            </form>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}
