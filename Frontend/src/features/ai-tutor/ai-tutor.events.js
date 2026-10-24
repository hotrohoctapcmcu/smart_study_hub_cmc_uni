/**
 * UniStudy CMC - AI Assistant Events
 * ===================================================================================
 * Gắn sự kiện cho Trợ lý AI Toàn màn hình:
 * 1. Logic Hiển thị Tin nhắn Tức thời (Vanilla JS - DOM Manipulation)
 *    - document.createElement tạo bong bóng câu hỏi người dùng
 *    - appendChild vào cuối vùng hiển thị chat ngay trước khi gọi API (fetch)
 *    - Tự động cuộn xuống đáy (scroll to bottom)
 * 2. Hiệu ứng Chờ Phản hồi - Typing Indicator
 *    - Tạo và append khối DOM avatar AI + 3 dấu chấm jumping dots
 *    - Khi server trả về kết quả: gọi .remove() và render chuỗi trả lời của AI
 *    - Nếu API lỗi: thông báo rõ ràng cho người dùng lập báo cáo phía Backend (không sửa backend)
 * 3. Quản lý Sidebar Lịch sử Chat:
 *    - Nút "Đoạn chat mới", chọn / xóa hội thoại cũ, toggle ẩn/hiện sidebar
 * ===================================================================================
 */
import { state, notifyStateChange } from "../../app/state.js";
import { escapeHtml } from "../../shared/utils/validation.js";
import { ASSETS } from "../../shared/config/assets.js";
import {
  renderConversation,
  renderHistoryList,
  renderPendingBubble
} from "./ai-tutor.view.js";
import {
  aiChatState,
  loadAssistantStatus,
  beginQuestion,
  askCurrentQuestion,
  createNewConversation,
  selectConversation,
  deleteConversation,
  toggleChatSidebar
} from "./ai-tutor.store.js";

function scrollBodyToEnd(panelEl) {
  const body = panelEl?.querySelector("#aiChatBody");
  if (body) {
    body.scrollTop = body.scrollHeight;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        body.scrollTop = body.scrollHeight;
      });
    }
  }
}

/**
 * Hiển thị tức thời tin nhắn người dùng và hiệu ứng Typing Indicator bằng DOM Manipulation
 */
