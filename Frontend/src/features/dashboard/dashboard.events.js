/**
 * UniStudy CMC - Dashboard Events
 */
import { changeCurrentTabRoute } from "../../app/workspace.js";

export function attachDashboardEvents(containerEl) {
  const syncBtn = containerEl.querySelector("#dashSyncActionBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      changeCurrentTabRoute("sync");
    });
  }

  const gotoBtns = containerEl.querySelectorAll("[data-dash-goto]");
  gotoBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetRoute = btn.getAttribute("data-dash-goto");
      changeCurrentTabRoute(targetRoute);
    });
  });
}
