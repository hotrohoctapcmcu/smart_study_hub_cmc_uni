/**
 * UniStudy CMC - Progress Feature Entry Point
 */
import { renderProgressView } from "./progress.view.js";
import { attachProgressEvents } from "./progress.events.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateISO } from "../../shared/utils/date.js";

export function mountProgress(containerEl) {
  const activeTab = getActiveTab();
  const uiState = {
    period: activeTab?.tabState?.progressPeriod || "week",
    selectedDate: activeTab?.tabState?.progressDate || formatDateISO(new Date())
  };

  function render() {
    containerEl.innerHTML = renderProgressView(uiState);
    attachProgressEvents(containerEl, uiState, render);
  }

  render();
}
