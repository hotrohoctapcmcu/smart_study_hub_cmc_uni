/**
 * UniStudy CMC - Documents Feature Mount
 * Quản lý vòng đời hiển thị Kho tài liệu và Sổ tay ghi chú
 */
import { renderDocumentsView } from "./documents.view.js";
import { attachDocumentsEvents } from "./documents.events.js";

let currentUiState = {
  docTab: "docs",
  selectedCategory: "Tất cả",
  selectedSubject: "Tất cả",
  searchQuery: "",
  activeNoteId: null
};

export function mountDocuments(containerEl) {
  const render = () => {
    containerEl.innerHTML = renderDocumentsView(currentUiState);
    attachDocumentsEvents(containerEl, currentUiState, (newState) => {
      currentUiState = { ...newState };
      render();
    });
  };

  render();
}

export function unmountDocuments() {
  // Dọn dẹp listener nếu cần
}
