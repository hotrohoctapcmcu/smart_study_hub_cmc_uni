/**
 * UniStudy CMC - AI Tutor Page
 * Trang "Trợ lý AI" trong workspace (khác panel nổi ở góc màn hình).
 *
 * Dùng CHUNG ai-tutor.store.js với panel nổi: hội thoại, trạng thái dịch vụ và
 * conversationId là một, nên hỏi ở trang này rồi mở panel nổi vẫn thấy tiếp.
 */
import { renderAiChatPanel } from "./ai-tutor.view.js";
import { attachAiChatEvents, openAiChat } from "./ai-tutor.events.js";

/**
 * Mount trang Trợ lý AI vào content pane.
 * @param {HTMLElement} containerEl
 */
export async function mountAiTutor(containerEl) {
  containerEl.innerHTML = `
    <div class="ai-tutor-page">
      <div class="ai-tutor-intro">
        <span class="eyebrow"><svg><use href="#i-spark"></use></svg> Học tập thông minh</span>
        <h1>Trợ lý AI UniStudy</h1>
        <p>
          Hỏi đáp kiến thức môn học, giải thích khái niệm khó, hoặc nhờ trợ lý gợi ý
          cách chia nhỏ kế hoạch ôn thi. Trợ lý dùng chung hội thoại với khung chat
          nổi ở góc phải màn hình.
        </p>
      </div>

      <div class="ai-tutor-panel-host" id="aiTutorPageHost">
        ${renderAiChatPanel()}
      </div>
    </div>
  `;

  // Panel ở trang này không có nút đóng kiểu "thu gọn về góc" — ẩn nút đó đi
  // để không gây hiểu nhầm là đóng được cả trang.
  const closeBtn = containerEl.querySelector("#closeMiniChatBtn");
  if (closeBtn) closeBtn.style.display = "none";

  // Panel trang dùng id riêng cho form/input để không đụng panel nổi.
  const panel = containerEl.querySelector("#miniChatPanel");
  if (panel) {
    panel.id = "aiTutorPagePanel";
    panel.classList.add("ai-tutor-page-panel");
    panel.removeAttribute("role");
    panel.setAttribute("aria-label", "Trợ lý AI UniStudy");
  }

  attachAiChatEvents(panel);

  // Kiểm tra trạng thái dịch vụ một lần (store tự bỏ qua nếu đã biết).
  await openAiChat();
}
