/**
 * UniStudy CMC - Schedule View (Theo Ảnh 06, 07, 08)
 */
import { state } from "../../app/state.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateISO, formatDateVN, getDaysOfWeek } from "../../shared/utils/date.js";
import { findScheduleConflicts } from "./schedule.conflicts.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { renderModal } from "../../shared/components/modal.js";

export function renderScheduleView() {
  const activeTab = getActiveTab();
  const selectedDateStr = activeTab.tabState?.selectedDate || formatDateISO(new Date());
  const mode = activeTab.tabState?.scheduleMode || "week";

  // Tổng hợp tất cả sự kiện (trường + tự học)
  const allEvents = [...state.schoolEvents, ...state.studyEvents];

  // Tính toán xung đột từ pure function
  const conflictResult = findScheduleConflicts(allEvents);
  const conflictCount = conflictResult.count;
  const conflictingIds = conflictResult.conflictingEventIds;

  // Tiêu đề khoảng thời gian dùng chung state với input date (tuyệt đối không suy từ chuỗi hiển thị)
  const weekDays = getDaysOfWeek(selectedDateStr);
  const weekStartVN = formatDateVN(weekDays[0].date);
  const weekEndVN = formatDateVN(weekDays[6].date);
  const periodTitle =
    mode === "week"
      ? `Tuần ${weekStartVN} – ${weekEndVN}`
      : mode === "day"
      ? `Ngày ${formatDateVN(selectedDateStr)}`
      : `Tháng ${selectedDateStr.slice(5, 7)}/${selectedDateStr.slice(0, 4)}`;

  return `
    <div class="schedule-container">
      <!-- Dải điều hướng & Chế độ xem -->
      <div class="schedule-header-controls">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div class="view-mode-tabs" role="tablist">
            <button type="button" class="view-mode-btn ${mode === "day" ? "active" : ""}" data-schedule-mode="day">Ngày</button>
            <button type="button" class="view-mode-btn ${mode === "week" ? "active" : ""}" data-schedule-mode="week">Tuần</button>
            <button type="button" class="view-mode-btn ${mode === "month" ? "active" : ""}" data-schedule-mode="month">Tháng</button>
          </div>

          <!-- Cụm điều hướng ngày: [‹] [Ô chọn ngày 📅] [›] -->
          <div class="schedule-date-navigator">
            <button type="button" class="icon-button schedule-nav-arrow" id="schedulePrevDateBtn" aria-label="Khoảng thời gian trước" title="Khoảng thời gian trước">
              <svg><use href="#i-chevron-left"></use></svg>
            </button>
            <input 
              type="date" 
              id="scheduleDatePicker" 
              class="schedule-date-input"
              aria-label="Chọn ngày xem lịch"
              value="${selectedDateStr}" 
            />
            <button type="button" class="icon-button schedule-nav-arrow" id="scheduleNextDateBtn" aria-label="Khoảng thời gian kế tiếp" title="Khoảng thời gian kế tiếp">
              <svg><use href="#i-chevron-right"></use></svg>
            </button>
          </div>

          <span class="schedule-period-badge">
            ${periodTitle}
          </span>
        </div>

        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="button primary" id="openAddStudySessionBtn">
            <svg><use href="#i-plus"></use></svg>
            <span>Xếp lịch tự học</span>
          </button>
        </div>
      </div>

      <!-- Banner cảnh báo xung đột (Khắc phục hoàn toàn lỗi ảnh 08) -->
      ${
        conflictCount > 0
          ? `
        <div class="schedule-conflict-banner" role="alert">
          <div>
            <strong>
              <svg style="color:var(--red-600);"><use href="#i-bell"></use></svg>
              Cảnh báo: Phát hiện ${conflictCount} xung đột lịch học!
            </strong>
            <p style="margin:4px 0 0;font-size:0.85rem;opacity:0.9;">
              Một số buổi học và ca tự học bị trùng thời gian trong cùng ngày. Cả hai buổi học đã được đánh dấu đỏ.
            </p>
          </div>
          <button type="button" class="button danger" id="openConflictResolutionBtn" style="background:white;border:1px solid var(--red-600);color:var(--red-600);">
            Giải quyết trùng lịch
          </button>
        </div>
      `
          : ""
      }

      <!-- Vùng hiển thị Lịch theo chế độ -->
      ${
        mode === "week"
          ? renderWeekView(selectedDateStr, allEvents, conflictingIds)
          : mode === "day"
          ? renderDayView(selectedDateStr, allEvents, conflictingIds)
          : renderMonthView(selectedDateStr, allEvents, conflictingIds)
      }

      <!-- Modal Thêm / Sửa lịch tự học -->
      <div id="studySessionModalContainer"></div>

      <!-- Modal Chi tiết buổi học -->
      <div id="eventDetailModalContainer"></div>

      <!-- Modal Xác nhận xóa buổi học -->
      <div id="confirmDeleteModalContainer"></div>

      <!-- Modal Giải quyết xung đột -->
      <div id="conflictResolutionModalContainer"></div>
    </div>
  `;
}

