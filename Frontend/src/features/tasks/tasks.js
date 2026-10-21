/**
 * UniStudy CMC - Tasks Feature Entry
 */
import { renderTasksView } from "./tasks.view.js";
import { attachTasksEvents } from "./tasks.events.js";
import { fetchTasksFromApi } from "./tasks.service.js";

let tasksLoaded = false;

export async function mountTasks(containerEl) {
  if (!tasksLoaded) {
    try {
      await fetchTasksFromApi();
      tasksLoaded = true;
    } catch (e) {
      console.warn("[Tasks] Không thể tải dữ liệu từ backend:", e.message);
    }
  }

  containerEl.innerHTML = renderTasksView();
  attachTasksEvents(containerEl);
}

