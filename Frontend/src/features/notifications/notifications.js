/**
 * UniStudy CMC - Notifications Feature Entry
 */
import { renderNotificationsView } from "./notifications.view.js";
import { attachNotificationsEvents } from "./notifications.events.js";
import { fetchNotificationsFromApi } from "./notifications.service.js";

let notifsLoaded = false;

export async function mountNotifications(containerEl) {
  if (!notifsLoaded) {
    try {
      await fetchNotificationsFromApi();
      notifsLoaded = true;
    } catch (e) {
      console.warn("[Notifications] Không thể tải thông báo từ backend:", e.message);
    }
  }

  containerEl.innerHTML = renderNotificationsView();
  attachNotificationsEvents(containerEl);
}

