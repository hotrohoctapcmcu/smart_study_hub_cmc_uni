/**
 * UniStudy CMC - Notifications Service
 * Interface dịch vụ theo API Backend Sprint 1
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { state, notifyStateChange } from "../../app/state.js";

export async function getNotifications() {
  return await apiRequest(ENDPOINTS.notifications.list);
}

export async function getUnreadNotificationCount() {
  return await apiRequest(ENDPOINTS.notifications.unreadCount);
}

export async function markNotificationRead(id) {
  const numericId = String(id).replace(/^notif-/, "");
  return await apiRequest(ENDPOINTS.notifications.markRead, {
    params: { id: numericId }
  });
}

/**
 * Chuẩn hóa 1 nhắc nhở từ Backend thành thông báo UI
 */
export function mapNotificationFromBackend(r) {
  const reminderId = Number(r.reminder_id ?? r.id);
  const type = r.target_type === "ASSIGNMENT" ? "deadline" : "system";

  return {
    id: `notif-${reminderId}`,
    reminderId,
    type,
    title: r.title || "Thông báo học tập",
    body: r.message || "",
    read: Boolean(r.is_sent),
    createdAt: r.created_at || r.remind_time || new Date().toISOString(),
    targetType: r.target_type,
    targetId: r.target_id
  };
}

/**
 * Tải danh sách nhắc nhở từ Backend API và gộp vào state.notifications
 */
export async function fetchNotificationsFromApi() {
  const res = await getNotifications();
  if (!res.success) {
    if (res.unavailable) return state.notifications;
    throw new Error(res.error || "Không thể tải thông báo từ máy chủ.");
  }

  const rows = res.data?.data ?? res.data ?? [];
  if (Array.isArray(rows)) {
    const backendNotifs = rows.map(mapNotificationFromBackend);
    // Giữ lại các thông báo cục bộ chưa có trên server
    const localOnly = state.notifications.filter(
      (n) => !backendNotifs.some((b) => b.id === n.id) && !n.reminderId
    );
    state.notifications = [...backendNotifs, ...localOnly];
    notifyStateChange();
    return state.notifications;
  }
  return state.notifications;
}

/**
 * Đánh dấu toàn bộ thông báo đã đọc trên Backend API
 */
export async function markAllNotificationsRead() {
  const unreadList = state.notifications.filter((n) => !n.read && n.reminderId);
  await Promise.allSettled(
    unreadList.map((n) => markNotificationRead(n.reminderId))
  );
}

