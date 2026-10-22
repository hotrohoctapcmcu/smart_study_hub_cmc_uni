/**
 * UniStudy CMC - Notifications Feature Entry
 */
import { renderNotificationsView } from "./notifications.view.js";
import { attachNotificationsEvents } from "./notifications.events.js";
import { fetchNotificationsFromApi } from "./notifications.service.js";

let notifsLoaded = false;

export async function mountNotifications(containerEl) {
  // Render trước bằng state cache để pane không bao giờ trắng
  // trong lúc chờ fetch.
  containerEl.innerHTML = renderNotificationsView();
  attachNotificationsEvents(containerEl);
  if (!notifsLoaded) {
    try {
      await fetchNotificationsFromApi();
      notifsLoaded = true;
      if (!containerEl.isConnected) return;
      containerEl.innerHTML = renderNotificationsView();
      attachNotificationsEvents(containerEl);
    } catch (e) {
      console.warn("[Notifications] Không thể tải thông báo từ backend:", e.message);
    }
  }
}

