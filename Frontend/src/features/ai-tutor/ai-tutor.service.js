/**
 * UniStudy CMC - AI Assistant Service
 * Gọi endpoint /api/v1/ai/* của backend; mọi trạng thái lỗi được chuẩn hoá
 * thành object mà view/events dùng trực tiếp.
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { getDocuments, getNotes } from "../documents/documents.service.js";

const FALLBACK_ERROR = "Không kết nối được trợ lý AI. Vui lòng thử lại.";

// Trợ lý AI trả lời qua Gemini có thể mất 5–45 giây; timeout mặc định 20 giây
// của api-client sẽ huỷ request giữa chừng dù máy chủ vẫn đang trả lời.
const ASK_TIMEOUT_MS = 180000;

export function getLocalStudyData() {
  // Chỉ gửi văn bản/metadata; không gửi tệp nhị phân hoặc đường dẫn riêng tư.
  return {
    documents: getDocuments().slice(0, 500).map(({ id, title, subject, category, uploadedAt, text, content }) =>
      ({ id, title, subject, category, uploadedAt, content: String(text || content || "").slice(0, 1000) })),
    notes: [...getNotes()].sort((a, b) => Number(Boolean(b.isDifficult)) - Number(Boolean(a.isDifficult)))
      .slice(0, 500).map(({ id, title, subject, tags, content, isDifficult, updatedAt }) =>
        ({ id, title, subject, tags, content: String(content || "").slice(0, 1200), isDifficult, updatedAt }))
  };
}

export async function requestAssistant(endpoint, body = {}) {
  const res = await apiRequest(endpoint, { body, timeout: ASK_TIMEOUT_MS });
  if (!res.success) return { success: false, message: res.error || FALLBACK_ERROR };
  return res.data;
}

export const analyzeDifficultNotes = () => requestAssistant(ENDPOINTS.ai.difficultNotes, { studyData: getLocalStudyData() });
export const generateProgressAdvice = progress => requestAssistant(ENDPOINTS.ai.progressAdvice, { progress });
export const generateExamPlan = options => requestAssistant(ENDPOINTS.ai.examPlan, { ...options, studyData: getLocalStudyData() });
export const checkAnswer = options => requestAssistant(ENDPOINTS.ai.check, options);
export const summarizeText = text => requestAssistant(ENDPOINTS.ai.summarize, { text });
export const draftLeave = options => requestAssistant(ENDPOINTS.ai.draftLeave, options);

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
    body: { question, conversationId, studyData: getLocalStudyData() },
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
