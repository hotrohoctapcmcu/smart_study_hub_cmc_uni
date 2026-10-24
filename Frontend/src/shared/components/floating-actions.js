/**
 * UniStudy CMC - Floating Actions Component
 * Gom cụm nút nổi góc dưới phải viewport:
 * 1. Chuông thông báo (phía trên, cùng kích thước, mở trang Thông báo & số lượng chưa đọc)
 * 2. Trợ lý AI Chatbot (phía dưới, mở panel tại chỗ)
 * Tự động đảm bảo nằm dưới modal backdrop và không đè lên nhau.
 */
import { state, getUnreadNotificationCount, notifyStateChange } from "../../app/state.js";
import { changeCurrentTabRoute, getActiveTab } from "../../app/workspace.js";
import { renderAiChatPanel } from "../../features/ai-tutor/ai-tutor.view.js";
import { attachAiChatEvents, openAiChat } from "../../features/ai-tutor/ai-tutor.events.js";

export function renderFloatingActions() {
  const activeTab = getActiveTab();
  const currentRouteId = activeTab?.routeId || "";
  // Khi đang ở trang Trợ lý AI toàn màn hình, không hiển thị cụm nút nổi để thanh chat hiển thị trọn vẹn, không bị đè nút gửi
  if (currentRouteId === "ai-tutor") {
    return "";
  }

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
      ${isChatOpen ? renderAiChatPanel({ fullScreen: false }) : ""}
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
      // Lần mở đầu tiên: kiểm tra dịch vụ AI rồi shell tự render lại panel
      if (state.miniChatOpen) openAiChat();
    });
  }

  // 3. Nút phóng to toàn màn hình từ khung chat nhỏ
  const expandBtn = containerEl.querySelector("#expandMiniChatBtn");
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      state.miniChatOpen = false;
      changeCurrentTabRoute("ai-tutor");
    });
  }

  // 4. Sự kiện trong panel trợ lý AI (đóng, gửi, gợi ý, thử lại)
  attachAiChatEvents(containerEl.querySelector("#miniChatPanel"));
}
