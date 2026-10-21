/**
 * UniStudy CMC - School Email Sync & Analysis View (Sprint 2)
 */
import { getSchoolEmails } from "./school-email.service.js";
import { formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";

export function renderSchoolEmailView(uiState = {}) {
  const emails = getSchoolEmails();
  const filter = uiState.filter || "all"; // "all" | "unread" | "has_deadline"
  const searchQuery = (uiState.searchQuery || "").trim().toLowerCase();

  let filtered = emails.filter((m) => {
    if (filter === "unread" && m.isRead) return false;
    if (filter === "has_deadline" && !m.extractedDeadline && !m.extractedExam) return false;
    if (searchQuery) {
      const matchSubject = m.subject.toLowerCase().includes(searchQuery);
      const matchSender = m.senderName.toLowerCase().includes(searchQuery);
      const matchBody = m.body.toLowerCase().includes(searchQuery);
      if (!matchSubject && !matchSender && !matchBody) return false;
    }
    return true;
  });

  const unreadCount = emails.filter((m) => !m.isRead).length;
  const deadlineCount = emails.filter((m) => m.extractedDeadline || m.extractedExam).length;

  return `
    <div class="school-email-container">
      <!-- Header -->
      <div class="school-email-header">
        <div>
          <span class="eyebrow"><svg><use href="#i-bell"></use></svg> Hòm thư Outlook CMC</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Đồng bộ & Phân tích Email trường</h1>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="button primary" id="syncEmailNowBtn">
            <svg><use href="#i-refresh"></use></svg>
            <span>Đồng bộ hòm thư trường</span>
          </button>
        </div>
      </div>

      <!-- Banner minh bạch ranh giới API -->
      <div class="school-email-api-banner">
        <svg style="color:var(--violet-600);width:22px;height:22px;flex-shrink:0;"><use href="#i-spark"></use></svg>
        <div>
          <strong>Giao diện phân tích email sinh viên CMC:</strong>
          <span style="font-size:0.88rem;display:block;opacity:0.9;">
            Tự động nhận diện bài tập, hạn chót và thông báo lịch thi từ email của giảng viên và nhà trường. 
            Kết nối API Microsoft 365 / IMAP sẽ kích hoạt khi có hợp đồng bảo mật xác nhận.
          </span>
        </div>
      </div>

      <!-- Thanh công cụ lọc & tìm kiếm -->
      <div class="email-controls-card">
        <div class="doc-search-row">
          <div class="doc-search-input-wrap">
            <svg><use href="#i-search"></use></svg>
            <input 
              type="search" 
              id="emailSearchInput" 
              placeholder="Tìm kiếm thư từ giảng viên, phòng đào tạo hoặc môn học..." 
              value="${searchQuery}"
            />
          </div>

          <div class="email-tabs-filter" role="tablist">
            <button type="button" class="view-mode-btn ${filter === "all" ? "active" : ""}" data-email-filter="all">Tất cả (${emails.length})</button>
            <button type="button" class="view-mode-btn ${filter === "unread" ? "active" : ""}" data-email-filter="unread">Chưa đọc (${unreadCount})</button>
            <button type="button" class="view-mode-btn ${filter === "has_deadline" ? "active" : ""}" data-email-filter="has_deadline">Có hạn nộp / Lịch thi (${deadlineCount})</button>
          </div>
        </div>
      </div>

      <!-- Danh sách Email -->
      <div class="email-list-wrapper">
        ${
          filtered.length > 0
            ? filtered
                .map((mail) => {
                  return `
              <div class="email-item-card ${mail.isRead ? "" : "unread"}" data-mail-id="${mail.id}">
                <div class="email-item-header">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span class="email-avatar-icon">
                      <svg><use href="#i-user"></use></svg>
                    </span>
                    <div>
                      <strong class="email-sender-name">${mail.senderName}</strong>
                      <span class="email-sender-address">${mail.sender}</span>
                    </div>
                  </div>
                  <span class="email-date-text">${formatDateTimeVN(mail.date)}</span>
                </div>

                <div class="email-subject-line">
                  <span class="email-subject-title">${mail.subject}</span>
                </div>

                <p class="email-preview-text">${mail.preview}</p>

                <!-- KHỐI PHÂN TÍCH AI: TỰ ĐỘNG PHÁT HIỆN DEADLINE -->
                ${
                  mail.extractedDeadline
                    ? `
                  <div class="extracted-deadline-box">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <svg style="color:var(--red-600);width:18px;height:18px;"><use href="#i-clock"></use></svg>
                      <div>
                        <strong>Phát hiện Deadline:</strong> ${mail.extractedDeadline.title} (${mail.extractedDeadline.subject})
                        <span style="display:block;font-size:0.8rem;color:var(--red-700);">Hạn chót: ${mail.extractedDeadline.due.replace("T", " ")}</span>
                      </div>
                    </div>
                    <div>
                      ${
                        mail.isProcessed
                          ? `<span class="badge-draft" style="background:var(--emerald-50);color:var(--emerald-700);">✓ Đã thêm vào Công việc</span>`
                          : `<button type="button" class="button primary small" data-add-deadline-task="${mail.id}">
                               <svg><use href="#i-plus"></use></svg>
                               <span>Thêm vào Công việc & Deadline</span>
                             </button>`
                      }
                    </div>
                  </div>
                `
                    : ""
                }

                <!-- KHỐI PHÂN TÍCH AI: TỰ ĐỘNG PHÁT HIỆN LỊCH THI -->
                ${
                  mail.extractedExam
                    ? `
                  <div class="extracted-exam-box">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <svg style="color:var(--violet-600);width:18px;height:18px;"><use href="#i-exam"></use></svg>
                      <div>
                        <strong>Phát hiện Lịch thi:</strong> ${mail.extractedExam.subject} (${mail.extractedExam.code})
                        <span style="display:block;font-size:0.8rem;color:var(--violet-700);">Ngày thi: ${mail.extractedExam.date} lúc ${mail.extractedExam.start} (Phòng ${mail.extractedExam.room})</span>
                      </div>
                    </div>
                    <div>
                      ${
                        mail.isExamProcessed
                          ? `<span class="badge-draft" style="background:var(--emerald-50);color:var(--emerald-700);">✓ Đã thêm vào Kế hoạch thi</span>`
                          : `<button type="button" class="button primary small" data-add-exam-plan="${mail.id}">
                               <svg><use href="#i-plus"></use></svg>
                               <span>Thêm vào Kế hoạch thi</span>
                             </button>`
                      }
                    </div>
                  </div>
                `
                    : ""
                }

                <div class="email-item-footer">
                  <button type="button" class="button ghost small" data-read-mail-detail="${mail.id}">
                    Xem toàn bộ email
                  </button>
                </div>
              </div>
            `;
                })
                .join("")
            : emails.length === 0
            ? renderEmptyState({
                icon: "i-bell",
                title: "Chưa có email được đồng bộ",
                description: "Chưa kết nối cổng thư sinh viên CMC (đang chờ API trường). Dữ liệu email và deadline trích xuất sẽ hiển thị tại đây khi hệ thống được tích hợp.",
                actionText: "Kiểm tra kết nối",
                actionDataAttr: 'id="emptyCheckEmailBtn"'
              })
            : renderEmptyState({
                icon: "i-search",
                title: "Không tìm thấy thư nào phù hợp",
                description: "Thử tìm kiếm với từ khóa khác hoặc đặt lại bộ lọc thư."
              })
        }
      </div>

      <!-- Modal Container -->
      <div id="schoolEmailModalContainer"></div>
    </div>
  `;
}

/**
 * Modal xem chi tiết nội dung email
 */
export function renderEmailDetailModal(mail) {
  return `
    <div class="modal-backdrop" id="emailDetailModal" role="dialog" aria-modal="true" aria-labelledby="emailDetailSubject">
      <div class="modal-card" style="max-width:680px;">
        <button type="button" class="icon-button modal-close" data-close-modal aria-label="Đóng">
          <svg><use href="#i-close"></use></svg>
        </button>

        <span class="eyebrow">Hộp thư đến · @student.cmcu.edu.vn</span>
        <h2 id="emailDetailSubject" style="margin:4px 0 10px;font-size:1.35rem;color:var(--ink-950);">${mail.subject}</h2>

        <div style="background:var(--ink-50);padding:12px;border-radius:10px;margin-bottom:16px;border:1px solid var(--ink-200);font-size:0.85rem;">
          <div style="margin-bottom:4px;">Từ: <strong>${mail.sender}</strong></div>
          <div style="color:var(--ink-600);">Thời gian: ${formatDateTimeVN(mail.date)}</div>
        </div>

        <div style="white-space:pre-wrap;line-height:1.6;font-size:0.92rem;color:var(--ink-800);background:white;padding:16px;border-radius:10px;border:1px solid var(--ink-200);margin-bottom:16px;max-height:360px;overflow-y:auto;">
          ${mail.body}
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="button primary" data-close-modal>
            Đóng email
          </button>
        </div>
      </div>
    </div>
  `;
}
