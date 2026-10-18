/**
 * UniStudy CMC - Sync Feature Entry
 */
import { renderSyncView } from "./sync.view.js";
import { attachSyncEvents } from "./sync.events.js";

export function mountSync(containerEl) {
  containerEl.innerHTML = renderSyncView();
  attachSyncEvents(containerEl);
}
