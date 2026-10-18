/**
 * UniStudy CMC - Notifications Service
 * Interface dịch vụ theo API_FUNCTION_MAP.md & API_CONTRACT.md
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";

export async function getNotifications() {
  return await apiRequest(ENDPOINTS.notifications.list);
}

export async function getUnreadNotificationCount() {
  return await apiRequest(ENDPOINTS.notifications.unreadCount);
}

export async function markNotificationRead(id) {
  return await apiRequest(ENDPOINTS.notifications.markRead, {
    params: { id }
  });
}

export async function markAllNotificationsRead() {
  return await apiRequest(ENDPOINTS.notifications.markAllRead);
}