/**
 * Render Lịch tuần (Tham chiếu Ảnh 06)
 */
function renderWeekView(selectedDateStr, allEvents, conflictingIds) {
  const days = getDaysOfWeek(selectedDateStr);
  const todayStr = formatDateISO(new Date());

  const headersHtml = days
    .map((d) => {
      const isToday = d.dateStr === todayStr;
      return `
        <div class="grid-day-header ${isToday ? "today" : ""}">
          <strong>${d.dayName}</strong>
          <span>${formatDateVN(d.date).slice(0, 5)}</span>
        </div>
      `;
    })
    .join("");

  const columnsHtml = days
    .map((d) => {
      const dayEvents = allEvents.filter((e) => e.date === d.dateStr);
      return `
        <div class="grid-day-column" data-date="${d.dateStr}">
          ${
            dayEvents.length > 0
              ? dayEvents
                  .map((ev) => {
                    const isConflict = conflictingIds.has(ev.id);
                    const isStudy = ev.source === "Tự thêm" || !ev.source;
                    const typeClass = isConflict ? "conflict" : isStudy ? "study" : "school";

                    return `
                      <div class="event-card ${typeClass}" data-event-id="${ev.id}" tabindex="0" role="button" aria-label="Xem chi tiết ${ev.title || ev.subject}">
                        <div class="event-card-title">${ev.title || ev.subject}</div>
                        <div class="event-card-time">${ev.start} – ${ev.end}</div>
                        ${ev.room ? `<div class="event-card-time">Phòng: ${ev.room}</div>` : ""}
                        <span class="event-card-tag">${isConflict ? "Trùng lịch" : isStudy ? "Tự học" : "Lịch trường"}</span>
                      </div>
                    `;
                  })
                  .join("")
              : `<div style="text-align:center;color:var(--ink-300);font-size:0.75rem;margin-top:20px;">Trống</div>`
          }
        </div>
      `;
    })
    .join("");

  return `
    <div class="schedule-week-grid">
      <div class="grid-day-header" style="background:#f3f1f8;">
        <strong>Giờ</strong>
      </div>
      ${headersHtml}
      
      <div style="padding:12px 8px;text-align:center;font-size:0.75rem;color:var(--ink-500);font-weight:600;">
        Cả ngày
      </div>
      ${columnsHtml}
    </div>
  `;
}

/**
 * Render Lịch ngày (Tham chiếu Ảnh 07)
 */
