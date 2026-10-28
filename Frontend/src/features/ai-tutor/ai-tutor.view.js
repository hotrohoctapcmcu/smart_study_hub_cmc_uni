/**
 * UniStudy CMC - AI Assistant View
 * Nội dung panel trợ lý AI: trạng thái kết nối, hội thoại, đang xử lý,
 * lỗi và trạng thái rỗng. Chỉ dựng HTML, không gọi API.
 */
import { escapeHtml } from "../../shared/utils/validation.js";
import { ASSETS } from "../../shared/config/assets.js";
import { aiChatState } from "./ai-tutor.store.js";

const SUGGESTIONS = [
  "Giải thích đạo hàm bằng ví dụ dễ hiểu",
  "Cách lập kế hoạch ôn thi 2 tuần",
  "Tóm tắt khái niệm cấu trúc dữ liệu cây"
];

function renderStatusLine() {
  if (aiChatState.status === "idle" || aiChatState.status === "loading") {
    return "Đang kiểm tra dịch vụ…";
  }
  if (aiChatState.status === "unavailable") return "Đang thử kết nối lại…";
  return "Đã kết nối trợ lý AI";
}

function renderMessage({ role, text }) {
  const isUser = role === "user";
  return `
    <div class="ai-msg ${isUser ? "ai-msg-user" : "ai-msg-assistant"}">
      ${isUser ? "" : `<div class="ai-msg-avatar"><img src="${ASSETS.fox.aiTutor}" alt="" /></div>`}
      <div class="ai-msg-bubble">${escapeHtml(text).replace(/\n/g, "<br />")}</div>
    </div>
  `;
}

function renderConversation() {
  if (aiChatState.messages.length) {
    return aiChatState.messages.map(renderMessage).join("");
  }

  // Empty state: gợi ý câu hỏi mẫu
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
 * Bong bóng "đang trả lời" — chèn ngay khi gửi câu hỏi, trước khi có kết quả API.
 */
export function renderPendingBubble() {
  return `
    <div class="ai-msg ai-msg-assistant" data-ai-pending>
      <div class="ai-msg-avatar"><img src="${ASSETS.fox.aiTutor}" alt="" /></div>
      <div class="ai-msg-bubble ai-typing" aria-label="Trợ lý đang trả lời">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
}

function renderError() {
  if (!aiChatState.error) return "";
  return `
    <div class="ai-chat-error" role="alert">
      <svg><use href="#i-bell"></use></svg>
      <span>${escapeHtml(aiChatState.error)}</span>
      ${!aiChatState.pending && aiChatState.messages.at(-1)?.role === 'user' ? '<button type="button" class="button ghost small" id="aiQuestionRetryBtn">Gửi lại câu hỏi</button>' : ''}
    </div>
  `;
}

function renderComposer() {
  const disabled = aiChatState.pending || aiChatState.status !== "ready";
  const placeholder = aiChatState.status === "ready"
    ? "Nhập câu hỏi cho trợ lý…"
    : "Đang kết nối trợ lý AI…";

  return `
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
  `;
}

/**
 * Toàn bộ nội dung panel trợ lý AI (header + body + composer).
 */
export function renderAiChatPanel() {
  return `
    <div class="mini-chat-panel" id="miniChatPanel" role="dialog" aria-label="Khung trợ lý học tập UniStudy">
      <div class="mini-chat-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:white;overflow:hidden;flex-shrink:0;">
            <img src="${ASSETS.fox.aiTutor}" alt="Linh vật cáo AI" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div>
            <strong style="font-size:0.9rem;display:block;">Trợ lý UniStudy CMC</strong>
            <small style="opacity:0.8;font-size:0.72rem;">${renderStatusLine()}</small>
          </div>
        </div>
        <button type="button" class="icon-button" id="closeMiniChatBtn" aria-label="Thu gọn trợ lý" style="width:28px;height:28px;border:none;background:rgba(255,255,255,0.2);color:white;border-radius:6px;cursor:pointer;">
          <svg style="width:16px;height:16px;"><use href="#i-close"></use></svg>
        </button>
      </div>

      <div class="mini-chat-body" id="aiChatBody">
        ${aiChatState.status === "unavailable"
          ? `<div class="ai-chat-notice">
               <strong>Chưa kết nối được trợ lý AI</strong>
               <p>${escapeHtml(aiChatState.statusMessage || "Máy chủ chưa sẵn sàng. Vui lòng kiểm tra lại sau.")}</p>
               <button type="button" class="button ghost" id="aiChatRetryBtn">Kiểm tra lại</button>
             </div>`
          : aiChatState.status === "loading"
            ? `<div class="ai-chat-notice">
                 <strong>Đang kết nối trợ lý AI…</strong>
                 <p>Vui lòng chờ trong giây lát.</p>
               </div>`
            : renderConversation()}
        ${aiChatState.pending ? renderPendingBubble() : ""}
        ${renderError()}
      </div>

      ${renderComposer()}
    </div>
  `;
}
