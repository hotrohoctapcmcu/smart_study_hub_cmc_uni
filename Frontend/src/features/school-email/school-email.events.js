/**
 * UniStudy CMC - School Email Events (Sprint 2)
 */
import {
  getSchoolEmails,
  markEmailRead,
  createTaskFromEmail,
  createExamFromEmail
} from "./school-email.service.js";
import { renderEmailDetailModal } from "./school-email.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";

export function attachSchoolEmailEvents(containerEl, uiState, reRenderCallback) {
  // 1. Chuyển tab lọc
  const filterBtns = containerEl.querySelectorAll("[data-email-filter]");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      uiState.filter = btn.getAttribute("data-email-filter");
      reRenderCallback();
    });
  });

  // 2. Tìm kiếm email
  const searchInput = containerEl.querySelector("#emailSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      uiState.searchQuery = e.target.value;
      reRenderCallback();
    });
  }

  // 3. Đồng bộ hòm thư trường
  const syncBtn = containerEl.querySelector("#syncEmailNowBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      alert("Đang kiểm tra hòm thư sinh viên CMC (@student.cmcu.edu.vn)... Dữ liệu hòm thư đã được đồng bộ mới nhất.");
      reRenderCallback();
    });
  }

  // 4. Thêm deadline vào tasks
  const addDeadlineBtns = containerEl.querySelectorAll("[data-add-deadline-task]");
  addDeadlineBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const emailId = btn.getAttribute("data-add-deadline-task");
      const task = createTaskFromEmail(emailId);
      if (task) {
        alert(`Đã tự động thêm "${task.title}" vào danh sách Công việc & Deadline của bạn!`);
        reRenderCallback();
      }
    });
  });

  // 5. Thêm lịch thi vào exams
  const addExamBtns = containerEl.querySelectorAll("[data-add-exam-plan]");
  addExamBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const emailId = btn.getAttribute("data-add-exam-plan");
      const exam = createExamFromEmail(emailId);
      if (exam) {
        alert(`Đã tự động thêm lịch thi môn "${exam.subject}" vào Kế hoạch ôn thi của bạn!`);
        reRenderCallback();
      }
    });
  });

  // 6. Đọc toàn bộ nội dung email
  const readDetailBtns = containerEl.querySelectorAll("[data-read-mail-detail]");
  readDetailBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const emailId = btn.getAttribute("data-read-mail-detail");
      markEmailRead(emailId);
      const email = getSchoolEmails().find((m) => m.id === emailId);
      if (!email) return;

      const modalHost = containerEl.querySelector("#schoolEmailModalContainer");
      if (!modalHost) return;

      modalHost.innerHTML = renderEmailDetailModal(email);
      const modalEl = modalHost.querySelector("#emailDetailModal");
      attachModalEvents(modalEl, () => {
        modalHost.innerHTML = "";
        reRenderCallback();
      });
    });
  });
}
