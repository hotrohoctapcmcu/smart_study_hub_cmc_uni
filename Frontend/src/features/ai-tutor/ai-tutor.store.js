/**
 * UniStudy CMC - AI Assistant Store
 * Giữ hội thoại của panel trợ lý AI giữa các lần shell re-render
 * (shell dựng lại toàn bộ DOM mỗi khi state đổi).
 */
import { getAssistantStatus, askAssistant, listConversations, getConversation } from "./ai-tutor.service.js";

const freshId = () => `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
function savedId() { try { return localStorage.getItem('ai-active-conversation'); } catch { return null; } }
function rememberId(id) { try { localStorage.setItem('ai-active-conversation', id); } catch { /* Storage is optional. */ } }
let historyPromise = null;

export const aiChatState = {
  // "idle" | "loading" | "ready" | "unavailable"
  status: "idle",
  statusMessage: "",
  messages: [],
  pending: false,
  error: "",
  draft: "",
  conversationId: savedId() || freshId(),
  history: [],
  historyLoaded: false,
  historyError: ""
};

export function resetAiChat() {
  aiChatState.status = "idle";
  aiChatState.statusMessage = "";
  aiChatState.messages = [];
  aiChatState.pending = false;
  aiChatState.error = "";
  aiChatState.draft = "";
  aiChatState.conversationId = freshId();
  aiChatState.history = [];
  aiChatState.historyLoaded = false;
  aiChatState.historyError = "";
  historyPromise = null;
}

export function newConversation() {
  if (aiChatState.pending) return;
  aiChatState.messages = []; aiChatState.error = ''; aiChatState.draft = '';
  aiChatState.conversationId = freshId(); rememberId(aiChatState.conversationId);
}

export async function selectConversation(id) {
  if (aiChatState.pending) return;
  const item = await getConversation(id);
  aiChatState.conversationId = item.id; aiChatState.messages = item.messages;
  aiChatState.error = ''; aiChatState.draft = ''; rememberId(item.id);
}

export async function loadChatHistory(force = false) {
  if (historyPromise) return historyPromise;
  if (aiChatState.historyLoaded && !force) return;
  historyPromise = (async () => {
    try {
      const id = aiChatState.conversationId;
      aiChatState.history = await listConversations();
      if (!aiChatState.messages.length && !aiChatState.pending && aiChatState.conversationId === id && aiChatState.history.some(item => item.id === id)) await selectConversation(id);
      aiChatState.historyLoaded = true; aiChatState.historyError = '';
    } catch (error) { aiChatState.historyError = error.message; }
  })();
  try { await historyPromise; } finally { historyPromise = null; }
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
  const id = aiChatState.conversationId;
  const res = await askAssistant(question, aiChatState.conversationId);
  if (aiChatState.conversationId !== id) return { success: false };
  aiChatState.pending = false;

  if (!res.success) {
    aiChatState.error = res.error;
    return { success: false };
  }

  aiChatState.messages.push({ role: "assistant", text: res.answer });
  aiChatState.conversationId = res.conversationId || id; rememberId(aiChatState.conversationId);
  const entry = aiChatState.history.find(item => item.id === aiChatState.conversationId);
  if (!entry) aiChatState.history.unshift({ id: aiChatState.conversationId, title: question.slice(0, 100) });
  if (aiChatState.status !== "ready") {
    aiChatState.status = "ready";
    aiChatState.statusMessage = "";
  }
  return { success: true };
}
