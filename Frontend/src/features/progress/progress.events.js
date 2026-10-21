/**
 * UniStudy CMC - Progress Events (Sprint 2 & Refactored)
 */
import { getActiveTab, updateActiveTabLocalState } from "../../app/workspace.js";
import { shiftDateByDays, shiftDateByMonths, formatDateISO } from "../../shared/utils/date.js";

export function attachProgressEvents(containerEl, uiState, reRenderCallback) {
  // 1. Chuyển chu kỳ Ngày / Tuần / Tháng
  const periodBtns = containerEl.querySelectorAll("[data-period]");
  periodBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-period");
      uiState.period = p;
      updateActiveTabLocalState({ progressPeriod: p });
      reRenderCallback();
    });
  });

  // 2. Thay đổi ngày qua input date
  const datePicker = containerEl.querySelector("#progressDatePicker");
  if (datePicker) {
    datePicker.addEventListener("change", (e) => {
      if (e.target.value) {
        uiState.selectedDate = e.target.value;
        updateActiveTabLocalState({ progressDate: e.target.value });
        reRenderCallback();
      }
    });
  }

  // 3. Nút lùi thời gian (Prev)
  const prevBtn = containerEl.querySelector("#progressPrevBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const cur = uiState.selectedDate || formatDateISO(new Date());
      let nextDate;
      if (uiState.period === "day") {
        nextDate = shiftDateByDays(cur, -1);
      } else if (uiState.period === "week") {
        nextDate = shiftDateByDays(cur, -7);
      } else {
        nextDate = shiftDateByMonths(cur, -1);
      }
      uiState.selectedDate = nextDate;
      updateActiveTabLocalState({ progressDate: nextDate });
      reRenderCallback();
    });
  }

  // 4. Nút tiến thời gian (Next)
  const nextBtn = containerEl.querySelector("#progressNextBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const cur = uiState.selectedDate || formatDateISO(new Date());
      let nextDate;
      if (uiState.period === "day") {
        nextDate = shiftDateByDays(cur, 1);
      } else if (uiState.period === "week") {
        nextDate = shiftDateByDays(cur, 7);
      } else {
        nextDate = shiftDateByMonths(cur, 1);
      }
      uiState.selectedDate = nextDate;
      updateActiveTabLocalState({ progressDate: nextDate });
      reRenderCallback();
    });
  }

  // 5. Nút cuộn ngang biểu đồ 24 giờ trong ngày (không thay đổi ngày được chọn)
  const scrollChartLeftBtn = containerEl.querySelector("#scrollDayChartLeftBtn");
  const scrollChartRightBtn = containerEl.querySelector("#scrollDayChartRightBtn");
  const chartScrollContainer = containerEl.querySelector("#progressBarChartScrollContainer");

  if (scrollChartLeftBtn && chartScrollContainer) {
    scrollChartLeftBtn.addEventListener("click", () => {
      chartScrollContainer.scrollBy({ left: -260, behavior: "smooth" });
    });
  }

  if (scrollChartRightBtn && chartScrollContainer) {
    scrollChartRightBtn.addEventListener("click", () => {
      chartScrollContainer.scrollBy({ left: 260, behavior: "smooth" });
    });
  }
}
