/**
 * UniStudy CMC - Notifications View
 */
import { state } from "../../app/state.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";

export function renderNotificationsView() {
  const activeTab = getActiveTab();
  const filter = activeTab.tabState.notificationFilter || "all";
  const allNotifs = state.notifications;

  let filtered = allNotifs;
  if (filter === "unread") {
    filtered = allNotifs.filter((n) => !n.read);
  } else if (filter === "read") {
    filtered = allNotifs.filter((n) => n.read);
  }

  const unreadCount = allNotifs.filter((n) => !n.read).length;

  return `
    <div class="notifications-container">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <span class="eyebrow"><svg><use href="#i-bell"></use></svg> Cập nhật hệ thống</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Thông báo & Nhắc nhở</h1>
        </div>
        ${
          unreadCount > 0
            ? `<button type="button" class="button ghost small" id="markAllReadBtn">Đánh dấu tất cả đã đọc</button>`
            : ""
        }
      </div>

      <!-- Dải bộ lọc -->
      <div class="notif-filter-bar">
        <div class="notif-filter-group">
          <button type="button" class="view-mode-btn ${filter === "all" ? "active" : ""}" data-notif-filter="all">Tất cả (${allNotifs.length})</button>
          <button type="button" class="view-mode-btn ${filter === "unread" ? "active" : ""}" data-notif-filter="unread">Chưa đọc (${unreadCount})</button>
          <button type="button" class="view-mode-btn ${filter === "read" ? "active" : ""}" data-notif-filter="read">Đã đọc (${allNotifs.length - unreadCount})</button>
        </div>
      </div>

      <!-- Danh sách Thông báo -->
      <div class="notif-list">
        ${
          filtered.length > 0
            ? filtered
                .map((n) => {
                  return `
              <div class="notif-item-card ${n.read ? "" : "unread"}" data-notif-id="${n.id}">
                <div class="notif-icon-circle">
                  <svg><use href="#${n.type === "deadline" ? "i-clock" : "i-bell"}"></use></svg>
                </div>
                <div class="notif-content-wrap">
                  <div class="notif-title-row">
                    <strong>${n.title}</strong>
                    <span class="notif-time-text">${n.createdAt ? formatDateTimeVN(n.createdAt) : ""}</span>
                  </div>
                  <p class="notif-body-text">${n.body}</p>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
                    <span class="badge-draft" style="font-size:0.72rem;">Nhắc nhở phiên cục bộ</span>
                    ${
                      !n.read
                        ? `<button type="button" class="button ghost small" data-mark-read-id="${n.id}" style="font-size:0.75rem;padding:2px 8px;min-height:28px;">
                             Đánh dấu đã đọc
                           </button>`
                        : `<span class="tiny muted">Đã đọc</span>`
                    }
                  </div>
                </div>
              </div>
            `;
                })
                .join("")
            : renderEmptyState({
                icon: "i-bell",
                title: "Không có thông báo nào",
                description: "Hệ thống sẽ tự động nhắc bạn khi có công việc sắp đến hạn trong vòng 24 giờ, 3 giờ và 1 giờ.",
                actionText: ""
              })
        }
      </div>
    </div>
  `;
}
