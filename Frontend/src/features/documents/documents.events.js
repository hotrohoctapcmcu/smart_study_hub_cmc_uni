/**
 * UniStudy CMC - Documents & Notebook Events
 * Quản lý tương tác:
 * - Đồng bộ danh mục dropdown và nút chọn nhanh
 * - Tự động lưu ghi chú khi gõ (autosave debounce) bảo toàn con trỏ & bộ gõ tiếng Việt
 * - Đảo bố cục: Soạn thảo bên trái, danh sách trang bên phải
 */
import {
  getDocuments,
  addDocument,
  deleteDocument,
  getNotes,
  createNote,
  updateNote,
  deleteNote
} from "./documents.service.js";
import { renderDocumentsView, renderUploadDocumentModal } from "./documents.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";

let debounceTimer = null;

export function attachDocumentsEvents(containerEl, uiState, onStateChange) {
  // 1. Chuyển Tab (Kho tài liệu <-> Ghi chú & Sổ tay)
  const tabBtns = containerEl.querySelectorAll("[data-doc-tab]");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-doc-tab");
      uiState.docTab = tab;
      onStateChange(uiState);
    });
  });

  // ========== CÁC SỰ KIỆN KHO TÀI LIỆU ==========
  if (uiState.docTab === "docs" || !uiState.docTab) {
    // 2. Đồng bộ danh mục: Nút chọn nhanh (quick chips)
    const quickChips = containerEl.querySelectorAll("[data-select-category]");
    quickChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const cat = chip.getAttribute("data-select-category");
        uiState.selectedCategory = cat;
        onStateChange(uiState);
      });
    });

    // 3. Đồng bộ danh mục: Dropdown select
    const catSelect = containerEl.querySelector("#docCategorySelect");
    if (catSelect) {
      catSelect.addEventListener("change", (e) => {
        uiState.selectedCategory = e.target.value;
        onStateChange(uiState);
      });
    }

    // 4. Dropdown Môn học
    const subjSelect = containerEl.querySelector("#docSubjectSelect");
    if (subjSelect) {
      subjSelect.addEventListener("change", (e) => {
        uiState.selectedSubject = e.target.value;
        onStateChange(uiState);
      });
    }

    // 5. Ô tìm kiếm tài liệu
    const searchInput = containerEl.querySelector("#docSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          uiState.searchQuery = e.target.value;
          onStateChange(uiState);
        }, 300);
      });
    }

    // 6. Nút Reset bộ lọc từ trạng thái rỗng
    const resetBtn = containerEl.querySelector("#resetDocFiltersBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        uiState.searchQuery = "";
        uiState.selectedCategory = "Tất cả";
        uiState.selectedSubject = "Tất cả";
        onStateChange(uiState);
      });
    }

    // 7. Mở modal Tải lên tài liệu
    const uploadBtn = containerEl.querySelector("#openUploadDocBtn");
    const emptyUploadBtn = containerEl.querySelector("#emptyUploadDocBtn");
    const modalHost = containerEl.querySelector("#uploadDocModalHost");

    const openUploadModal = () => {
      if (!modalHost) return;
      modalHost.innerHTML = renderUploadDocumentModal();
      const modalEl = modalHost.querySelector("#uploadDocModal");

      const close = () => {
        modalHost.innerHTML = "";
      };

      attachModalEvents(modalEl, close);

      const form = modalEl.querySelector("#uploadDocForm");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const title = fd.get("title")?.trim();
          const subject = fd.get("subject")?.trim();
          const category = fd.get("category");
          const fileType = fd.get("fileType");

          if (!title || !subject) {
            alert("Vui lòng nhập đầy đủ tên tài liệu và môn học.");
            return;
          }

          addDocument({
            title,
            subject,
            category,
            fileType,
            sizeStr: "2.4 MB"
          });

          close();
          onStateChange(uiState);
        });
      }
    };

    if (uploadBtn) uploadBtn.addEventListener("click", openUploadModal);
    if (emptyUploadBtn) emptyUploadBtn.addEventListener("click", openUploadModal);

    // 8. Xóa tài liệu
    const deleteDocBtns = containerEl.querySelectorAll("[data-delete-doc-id]");
    deleteDocBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const docId = btn.getAttribute("data-delete-doc-id");
        const ok = window.confirm("Bạn có chắc chắn muốn xóa tài liệu này khỏi kho học tập?");
        if (ok) {
          deleteDocument(docId);
          onStateChange(uiState);
        }
      });
    });
  }

  // ========== CÁC SỰ KIỆN SỔ TAY GHI CHÚ ==========
  if (uiState.docTab === "notes") {
    // 1. Tìm kiếm ghi chú trong sidebar
    const notesSearch = containerEl.querySelector("#notesSearchInput");
    if (notesSearch) {
      notesSearch.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          uiState.searchQuery = e.target.value;
          onStateChange(uiState);
        }, 300);
      });
    }

    // 2. Chọn trang ghi chú trong danh sách
    const noteCards = containerEl.querySelectorAll("[data-select-note-id]");
    noteCards.forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-select-note-id");
        uiState.activeNoteId = id;
        onStateChange(uiState);
      });
    });

    // 3. Tạo trang ghi chú mới (Giữ 1 nút duy nhất trong cột danh sách)
    const createNoteBtn = containerEl.querySelector("#createNewNoteBtn");
    const paperEmptyCreateBtn = containerEl.querySelector("#paperEmptyCreateBtn");

    const handleCreateNote = () => {
      const newNote = createNote({
        title: "Trang ghi chú mới",
        content: ""
      });
      uiState.activeNoteId = newNote.id;
      onStateChange(uiState);
    };

    if (createNoteBtn) createNoteBtn.addEventListener("click", handleCreateNote);
    if (paperEmptyCreateBtn) paperEmptyCreateBtn.addEventListener("click", handleCreateNote);

    // 4. Autosave trang soạn thảo:
    // Tuyệt đối không gọi re-render DOM để giữ nguyên vị trí con trỏ và IME gõ tiếng Việt!
    const titleInput = containerEl.querySelector("#noteTitleInput");
    const subjectInput = containerEl.querySelector("#noteSubjectInput");
    const tagsInput = containerEl.querySelector("#noteTagsInput");
    const contentTextarea = containerEl.querySelector("#noteContentTextarea");
    const saveStatusText = containerEl.querySelector("#saveStatusText");

    const getActiveId = () => {
      return uiState.activeNoteId || (getNotes()[0] && getNotes()[0].id);
    };

    const triggerAutoSave = () => {
      const activeId = getActiveId();
      if (!activeId) return;

      if (saveStatusText) {
        saveStatusText.textContent = "Đang lưu thay đổi...";
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const title = titleInput?.value.trim() || "Trang không tên";
        const subject = subjectInput?.value.trim() || "Ghi chép";
        const rawTags = tagsInput?.value || "";
        const tags = rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const content = contentTextarea?.value || "";

        updateNote(activeId, { title, subject, tags, content });

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");

        if (saveStatusText) {
          saveStatusText.textContent = `✓ Đã lưu lúc ${hh}:${mm}`;
        }

        // Cập nhật tiêu đề bên sidebar item trực tiếp trong DOM (không re-render toàn trang)
        const activeCard = containerEl.querySelector(`.note-item-card[data-select-note-id="${activeId}"]`);
        if (activeCard) {
          const tEl = activeCard.querySelector(".note-item-title");
          if (tEl) tEl.textContent = title;
          const pEl = activeCard.querySelector(".note-item-preview");
          if (pEl) pEl.textContent = content.slice(0, 60).replace(/\n/g, " ") || "Chưa có nội dung...";
        }
      }, 500);
    };

    if (titleInput) titleInput.addEventListener("input", triggerAutoSave);
    if (subjectInput) subjectInput.addEventListener("input", triggerAutoSave);
    if (tagsInput) tagsInput.addEventListener("input", triggerAutoSave);
    if (contentTextarea) contentTextarea.addEventListener("input", triggerAutoSave);

    // 5. Nút Lưu thủ công
    const manualSaveBtn = containerEl.querySelector("#saveNoteManualBtn");
    if (manualSaveBtn) {
      manualSaveBtn.addEventListener("click", () => {
        clearTimeout(debounceTimer);
        const activeId = getActiveId();
        if (!activeId) return;

        const title = titleInput?.value.trim() || "Trang không tên";
        const subject = subjectInput?.value.trim() || "Ghi chép";
        const rawTags = tagsInput?.value || "";
        const tags = rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const content = contentTextarea?.value || "";

        updateNote(activeId, { title, subject, tags, content });

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");

        if (saveStatusText) {
          saveStatusText.textContent = `✓ Đã lưu lúc ${hh}:${mm}`;
        }
      });
    }

    // 6. Nút Xóa ghi chú hiện tại
    const deleteNoteBtn = containerEl.querySelector("#deleteCurrentNoteBtn");
    if (deleteNoteBtn) {
      deleteNoteBtn.addEventListener("click", () => {
        const activeId = getActiveId();
        if (!activeId) return;

        const ok = window.confirm("Bạn có chắc chắn muốn xóa trang ghi chú này?");
        if (ok) {
          deleteNote(activeId);
          uiState.activeNoteId = null;
          onStateChange(uiState);
        }
      });
    }

    // 7. Toggle sidebar trên mobile
    const toggleSidebarBtn = containerEl.querySelector("#togglePagesSidebarBtn");
    const sidebarEl = containerEl.querySelector("#notesPagesSidebar");
    if (toggleSidebarBtn && sidebarEl) {
      toggleSidebarBtn.addEventListener("click", () => {
        sidebarEl.classList.toggle("open-mobile");
      });
    }
  }
}
