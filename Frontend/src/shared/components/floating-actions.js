/**
 * UniStudy CMC - Floating Actions Component
 * Gom cụm nút nổi góc dưới phải viewport:
 * 1. Chuông thông báo (phía trên, cùng kích thước, mở trang Thông báo & số lượng chưa đọc)
 * 2. Trợ lý AI Chatbot (phía dưới, mở panel tại chỗ)
 * Tự động đảm bảo nằm dưới modal backdrop và không đè lên nhau.
 */
import { state, getUnreadNotificationCount, notifyStateChange } from "../../app/state.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { ASSETS } from "../config/assets.js";

export function renderFloatingActions() {
  const unreadCount = getUnreadNotificationCount();
  const isChatOpen = state.miniChatOpen;

  return `
    <div class="floating-actions-dock" id="floatingActionsDock" role="region" aria-label="Thao tác nhanh">
      <!-- 1. Nút Chuông Thông báo (Nằm phía trên nút Chatbot) -->
      <button 
        type="button" 
        class="floating-action-btn floating-bell-btn" 
        id="notifBellBtn" 
        aria-label="Xem thông báo" 
        title="Thông báo ${unreadCount > 0 ? `(${unreadCount} chưa đọc)` : ""}"
      >
        <svg><use href="#i-bell"></use></svg>
        ${
          unreadCount > 0
            ? `<span class="floating-bell-badge">${unreadCount}</span>`
            : ""
        }
      </button>

      <!-- 2. Nút Chatbot AI (Nằm ngay bên dưới nút Chuông) -->
      <button 
        type="button" 
        class="floating-action-btn floating-chat-btn ${isChatOpen ? "active" : ""}" 
        id="openMiniChatBtn" 
        aria-label="${isChatOpen ? "Đóng trợ lý UniStudy" : "Mở trợ lý UniStudy"}" 
        title="Trợ lý UniStudy CMC"
      >
        <svg><use href="${isChatOpen ? "#i-close" : "#i-spark"}"></use></svg>
      </button>

      <!-- Khung Trợ lý AI khi mở (Đặt cạnh bên, không bị nút chuông hay nút chat đè lên) -->
      ${isChatOpen ? renderMiniChatPanel() : ""}
    </div>
  `;
}

function renderMiniChatPanel() {
  return `
    <div class="mini-chat-panel" id="miniChatPanel" role="dialog" aria-label="Khung trợ lý học tập UniStudy">
      <div class="mini-chat-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:white;overflow:hidden;flex-shrink:0;">
            <img src="${ASSETS.fox.aiTutor}" alt="Linh vật cáo AI" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div>
            <strong style="font-size:0.9rem;display:block;">Trợ lý UniStudy CMC</strong>
            <small style="opacity:0.8;font-size:0.72rem;">Chế độ chờ kết nối dịch vụ</small>
          </div>
        </div>
        <button type="button" class="icon-button" id="closeMiniChatBtn" aria-label="Thu gọn trợ lý" style="width:28px;height:28px;border:none;background:rgba(255,255,255,0.2);color:white;border-radius:6px;cursor:pointer;">
          <svg style="width:16px;height:16px;"><use href="#i-close"></use></svg>
        </button>
      </div>

      <div class="mini-chat-body">
        <div style="padding:16px;border-radius:12px;background:white;border:1px solid var(--ink-200);margin-bottom:12px;">
          <div class="eyebrow" style="margin-bottom:6px;">Trạng thái kết nối</div>
          <p style="margin:0;font-size:0.85rem;color:var(--ink-800);line-height:1.5;">
            Xin chào bạn! Tính năng tư vấn thông minh bằng AI đang trong lộ trình phát triển. 
            Hiện tại dịch vụ AI chưa kết nối máy chủ backend.
          </p>
        </div>
      </div>

      <div class="mini-chat-footer">
        <input type="text" placeholder="Dịch vụ AI chưa kết nối backend..." disabled />
        <button type="button" class="button primary" disabled style="opacity:0.6;padding:0 12px;">
          <svg><use href="#i-send"></use></svg>
        </button>
      </div>
    </div>
  `;
}

export function attachFloatingActionsEvents(containerEl) {
  // 1. Chuông thông báo
  const bellBtn = containerEl.querySelector("#notifBellBtn");
  if (bellBtn) {
    bellBtn.addEventListener("click", () => {
      changeCurrentTabRoute("notifications");
    });
  }

  // 2. Chatbot toggle
  const chatBtn = containerEl.querySelector("#openMiniChatBtn");
  if (chatBtn) {
    chatBtn.addEventListener("click", () => {
      state.miniChatOpen = !state.miniChatOpen;
      notifyStateChange();
    });
  }

  // 3. Đóng Chatbot trong header panel
  const closeBtn = containerEl.querySelector("#closeMiniChatBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      state.miniChatOpen = false;
      notifyStateChange();
    });
  }
}
