/**
 * UniStudy CMC - AI Assistant Store
 * ===================================================================================
 * Quản lý trạng thái hội thoại và lịch sử trò chuyện của Trợ lý AI:
 * - Lưu trữ danh sách các đoạn chat cũ (localStorage)
 * - Tạo đoạn chat mới, chuyển đổi giữa các cuộc hội thoại
 * - Giữ trạng thái kết nối, tin nhắn, loading và lỗi
 * ===================================================================================
 */
import { getAssistantStatus, askAssistant } from "./ai-tutor.service.js";

const STORAGE_KEY = "unistudy_ai_chat_conversations";

function loadSavedConversations() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversationsToStorage(list) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30))); // Giữ tối đa 30 cuộc hội thoại
  } catch {}
}

export const aiChatState = {
  // "idle" | "loading" | "ready" | "unavailable"
  status: "idle",
  statusMessage: "",
  messages: [],
  pending: false,
  error: "",
  draft: "",
  conversationId: `ai-${Date.now()}`,
  sidebarOpen: true,
  conversations: loadSavedConversations()
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
 * Tạo một cuộc trò chuyện mới
 */
export function createNewConversation() {
  aiChatState.conversationId = `ai-${Date.now()}`;
  aiChatState.messages = [];
  aiChatState.error = "";
  aiChatState.draft = "";
  aiChatState.pending = false;
  return aiChatState.conversationId;
}

/**
 * Chọn và mở một cuộc trò chuyện cũ từ lịch sử
 */
export function selectConversation(convId) {
  const conv = aiChatState.conversations.find((c) => c.id === convId);
  if (conv) {
    aiChatState.conversationId = conv.id;
    aiChatState.messages = Array.isArray(conv.messages) ? [...conv.messages] : [];
    aiChatState.error = "";
    aiChatState.draft = "";
    aiChatState.pending = false;
    return true;
  }
  return false;
}

/**
 * Xóa một cuộc trò chuyện khỏi lịch sử
 */
export function deleteConversation(convId) {
  aiChatState.conversations = aiChatState.conversations.filter((c) => c.id !== convId);
  saveConversationsToStorage(aiChatState.conversations);

  if (aiChatState.conversationId === convId) {
    createNewConversation();
  }
}

/**
 * Cập nhật lưu hội thoại hiện tại vào danh sách lịch sử
 */
export function syncCurrentConversationToHistory() {
  if (aiChatState.messages.length === 0) return;

  const firstUserMsg = aiChatState.messages.find((m) => m.role === "user");
  const title = firstUserMsg ? firstUserMsg.text.slice(0, 42).trim() : "Đoạn chat mới";

  const existingIdx = aiChatState.conversations.findIndex((c) => c.id === aiChatState.conversationId);
  const convRecord = {
    id: aiChatState.conversationId,
    title,
    updatedAt: new Date().toISOString(),
    messages: [...aiChatState.messages]
  };

  if (existingIdx !== -1) {
    aiChatState.conversations[existingIdx] = convRecord;
  } else {
    aiChatState.conversations.unshift(convRecord);
  }

  saveConversationsToStorage(aiChatState.conversations);
}

/**
 * Toggle ẩn / hiện sidebar lịch sử
 */
export function toggleChatSidebar() {
  aiChatState.sidebarOpen = !aiChatState.sidebarOpen;
  return aiChatState.sidebarOpen;
}

/**
 * Kiểm tra dịch vụ AI. Chỉ gọi mạng ở lần đầu hoặc khi force = true.
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
 */
export function beginQuestion(text) {
  const question = String(text || "").trim();
  if (!question || aiChatState.pending) return null;

  aiChatState.messages.push({ role: "user", text: question });
  aiChatState.pending = true;
  aiChatState.error = "";
  aiChatState.draft = "";
  syncCurrentConversationToHistory();
  return question;
}

/**
 * Gọi API cho câu hỏi vừa ghi nhận ở beginQuestion().
 */
export async function askCurrentQuestion(question) {
  const res = await askAssistant(question, aiChatState.conversationId);
  aiChatState.pending = false;

  if (!res.success) {
    aiChatState.error = res.error;
    return { success: false, error: res.error };
  }

  aiChatState.messages.push({ role: "assistant", text: res.answer });
  if (aiChatState.status !== "ready") {
    aiChatState.status = "ready";
    aiChatState.statusMessage = "";
  }
  syncCurrentConversationToHistory();
  return { success: true, answer: res.answer };
}
