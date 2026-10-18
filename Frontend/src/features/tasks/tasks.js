/**
 * UniStudy CMC - Tasks Feature Entry
 */
import { renderTasksView } from "./tasks.view.js";
import { attachTasksEvents } from "./tasks.events.js";

export function mountTasks(containerEl) {
  containerEl.innerHTML = renderTasksView();
  attachTasksEvents(containerEl);
}
