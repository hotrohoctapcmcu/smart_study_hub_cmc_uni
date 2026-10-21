/**
 * UniStudy CMC - School Email Feature Entry Point
 */
import { renderSchoolEmailView } from "./school-email.view.js";
import { attachSchoolEmailEvents } from "./school-email.events.js";

export function mountSchoolEmail(containerEl) {
  const uiState = {
    filter: "all",
    searchQuery: ""
  };

  function render() {
    containerEl.innerHTML = renderSchoolEmailView(uiState);
    attachSchoolEmailEvents(containerEl, uiState, render);
  }

  render();
}
