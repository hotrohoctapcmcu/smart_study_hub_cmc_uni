/**
 * UniStudy CMC - AI Assistant View
 * ===================================================================================
 * Giao diện Trợ lý AI đồng bộ cho cả 2 ngữ cảnh (Chuẩn ChatGPT / Gemini):
 * 1. Chế độ Toàn màn hình (fullScreen = true):
 *    - Layout 2 cột: Sidebar Lịch sử Chat + Vùng Chat Chính.
 *    - Danh sách lịch sử và cuộc trò chuyện cuộn độc lập mượt mà.
 *    - Thanh chat (composer) ghim CỐ ĐỊNH ở đáy màn hình.
 * 2. Chế độ Khung Chat Nhỏ (fullScreen = false):
 *    - Kích thước cố định 380px x 520px, không bị co rút hay tràn layout.
 *    - Header + Body cuộn tin nhắn + Thanh nhập liệu ghim cố định ở đáy.
 * ===================================================================================
 */
import { escapeHtml } from "../../shared/utils/validation.js";
import { ASSETS } from "../../shared/config/assets.js";
import { aiChatState } from "./ai-tutor.store.js";

export const SUGGESTIONS = [
  "Giải thích đạo hàm bằng ví dụ dễ hiểu",
  "Cách lập kế hoạch ôn thi 2 tuần",
  "Tóm tắt khái niệm cấu trúc dữ liệu cây"
];

export function renderStatusLine() {
  if (aiChatState.status === "idle" || aiChatState.status === "loading") {
    return "Đang kiểm tra dịch vụ…";
  }
  if (aiChatState.status === "unavailable") return "Đang thử kết nối lại…";
  return "Đã kết nối trợ lý AI";
}

export function renderMessage({ role, text }) {
  const isUser = role === "user";
  return `
    <div class="ai-msg ${isUser ? "ai-msg-user" : "ai-msg-assistant"}">
      ${isUser ? "" : `<div class="ai-msg-avatar"><img src="${ASSETS.fox.aiTutor}" alt="Avatar Trợ lý AI" /></div>`}
      <div class="ai-msg-bubble">${escapeHtml(text).replace(/\n/g, "<br />")}</div>
    </div>
  `;
}

export function renderHistoryList() {
  const list = aiChatState.conversations || [];
  if (!list.length) {
    return `
      <div class="ai-history-empty">
        <svg style="width:24px;height:24px;margin:0 auto 6px;display:block;opacity:0.4;"><use href="#i-message"></use></svg>
        Chưa có cuộc trò chuyện nào.<br/>Nhấn "Đoạn chat mới" để bắt đầu!
      </div>
    `;
  }

  return list.map((c) => {
    const isActive = c.id === aiChatState.conversationId;
    return `
      <div class="ai-history-item ${isActive ? "active" : ""}" data-conv-id="${escapeHtml(c.id)}" role="button" tabindex="0">
        <span class="ai-history-title" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
        <button type="button" class="ai-history-delete-btn" data-delete-conv-id="${escapeHtml(c.id)}" title="Xóa đoạn chat này" aria-label="Xóa">
          <svg><use href="#i-trash"></use></svg>
        </button>
      </div>
    `;
  }).join("");
}

