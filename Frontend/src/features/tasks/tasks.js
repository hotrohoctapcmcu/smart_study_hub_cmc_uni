/**
 * UniStudy CMC - Tasks Feature Entry
 */
import { renderTasksView } from "./tasks.view.js";
import { attachTasksEvents } from "./tasks.events.js";
import { fetchTasksFromApi } from "./tasks.service.js";

let tasksLoaded = false;

export async function mountTasks(containerEl) {
  // Render trước bằng state cache để pane không bao giờ trắng
  // trong lúc chờ fetch (tránh ghi vào DOM đã detach sau re-render).
  containerEl.innerHTML = renderTasksView();
  attachTasksEvents(containerEl);
  if (!tasksLoaded) {
    try {
      await fetchTasksFromApi();
      tasksLoaded = true;
      if (!containerEl.isConnected) return;
      containerEl.innerHTML = renderTasksView();
      attachTasksEvents(containerEl);
    } catch (e) {
      console.warn("[Tasks] Không thể tải dữ liệu từ backend:", e.message);
    }
  }
}

