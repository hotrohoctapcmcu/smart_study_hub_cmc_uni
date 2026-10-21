/**
 * UniStudy CMC - Exams Feature Entry
 */
import { renderExamsView } from "./exams.view.js";
import { attachExamsEvents } from "./exams.events.js";
import { fetchExamsFromApi } from "./exams.service.js";

let examsLoaded = false;

export async function mountExams(containerEl) {
  if (!examsLoaded) {
    try {
      await fetchExamsFromApi();
      examsLoaded = true;
    } catch (e) {
      console.warn("[Exams] Không thể tải kỳ thi từ backend:", e.message);
    }
  }

  containerEl.innerHTML = renderExamsView();
  attachExamsEvents(containerEl);
}

