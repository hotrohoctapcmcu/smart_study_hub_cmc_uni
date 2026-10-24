/**
 * UniStudy CMC - Timemap Feature Entry Point
 * ===================================================================================
 * Điều phối sự kiện và giao diện Bản đồ thời gian học tập:
 * - Điều hướng tuần (Hôm nay, Trước, Sau, Date Picker)
 * - Tương tác click khoảng trống mở modal thêm lịch tự học
 * - Thêm và đồng bộ lịch tự học ngay lập tức
 * ===================================================================================
 */

import { renderTimemapView } from "./timemap.view.js";
import { addSelfStudySession } from "./timemap.service.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateISO, shiftDateByDays } from "../../shared/utils/date.js";
import { fetchStudySchedules } from "../schedule/schedule.service.js";
import { fetchSchoolSchedules } from "../sync/sync.service.js";
import { fetchExamsFromApi } from "../exams/exams.service.js";
import { state } from "../../app/state.js";

export function mountTimemap(containerEl) {
  const activeTab = getActiveTab();
  const uiState = {
    selectedDate: activeTab?.tabState?.timemapDate || formatDateISO(new Date()),
    isModalOpen: false,
    modalData: null
  };

  // Đồng bộ dữ liệu lịch học, tự học và lịch thi từ API Backend SQLite
  Promise.allSettled([
    fetchStudySchedules(),
    fetchSchoolSchedules().then((schedules) => {
      if (Array.isArray(schedules) && schedules.length > 0) {
        state.schoolEvents = schedules.map((t) => ({ ...t, source: "Trường" }));
      }
    }),
    fetchExamsFromApi()
  ]).then(() => {
    if (containerEl && containerEl.isConnected) {
      render();
    }
  });

  function render() {
    containerEl.innerHTML = renderTimemapView(uiState);
    attachEvents();
  }

  function attachEvents() {
    // 1. Nút "Hôm nay"
    const todayBtn = containerEl.querySelector("#timemapTodayBtn");
    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        uiState.selectedDate = formatDateISO(new Date());
        if (activeTab?.tabState) activeTab.tabState.timemapDate = uiState.selectedDate;
        render();
      });
    }

    // 2. Date Picker
    const datePicker = containerEl.querySelector("#timemapDatePicker");
    if (datePicker) {
      datePicker.addEventListener("change", (e) => {
        if (e.target.value) {
          uiState.selectedDate = e.target.value;
          if (activeTab?.tabState) activeTab.tabState.timemapDate = uiState.selectedDate;
          render();
        }
      });
    }

    // 3. Nút Tuần trước (Prev)
    const prevBtn = containerEl.querySelector("#timemapPrevBtn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        uiState.selectedDate = shiftDateByDays(uiState.selectedDate, -7);
        if (activeTab?.tabState) activeTab.tabState.timemapDate = uiState.selectedDate;
        render();
      });
    }

    // 4. Nút Tuần sau (Next)
    const nextBtn = containerEl.querySelector("#timemapNextBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        uiState.selectedDate = shiftDateByDays(uiState.selectedDate, 7);
        if (activeTab?.tabState) activeTab.tabState.timemapDate = uiState.selectedDate;
        render();
      });
    }

    // 5. Bấm vào khoảng trống để mở form thêm buổi tự học
    const freeSlotEls = containerEl.querySelectorAll("[data-free-slot='true']");
    freeSlotEls.forEach((slot) => {
      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        const date = slot.getAttribute("data-date");
        const start = slot.getAttribute("data-start");
        const end = slot.getAttribute("data-end");

        uiState.isModalOpen = true;
        uiState.modalData = {
          title: "Tự học bài mới",
          subject: "Tự học",
          date: date || uiState.selectedDate,
          start: start || "08:00",
          end: end || "10:00",
          note: ""
        };
        render();
      });
    });

    // 6. Nút "Thêm buổi tự học" trên thanh công cụ
    const openAddModalBtn = containerEl.querySelector("#timemapOpenAddModalBtn");
    if (openAddModalBtn) {
      openAddModalBtn.addEventListener("click", () => {
        uiState.isModalOpen = true;
        uiState.modalData = {
          title: "Tự học bài mới",
          subject: "Tự học",
          date: uiState.selectedDate,
          start: "14:00",
          end: "16:00",
          note: ""
        };
        render();
      });
    }

    // 7. Đóng / Hủy Modal
    const closeModalBtn = containerEl.querySelector("#timemapCloseModalBtn");
    const cancelModalBtn = containerEl.querySelector("#timemapCancelModalBtn");
    const modalOverlay = containerEl.querySelector("#timemapModalOverlay");

    const closeModal = () => {
      uiState.isModalOpen = false;
      uiState.modalData = null;
      render();
    };

    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    // 8. Submit Form thêm buổi tự học
    const addForm = containerEl.querySelector("#timemapAddSelfStudyForm");
    if (addForm) {
      addForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(addForm);
        const title = (formData.get("title") || "Tự học").trim();
        const subject = (formData.get("subject") || "Tự học").trim();
        const date = formData.get("date");
        const start = formData.get("start");
        const end = formData.get("end");
        const note = (formData.get("note") || "").trim();

        if (start >= end) {
          alert("Giờ kết thúc phải sau giờ bắt đầu.");
          return;
        }

        try {
          await addSelfStudySession({ title, subject, date, start, end, note });
          uiState.isModalOpen = false;
          uiState.modalData = null;
          render();
        } catch (err) {
          console.error("[Timemap] Lỗi thêm buổi tự học:", err);
          alert("Không thể thêm buổi tự học: " + err.message);
        }
      });
    }
  }

  render();
}
