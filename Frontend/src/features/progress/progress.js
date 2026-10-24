import { renderProgressView } from "./progress.view.js";
import { attachProgressEvents } from "./progress.events.js";
import { fetchProgressApi } from "./progress.service.js";
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

  // Render ngay lập tức từ local state / cache
  render();

  // Đồng thời tải dữ liệu tươi mới nhất từ API /api/v1/progress
  fetchProgressApi({ period: uiState.period, date: uiState.selectedDate }).then((apiData) => {
    if (containerEl && containerEl.isConnected && apiData) {
      render();
    }
  });
}
