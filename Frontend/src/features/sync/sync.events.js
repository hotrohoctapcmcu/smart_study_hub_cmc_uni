/**
 * UniStudy CMC - Sync Events
 */
import { syncState } from "../../app/sync-state.js";
import { openSchoolPortals } from "./sync.auth-window.js";
import { attachSourceSelectorEvents } from "../../shared/components/source-selector.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { notifyStateChange } from "../../app/state.js";
import { getIuBridge, syncIuAuto, logoutIu } from "./sync.service.js";

export function attachSyncEvents(containerEl) {
  attachSourceSelectorEvents(containerEl);

  const confirmBtn = containerEl.querySelector("#confirmSyncBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (syncState.selectedSources.length === 0) return;
      // Trong app Electron: luồng tự động (SSO riêng -> pull -> hiển thị).
      if (getIuBridge() && syncState.selectedSources.includes("iu")) {
        confirmBtn.disabled = true;
        try {
          await syncIuAuto();
        } catch { /* message đã set trong service */ } finally {
          confirmBtn.disabled = false;
        }
        return;
      }
      // Web thuần: giữ hành vi cũ (mở popup cổng IU ngoài).
      openSchoolPortals(syncState.selectedSources);
      notifyStateChange();
    });
  }

  const skipBtn = containerEl.querySelector("#skipSyncBtn");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      changeCurrentTabRoute("dashboard");
    });
  }

  const iuLogoutBtn = containerEl.querySelector("#iuLogoutBtn");
  if (iuLogoutBtn) {
    iuLogoutBtn.addEventListener("click", async () => {
      await logoutIu();
      notifyStateChange();
    });
  }

  const emptyBtn = containerEl.querySelector("#viewEmptyAppBtn");
  if (emptyBtn) {
    emptyBtn.addEventListener("click", () => {
      changeCurrentTabRoute("dashboard");
    });
  }
}
