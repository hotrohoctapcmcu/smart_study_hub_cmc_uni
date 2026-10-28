/**
 * UniStudy CMC - Exams Feature Entry
 */
import { renderExamsView } from "./exams.view.js";
import { attachExamsEvents } from "./exams.events.js";
import { fetchExamsFromApi } from "./exams.service.js";

export async function mountExams(containerEl) {
  // Render trước bằng state cache để pane không bao giờ trắng
  // trong lúc chờ fetch.
  containerEl.innerHTML = renderExamsView();
  attachExamsEvents(containerEl);
    try {
      await fetchExamsFromApi({ notify: false });
      if (!containerEl.isConnected) return;
      containerEl.innerHTML = renderExamsView();
      attachExamsEvents(containerEl);
    } catch (e) {
      console.warn("[Exams] Không thể tải kỳ thi từ backend:", e.message);
    }
}