export function renderConversation() {
  if (aiChatState.messages.length) {
    return aiChatState.messages.map(renderMessage).join("");
  }

  // Empty state: Gợi ý câu hỏi mẫu
  return `
    <div class="ai-chat-empty">
      <div class="ai-chat-empty-icon">
        <img src="${ASSETS.fox.aiTutor}" alt="Linh vật cáo AI UniStudy" />
      </div>
      <strong>Bạn cần học gì hôm nay?</strong>
      <p>Đặt câu hỏi về kiến thức môn học, cách ôn thi hoặc nhờ trợ lý gợi ý kế hoạch học tập.</p>
      <div class="ai-chat-suggestions">
        ${SUGGESTIONS.map((s) => `
          <button type="button" class="ai-suggestion-btn" data-ai-suggestion="${escapeHtml(s)}">${escapeHtml(s)}</button>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Khối DOM Typing Indicator (3 dấu chấm nhảy lên xuống)
 */
export function renderPendingBubble() {
  return `
    <div class="ai-msg ai-msg-assistant" data-ai-pending>
      <div class="ai-msg-avatar"><img src="${ASSETS.fox.aiTutor}" alt="Avatar Trợ lý AI" /></div>
      <div class="ai-msg-bubble ai-typing" aria-label="Trợ lý đang trả lời">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
}

export function renderError() {
  if (!aiChatState.error) return "";
  return `
    <div class="ai-chat-error" role="alert">
      <svg><use href="#i-bell"></use></svg>
      <div>
        <strong>Không thể nhận phản hồi</strong>
        <div>${escapeHtml(aiChatState.error)}</div>
        <div style="font-size: 0.76rem; opacity: 0.85; margin-top: 3px;">
          (Lưu ý: Phía API Backend phản hồi lỗi. Vui lòng lập báo cáo gửi bạn phụ trách API để xử lý.)
        </div>
      </div>
    </div>
  `;
}

function renderChatBodyContent() {
  if (aiChatState.status === "unavailable") {
    return `
      <div class="ai-chat-notice">
        <strong>Chưa kết nối được trợ lý AI</strong>
        <p>${escapeHtml(aiChatState.statusMessage || "Máy chủ chưa sẵn sàng hoặc API bị ngắt kết nối. Vui lòng kiểm tra lại sau.")}</p>
        <button type="button" class="button ghost" id="aiChatRetryBtn">Kiểm tra lại</button>
      </div>
    `;
  }
  if (aiChatState.status === "loading") {
    return `
      <div class="ai-chat-notice">
        <strong>Đang kết nối trợ lý AI…</strong>
        <p>Vui lòng chờ trong giây lát.</p>
      </div>
    `;
  }
  return `
    ${renderConversation()}
    ${aiChatState.pending ? renderPendingBubble() : ""}
    ${renderError()}
  `;
}

/**
 * Render Trợ lý AI theo 2 chế độ: Toàn màn hình hoặc Khung nhỏ
 * @param {object} options
 * @param {boolean} [options.fullScreen=true] - true: toàn màn hình; false: khung chat popover nhỏ
 */
export function renderAiChatPanel(options = {}) {
  const isFullScreen = options.fullScreen !== false;
  const isSidebarOpen = aiChatState.sidebarOpen;
  const disabled = aiChatState.pending || aiChatState.status !== "ready";
  const placeholder = aiChatState.status === "ready"
    ? "Nhập câu hỏi cho trợ lý (nhấn Enter để gửi)..."
    : "Đang kết nối trợ lý AI…";

  // 1. CHẾ ĐỘ TOÀN MÀN HÌNH (FULL-SCREEN WORKSPACE PAGE)
  if (isFullScreen) {
    return `
      <div class="ai-tutor-fullscreen-container" id="aiTutorFullscreenContainer" role="region" aria-label="Trợ lý AI UniStudy">
        <!-- SIDEBAR LỊCH SỬ CHAT -->
        <aside class="ai-chat-sidebar ${isSidebarOpen ? "" : "collapsed"}" id="aiChatSidebar">
          <div class="ai-sidebar-header">
            <button type="button" class="ai-new-chat-btn" id="newChatBtn" title="Bắt đầu cuộc trò chuyện mới">
              <svg><use href="#i-plus"></use></svg>
              <span>Đoạn chat mới</span>
            </button>
          </div>
          <div class="ai-sidebar-content">
            <div class="ai-sidebar-label">Lịch sử trò chuyện</div>
            <div class="ai-history-list" id="chatHistoryList">
              ${renderHistoryList()}
            </div>
          </div>
        </aside>

        <!-- VÙNG CHAT CHÍNH (CỐ ĐỊNH CHIỀU CAO, CUỘN ĐỘC LẬP) -->
        <main class="ai-chat-main" id="aiChatMain">
          <header class="ai-chat-main-header">
            <div class="ai-header-left">
              <button type="button" class="ai-toggle-sidebar-btn" id="toggleChatSidebarBtn" title="Ẩn/Hiện Lịch sử chat" aria-label="Đóng mở lịch sử">
                <svg><use href="#i-menu"></use></svg>
              </button>
              <div class="ai-header-avatar">
                <img src="${ASSETS.fox.aiTutor}" alt="Avatar Trợ lý AI" />
              </div>
              <div class="ai-header-info">
                <h2 class="ai-header-title">Trợ lý AI UniStudy</h2>
                <div class="ai-header-status">
                  <span class="ai-status-indicator ${aiChatState.status !== "ready" ? "connecting" : ""}"></span>
                  <span>${renderStatusLine()}</span>
                </div>
              </div>
            </div>
          </header>

          <!-- Vùng cuộn hiển thị tin nhắn (flex: 1, overflow-y: auto) -->
          <div class="ai-chat-body" id="aiChatBody">
            ${renderChatBodyContent()}
          </div>

          <!-- Thanh nhập liệu ghim CỐ ĐỊNH ở đáy (chuẩn ChatGPT / Gemini) -->
          <div class="ai-chat-composer-container">
            <form class="ai-chat-form mini-chat-footer" id="aiChatForm">
              <input
                type="text"
                id="aiChatInput"
                value="${escapeHtml(aiChatState.draft)}"
                placeholder="${placeholder}"
                autocomplete="off"
                maxlength="4000"
                ${disabled ? "disabled" : ""}
              />
              <button type="submit" class="ai-chat-send-btn button primary" id="aiChatSendBtn" ${disabled ? "disabled" : ""} aria-label="Gửi câu hỏi">
                <svg><use href="#i-send"></use></svg>
              </button>
            </form>
          </div>
        </main>
      </div>
    `;
  }

  // 2. CHẾ ĐỘ KHUNG CHAT NHỎ (MINI CHAT POPOVER NỔI Ở GÓC PHẢI - CỐ ĐỊNH 380px x 520px)
  return `
    <div class="mini-chat-panel" id="miniChatPanel" role="dialog" aria-label="Khung trợ lý học tập UniStudy">
      <!-- Header khung chat nhỏ -->
      <div class="mini-chat-header">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <div style="width:30px;height:30px;border-radius:50%;background:white;overflow:hidden;flex-shrink:0;">
            <img src="${ASSETS.fox.aiTutor}" alt="Linh vật cáo AI" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div style="min-width:0;">
            <strong style="font-size:0.88rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Trợ lý UniStudy CMC</strong>
            <small style="opacity:0.82;font-size:0.7rem;display:block;">${renderStatusLine()}</small>
          </div>
        </div>
        <div class="mini-chat-header-actions">
          <button type="button" class="mini-chat-action-btn" id="newChatBtn" title="Bắt đầu đoạn chat mới" aria-label="Đoạn chat mới">
            <svg><use href="#i-plus"></use></svg>
          </button>
          <button type="button" class="mini-chat-action-btn" id="expandMiniChatBtn" title="Mở toàn màn hình" aria-label="Mở toàn màn hình">
            <svg><use href="#i-grid"></use></svg>
          </button>
          <button type="button" class="mini-chat-action-btn" id="closeMiniChatBtn" title="Đóng" aria-label="Đóng">
            <svg><use href="#i-close"></use></svg>
          </button>
        </div>
      </div>

      <!-- Vùng hiển thị tin nhắn (cuộn độc lập) -->
      <div class="mini-chat-body" id="aiChatBody">
        ${renderChatBodyContent()}
      </div>

      <!-- Thanh chat cố định ở đáy khung nhỏ -->
      <form class="mini-chat-footer" id="aiChatForm">
        <input
          type="text"
          id="aiChatInput"
          value="${escapeHtml(aiChatState.draft)}"
          placeholder="${placeholder}"
          autocomplete="off"
          maxlength="4000"
          ${disabled ? "disabled" : ""}
        />
        <button type="submit" class="button primary" id="aiChatSendBtn" ${disabled ? "disabled" : ""} aria-label="Gửi câu hỏi">
          <svg><use href="#i-send"></use></svg>
        </button>
      </form>
    </div>
  `;
}
