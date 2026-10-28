/**
 * UniStudy CMC - Exams Events
 */
import { state, updateLocalExam, deleteLocalExam } from "../../app/state.js";
import { changeCurrentTabRoute, updateActiveTabLocalState } from "../../app/workspace.js";
import { validateExamInput } from "../../shared/utils/validation.js";
import { renderExamModal } from "./exams.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";
import { createExamApi, updateExamApi, deleteExamApi, fetchExamsFromApi } from "./exams.service.js";
import { workspaceRequest } from "../../shared/services/workspace-api.js";
import { writeDraft } from "../ai-study/ai-study.service.js";

export function attachExamsEvents(containerEl) {
  containerEl.querySelector('#examAiPlanBtn')?.addEventListener('click', () => changeCurrentTabRoute('exam-plan-ai'));
  containerEl.querySelector('#examWeaknessBtn')?.addEventListener('click', () => changeCurrentTabRoute('weaknesses'));
  containerEl.querySelectorAll('[data-ai-plan-exam]').forEach(button => button.addEventListener('click', () => {
    writeDraft('ai-exam-seed', button.dataset.aiPlanExam); changeCurrentTabRoute('exam-plan-ai');
  }));
  containerEl.querySelectorAll('[data-phase-status]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await workspaceRequest('PATCH', `/exams/study-plans/${encodeURIComponent(button.dataset.phaseStatus)}/status`, { body: { status: button.dataset.status } }); await fetchExamsFromApi(); }
    catch (error) { alert(error.message); button.disabled = false; }
  }));
  containerEl.querySelectorAll('[data-phase-delete]').forEach(button => button.addEventListener('click', async () => {
    if (!window.confirm('Xóa giai đoạn ôn tập này? Các buổi tự học đã thêm vẫn được quản lý riêng trong Lịch học.')) return;
    button.disabled = true;
    try { await workspaceRequest('DELETE', `/exams/study-plans/${encodeURIComponent(button.dataset.phaseDelete)}`); await fetchExamsFromApi(); }
    catch (error) { alert(error.message); button.disabled = false; }
  }));
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

    let cleanup, saving = false;
    const close = () => {
      cleanup?.();
      modalHost.innerHTML = "";
    };

    cleanup = attachModalEvents(modalEl, close);

    const form = modalEl.querySelector("#examModalForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (saving) return;
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

        saving = true;
        const button = modalEl.querySelector('button[type=submit]'); if (button) button.disabled = true;
        try {
          if (initialData?.isLocalDraft) updateLocalExam(initialData.id, data);
          else if (initialData?.id) await updateExamApi({ ...initialData, ...data });
          else await createExamApi(data);
          close();
        } catch (error) { alert(error.message); if (button) button.disabled = false; } finally { saving = false; }
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
        deleteExamApi(id).catch((err) =>
          console.warn("[Exams] Lỗi xóa kỳ thi trên máy chủ:", err)
        );
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
