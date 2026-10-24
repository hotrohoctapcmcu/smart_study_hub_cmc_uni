/**
 * UniStudy CMC - AI Tutor Page (Toàn màn hình)
 * ===================================================================================
 * Trang "Trợ lý AI" trong workspace:
 * - Mở rộng toàn diện tích (Full-screen), loại bỏ khung hẹp ở giữa màn hình.
 * - Bố cục Flexbox 2 cột: Sidebar Lịch sử Chat + Vùng Chat Chính.
 * - Dùng chung ai-tutor.store.js với panel nổi để dữ liệu luôn đồng bộ.
 * ===================================================================================
 */
import { renderAiChatPanel } from "./ai-tutor.view.js";
import { attachAiChatEvents, openAiChat } from "./ai-tutor.events.js";

/**
 * Mount trang Trợ lý AI toàn màn hình vào content pane.
 * @param {HTMLElement} containerEl
 */
export async function mountAiTutor(containerEl) {
  if (!containerEl) return;

  // Kích hoạt chế độ Full-screen (loại bỏ padding hạn chế kích thước)
  containerEl.classList.add("workspace-pane-ai-tutor");

  // Render toàn bộ layout 2 phần: Sidebar Lịch sử Chat + Vùng Chat Chính
  containerEl.innerHTML = renderAiChatPanel({ fullScreen: true });

  // Trên trang toàn màn hình, không cần nút đóng kiểu thu nhỏ về góc
  const closeBtn = containerEl.querySelector("#closeMiniChatBtn");
  if (closeBtn) closeBtn.style.display = "none";

  const panel = containerEl.querySelector("#aiTutorFullscreenContainer") || containerEl.firstElementChild;
  if (panel) {
    panel.classList.add("ai-tutor-fullpage");
    panel.removeAttribute("role");
    panel.setAttribute("aria-label", "Trợ lý AI UniStudy");
  }

  attachAiChatEvents(containerEl);

  // Kiểm tra trạng thái dịch vụ một lần
  await openAiChat();
}
