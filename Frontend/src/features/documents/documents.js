/**
 * UniStudy CMC - Documents Feature Mount
 * Quản lý vòng đời hiển thị Kho tài liệu và Sổ tay ghi chú
 */
import { renderDocumentsView } from "./documents.view.js";
import { attachDocumentsEvents } from "./documents.events.js";
import { refreshLearningLibrary } from "./documents.service.js";
import { getActiveTab } from "../../app/workspace.js";

let currentUiState = {
  docTab: "docs",
  selectedCategory: "Tất cả",
  selectedSubject: "Tất cả",
  searchQuery: "",
  activeNoteId: null
};

export async function mountDocuments(containerEl) {
  const requested = getActiveTab()?.tabState?.searchTarget;
  if (requested) currentUiState = { ...currentUiState, docTab: requested.docTab || 'docs', activeNoteId: requested.id, selectedCategory: 'Tất cả', selectedSubject: 'Tất cả', searchQuery: requested.type === 'document' ? requested.title : '' };
  if (requested) delete getActiveTab().tabState.searchTarget;
  const render = () => {
    containerEl.innerHTML = renderDocumentsView(currentUiState);
    attachDocumentsEvents(containerEl, currentUiState, (newState) => {
      currentUiState = { ...newState };
      render();
    });
  };

  const loading = refreshLearningLibrary();
  render();
  await loading;
  if (containerEl.isConnected !== false) render();
}

export function unmountDocuments() {
  // Dọn dẹp listener nếu cần
}
