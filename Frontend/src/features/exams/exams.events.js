/**
 * UniStudy CMC - Exams Events
 */
import { state, addLocalExam, updateLocalExam, deleteLocalExam } from "../../app/state.js";
import { changeCurrentTabRoute, updateActiveTabLocalState } from "../../app/workspace.js";
import { validateExamInput } from "../../shared/utils/validation.js";
import { renderExamModal } from "./exams.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";

export function attachExamsEvents(containerEl) {
  // Nút Đồng bộ lịch thi
  const syncBtn = containerEl.querySelector("#examSyncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      changeCurrentTabRoute("sync");
    });
  }

  // Mở modal tạo / sửa kỳ thi
  const openModal = (initialData = null) => {
    const modalHost = containerEl.querySelector("#examModalHost");
    if (!modalHost) return;

    modalHost.innerHTML = renderExamModal(initialData);
    const modalEl = modalHost.querySelector("#examDetailModal");

    const close = () => {
      modalHost.innerHTML = "";
    };

    attachModalEvents(modalEl, close);

    const form = modalEl.querySelector("#examModalForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = {
          subject: fd.get("subject"),
          code: fd.get("code"),
          date: fd.get("date"),
          start: fd.get("start"),
          duration: fd.get("duration"),
          room: fd.get("room"),
          scope: fd.get("scope")
        };

        const check = validateExamInput(data);
        if (!check.isValid) {
          const firstErr = Object.values(check.errors)[0];
          alert(firstErr);
          return;
        }

        if (initialData?.id) {
          updateLocalExam(initialData.id, data);
        } else {
          // Tạo mốc lộ trình tự động ban đầu từ phạm vi
          const milestones = [
            { title: "Đọc giáo trình & tổng hợp lý thuyết", targetDate: data.date },
            { title: "Làm bài tập trắc nghiệm và đề cương", targetDate: data.date }
          ];
          addLocalExam({ ...data, studyMilestones: milestones });
        }
        close();
      });
    }
  };

  const createBtn = containerEl.querySelector("#openCreateExamBtn");
  const emptyCreateBtn = containerEl.querySelector("#emptyCreateExamBtn");
  if (createBtn) createBtn.addEventListener("click", () => openModal());
  if (emptyCreateBtn) emptyCreateBtn.addEventListener("click", () => openModal());

  // Nút Sửa kỳ thi
  const editBtns = containerEl.querySelectorAll("[data-edit-exam-id]");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-exam-id");
      const exam = state.exams.find((e) => e.id === id);
      if (exam) {
        openModal(exam);
      }
    });
  });

  // Nút Xóa kỳ thi
  const deleteBtns = containerEl.querySelectorAll("[data-delete-exam-id]");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete-exam-id");
      const ok = window.confirm("Bạn có chắc chắn muốn xóa kỳ thi này?");
      if (ok) {
        deleteLocalExam(id);
      }
    });
  });

  // Nút "Lên kế hoạch học": Chuyển route sang schedule và chọn ngày thi trong tab hiện tại!
  const gotoScheduleBtns = containerEl.querySelectorAll("[data-goto-schedule-exam]");
  gotoScheduleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const examDate = btn.getAttribute("data-goto-schedule-exam");
      updateActiveTabLocalState({ selectedDate: examDate });
      changeCurrentTabRoute("schedule");
    });
  });
}
