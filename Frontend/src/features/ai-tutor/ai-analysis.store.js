/** Giữ kết quả phân tích ngoài DOM để không mất khi shell dựng lại trang. */
import { notifyStateChange } from "../../app/state.js";

const analyses = new Map();

export function getAIAnalysis(key) {
  return analyses.get(key) || { pending: false, text: "", error: "" };
}

export const progressAnalysisKey = (period, date) => `progress:${period}:${date}`;

export async function runAIAnalysis(key, request, format) {
  if (getAIAnalysis(key).pending) return;
  const current = { pending: true, text: "", error: "" };
  analyses.set(key, current);
  notifyStateChange();
  try {
    const result = await request();
    if (result.success) current.text = format(result.data);
    else current.error = result.message || "Chưa thể phân tích. Vui lòng thử lại.";
  } catch {
    current.error = "Chưa thể phân tích. Vui lòng thử lại.";
  } finally {
    current.pending = false;
    notifyStateChange();
  }
}
