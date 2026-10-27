/**
 * UniStudy CMC - Schedule View (Google Calendar Style 24h Grid)
 * Tách biệt View, Grid Layout, Conflicts và CSS.
 */
import { state } from "../../app/state.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateISO, formatDateVN, getDaysOfWeek } from "../../shared/utils/date.js";
import { findScheduleConflicts } from "./schedule.conflicts.js";
import { renderModal } from "../../shared/components/modal.js";
import { escapeHtml } from "../../shared/utils/validation.js";
import { 
  HOUR_HEIGHT, 
  HOURS_24, 
  GRID_HOURS_2H,
  splitOvernightEvents, 
  layoutDayEvents 
} from "./schedule.grid.js";

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

  return `
    <div class="schedule-container">
      <!-- Thanh công cụ lịch: Chế độ xem [Ngày] [Tuần] [Tháng], Hôm nay, Gợi ý AI và Xếp lịch tự học -->
      <div class="schedule-header-controls">
        <div class="schedule-nav-group">
          <button type="button" class="button secondary small" id="scheduleTodayBtn">
            Hôm nay
          </button>
          <div class="view-mode-tabs" role="tablist">
            <button type="button" class="view-mode-btn ${mode === "day" ? "active" : ""}" data-schedule-mode="day">Ngày</button>
            <button type="button" class="view-mode-btn ${mode === "week" ? "active" : ""}" data-schedule-mode="week">Tuần</button>
            <button type="button" class="view-mode-btn ${mode === "month" ? "active" : ""}" data-schedule-mode="month">Tháng</button>
          </div>
        </div>

        <div class="schedule-action-group">
          <button type="button" class="button ghost small mobile-mini-toggle" id="toggleMiniCalMobileBtn" title="Mở lịch nhỏ">
            <svg style="width:16px;height:16px;"><use href="#i-calendar"></use></svg>
            <span>Lịch nhỏ</span>
          </button>
          <button type="button" class="button secondary" id="openAiScheduleBtn" title="Nhận gợi ý sắp xếp thời khóa biểu tự học từ AI">
            <svg style="color:var(--violet-600);"><use href="#i-spark"></use></svg>
            <span>Gợi ý xếp lịch bằng AI</span>
          </button>
          <button type="button" class="button primary" id="openAddStudySessionBtn">
            <svg><use href="#i-plus"></use></svg>
            <span>Xếp lịch tự học</span>
          </button>
        </div>
      </div>

      <!-- Banner cảnh báo xung đột đã tồn tại -->
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
              Một số buổi học và ca tự học bị trùng thời gian. Các buổi trùng đã được đánh dấu đỏ trên lịch.
            </p>
          </div>
          <button type="button" class="button danger" id="openConflictResolutionBtn" style="background:white;border:1px solid var(--red-600);color:var(--red-600);">
            Xem và xử lý (${conflictCount})
          </button>
        </div>
      `
          : ""
      }

      <!-- BỐ CỤC 2 CỘT CHUẨN: BÊN TRÁI: LỊCH CHÍNH (DIỆN TÍCH LỚN), BÊN PHẢI: LỊCH THÁNG THU NHỎ & CHÚ GIẢI -->
      <div class="schedule-body-layout">
        <!-- Cột lớn bên trái: Lịch chính (Ngày / Tuần theo lưới 24h hoặc Tháng) -->
        <main class="schedule-main-col">
          ${
            mode === "week"
              ? renderWeekHourlyGrid(selectedDateStr, allEvents, conflictingIds)
              : mode === "day"
              ? renderDayHourlyGrid(selectedDateStr, allEvents, conflictingIds)
              : renderMonthView(selectedDateStr, allEvents, conflictingIds)
          }
        </main>

        <!-- Cột bên phải: Lịch tháng thu nhỏ & Chú giải màu -->
        <aside class="schedule-side-col" id="scheduleSideCol">
          ${renderMiniCalendar(selectedDateStr, allEvents)}
          ${renderColorLegend()}
        </aside>
      </div>

      <!-- Modal Gợi ý xếp lịch bằng AI -->
      <div id="aiScheduleModalContainer"></div>

      <!-- Modal Thêm / Sửa lịch tự học -->
      <div id="studySessionModalContainer"></div>

      <!-- Modal Chi tiết buổi học -->
      <div id="eventDetailModalContainer"></div>

      <!-- Modal Xác nhận xóa buổi học -->
      <div id="confirmDeleteModalContainer"></div>

      <!-- Modal Xử lý xung đột khi Thêm / Sửa -->
      <div id="conflictDecisionModalContainer"></div>

      <!-- Modal Xem và giải quyết xung đột đã tồn tại -->
      <div id="conflictResolutionModalContainer"></div>
    </div>
  `;
}

/**
 * Render Lịch tháng thu nhỏ (Mini Calendar) điều khiển lịch chính
 */
export function renderMiniCalendar(selectedDateStr, allEvents) {
  const parts = selectedDateStr.split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const todayStr = formatDateISO(new Date());

  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Thứ 2 = 0
  const totalSlots = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;

  const datesWithEvents = new Set(allEvents.map((e) => e.date));

  let cellsHtml = "";
  for (let i = 0; i < totalSlots; i++) {
    const dayNum = i - startDayOfWeek + 1;
    if (dayNum >= 1 && dayNum <= daysInMonth) {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const isSelected = dateStr === selectedDateStr;
      const isToday = dateStr === todayStr;
      const hasEvents = datesWithEvents.has(dateStr);

      cellsHtml += `
        <button type="button" 
          class="mini-day-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${hasEvents ? "has-events" : ""}" 
          data-mini-date="${dateStr}"
          title="${dateStr}${isToday ? " (Hôm nay)" : ""}${hasEvents ? " (Có lịch)" : ""}">
          <span>${dayNum}</span>
          ${hasEvents ? `<span class="mini-event-dot"></span>` : ""}
        </button>
      `;
    } else {
      cellsHtml += `<div class="mini-day-cell empty"></div>`;
    }
  }

  return `
    <div class="schedule-mini-card">
      <div class="mini-cal-header">
        <button type="button" class="mini-nav-arrow" id="miniCalPrevBtn" title="Tháng trước" aria-label="Tháng trước">
          <svg><use href="#i-chevron-left"></use></svg>
        </button>
        <span class="mini-cal-title" id="miniCalTitle">Tháng ${m + 1} / ${y}</span>
        <button type="button" class="mini-nav-arrow" id="miniCalNextBtn" title="Tháng sau" aria-label="Tháng sau">
          <svg><use href="#i-chevron-right"></use></svg>
        </button>
      </div>

      <div class="mini-cal-days-header">
        <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
      </div>

      <div class="mini-cal-grid">
        ${cellsHtml}
      </div>
    </div>
  `;
}

/**
 * Render Chú giải màu lịch học
 */
export function renderColorLegend() {
  return `
    <div class="schedule-legend-card">
      <div class="legend-header">
        <svg style="width:16px;height:16px;color:var(--violet-700);"><use href="#i-spark"></use></svg>
        <strong>Chú giải màu sắc</strong>
      </div>
      <div class="legend-list">
        <div class="legend-item">
          <span class="legend-badge-color school"></span>
          <span>Lịch trường CMC (Vàng)</span>
        </div>
        <div class="legend-item">
          <span class="legend-badge-color study"></span>
          <span>Lịch tự học cá nhân (Xanh lá)</span>
        </div>
        <div class="legend-item">
          <span class="legend-badge-color conflict"></span>
          <span>Trùng lịch học (Đỏ cảnh báo)</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Lịch tuần theo Lưới 24 Giờ chuẩn Google Calendar
 */
