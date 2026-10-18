/**
 * UniStudy CMC - Notifications Feature Entry
 */
import { renderNotificationsView } from "./notifications.view.js";
import { attachNotificationsEvents } from "./notifications.events.js";

export function mountNotifications(containerEl) {
  containerEl.innerHTML = renderNotificationsView();
  attachNotificationsEvents(containerEl);
}
