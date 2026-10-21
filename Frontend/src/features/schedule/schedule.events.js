/**
 * UniStudy CMC - Schedule Events Controller
 */
import { state, notifyStateChange } from "../../app/state.js";
import { getActiveTab, updateActiveTabLocalState } from "../../app/workspace.js";
import { formatDateISO, shiftDateByDays, shiftDateByMonths } from "../../shared/utils/date.js";
import { validateStudySessionForm } from "./schedule.validation.js";
import { 
  renderStudySessionModal, 
  renderEventDetailModal, 
  renderConfirmDeleteModal, 
  renderConflictDecisionModal,
  renderExistingConflictModal,
  renderAiScheduleModal 
} from "./schedule.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";
import { areEventsConflicting, findScheduleConflicts } from "./schedule.conflicts.js";
import { createSelfStudy, updateSelfStudy, deleteSelfStudy } from "./schedule.service.js";

// Lưu vị trí cuộn để không tự cuộn lại sau mỗi lần render (mặc định ~07:00)
let savedScrollTop = 420;

export function attachScheduleEvents(containerEl) {
  // 1. Chuyển chế độ xem: Ngày / Tuần / Tháng
  const modeBtns = containerEl.querySelectorAll("[data-schedule-mode]");
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-schedule-mode");
      updateActiveTabLocalState({ scheduleMode: mode });
    });
  });

  // 2. Thanh công cụ chính: Hôm nay, Kỳ trước, Kỳ sau
  const todayBtn = containerEl.querySelector("#scheduleTodayBtn");
  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      updateActiveTabLocalState({ selectedDate: formatDateISO(new Date()) });
    });
  }

  const prevPeriodBtn = containerEl.querySelector("#schedulePrevPeriodBtn");
  if (prevPeriodBtn) {
    prevPeriodBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const current = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      const mode = activeTab.tabState?.scheduleMode || "week";

      let newDate = current;
      if (mode === "day") {
        newDate = shiftDateByDays(current, -1);
      } else if (mode === "week") {
        newDate = shiftDateByDays(current, -7);
      } else if (mode === "month") {
        newDate = shiftDateByMonths(current, -1);
      }
      updateActiveTabLocalState({ selectedDate: newDate });
    });
  }

  const nextPeriodBtn = containerEl.querySelector("#scheduleNextPeriodBtn");
  if (nextPeriodBtn) {
    nextPeriodBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const current = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      const mode = activeTab.tabState?.scheduleMode || "week";

      let newDate = current;
      if (mode === "day") {
        newDate = shiftDateByDays(current, 1);
      } else if (mode === "week") {
        newDate = shiftDateByDays(current, 7);
      } else if (mode === "month") {
        newDate = shiftDateByMonths(current, 1);
      }
      updateActiveTabLocalState({ selectedDate: newDate });
    });
  }

  // 3. Nút mở/thu gọn Lịch nhỏ trên Mobile
  const toggleMiniBtn = containerEl.querySelector("#toggleMiniCalMobileBtn");
  const sideCol = containerEl.querySelector("#scheduleSideCol");
  if (toggleMiniBtn && sideCol) {
    toggleMiniBtn.addEventListener("click", () => {
      sideCol.classList.toggle("mobile-open");
    });
  }

  // 4. Lịch thu nhỏ: Nút lùi / tiến tháng
  const miniPrevBtn = containerEl.querySelector("#miniCalPrevBtn");
  if (miniPrevBtn) {
    miniPrevBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const current = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      const newDate = shiftDateByMonths(current, -1);
      updateActiveTabLocalState({ selectedDate: newDate });
    });
  }

  const miniNextBtn = containerEl.querySelector("#miniCalNextBtn");
  if (miniNextBtn) {
    miniNextBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const current = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      const newDate = shiftDateByMonths(current, 1);
      updateActiveTabLocalState({ selectedDate: newDate });
    });
  }

  // 5. Lịch thu nhỏ: Click chọn ngày trực tiếp
  const miniDayBtns = containerEl.querySelectorAll("[data-mini-date]");
  miniDayBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.getAttribute("data-mini-date");
      if (date) {
        updateActiveTabLocalState({ selectedDate: date });
      }
    });
  });

  // 6. Header cột ngày trong tuần: Click để chọn ngày đó
  const colHeaders = containerEl.querySelectorAll("[data-select-day]");
  colHeaders.forEach((hdr) => {
    hdr.addEventListener("click", () => {
      const date = hdr.getAttribute("data-select-day");
      if (date) {
        updateActiveTabLocalState({ selectedDate: date });
      }
    });
  });

  // 7. Lịch tháng: Click ô ngày hoặc nút "+N lịch"
  const monthCells = containerEl.querySelectorAll("[data-month-cell-date]");
  monthCells.forEach((cell) => {
    cell.addEventListener("click", (e) => {
      if (!e.target.closest("[data-event-id]") && !e.target.closest("[data-more-date]")) {
        const date = cell.getAttribute("data-month-cell-date");
        if (date) {
          updateActiveTabLocalState({ selectedDate: date });
        }
      }
    });
  });

  const moreLinks = containerEl.querySelectorAll("[data-more-date]");
  moreLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      const date = link.getAttribute("data-more-date");
      if (date) {
        updateActiveTabLocalState({ selectedDate: date, scheduleMode: "day" });
      }
    });
  });

  // 8. Cuộn mượt và bảo toàn vị trí cuộn trên lưới 24 giờ
  const scrollPane = containerEl.querySelector("#scheduleHourlyScrollPane");
  if (scrollPane) {
    scrollPane.scrollTop = savedScrollTop;
    scrollPane.addEventListener("scroll", () => {
      savedScrollTop = scrollPane.scrollTop;
    }, { passive: true });
  }

  // ===================== HELPER MODALS =====================

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
        notifyStateChange();
      });
    }
  };

  // Helper mở Modal Giải quyết Xung đột khi thêm/sửa
  const openConflictDecisionModal = ({ pendingData, conflictingEvents, isEdit, onConfirmSave }) => {
    const conflictHost = containerEl.querySelector("#conflictDecisionModalContainer");
    if (!conflictHost) return;

    conflictHost.innerHTML = renderConflictDecisionModal({
      pendingSession: pendingData,
      conflictingEvents,
      isEdit
    });

    const modalEl = conflictHost.querySelector("#conflictDecisionModal");
    const closeConflict = () => {
      conflictHost.innerHTML = "";
    };

    attachModalEvents(modalEl, closeConflict);

    // a. "Giữ lịch trên lớp" hoặc "Hủy bỏ"
    const cancelBtns = modalEl.querySelectorAll("#decisionKeepSchoolBtn, #decisionCancelBtn");
    cancelBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        closeConflict();
      });
    });

    // b. "Đổi giờ tự học" -> Đóng conflict modal, mở lại form với data đã nhập
    const adjustBtns = modalEl.querySelectorAll("#decisionAdjustTimeBtn");
    adjustBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        closeConflict();
        openAddModal(pendingData);
      });
    });

    // c. "Vẫn lưu lịch tự học" -> Lưu cả 2 và đánh dấu trùng đỏ
    const forceBtns = modalEl.querySelectorAll("#decisionForceSaveBtn");
    forceBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        closeConflict();
        await onConfirmSave();
      });
    });

    // d. "Thay thế lịch tự học cũ"
    const replaceBtn = modalEl.querySelector("#decisionReplaceStudyBtn");
    if (replaceBtn) {
      replaceBtn.addEventListener("click", async () => {
        const replaceId = replaceBtn.getAttribute("data-replace-id");
        if (replaceId) {
          const oldEvent = state.studyEvents.find((s) => s.id === replaceId);
          const confirmReplace = confirm(
            `Xác nhận xóa lịch tự học cũ "${oldEvent?.title || oldEvent?.subject}" và lưu lịch mới này?`
          );
          if (confirmReplace) {
            await deleteSelfStudy(replaceId);
            closeConflict();
            await onConfirmSave();
          }
        }
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
          id: initialData?.id || undefined,
          title: formData.get("title")?.trim(),
          subject: formData.get("subject")?.trim(),
          date: formData.get("date"),
          start: formData.get("start"),
          end: formData.get("end"),
          note: formData.get("note")?.trim(),
          source: "Tự thêm"
        };

        const validation = validateStudySessionForm(data);
        if (!validation.isValid) {
          const firstErr = Object.values(validation.errors)[0];
          alert(firstErr);
          return;
        }

        // Kiểm tra xung đột trước khi lưu
        const allEvents = [...state.schoolEvents, ...state.studyEvents];
        const conflictingEvents = allEvents.filter((ev) => {
          if (initialData?.id && ev.id === initialData.id) return false;
          return areEventsConflicting(data, ev);
        });

        const performSave = async () => {
          if (initialData?.id) {
            await updateSelfStudy(initialData.id, data);
          } else {
            await createSelfStudy(data);
          }
          close();
          notifyStateChange();
        };

        if (conflictingEvents.length > 0) {
          // Phát hiện xung đột -> Mở Modal quyết định lựa chọn, CHƯA ghi thay đổi
          openConflictDecisionModal({
            pendingData: data,
            conflictingEvents,
            isEdit: Boolean(initialData?.id),
            onConfirmSave: performSave
          });
        } else {
          await performSave();
        }
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

  // 9. Nhấn ô giờ trống để mở form điền sẵn ngày & giờ
  const hourSlots = containerEl.querySelectorAll("[data-slot-date][data-slot-hour]");
  hourSlots.forEach((slot) => {
    slot.addEventListener("click", (e) => {
      // Chỉ kích hoạt khi click vào nền ô giờ, không phải click vào thẻ sự kiện
      if (e.target.closest("[data-event-id]")) return;

      const slotDate = slot.getAttribute("data-slot-date");
      const slotHour = parseInt(slot.getAttribute("data-slot-hour"), 10);
      const startStr = `${String(slotHour).padStart(2, "0")}:00`;
      const endHour = Math.min(23, slotHour + 1);
      const endStr = `${String(endHour).padStart(2, "0")}:30`;

      openAddModal({
        date: slotDate,
        start: startStr,
        end: endStr,
        title: "",
        subject: ""
      });
    });
  });

  // 10. Nút chính "Xếp lịch tự học"
  const addBtn = containerEl.querySelector("#openAddStudySessionBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const activeTab = getActiveTab();
      const current = activeTab.tabState?.selectedDate || formatDateISO(new Date());
      openAddModal({ date: current, start: "08:00", end: "09:30" });
    });
  }

  // 11. Nhấn vào thẻ sự kiện để xem chi tiết (Click & Phím Enter/Space)
  const eventCards = containerEl.querySelectorAll("[data-event-id]");
  eventCards.forEach((card) => {
    const handleOpen = () => {
      const id = card.getAttribute("data-event-id");
      const allEvents = [...state.schoolEvents, ...state.studyEvents];
      const event = allEvents.find((e) => String(e.id) === String(id));
      if (event) {
        openDetailModal(event);
      }
    };

    card.addEventListener("click", (e) => {
      e.stopPropagation();
      handleOpen();
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        handleOpen();
      }
    });
  });

  // 12. Mở modal Xem và Xử lý Xung đột đã tồn tại
  const conflictBtn = containerEl.querySelector("#openConflictResolutionBtn");
  if (conflictBtn) {
    conflictBtn.addEventListener("click", () => {
      const modalHost = containerEl.querySelector("#conflictResolutionModalContainer");
      if (!modalHost) return;

      const allEvents = [...state.schoolEvents, ...state.studyEvents];
      const conflictResult = findScheduleConflicts(allEvents);

      modalHost.innerHTML = renderExistingConflictModal(conflictResult.conflictPairs);
      const modalEl = modalHost.querySelector("#conflictResolutionModal");

      const close = () => {
        modalHost.innerHTML = "";
      };

      attachModalEvents(modalEl, close);

      // Đổi giờ ca tự học
      const editBtns = modalEl.querySelectorAll("[data-resolve-edit]");
      editBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-resolve-edit");
          const ev = state.studyEvents.find((s) => String(s.id) === String(id));
          if (ev) {
            close();
            openAddModal(ev);
          }
        });
      });

      // Xóa ca tự học
      const delBtns = modalEl.querySelectorAll("[data-resolve-delete]");
      delBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-resolve-delete");
          const ev = state.studyEvents.find((s) => String(s.id) === String(id));
          if (ev) {
            close();
            openConfirmDeleteModal(ev);
          }
        });
      });
    });
  }

  // 14. Mở modal Gợi ý xếp lịch bằng AI
  const openAiBtn = containerEl.querySelector("#openAiScheduleBtn");
  if (openAiBtn) {
    openAiBtn.addEventListener("click", () => {
      const modalHost = containerEl.querySelector("#aiScheduleModalContainer");
      if (!modalHost) return;

      const activeTab = getActiveTab();
      const currentSelectedDate = activeTab.tabState?.selectedDate || formatDateISO(new Date());

      let currentViewState = {
        formData: {
          startDate: currentSelectedDate,
          endDate: shiftDateByDays(currentSelectedDate, 6),
          subject: "",
          freeStartHour: "19:00",
          freeEndHour: "22:00",
          durationHours: "2"
        },
        status: "idle",
        message: "",
        proposals: []
      };

      const renderCurrentAiModal = () => {
        modalHost.innerHTML = renderAiScheduleModal(currentViewState);
        const modalEl = modalHost.querySelector("#aiScheduleModal");
        if (!modalEl) return;

        const close = () => {
          modalHost.innerHTML = "";
        };

        attachModalEvents(modalEl, close);

        // Submit form
        const form = modalEl.querySelector("#aiScheduleForm");
        if (form) {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const formData = {
              startDate: fd.get("startDate"),
              endDate: fd.get("endDate"),
              subject: fd.get("subject")?.trim(),
              freeStartHour: fd.get("freeStartHour"),
              freeEndHour: fd.get("freeEndHour"),
              durationHours: fd.get("durationHours")
            };

            if (!formData.subject) {
              alert("Vui lòng nhập môn học hoặc công việc cần ôn tập.");
              return;
            }

            if (formData.endDate < formData.startDate) {
              alert("Ngày kết thúc không được trước ngày bắt đầu.");
              return;
            }

            if (formData.freeEndHour <= formData.freeStartHour) {
              alert("Giờ kết thúc rảnh phải sau giờ bắt đầu.");
              return;
            }

            // Hiển thị trạng thái loading và chặn click liên tiếp
            currentViewState = {
              ...currentViewState,
              formData,
              status: "loading"
            };
            renderCurrentAiModal();

            // Kiểm tra kết nối API AI thật (chưa có endpoint backend được xác nhận)
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Thông báo đang chờ API kết nối, KHÔNG tạo đề xuất giả trong app chính
            currentViewState = {
              ...currentViewState,
              status: "waiting-api"
            };
            renderCurrentAiModal();
          });
        }

        // Nút thử lại
        const retryBtn = modalEl.querySelector("#retryAiScheduleBtn");
        if (retryBtn) {
          retryBtn.addEventListener("click", () => {
            currentViewState = {
              ...currentViewState,
              status: "idle"
            };
            renderCurrentAiModal();
          });
        }

        // Áp dụng đề xuất xem trước nếu có
        const applyBtn = modalEl.querySelector("#applyAiProposalsBtn");
        if (applyBtn && currentViewState.proposals.length > 0) {
          applyBtn.addEventListener("click", () => {
            // Kiểm tra xung đột trước khi áp dụng
            let hasConflict = false;
            const sessionsToApply = [];

            for (const prop of currentViewState.proposals) {
              const sessionCandidate = {
                id: prop.id || `study-ai-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                date: prop.date,
                start: prop.start,
                end: prop.end,
                title: prop.title || prop.subject,
                subject: prop.subject || prop.title,
                source: "Tự thêm",
                note: prop.note || "Đề xuất bởi trợ lý AI UniStudy"
              };

              // Kiểm tra xem đã có sự kiện tương đương chưa (chống trùng bản ghi)
              const alreadyExists = state.studyEvents.some(
                (s) => s.date === sessionCandidate.date && s.start === sessionCandidate.start && s.end === sessionCandidate.end && s.title === sessionCandidate.title
              );

              if (!alreadyExists) {
                sessionsToApply.push(sessionCandidate);
              }
            }

            // Lưu các buổi học
            sessionsToApply.forEach((sess) => {
              createSelfStudy(sess);
            });

            close();
            notifyStateChange();
          });
        }
      };

      renderCurrentAiModal();
    });
  }
}
