/**
 * UniStudy CMC - Schedule Events
 */
import { state, notifyStateChange } from "../../app/state.js";
import { getActiveTab, updateActiveTabLocalState } from "../../app/workspace.js";
import { formatDateISO, shiftDateByDays, shiftDateByMonths } from "../../shared/utils/date.js";
import { validateStudySessionForm } from "./schedule.validation.js";
import { 
  renderStudySessionModal, 
  renderEventDetailModal, 
  renderConfirmDeleteModal, 
  renderConflictResolutionModal 
} from "./schedule.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";
import { findScheduleConflicts } from "./schedule.conflicts.js";
import { createSelfStudy, updateSelfStudy, deleteSelfStudy } from "./schedule.service.js";

export function attachScheduleEvents(containerEl) {
  // 1. Chuyển chế độ xem: ngày / tuần / tháng
  const modeBtns = containerEl.querySelectorAll("[data-schedule-mode]");
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-schedule-mode");
      updateActiveTabLocalState({ scheduleMode: mode });
    });
  });

  // 2. Chuyển ngày
  const datePicker = containerEl.querySelector("#scheduleDatePicker");
  if (datePicker) {
    datePicker.addEventListener("change", (e) => {
      if (e.target.value) {
        updateActiveTabLocalState({ selectedDate: e.target.value });
      }
    });
  }

  const prevBtn = containerEl.querySelector("#schedulePrevDateBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const currentSelected = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      const mode = activeTab.tabState?.scheduleMode || "week";

      let newDate;
      if (mode === "day") {
        newDate = shiftDateByDays(currentSelected, -1);
      } else if (mode === "week") {
        newDate = shiftDateByDays(currentSelected, -7);
      } else {
        newDate = shiftDateByMonths(currentSelected, -1);
      }
      updateActiveTabLocalState({ selectedDate: newDate });
    });
  }

  const nextBtn = containerEl.querySelector("#scheduleNextDateBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const currentSelected = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      const mode = activeTab.tabState?.scheduleMode || "week";

      let newDate;
      if (mode === "day") {
        newDate = shiftDateByDays(currentSelected, 1);
      } else if (mode === "week") {
        newDate = shiftDateByDays(currentSelected, 7);
      } else {
        newDate = shiftDateByMonths(currentSelected, 1);
      }
      updateActiveTabLocalState({ selectedDate: newDate });
    });
  }

  // Helper mở Modal Xác nhận Xóa
  const openConfirmDeleteModal = (session) => {
    const modalHost = containerEl.querySelector("#confirmDeleteModalContainer");
    if (!modalHost) return;

    modalHost.innerHTML = renderConfirmDeleteModal(session);
    const modalEl = modalHost.querySelector("#confirmDeleteModal");

    const close = () => {
      modalHost.innerHTML = "";
    };

    attachModalEvents(modalEl, close);

    const confirmBtn = modalEl.querySelector("#confirmDeleteSessionBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        await deleteSelfStudy(session.id);
        close();
      });
    }
  };

  // Helper mở Modal Thêm / Sửa Lịch tự học
  const openAddModal = (initialData = null) => {
    const modalHost = containerEl.querySelector("#studySessionModalContainer");
    if (!modalHost) return;

    modalHost.innerHTML = renderStudySessionModal(initialData);
    const modalEl = modalHost.querySelector("#studyModal");

    const close = () => {
      modalHost.innerHTML = "";
    };

    attachModalEvents(modalEl, close);

    const form = modalEl.querySelector("#studySessionForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {
          title: formData.get("title"),
          subject: formData.get("subject"),
          date: formData.get("date"),
          start: formData.get("start"),
          end: formData.get("end"),
          note: formData.get("note")
        };

        const validation = validateStudySessionForm(data);
        if (!validation.isValid) {
          const firstErr = Object.values(validation.errors)[0];
          alert(firstErr);
          return;
        }

        if (initialData?.id) {
          // Cập nhật đúng bản ghi theo ID qua service
          await updateSelfStudy(initialData.id, data);
        } else {
          // Thêm mới qua service
          await createSelfStudy(data);
        }
        close();
      });
    }
  };

  // Helper mở Modal Chi tiết sự kiện
  const openDetailModal = (event) => {
    const modalHost = containerEl.querySelector("#eventDetailModalContainer");
    if (!modalHost) return;

    const allEvents = [...state.schoolEvents, ...state.studyEvents];
    const conflictResult = findScheduleConflicts(allEvents);
    const isConflict = conflictResult.conflictingEventIds.has(event.id);

    modalHost.innerHTML = renderEventDetailModal(event, isConflict);
    const modalEl = modalHost.querySelector("#eventDetailModal");

    const close = () => {
      modalHost.innerHTML = "";
    };

    attachModalEvents(modalEl, close);

    // Nút Sửa trong modal chi tiết
    const editBtn = modalEl.querySelector("#editStudyFromDetailBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        close();
        openAddModal(event);
      });
    }

    // Nút Xóa trong modal chi tiết
    const deleteBtn = modalEl.querySelector("#deleteStudyFromDetailBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        close();
        openConfirmDeleteModal(event);
      });
    }
  };

  // 3. Mở modal thêm lịch tự học
  const addBtn = containerEl.querySelector("#openAddStudySessionBtn");
  const emptyAddBtn = containerEl.querySelector("#emptyDayAddStudyBtn");
  if (addBtn) addBtn.addEventListener("click", () => openAddModal());
  if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => openAddModal());

  // 4. Nhấn vào thẻ sự kiện để xem chi tiết (Hỗ trợ Click, Touch & Bàn phím Enter/Space)
  const eventCards = containerEl.querySelectorAll("[data-event-id]");
  eventCards.forEach((card) => {
    const handleOpen = () => {
      const id = card.getAttribute("data-event-id");
      const allEvents = [...state.schoolEvents, ...state.studyEvents];
      const event = allEvents.find((e) => e.id === id);
      if (event) {
        openDetailModal(event);
      }
    };

    card.addEventListener("click", handleOpen);

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
    });
  });

  // 5. Nút Sửa / Xóa trực tiếp trong Day View
  const editBtns = containerEl.querySelectorAll("[data-edit-study-id]");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-edit-study-id");
      const session = state.studyEvents.find((s) => s.id === id);
      if (session) {
        openAddModal(session);
      }
    });
  });

  const deleteBtns = containerEl.querySelectorAll("[data-delete-study-id]");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-delete-study-id");
      const session = state.studyEvents.find((s) => s.id === id);
      if (session) {
        openConfirmDeleteModal(session);
      }
    });
  });

  // 6. Mở modal giải quyết xung đột lịch
  const conflictBtn = containerEl.querySelector("#openConflictResolutionBtn");
  if (conflictBtn) {
    conflictBtn.addEventListener("click", () => {
      const modalHost = containerEl.querySelector("#conflictResolutionModalContainer");
      if (!modalHost) return;

      const allEvents = [...state.schoolEvents, ...state.studyEvents];
      const conflictResult = findScheduleConflicts(allEvents);

      modalHost.innerHTML = renderConflictResolutionModal(conflictResult.conflictPairs);
      const modalEl = modalHost.querySelector("#conflictResolutionModal");

      const close = () => {
        modalHost.innerHTML = "";
      };

      attachModalEvents(modalEl, close);

      const resolveBtns = modalEl.querySelectorAll("[data-resolve-conflict]");
      resolveBtns.forEach((rBtn) => {
        rBtn.addEventListener("click", async () => {
          const action = rBtn.getAttribute("data-resolve-conflict");
          const pairKey = rBtn.getAttribute("data-pair-key");
          const pair = conflictResult.conflictPairs.find((p) => p.key === pairKey);

          if (!pair) return;

          if (action === "keep_school") {
            // Xóa ca tự học trùng
            const studyEv = pair.eventA.source === "Tự thêm" ? pair.eventA : pair.eventB;
            await deleteSelfStudy(studyEv.id);
            close();
          } else if (action === "keep_study") {
            // Ghi nhận lựa chọn ưu tiên vào state
            state.conflictResolutions[pairKey] = "study";
            alert("Đã ghi nhận ưu tiên lịch tự học cho khoảng thời gian này trong không gian làm việc.");
            close();
            notifyStateChange();
          } else if (action === "adjust_time") {
            // Mở form chỉnh sửa cho ca tự học
            const studyEv = pair.eventA.source === "Tự thêm" ? pair.eventA : pair.eventB;
            close();
            openAddModal(studyEv);
          }
        });
      });
    });
  }
}
