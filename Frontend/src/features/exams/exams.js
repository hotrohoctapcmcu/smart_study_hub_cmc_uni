/**
 * UniStudy CMC - Exams Feature Entry
 */
import { renderExamsView } from "./exams.view.js";
import { attachExamsEvents } from "./exams.events.js";

export function mountExams(containerEl) {
  containerEl.innerHTML = renderExamsView();
  attachExamsEvents(containerEl);
}
