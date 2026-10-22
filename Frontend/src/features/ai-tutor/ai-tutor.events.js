/**
 * UniStudy CMC - AI Assistant Events
 * Gắn sự kiện cho panel trợ lý AI: mở/đóng, gửi câu hỏi, gợi ý, thử lại.
 * Dữ liệu đi qua ai-tutor.store.js; shell tự dựng lại panel khi state đổi.
 */
import { state, notifyStateChange } from "../../app/state.js";
import { renderPendingBubble } from "./ai-tutor.view.js";
import {
  aiChatState,
  loadAssistantStatus,
  beginQuestion,
  askCurrentQuestion
} from "./ai-tutor.store.js";

function scrollBodyToEnd(panelEl) {
  const body = panelEl?.querySelector("#aiChatBody");
  if (body) body.scrollTop = body.scrollHeight;
}

/**
 * Gửi câu hỏi: hiện loading ngay, gọi API, rồi cập nhật lại panel.
 */
async function submitQuestion(panelEl, text) {
  const question = beginQuestion(text);
  if (!question) return;

  const body = panelEl?.querySelector("#aiChatBody");
  const input = panelEl?.querySelector("#aiChatInput");
  if (input) input.value = "";

  if (body) {
    body.insertAdjacentHTML("beforeend", renderPendingBubble());
    scrollBodyToEnd(panelEl);
  }

  await askCurrentQuestion(question);
  notifyStateChange();
}

export function attachAiChatEvents(panelEl) {
  if (!panelEl) return;

  const closeBtn = panelEl.querySelector("#closeMiniChatBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      state.miniChatOpen = false;
      notifyStateChange();
    });
  }

  const retryBtn = panelEl.querySelector("#aiChatRetryBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      await loadAssistantStatus(true);
      notifyStateChange();
    });
  }

  const form = panelEl.querySelector("#aiChatForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitQuestion(panelEl, panelEl.querySelector("#aiChatInput")?.value || "");
    });
  }

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

  panelEl.querySelectorAll("[data-ai-suggestion]").forEach((btn) => {
    btn.addEventListener("click", () => {
      submitQuestion(panelEl, btn.getAttribute("data-ai-suggestion"));
    });
  });

  scrollBodyToEnd(panelEl);
}

/**
 * Mở panel: kiểm tra trạng thái dịch vụ (một lần) rồi để shell render.
 * Hiện loading ngay trong lúc chờ, tránh panel trông như đã sẵn sàng.
 */
export async function openAiChat() {
  if (aiChatState.status !== "idle") return;

  const dangKiemTra = loadAssistantStatus();
  notifyStateChange();
  await dangKiemTra;
  notifyStateChange();
}
