/**
 * UniStudy CMC - AI Assistant Store
 * Giữ hội thoại của panel trợ lý AI giữa các lần shell re-render
 * (shell dựng lại toàn bộ DOM mỗi khi state đổi).
 */
import { getAssistantStatus, askAssistant } from "./ai-tutor.service.js";

export const aiChatState = {
  // "idle" | "loading" | "ready" | "unavailable"
  status: "idle",
  statusMessage: "",
  messages: [],
  pending: false,
  error: "",
  draft: "",
  conversationId: `ai-${Date.now()}`
};

export function resetAiChat() {
  aiChatState.status = "idle";
  aiChatState.statusMessage = "";
  aiChatState.messages = [];
  aiChatState.pending = false;
  aiChatState.error = "";
  aiChatState.draft = "";
  aiChatState.conversationId = `ai-${Date.now()}`;
}

/**
 * Kiểm tra dịch vụ AI. Chỉ gọi mạng ở lần đầu hoặc khi force = true.
 *
 * Chỉ khoá khung chat khi máy chủ trả lời DỨT KHOÁT là chưa sẵn sàng. Nếu lần
 * kiểm tra đầu không gọi được máy chủ (mạng chập chờn lúc mở app), vẫn mở ô
 * nhập để người dùng chat luôn — lỗi thật sẽ hiện khi gửi câu hỏi.
 */
export async function loadAssistantStatus(force = false) {
  if (!force && aiChatState.status !== "idle") return aiChatState;

  aiChatState.status = "loading";
  const res = await getAssistantStatus();

  const khongGoiDuocMayChu = !res.success;
  aiChatState.status = res.ready || khongGoiDuocMayChu ? "ready" : "unavailable";
  aiChatState.statusMessage = khongGoiDuocMayChu
    ? ""
    : (res.message || (res.ready ? "Trợ lý AI sẵn sàng." : ""));
  return aiChatState;
}

/**
 * Ghi nhận câu hỏi của người dùng và bật trạng thái đang xử lý (loading).
 * Tách khỏi askCurrentQuestion để view kịp hiển thị loading trước khi chờ API.
 * @returns {string|null} câu hỏi đã chuẩn hoá, null nếu không hợp lệ
 */
export function beginQuestion(text) {
  const question = String(text || "").trim();
  if (!question || aiChatState.pending) return null;

  aiChatState.messages.push({ role: "user", text: question });
  aiChatState.pending = true;
  aiChatState.error = "";
  aiChatState.draft = "";
  return question;
}

/**
 * Gọi API cho câu hỏi vừa ghi nhận ở beginQuestion().
 * @returns {Promise<{success: boolean}>}
 */
export async function askCurrentQuestion(question) {
  const res = await askAssistant(question, aiChatState.conversationId);
  aiChatState.pending = false;

  if (!res.success) {
    aiChatState.error = res.error;
    return { success: false };
  }

  aiChatState.messages.push({ role: "assistant", text: res.answer });
  if (aiChatState.status !== "ready") {
    aiChatState.status = "ready";
    aiChatState.statusMessage = "";
  }
  return { success: true };
}