export function renderWeekHourlyGrid(selectedDateStr, allEvents, conflictingIds) {
  const days = getDaysOfWeek(selectedDateStr);
  const todayStr = formatDateISO(new Date());

  // Tách sự kiện qua nửa đêm nếu có
  const processedEvents = splitOvernightEvents(allEvents);

  // 1. Sticky Header Ngày
  const dayHeadersHtml = days
    .map((d) => {
      const isToday = d.dateStr === todayStr;
      const isSelected = d.dateStr === selectedDateStr;
      return `
        <div class="grid-col-header ${isToday ? "today" : ""} ${isSelected ? "selected-day" : ""}" data-select-day="${d.dateStr}">
          <span class="col-header-dayname">${d.dayName}</span>
          <span class="col-header-daynum ${isToday ? "today-badge" : ""}">${formatDateVN(d.date).slice(0, 5)}</span>
        </div>
      `;
    })
    .join("");

  // 2. Kiểm tra có sự kiện cả ngày hoặc thiếu giờ trong tuần không
  const weekEvents = processedEvents.filter((ev) => days.some((d) => d.dateStr === ev.date));
  const weekAllDayOrMissing = weekEvents.filter((ev) => ev.isAllDay || !ev.start || !ev.end);

  let allDayRowHtml = "";
  if (weekAllDayOrMissing.length > 0) {
    const allDayColsHtml = days
      .map((d) => {
        const items = weekAllDayOrMissing.filter((e) => e.date === d.dateStr);
        if (items.length === 0) return `<div class="allday-col-cell"></div>`;

        return `
          <div class="allday-col-cell">
            ${items
              .map((ev) => {
                const isConflict = conflictingIds.has(ev.id || ev.originalId);
                const isStudy = ev.source === "Tự thêm" || !ev.source;
                const typeClass = isConflict ? "conflict" : isStudy ? "study" : "school";
                const isMissingTime = !ev.start || !ev.end;

                return `
                  <div class="allday-event-chip ${typeClass}" data-event-id="${ev.id || ev.originalId}" tabindex="0" role="button">
                    <span>${isMissingTime ? "⚠️ Thiếu thông tin giờ: " : ""}${ev.title || ev.subject}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      })
      .join("");

    allDayRowHtml = `
      <div class="grid-allday-row">
        <div class="grid-time-gutter-cell allday-label">Cả ngày</div>
        <div class="grid-allday-columns">${allDayColsHtml}</div>
      </div>
    `;
  }

  // 3. Render 7 cột ngày theo lưới 24 giờ
  const columnsHtml = days
    .map((d) => {
      const dayEvents = processedEvents.filter((e) => e.date === d.dateStr);
      const { positionedEvents } = layoutDayEvents(dayEvents);

      // 12 hàng lưới giờ (2 giờ trên 1 lưới: 00:00 -> 02:00, 02:00 -> 04:00, ...)
      const hourRowsHtml = GRID_HOURS_2H.map((h) => {
        const nextH = h + 2;
        const startStr = `${String(h).padStart(2, "0")}:00`;
        const endStr = `${String(nextH).padStart(2, "0")}:00`;
        return `
          <div class="grid-hour-row" 
            data-slot-date="${d.dateStr}" 
            data-slot-hour="${h}"
            title="Nhấn để xếp lịch tự học (${startStr} – ${endStr}) ngày ${d.dateStr}">
            <div class="grid-half-hour-line" title="${String(h + 1).padStart(2, "0")}:00"></div>
          </div>
        `;
      }).join("");

      // Khối sự kiện được tính toán vị trí chính xác
      const eventBlocksHtml = positionedEvents
        .map((ev) => renderEventBlock(ev, conflictingIds))
        .join("");

      return `
        <div class="grid-day-column" data-day-col="${d.dateStr}">
          <div class="grid-hour-rows-bg">${hourRowsHtml}</div>
          <div class="grid-events-layer">${eventBlocksHtml}</div>
        </div>
      `;
    })
    .join("");

  // 4. Cột mốc giờ bên trái (00:00, 02:00, 04:00 ... 22:00, 24:00)
  const timeGutterHtml = GRID_HOURS_2H.map((h) => {
    return `
      <div class="grid-time-gutter-slot ${h === 0 ? "slot-zero" : ""}" style="top:${h * HOUR_HEIGHT}px;">
        <span>${String(h).padStart(2, "0")}:00</span>
      </div>
    `;
  }).join("") + `
    <div class="grid-time-gutter-slot" style="top:${24 * HOUR_HEIGHT}px;">
      <span>24:00</span>
    </div>
  `;

  return `
    <div class="schedule-grid-container">
      <!-- Dòng tiêu đề ngày cố định (Sticky) -->
      <div class="grid-sticky-header">
        <div class="grid-time-gutter-corner">Giờ</div>
        <div class="grid-header-columns">${dayHeadersHtml}</div>
      </div>

      <!-- Hàng sự kiện cả ngày nếu có -->
      ${allDayRowHtml}

      <!-- Khung cuộn dọc lưới 24 giờ -->
      <div class="schedule-grid-scroll-pane" id="scheduleHourlyScrollPane">
        <div class="grid-body-canvas" style="height:${24 * HOUR_HEIGHT}px;">
          <div class="grid-time-gutter">${timeGutterHtml}</div>
          <div class="grid-days-container">${columnsHtml}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Lịch ngày theo Lưới 24 Giờ chuẩn Google Calendar
 */
export function renderDayHourlyGrid(selectedDateStr, allEvents, conflictingIds) {
  const todayStr = formatDateISO(new Date());
  const isToday = selectedDateStr === todayStr;
  const processedEvents = splitOvernightEvents(allEvents);
  const dayEvents = processedEvents.filter((e) => e.date === selectedDateStr);
  const { positionedEvents, allDayEvents, missingTimeEvents } = layoutDayEvents(dayEvents);

  const allDayList = [...allDayEvents, ...missingTimeEvents];

  // 1. Sticky Header cho 1 ngày
  const headerHtml = `
    <div class="grid-sticky-header">
      <div class="grid-time-gutter-corner">Giờ</div>
      <div class="grid-header-columns single-day">
        <div class="grid-col-header single-col ${isToday ? "today" : ""}">
          <span class="col-header-dayname">Lịch học chi tiết</span>
          <span class="col-header-daynum ${isToday ? "today-badge" : ""}">${formatDateVN(selectedDateStr)}</span>
        </div>
      </div>
    </div>
  `;

  // 2. Hàng cả ngày / thiếu giờ nếu có
  let allDayRowHtml = "";
  if (allDayList.length > 0) {
    allDayRowHtml = `
      <div class="grid-allday-row">
        <div class="grid-time-gutter-cell allday-label">Cả ngày</div>
        <div class="grid-allday-columns single-day">
          <div class="allday-col-cell">
            ${allDayList
              .map((ev) => {
                const isConflict = conflictingIds.has(ev.id || ev.originalId);
                const isStudy = ev.source === "Tự thêm" || !ev.source;
                const typeClass = isConflict ? "conflict" : isStudy ? "study" : "school";
                const isMissingTime = !ev.start || !ev.end;

                return `
                  <div class="allday-event-chip ${typeClass}" data-event-id="${ev.id || ev.originalId}" tabindex="0" role="button">
                    <span>${isMissingTime ? "⚠️ Thiếu thông tin giờ: " : ""}${ev.title || ev.subject}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  // 3. 12 hàng lưới giờ (2 giờ trên 1 lưới: 00:00 -> 02:00, ...)
  const hourRowsHtml = GRID_HOURS_2H.map((h) => {
    const nextH = h + 2;
    const startStr = `${String(h).padStart(2, "0")}:00`;
    const endStr = `${String(nextH).padStart(2, "0")}:00`;
    return `
      <div class="grid-hour-row" 
        data-slot-date="${selectedDateStr}" 
        data-slot-hour="${h}"
        title="Nhấn để xếp lịch tự học (${startStr} – ${endStr})">
        <div class="grid-half-hour-line" title="${String(h + 1).padStart(2, "0")}:00"></div>
      </div>
    `;
  }).join("");

  // Khối sự kiện phân bổ chính xác theo phút
  const eventBlocksHtml = positionedEvents
    .map((ev) => renderEventBlock(ev, conflictingIds))
    .join("");

  // 4. Cột mốc giờ bên trái (00:00, 02:00, 04:00 ... 22:00, 24:00)
  const timeGutterHtml = GRID_HOURS_2H.map((h) => {
    return `
      <div class="grid-time-gutter-slot ${h === 0 ? "slot-zero" : ""}" style="top:${h * HOUR_HEIGHT}px;">
        <span>${String(h).padStart(2, "0")}:00</span>
      </div>
    `;
  }).join("") + `
    <div class="grid-time-gutter-slot" style="top:${24 * HOUR_HEIGHT}px;">
      <span>24:00</span>
    </div>
  `;

  return `
    <div class="schedule-grid-container single-day-mode">
      ${headerHtml}
      ${allDayRowHtml}

      <div class="schedule-grid-scroll-pane" id="scheduleHourlyScrollPane">
        <div class="grid-body-canvas" style="height:${24 * HOUR_HEIGHT}px;">
          <div class="grid-time-gutter">${timeGutterHtml}</div>
          <div class="grid-days-container single-day">
            <div class="grid-day-column single-col" data-day-col="${selectedDateStr}">
              <div class="grid-hour-rows-bg">${hourRowsHtml}</div>
              <div class="grid-events-layer">${eventBlocksHtml}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render một khối sự kiện trên lưới giờ
 */
function renderEventBlock(ev, conflictingIds) {
  const isConflict = conflictingIds.has(ev.id || ev.originalId);
  const isStudy = ev.source === "Tự thêm" || !ev.source;
  const typeClass = isConflict ? "conflict" : isStudy ? "study" : "school";

  const eventId = ev.originalId || ev.id;
  const isShort = ev.height < 36;

  return `
    <div class="calendar-event-block ${typeClass} ${isShort ? "is-short" : ""}" 
      style="top:${ev.top}px;height:${ev.height}px;left:${ev.leftPercent}%;width:${ev.widthPercent}%;"
      data-event-id="${eventId}"
      tabindex="0"
      role="button"
      aria-label="Xem chi tiết ${ev.title || ev.subject} (${ev.start} – ${ev.end})">
      <div class="ev-time-badge">${ev.start} – ${ev.end}</div>
      <div class="ev-title">${ev.title || ev.subject}</div>
      ${ev.room && !isShort ? `<div class="ev-room">📍 ${ev.room}</div>` : ""}
      ${
        isConflict
          ? `<span class="ev-conflict-tag">⚠️ Trùng lịch</span>`
          : `<span class="ev-source-tag">${isStudy ? "Tự học" : "Lịch trường"}</span>`
      }
    </div>
  `;
}

/**
 * Render Lịch tháng chính (Month View)
 * QUY ĐỊNH: Trong mỗi ô, sự kiện chỉ hiện giờ bắt đầu–kết thúc. Không hiện tên môn, phòng hoặc mô tả dài.
 */
export function renderMonthView(selectedDateStr, allEvents, conflictingIds) {
  const parts = selectedDateStr.split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const todayStr = formatDateISO(new Date());

  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const numWeeks = Math.ceil((startDayOfWeek + daysInMonth) / 7);
  const totalSlots = numWeeks * 7;

  const dayHeadersHtml = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    .map((name) => `<div class="month-col-header"><strong>${name}</strong></div>`)
    .join("");

  let cellsHtml = "";
  for (let i = 0; i < totalSlots; i++) {
    const dayNum = i - startDayOfWeek + 1;
    const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;

    if (isCurrentMonth) {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const isSelected = dateStr === selectedDateStr;
      const isToday = dateStr === todayStr;

      // Sắp xếp sự kiện từ sớm đến muộn
      const dayEvents = allEvents
        .filter((e) => e.date === dateStr)
        .sort((a, b) => {
          if (!a.start) return 1;
          if (!b.start) return -1;
          return a.start.localeCompare(b.start);
        });

      // Chỉ hiển thị tối đa 3 chip giờ; nếu nhiều hơn hiện "+N lịch"
      const MAX_DISPLAY = 3;
      const visibleEvents = dayEvents.slice(0, MAX_DISPLAY);
      const remainingCount = dayEvents.length - MAX_DISPLAY;

      const eventBadgesHtml = visibleEvents
        .map((ev) => {
          const isConflict = conflictingIds.has(ev.id);
          const isStudy = ev.source === "Tự thêm" || !ev.source;
          const typeClass = isConflict ? "conflict" : isStudy ? "study" : "school";

          // Nhãn hiển thị: CHỈ GIỜ BẮT ĐẦU – KẾ THÚC. Không tự gán giờ cho sự kiện cả ngày hoặc thiếu giờ.
          let timeLabel = "";
          if (ev.isAllDay) {
            timeLabel = "Cả ngày";
          } else if (!ev.start || !ev.end) {
            timeLabel = "Thiếu giờ";
          } else {
            timeLabel = `${ev.start} – ${ev.end}`;
          }

          return `
            <div class="month-event-chip ${typeClass}" 
              data-event-id="${ev.id}" 
              tabindex="0" 
              role="button" 
              title="${timeLabel}">
              <span class="chip-time">${timeLabel}</span>
            </div>
          `;
        })
        .join("");

      const moreBtnHtml =
        remainingCount > 0
          ? `<button type="button" class="month-more-link" data-more-date="${dateStr}">+${remainingCount} lịch</button>`
          : "";

      cellsHtml += `
        <div class="month-grid-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}" data-month-cell-date="${dateStr}">
          <div class="month-cell-header">
            <span class="month-day-num ${isToday ? "today-badge" : ""}">${dayNum}</span>
            ${dayEvents.length > 0 ? `<span class="month-event-count">${dayEvents.length}</span>` : ""}
          </div>
          <div class="month-cell-events">
            ${eventBadgesHtml}
            ${moreBtnHtml}
          </div>
        </div>
      `;
    } else {
      // Ngày thuộc tháng trước/sau hiển thị nhạt hơn (other-month)
      cellsHtml += `
        <div class="month-grid-cell other-month">
          <div class="month-cell-header">
            <span class="month-day-num muted"></span>
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="schedule-month-container">
      <div class="schedule-month-grid">
        ${dayHeadersHtml}
        ${cellsHtml}
      </div>
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
          <span><strong>Thời gian:</strong> ${event.start && event.end ? `${event.start} – ${event.end}` : "Chưa có thông tin giờ"}</span>
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
          ℹ️ Đây là thời khóa biểu chính khóa từ cổng trường CMC University, không thể chỉnh sửa hoặc xóa thủ công.
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
 * Render Modal Quyết định xử lý Xung đột khi Thêm / Sửa lịch tự học (Conflict Decision Modal)
 * Theo đúng các trường hợp yêu cầu A.6:
 * - Trùng lịch trường: a. Giữ lịch trên lớp, b. Đổi giờ tự học, c. Vẫn lưu lịch tự học
 * - Trùng lịch tự học khác: Hủy, Đổi giờ, Giữ cả hai, Thay thế lịch cũ
 */
export function renderConflictDecisionModal({ pendingSession, conflictingEvents, isEdit }) {
  const hasSchoolConflict = conflictingEvents.some((e) => e.source === "Trường" || e.source === "CMC");
  const firstConflictingStudy = conflictingEvents.find((e) => e.source === "Tự thêm" || !e.source);

  const conflictCardsHtml = conflictingEvents
    .map((ev) => {
      const isSchool = ev.source === "Trường" || ev.source === "CMC";
      return `
        <div style="background:white;border:1px solid var(--red-200);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong style="color:var(--ink-950);">${ev.title || ev.subject}</strong>
            <span class="badge-draft" style="background:${isSchool ? "#fef3c7" : "#dcfce7"};color:${isSchool ? "#92400e" : "#166534"};font-size:0.72rem;">
              ${isSchool ? "🎓 Lịch trường" : "📘 Lịch tự học"}
            </span>
          </div>
          <div style="font-size:0.86rem;color:var(--ink-700);">
            Ngày: <strong>${formatDateVN(ev.date)}</strong> | Thời gian: <strong>${ev.start} – ${ev.end}</strong>
          </div>
          ${ev.room ? `<div style="font-size:0.8rem;color:var(--ink-500);">Phòng: ${ev.room}</div>` : ""}
        </div>
      `;
    })
    .join("");

  let actionsHtml = "";
  if (hasSchoolConflict) {
    actionsHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="button secondary" id="decisionKeepSchoolBtn">
            Giữ lịch trên lớp (Hủy lưu)
          </button>
          <button type="button" class="button ghost" id="decisionAdjustTimeBtn">
            Đổi giờ tự học
          </button>
          <button type="button" class="button danger" id="decisionForceSaveBtn">
            Vẫn lưu lịch tự học (Đánh dấu trùng)
          </button>
        </div>
        <p style="margin:4px 0 0;font-size:0.78rem;color:var(--ink-500);text-align:right;">
          Lưu ý: Lịch trường không bị ẩn/xóa, cảnh báo trùng sẽ tiếp tục hiển thị trên lịch.
        </p>
      </div>
    `;
  } else {
    actionsHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="button secondary" id="decisionCancelBtn">
            Hủy bỏ
          </button>
          <button type="button" class="button ghost" id="decisionAdjustTimeBtn">
            Đổi giờ
          </button>
          <button type="button" class="button primary" id="decisionForceSaveBtn">
            Giữ cả hai (Lưu song song)
          </button>
          ${
            firstConflictingStudy
              ? `
            <button type="button" class="button danger" id="decisionReplaceStudyBtn" data-replace-id="${firstConflictingStudy.id}">
              Thay thế lịch cũ ("${firstConflictingStudy.title || firstConflictingStudy.subject}")
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="padding:10px 14px;background:#fef2f2;border-radius:8px;border:1px solid #fee2e2;color:#991b1b;font-size:0.9rem;">
        ⚠️ <strong>Phát hiện xung đột thời gian:</strong> Buổi học dự kiến (<strong>${pendingSession.start} – ${pendingSession.end}</strong> ngày ${formatDateVN(pendingSession.date)}) trùng với ${conflictingEvents.length} lịch đã có:
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${conflictCardsHtml}
      </div>

      <p style="margin:0;font-size:0.85rem;color:var(--ink-600);">
        Hệ thống chưa ghi nhận thay đổi này vào bộ nhớ. Vui lòng chọn một phương án xử lý bên dưới:
      </p>
    </div>
  `;

  return renderModal({
    id: "conflictDecisionModal",
    title: "Xác nhận xung đột lịch học",
    bodyHtml,
    footerHtml: actionsHtml,
    customClass: "conflict-decision-dialog"
  });
}

/**
 * Render Modal Xem và Xử lý Xung đột đã tồn tại
 */
export function renderExistingConflictModal(conflictPairs) {
  const pairsHtml = conflictPairs
    .map((p, idx) => {
      const a = p.eventA;
      const b = p.eventB;
      const aIsStudy = a.source === "Tự thêm" || !a.source;
      const bIsStudy = b.source === "Tự thêm" || !b.source;

      return `
        <div style="border:1px solid var(--red-200);background:#fff5f5;border-radius:12px;padding:16px;margin-bottom:14px;">
          <strong style="color:var(--red-600);display:block;margin-bottom:8px;">
            Xung đột #${idx + 1} (Ngày ${formatDateVN(a.date)}):
          </strong>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div style="background:white;padding:10px;border-radius:8px;border:1px solid var(--ink-200);">
              <div style="font-weight:700;">${a.title || a.subject}</div>
              <div style="font-size:0.8rem;color:var(--ink-600);">${a.start} – ${a.end}</div>
              <span class="eyebrow" style="font-size:0.7rem;">${aIsStudy ? "Tự học" : "Lịch trường"}</span>
            </div>
            <div style="background:white;padding:10px;border-radius:8px;border:1px solid var(--ink-200);">
              <div style="font-weight:700;">${b.title || b.subject}</div>
              <div style="font-size:0.8rem;color:var(--ink-600);">${b.start} – ${b.end}</div>
              <span class="eyebrow" style="font-size:0.7rem;">${bIsStudy ? "Tự học" : "Lịch trường"}</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${
              aIsStudy
                ? `
              <button type="button" class="button ghost small" data-resolve-edit="${a.id}">
                Đổi giờ "${a.title || a.subject}"
              </button>
              <button type="button" class="button danger small" data-resolve-delete="${a.id}">
                Xóa ca tự học
              </button>
            `
                : ""
            }
            ${
              bIsStudy
                ? `
              <button type="button" class="button ghost small" data-resolve-edit="${b.id}">
                Đổi giờ "${b.title || b.subject}"
              </button>
              <button type="button" class="button danger small" data-resolve-delete="${b.id}">
                Xóa ca tự học
              </button>
            `
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");

  const bodyHtml = `
    <p class="muted small" style="margin-top:0;">
      Danh sách các buổi học bị trùng lặp thời gian trong bộ nhớ làm việc. Bạn có thể chọn đổi khung giờ hoặc xóa ca tự học để giải phóng xung đột.
    </p>
    <div>${pairsHtml}</div>
  `;

  return renderModal({
    id: "conflictResolutionModal",
    title: "Xem và xử lý xung đột lịch học",
    bodyHtml,
    footerHtml: `<button type="button" class="button ghost" data-close-modal="conflictResolutionModal">Đóng</button>`
  });
}

/**
 * Render Modal Gợi ý xếp lịch tự học bằng AI
 */
export function renderAiScheduleModal(viewState = {}) {
  const {
    formData = {},
    status = "idle", // "idle" | "loading" | "waiting-api" | "preview"
    message = "",
    proposals = []
  } = viewState;

  const todayStr = formatDateISO(new Date());
  const startDate = formData.startDate || todayStr;
  const endDate = formData.endDate || todayStr;
  const subject = escapeHtml(formData.subject || "");
  const freeStartHour = formData.freeStartHour || "19:00";
  const freeEndHour = formData.freeEndHour || "22:00";
  const durationHours = formData.durationHours || "2";

  const isLoading = status === "loading";
  const isWaitingApi = status === "waiting-api";
  const isPreview = status === "preview" && proposals.length > 0;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- Banner giới thiệu / Trạng thái AI -->
      <div style="background:var(--violet-50);border:1px solid var(--violet-200);border-radius:10px;padding:12px 16px;display:flex;align-items:flex-start;gap:12px;">
        <svg style="width:22px;height:22px;color:var(--violet-700);flex-shrink:0;margin-top:2px;"><use href="#i-spark"></use></svg>
        <div style="font-size:0.86rem;color:var(--ink-800);line-height:1.45;">
          <strong>Trợ lý AI UniStudy CMC:</strong> Phân tích khoảng trống thời khóa biểu và đề xuất các ca tự học phù hợp không trùng với lịch trường.
        </div>
      </div>

      <!-- Biểu mẫu thông số xếp lịch -->
      <form id="aiScheduleForm" style="display:flex;flex-direction:column;gap:14px;">
        <!-- 1) Khoảng ngày muốn xếp lịch -->
        <div>
          <span class="small" style="font-weight:700;display:block;margin-bottom:6px;color:var(--ink-950);">
            1. Khoảng ngày muốn xếp lịch *
          </span>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <label>
              <span class="tiny muted" style="font-weight:600;display:block;margin-bottom:4px;">Từ ngày:</span>
              <input 
                type="date" 
                name="startDate" 
                required 
                value="${startDate}" 
                ${isLoading ? "disabled" : ""}
                style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:8px 10px;font-size:0.86rem;"
              />
            </label>
            <label>
              <span class="tiny muted" style="font-weight:600;display:block;margin-bottom:4px;">Đến ngày:</span>
              <input 
                type="date" 
                name="endDate" 
                required 
                value="${endDate}" 
                ${isLoading ? "disabled" : ""}
                style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:8px 10px;font-size:0.86rem;"
              />
            </label>
          </div>
        </div>

        <!-- 2) Môn hoặc công việc cần học -->
        <label>
          <span class="small" style="font-weight:700;display:block;margin-bottom:4px;color:var(--ink-950);">
            2. Môn học hoặc công việc cần ôn tập *
          </span>
          <input 
            type="text" 
            name="subject" 
            required 
            placeholder="Ví dụ: Ôn tập Cấu trúc dữ liệu & Giải thuật CMC" 
            value="${subject}" 
            ${isLoading ? "disabled" : ""}
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:9px 12px;font-size:0.9rem;"
          />
        </label>

        <!-- 3) Khoảng giờ rảnh -->
        <div>
          <span class="small" style="font-weight:700;display:block;margin-bottom:6px;color:var(--ink-950);">
            3. Khoảng giờ rảnh trong ngày *
          </span>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <label>
              <span class="tiny muted" style="font-weight:600;display:block;margin-bottom:4px;">Bắt đầu rảnh từ:</span>
              <input 
                type="time" 
                name="freeStartHour" 
                required 
                value="${freeStartHour}" 
                ${isLoading ? "disabled" : ""}
                style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:8px 10px;font-size:0.86rem;"
              />
            </label>
            <label>
              <span class="tiny muted" style="font-weight:600;display:block;margin-bottom:4px;">Rảnh đến:</span>
              <input 
                type="time" 
                name="freeEndHour" 
                required 
                value="${freeEndHour}" 
                ${isLoading ? "disabled" : ""}
                style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:8px 10px;font-size:0.86rem;"
              />
            </label>
          </div>
        </div>

        <!-- 4) Thời lượng mong muốn -->
        <label>
          <span class="small" style="font-weight:700;display:block;margin-bottom:4px;color:var(--ink-950);">
            4. Thời lượng mong muốn mỗi ca học
          </span>
          <select name="durationHours" ${isLoading ? "disabled" : ""} style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:8px 10px;font-size:0.86rem;background:white;">
            <option value="1" ${durationHours === "1" ? "selected" : ""}>1 giờ / buổi</option>
            <option value="1.5" ${durationHours === "1.5" ? "selected" : ""}>1.5 giờ (90 phút) / buổi</option>
            <option value="2" ${durationHours === "2" ? "selected" : ""}>2 giờ / buổi (Khuyến nghị)</option>
            <option value="2.5" ${durationHours === "2.5" ? "selected" : ""}>2.5 giờ / buổi</option>
            <option value="3" ${durationHours === "3" ? "selected" : ""}>3 giờ / buổi</option>
          </select>
        </label>
      </form>

      <!-- Vùng trạng thái: Loading, Chờ kết nối API hoặc Danh sách đề xuất xem trước -->
      ${
        isLoading
          ? `
        <div style="padding:20px;text-align:center;background:var(--ink-50);border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:10px;">
          <div class="sync-spinner" style="width:28px;height:28px;border:3px solid var(--violet-200);border-top-color:var(--violet-600);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span style="font-weight:600;color:var(--violet-700);font-size:0.9rem;">Đang kết nối hệ thống AI và kiểm tra lịch học...</span>
          <span class="tiny muted">Vui lòng đợi trong giây lát. Không bấm liên tiếp nhiều lần.</span>
        </div>
      `
          : isWaitingApi
          ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;" role="status">
          <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#92400e;margin-bottom:6px;">
            <svg style="width:18px;height:18px;color:#d97706;"><use href="#i-spark"></use></svg>
            <span>Chưa thể tạo hoặc lưu kế hoạch</span>
          </div>
          <p style="margin:0 0 10px;font-size:0.86rem;color:#78350f;line-height:1.45;">
            ${escapeHtml(message || "Vui lòng kiểm tra kết nối và thử lại.")}
          </p>
          <button type="button" class="button secondary small" id="retryAiScheduleBtn" style="background:white;border-color:#f59e0b;color:#b45309;">
            <svg style="width:14px;height:14px;"><use href="#i-sync"></use></svg>
            <span>Thử kết nối lại</span>
          </button>
        </div>
      `
          : isPreview
          ? `
        <div style="border-top:1px solid var(--ink-200);padding-top:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <strong style="color:var(--ink-950);font-size:0.95rem;">Đề xuất xem trước (${proposals.length} ca học):</strong>
            <span class="badge-draft">Chỉ là đề xuất để xem trước</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;">
            ${proposals
              .map(
                (p, idx) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:white;border:1px solid var(--ink-200);border-radius:8px;">
                <div>
                  <div style="font-weight:700;font-size:0.88rem;color:var(--ink-950);">${escapeHtml(p.title || p.subject)}</div>
                  <div style="font-size:0.78rem;color:var(--ink-600);">Ngày ${formatDateVN(p.date)} · ${p.start} – ${p.end}</div>
                </div>
                <span class="status-pill violet" style="font-size:0.72rem;">Đề xuất #${idx + 1}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="aiScheduleModal">Đóng</button>
    ${
      isPreview
        ? `
      <button type="button" class="button primary" id="applyAiProposalsBtn" style="background:var(--emerald-600);border-color:var(--emerald-600);">
        <svg><use href="#i-check"></use></svg>
        <span>Áp dụng vào lịch học</span>
      </button>
    `
        : `
      <button type="submit" form="aiScheduleForm" class="button primary" id="submitAiScheduleBtn" ${isLoading ? "disabled" : ""}>
        <svg><use href="#i-spark"></use></svg>
        <span>${isLoading ? "Đang xử lý..." : "Nhận gợi ý từ AI"}</span>
      </button>
    `
    }
  `;

  return renderModal({
    id: "aiScheduleModal",
    title: "Gợi ý xếp lịch tự học bằng AI",
    bodyHtml,
    footerHtml,
    customClass: "ai-schedule-dialog"
  });
}
