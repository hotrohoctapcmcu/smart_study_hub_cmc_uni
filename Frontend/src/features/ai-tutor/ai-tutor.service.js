/**
 * UniStudy CMC - AI Assistant Service
 * Gọi endpoint /api/v1/ai/* của backend; mọi trạng thái lỗi được chuẩn hoá
 * thành object mà view/events dùng trực tiếp.
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";

const FALLBACK_ERROR = "Không kết nối được trợ lý AI. Vui lòng thử lại.";

// Trợ lý AI trả lời qua Gemini có thể mất 5–45 giây; timeout mặc định 20 giây
// của api-client sẽ huỷ request giữa chừng dù máy chủ vẫn đang trả lời.
const ASK_TIMEOUT_MS = 90000;

/**
 * Trạng thái dịch vụ trợ lý AI.
 * @returns {Promise<{success: boolean, ready: boolean, message: string}>}
 */
export async function getAssistantStatus() {
  const res = await apiRequest(ENDPOINTS.ai.status);
  if (!res.success) {
    return { success: false, ready: false, message: res.error || FALLBACK_ERROR };
  }
  const data = res.data?.data || {};
  return {
    success: true,
    ready: Boolean(data.ready),
    model: data.model || "Trợ lý AI",
    message: data.message || ""
  };
}

/**
 * Gửi câu hỏi tới trợ lý AI.
 * @param {string} question
 * @param {string} [conversationId] - giữ ngữ cảnh hội thoại giữa các lượt
 * @returns {Promise<{success: boolean, answer?: string, error?: string, code?: string}>}
 */
export async function askAssistant(question, conversationId) {
  const res = await apiRequest(ENDPOINTS.ai.ask, {
    body: conversationId ? { question, conversationId } : { question },
    timeout: ASK_TIMEOUT_MS
  });

  if (!res.success) {
    return { success: false, error: res.error || FALLBACK_ERROR };
  }

  const answer = res.data?.data?.answer;
  if (!answer) {
    return { success: false, error: "Trợ lý AI không trả về nội dung." };
  }

  return { success: true, answer };
}
