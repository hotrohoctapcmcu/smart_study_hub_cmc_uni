import { workspaceRequest } from "../../shared/services/workspace-api.js";
import { getLocalStudyData } from "../ai-tutor/ai-tutor.service.js";

export const aiRequest = (method, path, body) => workspaceRequest(method, `/ai${path}`, { body, timeout: 180000 });
export const studyData = getLocalStudyData;
export const todayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function readDraft(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeDraft(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The form remains usable if storage is full. */ }
}
