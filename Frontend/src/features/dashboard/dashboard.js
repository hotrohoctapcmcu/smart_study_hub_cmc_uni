/**
 * UniStudy CMC - Dashboard Feature Entry
 */
import { renderDashboardView } from "./dashboard.view.js";
import { attachDashboardEvents } from "./dashboard.events.js";
import { fetchDashboardData } from "./dashboard.service.js";
import { state } from "../../app/state.js";

export async function mountDashboard(containerEl) {
  if (!state.studentProfile) {
    try {
      await fetchDashboardData();
    } catch (e) {
      console.warn("[Dashboard] Không thể tải dữ liệu dashboard:", e.message);
    }
  }

  containerEl.innerHTML = renderDashboardView();
  attachDashboardEvents(containerEl);
}