function renderDayView(selectedDateStr, allEvents, conflictingIds) {
  const dayEvents = allEvents
    .filter((e) => e.date === selectedDateStr)
    .sort((a, b) => (a.start > b.start ? 1 : -1));

  if (dayEvents.length === 0) {
    return renderEmptyState({
      icon: "i-calendar",
      title: `Không có lịch trong ngày ${formatDateVN(selectedDateStr)}`,
      description: "Bạn có thể xếp thêm buổi tự học hoặc đồng bộ thời khóa biểu từ cổng trường CMC.",
      actionText: "Thêm lịch tự học",
      actionDataAttr: 'id="emptyDayAddStudyBtn"'
    });
  }

  const rowsHtml = dayEvents
    .map((ev) => {
      const isConflict = conflictingIds.has(ev.id);
      const isStudy = ev.source === "Tự thêm" || !ev.source;

      return `
        <div class="day-event-row ${isConflict ? "conflict" : ""}" data-event-id="${ev.id}" tabindex="0" role="button" aria-label="Xem chi tiết ${ev.title || ev.subject}">
          <div>
            <div style="font-weight:700;font-size:1.1rem;color:var(--ink-950);">${ev.start} – ${ev.end}</div>
            <span class="eyebrow" style="font-size:0.75rem;">${isStudy ? "Tự học cá nhân" : "Thời khóa biểu trường"}</span>
          </div>

          <div>
            <h4 style="margin:0 0 4px;font-size:1.05rem;color:var(--ink-950);">${ev.subject || ev.title}</h4>
            <p style="margin:0;font-size:0.86rem;color:var(--ink-600);">
              ${ev.note || ev.title || ""} ${ev.room ? `· Phòng: ${ev.room}` : ""} ${ev.lecturer ? `· GV: ${ev.lecturer}` : ""}
            </p>
            ${
              isConflict
                ? `<div style="margin-top:6px;color:var(--red-600);font-weight:700;font-size:0.82rem;">
                     ⚠️ Trùng thời gian với một buổi học khác trong ngày!
                   </div>`
                : ""
            }
          </div>

          <div style="display:flex;align-items:center;gap:8px;" onclick="event.stopPropagation();">
            ${
              isStudy
                ? `
              <button type="button" class="button ghost small" data-edit-study-id="${ev.id}" aria-label="Chỉnh sửa buổi học">Sửa</button>
              <button type="button" class="button danger small" data-delete-study-id="${ev.id}" aria-label="Xóa buổi học">Xóa</button>
            `
                : `<span class="badge-draft" style="background:#fef3c7;color:#92400e;">Lịch chính khóa</span>`
            }
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="schedule-day-list">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;font-size:1.2rem;color:var(--ink-950);">
          Lịch học ngày ${formatDateVN(selectedDateStr)}
        </h3>
        <span class="muted small">${dayEvents.length} buổi học</span>
      </div>
      ${rowsHtml}
    </div>
  `;
}

/**
 * Render Lịch tháng
 */
function renderMonthView(selectedDateStr, allEvents, conflictingIds) {
  return `
    <div style="background:white;border-radius:var(--radius-lg);padding:30px;border:1px solid var(--ink-200);text-align:center;">
      <h3 style="margin:0 0 10px;">Lịch tháng</h3>
      <p class="muted">Đang xem tháng chứa ngày ${formatDateVN(selectedDateStr)}. Dùng Lịch tuần hoặc Lịch ngày để xem chi tiết theo tiết học.</p>
    </div>
  `;
}

/**
 * Render Modal Chi tiết buổi học (Event Detail Modal)
 */
export function renderEventDetailModal(event, isConflict = false) {
  const isStudy = event.source === "Tự thêm" || !event.source;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="eyebrow" style="font-size:0.8rem;background:#f3f1f8;padding:4px 10px;border-radius:6px;">
          ${isStudy ? "📘 Lịch tự học cá nhân" : "🎓 Thời khóa biểu CMC"}
        </span>
        ${
          isConflict
            ? `<span style="background:#fee2e2;color:#dc2626;font-size:0.78rem;font-weight:700;padding:4px 8px;border-radius:6px;">
                 ⚠️ Trùng lịch
               </span>`
            : ""
        }
      </div>

      <div>
        <h4 style="margin:0 0 6px;font-size:1.3rem;color:var(--ink-950);">
          ${event.title || event.subject}
        </h4>
        ${
          event.subject && event.title && event.title !== event.subject
            ? `<div style="font-size:0.9rem;color:var(--ink-600);margin-bottom:4px;">Môn: <strong>${event.subject}</strong></div>`
            : ""
        }
      </div>

      <div style="background:#f8fafc;border:1px solid var(--ink-200);border-radius:12px;padding:14px 18px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;font-size:0.92rem;color:var(--ink-800);">
          <svg style="width:18px;height:18px;color:var(--violet-700);"><use href="#i-calendar"></use></svg>
          <span><strong>Ngày học:</strong> ${formatDateVN(event.date)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;font-size:0.92rem;color:var(--ink-800);">
          <svg style="width:18px;height:18px;color:var(--violet-700);"><use href="#i-chart"></use></svg>
          <span><strong>Thời gian:</strong> ${event.start} – ${event.end}</span>
        </div>
        ${
          event.room
            ? `<div style="display:flex;align-items:center;gap:10px;font-size:0.92rem;color:var(--ink-800);">
                 <span><strong>Phòng học:</strong> ${event.room}</span>
               </div>`
            : ""
        }
        ${
          event.lecturer
            ? `<div style="display:flex;align-items:center;gap:10px;font-size:0.92rem;color:var(--ink-800);">
                 <span><strong>Giảng viên:</strong> ${event.lecturer}</span>
               </div>`
            : ""
        }
        ${
          event.note
            ? `<div style="display:flex;align-items:center;gap:10px;font-size:0.92rem;color:var(--ink-800);">
                 <span><strong>Ghi chú:</strong> ${event.note}</span>
               </div>`
            : ""
        }
      </div>

      ${
        isConflict
          ? `
        <div style="padding:12px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fee2e2;color:#991b1b;font-size:0.86rem;line-height:1.4;">
          <strong>Cảnh báo xung đột:</strong> Buổi học này bị trùng giờ với một ca học khác trong ngày. Bạn có thể chỉnh sửa khung giờ để không bị trùng.
        </div>
      `
          : ""
      }

      ${
        !isStudy
          ? `
        <p style="margin:0;font-size:0.82rem;color:var(--ink-500);font-style:italic;">
          ℹ️ Đây là thời khóa biểu chính khóa đồng bộ từ cổng trường CMC University, không thể chỉnh sửa hoặc xóa thủ công.
        </p>
      `
          : ""
      }
    </div>
  `;

  const footerHtml = isStudy
    ? `
      <button type="button" class="button danger" id="deleteStudyFromDetailBtn" data-event-id="${event.id}">Xóa lịch</button>
      <button type="button" class="button primary" id="editStudyFromDetailBtn" data-event-id="${event.id}">Chỉnh sửa</button>
      <button type="button" class="button ghost" data-close-modal="eventDetailModal">Đóng</button>
    `
    : `
      <button type="button" class="button ghost" data-close-modal="eventDetailModal">Đóng</button>
    `;

  return renderModal({
    id: "eventDetailModal",
    title: "Chi tiết buổi học",
    bodyHtml,
    footerHtml,
    customClass: "event-detail-dialog"
  });
}

/**
 * Render Modal Xác nhận Xóa buổi học (Confirm Delete Modal)
 */
export function renderConfirmDeleteModal(event) {
  const bodyHtml = `
    <div style="padding:6px 0;">
      <p style="margin:0 0 14px;font-size:0.95rem;line-height:1.5;color:var(--ink-950);">
        Bạn có chắc chắn muốn xóa lịch tự học <strong>"${event.title || event.subject}"</strong> không?
      </p>

      <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:12px 16px;color:#991b1b;font-size:0.88rem;display:flex;flex-direction:column;gap:4px;">
        <div><strong>Ngày:</strong> ${formatDateVN(event.date)}</div>
        <div><strong>Thời gian:</strong> ${event.start} – ${event.end}</div>
        ${event.subject ? `<div><strong>Môn học:</strong> ${event.subject}</div>` : ""}
      </div>

      <p style="margin:12px 0 0;font-size:0.82rem;color:var(--ink-500);">
        Thao tác này chỉ xóa bản ghi cục bộ khỏi phiên làm việc và không thể hoàn tác.
      </p>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="confirmDeleteModal">Hủy bỏ</button>
    <button type="button" class="button danger" id="confirmDeleteSessionBtn" data-event-id="${event.id}">
      Xác nhận xóa
    </button>
  `;

  return renderModal({
    id: "confirmDeleteModal",
    title: "Xác nhận xóa lịch tự học",
    bodyHtml,
    footerHtml,
    customClass: "confirm-delete-dialog"
  });
}

/**
 * Render Modal Thêm / Sửa Lịch tự học
 */
export function renderStudySessionModal(sessionData = null) {
  const isEdit = Boolean(sessionData && sessionData.id);

  const bodyHtml = `
    <form id="studySessionForm" style="display:flex;flex-direction:column;gap:14px;">
      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Tên hoặc mục tiêu buổi học *</span>
        <input 
          type="text" 
          name="title" 
          required 
          placeholder="Ví dụ: Ôn tập Cấu trúc dữ liệu Chương 3" 
          value="${sessionData?.title || ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Môn học</span>
        <input 
          type="text" 
          name="subject" 
          placeholder="Ví dụ: Cấu trúc dữ liệu" 
          value="${sessionData?.subject || ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Ngày học *</span>
        <input 
          type="date" 
          name="date" 
          required 
          value="${sessionData?.date || formatDateISO(new Date())}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Giờ bắt đầu *</span>
          <input 
            type="time" 
            name="start" 
            required 
            value="${sessionData?.start || "08:00"}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Giờ kết thúc *</span>
          <input 
            type="time" 
            name="end" 
            required 
            value="${sessionData?.end || "09:30"}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
      </div>

      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Ghi chú / Địa điểm</span>
        <input 
          type="text" 
          name="note" 
          placeholder="Ví dụ: Thư viện cơ sở 2" 
          value="${sessionData?.note || ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <div class="badge-draft" style="width:fit-content;">
        📌 Bản nháp cục bộ — Chưa lưu server
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="studyModal">Hủy</button>
    <button type="submit" form="studySessionForm" class="button primary">
      ${isEdit ? "Cập nhật buổi học" : "Lưu lịch tự học"}
    </button>
  `;

  return renderModal({
    id: "studyModal",
    title: isEdit ? "Chỉnh sửa lịch tự học" : "Xếp lịch tự học mới",
    bodyHtml,
    footerHtml
  });
}

/**
 * Render Modal Giải quyết xung đột (Conflict Resolution Modal)
 */
export function renderConflictResolutionModal(conflictPairs) {
  const pairsHtml = conflictPairs
    .map((p, idx) => {
      const a = p.eventA;
      const b = p.eventB;
      return `
        <div style="border:1px solid var(--red-100);background:#fff5f5;border-radius:12px;padding:16px;margin-bottom:14px;">
          <strong style="color:var(--red-600);display:block;margin-bottom:8px;">
            Cặp xung đột #${idx + 1} (Ngày ${a.date}):
          </strong>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div style="background:white;padding:10px;border-radius:8px;border:1px solid var(--ink-200);">
              <div style="font-weight:700;">${a.title || a.subject}</div>
              <div style="font-size:0.8rem;color:var(--ink-600);">${a.start} – ${a.end}</div>
              <span class="eyebrow" style="font-size:0.7rem;">${a.source || "CMC"}</span>
            </div>
            <div style="background:white;padding:10px;border-radius:8px;border:1px solid var(--ink-200);">
              <div style="font-weight:700;">${b.title || b.subject}</div>
              <div style="font-size:0.8rem;color:var(--ink-600);">${b.start} – ${b.end}</div>
              <span class="eyebrow" style="font-size:0.7rem;">${b.source || "CMC"}</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="button secondary small" data-resolve-conflict="keep_school" data-pair-key="${p.key}">
              Giữ lịch trên trường (Hủy tự học)
            </button>
            <button type="button" class="button ghost small" data-resolve-conflict="keep_study" data-pair-key="${p.key}">
              Ưu tiên lịch tự học
            </button>
            <button type="button" class="button ghost small" data-resolve-conflict="adjust_time" data-pair-key="${p.key}">
              Đổi giờ tự học
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  const bodyHtml = `
    <p class="muted small" style="margin-top:0;">
      Chọn giải pháp xử lý cho các khoảng thời gian bị trùng lặp. 
      Lưu ý: Lịch trường là thông tin chính khóa, việc ưu tiên tự học chỉ lưu ghi nhận trong không gian làm việc cục bộ.
    </p>
    <div>${pairsHtml}</div>
  `;

  return renderModal({
    id: "conflictResolutionModal",
    title: "Giải quyết xung đột lịch học",
    bodyHtml
  });
}
