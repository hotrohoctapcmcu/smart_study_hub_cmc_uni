/**
 * UniStudy CMC - Profile Feature Entry
 */
import { renderProfileView } from "./profile.view.js?v=5";
import { attachProfileEvents } from "./profile.events.js?v=5";

export function mountProfile(containerEl) {
  containerEl.innerHTML = renderProfileView();
  attachProfileEvents(containerEl);
}
