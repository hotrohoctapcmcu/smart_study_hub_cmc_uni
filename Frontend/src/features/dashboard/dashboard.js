/**
 * UniStudy CMC - Dashboard Feature Entry
 */
import { renderDashboardView } from "./dashboard.view.js";
import { attachDashboardEvents } from "./dashboard.events.js";

export function mountDashboard(containerEl) {
  containerEl.innerHTML = renderDashboardView();
  attachDashboardEvents(containerEl);
}
