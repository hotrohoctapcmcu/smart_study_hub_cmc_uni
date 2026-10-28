/**
 * UniStudy CMC - Unified Notifications & School Email Events
 */
import { updateActiveTabLocalState } from "../../app/workspace.js";
import { markNotificationAsRead, markAllNotificationsAsRead, notifyStateChange } from "../../app/state.js";
import { getSchoolEmails } from "../school-email/school-email.service.js";
import { syncSchoolEmails, readSchoolEmailOnServer, processSchoolEmailOnServer, refreshSchoolEmail, markAllSchoolEmailsOnServer } from "../school-email/school-email.service.js";
import { workspaceRequest } from "../../shared/services/workspace-api.js";
import { renderEmailDetailModal } from "../school-email/school-email.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";

import { markNotificationRead, markAllNotificationsRead as markAllApi } from "./notifications.service.js";

export function attachNotificationsEvents(containerEl) {
  const safe = action => async (...args) => { try { await action(...args); } catch (error) { alert(error.message); } };
  for (const [selector, connect] of [['#connectOutlookBtn', true], ['#syncEmailNowBtn', false]]) {
    containerEl.querySelector(selector)?.addEventListener('click', safe(async () => {
      const pending = syncSchoolEmails(connect); notifyStateChange();
      try { await pending; } finally { notifyStateChange(); }
    }));
  }
  containerEl.querySelector('#disconnectOutlookBtn')?.addEventListener('click', safe(async () => {
    await workspaceRequest('DELETE', '/email/session');
    alert('Đã ngắt phiên Outlook. Thư đã tải vẫn được giữ.');
  }));
  // 1. Lọc theo tab bộ lọc
  const filterBtns = containerEl.querySelectorAll("[data-notif-filter]");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.getAttribute("data-notif-filter");
      updateActiveTabLocalState({ notificationFilter: f });
      notifyStateChange();
    });
  });

  // 2. Đánh dấu đã đọc từng mục (cả thông báo hệ thống và email trường)
  const markReadBtns = containerEl.querySelectorAll("[data-mark-read-id]");
  markReadBtns.forEach((btn) => {
    btn.addEventListener("click", safe(async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-mark-read-id");
      const itemType = btn.getAttribute("data-item-type");

      if (itemType === "email") {
        await readSchoolEmailOnServer(id);
      } else {
        markNotificationAsRead(id);
        markNotificationRead(id).catch((err) =>
          console.warn("[Notifications] Lỗi đánh dấu đã đọc trên backend:", err)
        );
      }
      notifyStateChange();
    }));
  });

  // 3. Đánh dấu tất cả đã đọc
  const markAllBtn = containerEl.querySelector("#markAllReadBtn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", safe(async () => {
      await Promise.all([markAllApi(), markAllSchoolEmailsOnServer()]);
      markAllNotificationsAsRead();
    }));
  }

  // 4. Mở modal xem toàn bộ nội dung email
  const openMailBtns = containerEl.querySelectorAll("[data-open-mail-modal]");
  const modalHost = containerEl.querySelector("#emailModalHost");

  openMailBtns.forEach((btn) => {
    btn.addEventListener("click", safe(async () => {
      const mailId = btn.getAttribute("data-open-mail-modal");
      const emails = getSchoolEmails();
      const mail = emails.find((m) => m.id === mailId);
      if (!mail || !modalHost) return;

      // Đánh dấu đã đọc khi mở thư
      await readSchoolEmailOnServer(mailId);

      modalHost.innerHTML = renderEmailDetailModal(mail);
      const modalEl = modalHost.querySelector("#emailDetailModal");

      const closeModal = () => {
        modalHost.innerHTML = "";
        notifyStateChange();
      };

      attachModalEvents(modalEl, closeModal);
      modalEl.querySelector('[data-refresh-mail]')?.addEventListener('click', safe(async () => {
        await refreshSchoolEmail(mailId); closeModal();
      }));
    }));
  });

  // 5. Trích xuất Deadline từ email tạo công việc
  const createTaskBtns = containerEl.querySelectorAll("[data-create-task-mail-id]");
  createTaskBtns.forEach((btn) => {
    btn.addEventListener("click", safe(async (e) => {
      e.stopPropagation();
      const mailId = btn.getAttribute("data-create-task-mail-id");
      const created = await processSchoolEmailOnServer(mailId, 'task');
      if (created) {
        notifyStateChange();
      }
    }));
  });

  // 6. Trích xuất Lịch thi từ email tạo kỳ thi
  const createExamBtns = containerEl.querySelectorAll("[data-create-exam-mail-id]");
  createExamBtns.forEach((btn) => {
    btn.addEventListener("click", safe(async (e) => {
      e.stopPropagation();
      const mailId = btn.getAttribute("data-create-exam-mail-id");
      const created = await processSchoolEmailOnServer(mailId, 'exam');
      if (created) {
        notifyStateChange();
      }
    }));
  });
}