async function submitQuestion(panelEl, text) {
  const questionText = String(text || "").trim();
  if (!questionText || aiChatState.pending) return;

  const body = panelEl?.querySelector("#aiChatBody");
  const input = panelEl?.querySelector("#aiChatInput");
  const sendBtn = panelEl?.querySelector("#aiChatSendBtn");

  // 1. Xóa nội dung ô input ngay lập tức
  if (input) {
    input.value = "";
    aiChatState.draft = "";
  }

  // 2. Xóa empty state hoặc lỗi cũ nếu đang hiển thị trong vùng chat
  if (body) {
    const emptyState = body.querySelector(".ai-chat-empty");
    if (emptyState) emptyState.remove();

    const oldNotice = body.querySelector(".ai-chat-notice");
    if (oldNotice) oldNotice.remove();

    const oldErrors = body.querySelectorAll(".ai-chat-error");
    oldErrors.forEach((el) => el.remove());

    // 3. Tạo bong bóng câu hỏi người dùng bằng document.createElement
    const userMsgEl = document.createElement("div");
    userMsgEl.className = "ai-msg ai-msg-user";
    const userBubble = document.createElement("div");
    userBubble.className = "ai-msg-bubble";
    userBubble.innerHTML = escapeHtml(questionText).replace(/\n/g, "<br />");
    userMsgEl.appendChild(userBubble);

    // Gắn vào cuối vùng chat TRƯỚC KHI gọi API fetch
    body.appendChild(userMsgEl);

    // 4. Tạo khối DOM hiệu ứng chờ phản hồi (Typing indicator: 3 dấu chấm nhảy)
    const typingIndicatorEl = document.createElement("div");
    typingIndicatorEl.className = "ai-msg ai-msg-assistant ai-typing-indicator";
    typingIndicatorEl.setAttribute("data-ai-pending", "");
    typingIndicatorEl.innerHTML = `
      <div class="ai-msg-avatar">
        <img src="${ASSETS.fox.aiTutor}" alt="Avatar Trợ lý AI" />
      </div>
      <div class="ai-msg-bubble ai-typing" aria-label="Trợ lý đang trả lời">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    body.appendChild(typingIndicatorEl);

    // Tự động cuộn xuống đáy
    scrollBodyToEnd(panelEl);

    // Khóa tạm thời nút gửi & ô nhập
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    // 5. Cập nhật state và bắt đầu gọi API
    beginQuestion(questionText);

    try {
      const res = await askCurrentQuestion(questionText);

      // 6. Xóa khối DOM hiệu ứng chờ phản hồi
      if (typingIndicatorEl && typeof typingIndicatorEl.remove === "function") {
        typingIndicatorEl.remove();
      }

      if (res && res.success) {
        // Render văn bản trả lời của AI vào đúng vị trí cuối
        const aiMsgEl = document.createElement("div");
        aiMsgEl.className = "ai-msg ai-msg-assistant";
        aiMsgEl.innerHTML = `
          <div class="ai-msg-avatar">
            <img src="${ASSETS.fox.aiTutor}" alt="Avatar Trợ lý AI" />
          </div>
          <div class="ai-msg-bubble">${escapeHtml(res.answer).replace(/\n/g, "<br />")}</div>
        `;
        body.appendChild(aiMsgEl);
      } else {
        // Render thông báo lỗi rõ ràng nếu API thất bại
        const errorEl = document.createElement("div");
        errorEl.className = "ai-chat-error";
        errorEl.setAttribute("role", "alert");
        errorEl.innerHTML = `
          <svg><use href="#i-bell"></use></svg>
          <div>
            <strong>Lỗi phản hồi từ dịch vụ AI</strong>
            <div>${escapeHtml(res?.error || "Không thể nhận phản hồi từ máy chủ.")}</div>
            <div style="font-size: 0.78rem; opacity: 0.85; margin-top: 4px;">
              (Lưu ý: Phía API Backend phản hồi lỗi. Vui lòng lập báo cáo gửi bạn phụ trách API để xử lý.)
            </div>
          </div>
        `;
        body.appendChild(errorEl);
      }
    } catch (err) {
      if (typingIndicatorEl && typeof typingIndicatorEl.remove === "function") {
        typingIndicatorEl.remove();
      }
      const errorEl = document.createElement("div");
      errorEl.className = "ai-chat-error";
      errorEl.setAttribute("role", "alert");
      errorEl.innerHTML = `
        <svg><use href="#i-bell"></use></svg>
        <div>
          <strong>Lỗi kết nối máy chủ</strong>
          <div>${escapeHtml(err.message || "Mạng hoặc máy chủ gặp sự cố.")}</div>
          <div style="font-size: 0.78rem; opacity: 0.85; margin-top: 4px;">
            (Lưu ý: Phía API Backend không thể phản hồi. Vui lòng lập báo cáo gửi bạn phụ trách API để xử lý.)
          </div>
        </div>
      `;
      body.appendChild(errorEl);
    } finally {
      // Mở khóa lại ô nhập và nút gửi
      if (input) {
        input.disabled = false;
        input.focus();
      }
      if (sendBtn) {
        sendBtn.disabled = false;
      }
      scrollBodyToEnd(panelEl);

      // Cập nhật lại danh sách lịch sử cuộc trò chuyện
      refreshHistorySidebar(panelEl);
    }
  } else {
    // Dự phòng trường hợp không có body trong DOM
    beginQuestion(questionText);
    await askCurrentQuestion(questionText);
    notifyStateChange();
  }
}

/**
 * Cập nhật danh sách các cuộc trò chuyện ở Sidebar
 */
function refreshHistorySidebar(panelEl) {
  const historyListEl = panelEl?.querySelector("#chatHistoryList");
  if (historyListEl) {
    historyListEl.innerHTML = renderHistoryList();
    attachHistoryListEvents(panelEl);
  }
}

/**
 * Gắn sự kiện cho các item trong danh sách lịch sử
 */
function attachHistoryListEvents(panelEl) {
  if (!panelEl) return;

  // Chọn cuộc trò chuyện cũ
  panelEl.querySelectorAll(".ai-history-item[data-conv-id]").forEach((item) => {
    item.addEventListener("click", (e) => {
      // Bỏ qua nếu click vào nút xóa
      if (e.target.closest(".ai-history-delete-btn")) return;

      const convId = item.getAttribute("data-conv-id");
      if (convId && convId !== aiChatState.conversationId) {
        selectConversation(convId);
        const body = panelEl.querySelector("#aiChatBody");
        if (body) {
          body.innerHTML = renderConversation();
          scrollBodyToEnd(panelEl);
        }
        refreshHistorySidebar(panelEl);
      }
    });
  });

  // Xóa cuộc trò chuyện cũ
  panelEl.querySelectorAll(".ai-history-delete-btn[data-delete-conv-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const convId = btn.getAttribute("data-delete-conv-id");
      if (convId) {
        deleteConversation(convId);
        const body = panelEl.querySelector("#aiChatBody");
        if (body) {
          body.innerHTML = renderConversation();
          scrollBodyToEnd(panelEl);
        }
        refreshHistorySidebar(panelEl);
      }
    });
  });
}

/**
 * Gắn toàn bộ sự kiện cho giao diện AI Tutor
 */
export function attachAiChatEvents(panelEl) {
  if (!panelEl) return;

  // 1. Nút Đóng / Thu gọn (dùng khi ở panel nổi)
  const closeBtn = panelEl.querySelector("#closeMiniChatBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      state.miniChatOpen = false;
      notifyStateChange();
    });
  }

  // 1b. Nút Mở rộng sang toàn màn hình (dùng ở panel nổi)
  const expandBtn = panelEl.querySelector("#expandMiniChatBtn");
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      state.miniChatOpen = false;
      import("../../app/workspace.js").then(({ changeCurrentTabRoute }) => {
        changeCurrentTabRoute("ai-tutor");
      });
    });
  }

  // 2. Nút Thử lại khi kết nối chưa sẵn sàng
  const retryBtn = panelEl.querySelector("#aiChatRetryBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      await loadAssistantStatus(true);
      notifyStateChange();
    });
  }

  // 3. Form gửi tin nhắn & Nút gửi
  const form = panelEl.querySelector("#aiChatForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = panelEl.querySelector("#aiChatInput")?.value || "";
      submitQuestion(panelEl, text);
    });
  }

  // 4. Input nhập liệu: Enter gửi, lưu draft
  const input = panelEl.querySelector("#aiChatInput");
  if (input) {
    input.addEventListener("input", () => {
      aiChatState.draft = input.value;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitQuestion(panelEl, input.value);
      }
    });
  }

  // 5. Nút "Đoạn chat mới"
  const newChatBtn = panelEl.querySelector("#newChatBtn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      createNewConversation();
      const body = panelEl.querySelector("#aiChatBody");
      if (body) {
        body.innerHTML = renderConversation();
        scrollBodyToEnd(panelEl);
      }
      refreshHistorySidebar(panelEl);
      const chatInput = panelEl.querySelector("#aiChatInput");
      if (chatInput) {
        chatInput.value = "";
        chatInput.focus();
      }
    });
  }

  // 6. Nút Toggle Ẩn / Hiện Sidebar Lịch sử
  const toggleBtn = panelEl.querySelector("#toggleChatSidebarBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const sidebar = panelEl.querySelector("#aiChatSidebar");
      if (sidebar) {
        sidebar.classList.toggle("collapsed");
        aiChatState.sidebarOpen = !sidebar.classList.contains("collapsed");
      }
    });
  }

  // 7. Gắn sự kiện cho danh sách lịch sử
  attachHistoryListEvents(panelEl);

  // 8. Gợi ý câu hỏi mẫu (dùng event delegation trên body)
  const body = panelEl.querySelector("#aiChatBody");
  if (body) {
    body.addEventListener("click", (e) => {
      const sugBtn = e.target.closest("[data-ai-suggestion]");
      if (sugBtn) {
        const text = sugBtn.getAttribute("data-ai-suggestion");
        submitQuestion(panelEl, text);
      }
    });
  }

  // Cuộn xuống đáy lúc khởi tạo
  scrollBodyToEnd(panelEl);
}

/**
 * Mở panel: kiểm tra trạng thái dịch vụ một lần
 */
export async function openAiChat() {
  if (aiChatState.status !== "idle") return;

  const dangKiemTra = loadAssistantStatus();
  notifyStateChange();
  await dangKiemTra;
  notifyStateChange();
}
