/**
 * UniStudy CMC - School Email Feature Entry Point
 */
import { renderSchoolEmailView } from "./school-email.view.js";
import { attachSchoolEmailEvents } from "./school-email.events.js";
import { fetchSchoolEmails } from "./school-email.service.js";

export async function mountSchoolEmail(containerEl) {
  const uiState = {
    filter: "all",
    searchQuery: ""
  };

  function render() {
    containerEl.innerHTML = renderSchoolEmailView(uiState);
    attachSchoolEmailEvents(containerEl, uiState, render);
  }

  render();
  try { await fetchSchoolEmails(); if (containerEl.isConnected !== false) render(); } catch { /* Saved local cache stays visible. */ }
}
