/**
 * UniStudy CMC - Progress Feature Entry Point
 */
import { renderProgressView } from "./progress.view.js";
import { attachProgressEvents } from "./progress.events.js";
import { getActiveTab } from "../../app/workspace.js";
import { formatDateISO } from "../../shared/utils/date.js";
import { fetchServerProgress, fetchServerTimeMap } from "./progress.service.js";
import { syncPomodoroHistory } from "../pomodoro/pomodoro.sync.js";

export function mountProgress(containerEl) {
  const activeTab = getActiveTab();
  const uiState = {
    period: activeTab?.tabState?.progressPeriod || "week",
    selectedDate: activeTab?.tabState?.progressDate || formatDateISO(new Date())
  };

  let requestVersion = 0;
  function renderView() {
    containerEl.innerHTML = renderProgressView(uiState);
    attachProgressEvents(containerEl, uiState, render);
  }

  async function render() {
    const version = ++requestVersion;
    uiState.serverLoading = true;
    uiState.serverProgress = null;
    uiState.serverTimeMap = null;
    uiState.serverErrors = [];
    renderView();
    await syncPomodoroHistory();
    const results = await Promise.allSettled([
      fetchServerProgress(uiState.period, uiState.selectedDate), fetchServerTimeMap(uiState.period, uiState.selectedDate)
    ]);
    if (version !== requestVersion || containerEl.isConnected === false) return;
    uiState.serverLoading = false;
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        uiState[index === 0 ? "serverProgress" : "serverTimeMap"] = result.value;
      } else uiState.serverErrors.push(result.reason.message);
    }
    renderView();
  }

  render();
}
