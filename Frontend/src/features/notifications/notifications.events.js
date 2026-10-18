/**
 * UniStudy CMC - Notifications Events
 */
import { updateActiveTabLocalState } from "../../app/workspace.js";
import { markNotificationAsRead, markAllNotificationsAsRead } from "../../app/state.js";

export function attachNotificationsEvents(containerEl) {
  // Lọc Tất cả / Chưa đọc / Đã đọc
  const filterBtns = containerEl.querySelectorAll("[data-notif-filter]");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.getAttribute("data-notif-filter");
      updateActiveTabLocalState({ notificationFilter: f });
    });
  });

  // Đánh dấu đã đọc từng cái
  const markReadBtns = containerEl.querySelectorAll("[data-mark-read-id]");
  markReadBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-mark-read-id");
      markNotificationAsRead(id);
    });
  });

  // Đánh dấu tất cả đã đọc
  const markAllBtn = containerEl.querySelector("#markAllReadBtn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", () => {
      markAllNotificationsAsRead();
    });
  }
}
