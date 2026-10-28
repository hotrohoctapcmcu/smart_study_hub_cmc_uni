/**
 * UniStudy CMC - AI Tutor Page
 * Trang "Trợ lý AI" trong workspace (khác panel nổi ở góc màn hình).
 *
 * Dùng CHUNG ai-tutor.store.js với panel nổi: hội thoại, trạng thái dịch vụ và
 * conversationId là một, nên hỏi ở trang này rồi mở panel nổi vẫn thấy tiếp.
 */
import { renderAiChatPanel } from "./ai-tutor.view.js";
import { attachAiChatEvents, openAiChat } from "./ai-tutor.events.js";
import { aiChatState, loadChatHistory, selectConversation, newConversation } from "./ai-tutor.store.js";
import { notifyStateChange } from "../../app/state.js";
import { escapeHtml as e } from "../../shared/utils/validation.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";

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

      <div class="ai-chat-history-bar">
        <label for="aiHistorySelect">Hội thoại đã lưu</label>
        <select id="aiHistorySelect" ${aiChatState.pending ? 'disabled' : ''}>
          <option value="">Chọn hội thoại</option>
          ${aiChatState.history.map(item => `<option value="${e(item.id)}" ${item.id === aiChatState.conversationId ? 'selected' : ''}>${e(item.title)}</option>`).join('')}
        </select>
        <button type="button" class="button secondary small" id="aiNewConversation" ${aiChatState.pending ? 'disabled' : ''}>Hội thoại mới</button>
        <button type="button" class="button ghost small" id="aiHistoryRefresh">Tải lại lịch sử</button>
      </div>
      ${aiChatState.historyError ? `<p role="alert">${e(aiChatState.historyError)}</p>` : ''}
      <div class="ai-study-row"><button class="button ghost small" data-ai-tool="quiz">Kiểm tra kiến thức</button><button class="button ghost small" data-ai-tool="weaknesses">Điểm yếu</button><button class="button ghost small" data-ai-tool="exam-plan-ai">AI ôn thi</button><button class="button ghost small" data-ai-tool="leave-letter">Soạn đơn nghỉ học</button></div>

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
  containerEl.querySelector('#aiNewConversation').addEventListener('click', () => { newConversation(); notifyStateChange(); });
  containerEl.querySelector('#aiHistorySelect').addEventListener('change', async event => {
    if (!event.target.value) return;
    event.target.disabled = true;
    try { await selectConversation(event.target.value); } catch (error) { aiChatState.error = error.message; }
    notifyStateChange();
  });
  containerEl.querySelector('#aiHistoryRefresh').addEventListener('click', async event => {
    event.currentTarget.disabled = true; await loadChatHistory(true); notifyStateChange();
  });
  containerEl.querySelectorAll('[data-ai-tool]').forEach(button => button.addEventListener('click', () => changeCurrentTabRoute(button.dataset.aiTool)));

  // Kiểm tra trạng thái dịch vụ một lần (store tự bỏ qua nếu đã biết).
  await openAiChat();
}
