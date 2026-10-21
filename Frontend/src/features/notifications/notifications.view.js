/**
 * UniStudy CMC - Unified Notifications & School Email View
 * Gộp thông báo hệ thống, nhắc deadline và hòm thư sinh viên CMC vào một giao diện duy nhất
 */
import { state } from "../../app/state.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { getSchoolEmails } from "../school-email/school-email.service.js";

export function renderNotificationsView() {
  const activeTab = getActiveTab();
  const filter = activeTab.tabState.notificationFilter || "all";

  // 1. Lấy thông báo hệ thống & deadline từ state
  const systemNotifs = (state.notifications || []).map((n) => ({
    id: n.id,
    itemType: "notification",
    title: n.title,
    senderName: "Hệ thống UniStudy",
    sender: "hethong@cmcu.edu.vn",
    body: n.body,
    isRead: Boolean(n.read),
    date: n.createdAt,
    type: n.type || "system",
    raw: n
  }));

  // 2. Lấy email trường thực tế
  const schoolEmails = getSchoolEmails().map((m) => ({
    id: m.id,
    itemType: "email",
    title: m.subject,
    senderName: m.senderName || m.sender,
    sender: m.sender,
    body: m.preview || m.body?.slice(0, 160) + "...",
    fullBody: m.body,
    isRead: Boolean(m.isRead),
    date: m.date,
    extractedDeadline: m.extractedDeadline,
    extractedExam: m.extractedExam,
    isProcessed: m.isProcessed,
    isExamProcessed: m.isExamProcessed,
    raw: m
  }));

  // 3. Hợp nhất và sắp xếp theo ngày gửi/tạo giảm dần (mới nhất lên đầu)
  const unifiedItems = [...systemNotifs, ...schoolEmails].sort((a, b) => {
    const tA = new Date(a.date || 0).getTime();
    const tB = new Date(b.date || 0).getTime();
    return tB - tA;
  });

  // 4. Lọc theo bộ lọc người dùng chọn
  let filtered = unifiedItems;
  if (filter === "unread") {
    filtered = unifiedItems.filter((i) => !i.isRead);
  } else if (filter === "read") {
    filtered = unifiedItems.filter((i) => i.isRead);
  } else if (filter === "emails") {
    filtered = unifiedItems.filter((i) => i.itemType === "email");
  } else if (filter === "deadlines") {
    filtered = unifiedItems.filter((i) => i.type === "deadline" || i.extractedDeadline);
  }

  const totalCount = unifiedItems.length;
  const unreadCount = unifiedItems.filter((i) => !i.isRead).length;
  const emailCount = schoolEmails.length;
  const deadlineCount = unifiedItems.filter((i) => i.type === "deadline" || i.extractedDeadline).length;

  return `
    <div class="notifications-container">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <span class="eyebrow"><svg><use href="#i-bell"></use></svg> Hộp thư & Thông báo hợp nhất</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Thông báo & Email trường</h1>
        </div>
        ${
          unreadCount > 0
            ? `<button type="button" class="button ghost small" id="markAllReadBtn">
                 <svg style="width:14px;height:14px;"><use href="#i-check"></use></svg>
                 <span>Đánh dấu tất cả đã đọc</span>
               </button>`
            : ""
        }
      </div>

      <!-- Dải bộ lọc tích hợp -->
      <div class="notif-filter-bar">
        <div class="notif-filter-group" style="flex-wrap:wrap;">
          <button type="button" class="view-mode-btn ${filter === "all" ? "active" : ""}" data-notif-filter="all">Tất cả (${totalCount})</button>
          <button type="button" class="view-mode-btn ${filter === "unread" ? "active" : ""}" data-notif-filter="unread">Chưa đọc (${unreadCount})</button>
          <button type="button" class="view-mode-btn ${filter === "read" ? "active" : ""}" data-notif-filter="read">Đã đọc (${totalCount - unreadCount})</button>
          <button type="button" class="view-mode-btn ${filter === "emails" ? "active" : ""}" data-notif-filter="emails">Email trường (${emailCount})</button>
          <button type="button" class="view-mode-btn ${filter === "deadlines" ? "active" : ""}" data-notif-filter="deadlines">Deadline & Lịch thi (${deadlineCount})</button>
        </div>
      </div>

      <!-- Danh sách Thông báo & Email -->
      <div class="notif-list">
        ${
          filtered.length > 0
            ? filtered
                .map((item) => {
                  const isEmail = item.itemType === "email";
                  const isUnread = !item.isRead;

                  return `
              <div class="notif-item-card ${isUnread ? "unread" : ""}" data-item-id="${item.id}" data-item-type="${item.itemType}">
                <div class="notif-icon-circle ${isEmail ? "email-circle" : ""}">
                  <svg><use href="#${isEmail ? "i-user" : item.type === "deadline" ? "i-clock" : "i-bell"}"></use></svg>
                </div>
                <div class="notif-content-wrap">
                  <div class="notif-title-row">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <strong style="color:var(--ink-950);font-size:0.98rem;">${item.title}</strong>
                      <span class="badge-draft" style="font-size:0.72rem;${isEmail ? "background:#ede9fe;color:#5b21b6;" : ""}">
                        ${isEmail ? "📧 Email trường CMC" : item.type === "deadline" ? "⏰ Nhắc deadline" : "🔔 Thông báo hệ thống"}
                      </span>
                    </div>
                    <span class="notif-time-text">${item.date ? formatDateTimeVN(item.date) : ""}</span>
                  </div>

                  ${
                    isEmail
                      ? `<div style="font-size:0.8rem;color:var(--ink-600);margin:2px 0 6px;">
                           Từ: <strong>${item.senderName}</strong> &lt;${item.sender}&gt;
                         </div>`
                      : ""
                  }

                  <p class="notif-body-text">${item.body}</p>

                  <!-- Khối Trích xuất Deadline / Lịch thi từ Email -->
                  ${
                    item.extractedDeadline
                      ? `
                    <div class="notif-extracted-box" style="margin-top:10px;padding:10px 14px;background:var(--red-50, #fef2f2);border:1px solid var(--red-200, #fecaca);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <svg style="color:var(--red-600);width:18px;height:18px;"><use href="#i-clock"></use></svg>
                        <span style="font-size:0.85rem;color:var(--ink-900);">
                          <strong>Hạn nộp bài:</strong> ${item.extractedDeadline.title} · Hạn: ${item.extractedDeadline.due?.replace("T", " ")}
                        </span>
                      </div>
                      ${
                        item.isProcessed
                          ? `<span class="badge-draft" style="background:#d1fae5;color:#065f46;">✓ Đã thêm vào Công việc</span>`
                          : `<button type="button" class="button primary small" data-create-task-mail-id="${item.id}" style="font-size:0.78rem;padding:4px 10px;">
                               Tạo công việc từ Deadline
                             </button>`
                      }
                    </div>
                  `
                      : ""
                  }

                  ${
                    item.extractedExam
                      ? `
                    <div class="notif-extracted-box" style="margin-top:10px;padding:10px 14px;background:var(--amber-50, #fffbeb);border:1px solid var(--amber-200, #fde68a);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <svg style="color:var(--amber-600);width:18px;height:18px;"><use href="#i-exam"></use></svg>
                        <span style="font-size:0.85rem;color:var(--ink-900);">
                          <strong>Lịch thi:</strong> ${item.extractedExam.subject} (${item.extractedExam.code}) · Ngày ${item.extractedExam.date} lúc ${item.extractedExam.start}
                        </span>
                      </div>
                      ${
                        item.isExamProcessed
                          ? `<span class="badge-draft" style="background:#d1fae5;color:#065f46;">✓ Đã thêm vào Lịch thi</span>`
                          : `<button type="button" class="button secondary small" data-create-exam-mail-id="${item.id}" style="font-size:0.78rem;padding:4px 10px;">
                               Thêm vào Kế hoạch thi
                             </button>`
                      }
                    </div>
                  `
                      : ""
                  }

                  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:8px;border-top:1px solid var(--ink-100);">
                    <div style="display:flex;align-items:center;gap:8px;">
                      ${
                        isEmail
                          ? `<button type="button" class="button ghost small" data-open-mail-modal="${item.id}" style="font-size:0.78rem;padding:3px 10px;">
                               Xem nội dung email
                             </button>`
                          : ""
                      }
                    </div>
                    <div>
                      ${
                        isUnread
                          ? `<button type="button" class="button ghost small" data-mark-read-id="${item.id}" data-item-type="${item.itemType}" style="font-size:0.75rem;padding:2px 8px;min-height:28px;">
                               Đánh dấu đã đọc
                             </button>`
                          : `<span class="tiny muted">✓ Đã đọc</span>`
                      }
                    </div>
                  </div>
                </div>
              </div>
            `;
                })
                .join("")
            : renderEmptyState({
                icon: "i-bell",
                title: "Không có thông báo nào",
                description: filter === "emails"
                  ? "Chưa có email nào từ trường CMC được đồng bộ."
                  : filter === "unread"
                  ? "Tuyệt vời! Bạn không có thông báo hay thư chưa đọc nào."
                  : "Chưa có thông báo hoặc email nào trong danh sách.",
                actionText: ""
              })
        }
      </div>

      <!-- Container Modal Chi tiết Email -->
      <div id="emailModalHost"></div>
    </div>
  `;
}
