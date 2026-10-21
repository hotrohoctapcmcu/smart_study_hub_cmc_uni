/**
 * UniStudy CMC - Documents & Notebook View
 * 1. Kho tài liệu: Bộ lọc danh mục, khoảng cách chuẩn, không chạm viền
 * 2. Sổ tay ghi chú: Trang giấy soạn thảo bên TRÁI, danh sách trang bên PHẢI
 */
import { getDocuments, getNotes } from "./documents.service.js";
import { formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { renderModal } from "../../shared/components/modal.js";

export const DOCUMENT_CATEGORIES = [
  "Tất cả",
  "Slide bài giảng",
  "Đề cương & Tài liệu ôn",
  "Tài liệu tham khảo",
  "Bài tập & Đồ án"
];

export function renderDocumentsView(uiState = {}) {
  const currentTab = uiState.docTab || "docs"; // "docs" | "notes"
  const selectedCategory = uiState.selectedCategory || "Tất cả";
  const searchQuery = (uiState.searchQuery || "").trim().toLowerCase();
  const selectedSubject = uiState.selectedSubject || "Tất cả";
  const activeNoteId = uiState.activeNoteId || null;

  const allDocs = getDocuments();
  const allNotes = getNotes();

  // Lấy danh sách các môn học độc nhất từ tài liệu
  const subjectsList = ["Tất cả", ...new Set(allDocs.map((d) => d.subject).filter(Boolean))];

  return `
    <div class="documents-page-container">
      <!-- 1. Tiêu đề và nút Tải lên tài liệu -->
      <div class="documents-header">
        <div>
          <span class="eyebrow"><svg><use href="#i-folder"></use></svg> Học liệu & Sổ tay UniStudy CMC</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Kho học liệu & Sổ tay cá nhân</h1>
        </div>
        ${
          currentTab === "docs"
            ? `
          <button type="button" class="button primary" id="openUploadDocBtn">
            <svg><use href="#i-plus"></use></svg>
            <span>Tải lên tài liệu</span>
          </button>
        `
            : ""
        }
      </div>

      <!-- 2. Hai tab Kho tài liệu / Ghi chú & Sổ tay -->
      <div class="documents-tabs-bar" role="tablist">
        <button type="button" class="doc-tab-btn ${currentTab === "docs" ? "active" : ""}" data-doc-tab="docs">
          <svg style="width:16px;height:16px;"><use href="#i-folder"></use></svg>
          <span>Kho tài liệu</span>
          <span class="doc-tab-count">${allDocs.length}</span>
        </button>
        <button type="button" class="doc-tab-btn ${currentTab === "notes" ? "active" : ""}" data-doc-tab="notes">
          <svg style="width:16px;height:16px;"><use href="#i-plan"></use></svg>
          <span>Ghi chú & Sổ tay</span>
          <span class="doc-tab-count">${allNotes.length}</span>
        </button>
      </div>

      <!-- Nội dung tương ứng theo tab -->
      ${
        currentTab === "docs"
          ? renderRepositoryTab(allDocs, selectedCategory, selectedSubject, searchQuery, subjectsList)
          : renderNotebookTab(allNotes, activeNoteId, searchQuery)
      }

      <!-- Host Modal Tải lên tài liệu -->
      <div id="uploadDocModalHost"></div>
    </div>
  `;
}

/**
 * Render Tab Kho tài liệu (Yêu cầu 4)
 */
function renderRepositoryTab(allDocs, selectedCategory, selectedSubject, searchQuery, subjectsList) {
  // Lọc tài liệu
  let filtered = allDocs;
  if (selectedCategory && selectedCategory !== "Tất cả") {
    filtered = filtered.filter((d) => d.category === selectedCategory);
  }
  if (selectedSubject && selectedSubject !== "Tất cả") {
    filtered = filtered.filter((d) => d.subject === selectedSubject);
  }
  if (searchQuery) {
    filtered = filtered.filter(
      (d) =>
        d.title.toLowerCase().includes(searchQuery) ||
        d.subject.toLowerCase().includes(searchQuery) ||
        d.category.toLowerCase().includes(searchQuery)
    );
  }

  const isRepoEmpty = allDocs.length === 0;
  const isFilterEmpty = filtered.length === 0 && !isRepoEmpty;

  return `
    <div class="documents-tab-content">
      <!-- 3. Ô tìm kiếm và các bộ lọc -->
      <div class="doc-filter-toolbar">
        <div class="doc-search-box">
          <svg class="doc-search-icon"><use href="#i-search"></use></svg>
          <input 
            type="search" 
            id="docSearchInput" 
            placeholder="Tìm theo tên bài giảng, đề cương, môn học..." 
            value="${searchQuery}" 
            aria-label="Tìm kiếm tài liệu"
          />
        </div>

        <div class="doc-filter-dropdowns">
          <div class="doc-select-group">
            <label for="docCategorySelect" class="doc-select-label">Loại tài liệu:</label>
            <select id="docCategorySelect" class="doc-select">
              ${DOCUMENT_CATEGORIES.map(
                (cat) => `<option value="${cat}" ${cat === selectedCategory ? "selected" : ""}>${cat}</option>`
              ).join("")}
            </select>
          </div>

          <div class="doc-select-group">
            <label for="docSubjectSelect" class="doc-select-label">Môn học:</label>
            <select id="docSubjectSelect" class="doc-select">
              ${subjectsList.map(
                (subj) => `<option value="${subj}" ${subj === selectedSubject ? "selected" : ""}>${subj}</option>`
              ).join("")}
            </select>
          </div>
        </div>
      </div>

      <!-- 4. Nhóm chọn nhanh loại tài liệu (Khoảng cách rõ ràng, không chạm viền card bên dưới) -->
      <div class="doc-quick-category-bar">
        ${DOCUMENT_CATEGORIES.map(
          (cat) => `
          <button type="button" 
            class="doc-quick-chip ${cat === selectedCategory ? "active" : ""}" 
            data-select-category="${cat}">
            ${cat}
          </button>
        `
        ).join("")}
      </div>

      <!-- 5. Danh sách tài liệu hoặc trạng thái rỗng -->
      <div class="doc-list-card">
        ${
          filtered.length > 0
            ? `
          <div class="doc-table-responsive">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>Tài liệu & Môn học</th>
                  <th style="width:180px;">Loại tài liệu</th>
                  <th style="width:120px;">Định dạng & Dung lượng</th>
                  <th style="width:140px;">Ngày tải lên</th>
                  <th style="width:90px;text-align:right;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${filtered
                  .map((doc) => {
                    const badgeClass =
                      doc.fileType === "PDF" ? "badge-pdf" : doc.fileType === "DOCX" ? "badge-doc" : "badge-ppt";

                    return `
                      <tr class="doc-table-row" data-doc-id="${doc.id}">
                        <td class="doc-title-cell">
                          <strong class="doc-title-text" title="${doc.title}">${doc.title}</strong>
                          <span class="doc-subject-tag">${doc.subject}</span>
                        </td>
                        <td>
                          <span class="doc-category-badge">${doc.category}</span>
                        </td>
                        <td>
                          <span class="file-type-pill ${badgeClass}">${doc.fileType}</span>
                          <span class="small muted">${doc.sizeStr}</span>
                        </td>
                        <td>
                          <span class="small muted">${formatDateTimeVN(doc.uploadedAt).slice(0, 10)}</span>
                        </td>
                        <td style="text-align:right;">
                          <button type="button" class="icon-button doc-delete-btn" data-delete-doc-id="${doc.id}" aria-label="Xóa tài liệu" title="Xóa tài liệu" style="color:var(--red-600);width:32px;height:32px;display:inline-grid;">
                            <svg style="width:14px;height:14px;"><use href="#i-trash"></use></svg>
                          </button>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
            : isRepoEmpty
            ? `
          <div class="doc-empty-state-wrap">
            ${renderEmptyState({
              icon: "i-folder",
              title: "Kho tài liệu hiện đang trống",
              description: "Tải lên slide bài giảng, đề cương hoặc tài liệu ôn tập để dễ dàng tra cứu trong kỳ học.",
              actionText: "Tải lên tài liệu đầu tiên",
              actionDataAttr: 'id="emptyUploadDocBtn"'
            })}
          </div>
        `
            : `
          <div class="doc-empty-state-wrap">
            ${renderEmptyState({
              icon: "i-search",
              title: "Không tìm thấy tài liệu phù hợp",
              description: "Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn lại danh mục phân loại.",
              actionText: "Xem tất cả tài liệu",
              actionDataAttr: 'id="resetDocFiltersBtn"'
            })}
          </div>
        `
        }
      </div>
    </div>
  `;
}

/**
 * Render Tab Sổ tay ghi chú (Yêu cầu 5 - ĐẢO BỐ CỤC: Trang giấy bên TRÁI, Danh sách trang bên PHẢI)
 */
function renderNotebookTab(allNotes, activeNoteId, searchQuery) {
  let filteredNotes = allNotes;
  if (searchQuery) {
    filteredNotes = filteredNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(searchQuery) ||
        n.content.toLowerCase().includes(searchQuery) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(searchQuery)))
    );
  }

  // Xác định note đang mở
  let currentNote = allNotes.find((n) => n.id === activeNoteId);
  if (!currentNote && allNotes.length > 0) {
    currentNote = allNotes[0];
  }

  return `
    <div class="notes-workspace-layout">
      <!-- CỘT CHÍNH BÊN TRÁI: Trang giấy soạn thảo ghi chú -->
      <div class="notes-paper-editor">
        ${
          currentNote
            ? `
          <!-- Thanh trạng thái và nút thao tác trên đầu trang giấy -->
          <div class="paper-top-toolbar">
            <div class="paper-save-status" id="paperSaveStatus">
              <span class="status-indicator-dot"></span>
              <span id="saveStatusText">Đã lưu lúc ${formatDateTimeVN(currentNote.updatedAt).slice(11, 16)}</span>
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="button secondary small" id="saveNoteManualBtn" title="Lưu ghi chú thủ công">
                <svg style="width:14px;height:14px;"><use href="#i-check"></use></svg>
                <span>Lưu ghi chú</span>
              </button>
              <button type="button" class="button ghost-danger small" id="deleteCurrentNoteBtn" data-note-id="${currentNote.id}" title="Xóa trang ghi chú này">
                <svg style="width:14px;height:14px;"><use href="#i-trash"></use></svg>
                <span>Xóa</span>
              </button>
              <button type="button" class="button ghost small notes-mobile-toggle-btn" id="togglePagesSidebarBtn" title="Danh sách các trang">
                <span>📑 Danh sách trang</span>
              </button>
            </div>
          </div>

          <!-- Khu vực nhập Tiêu đề, Môn học, Tags và thời gian -->
          <div class="paper-meta-header">
            <input 
              type="text" 
              id="noteTitleInput" 
              class="paper-title-input" 
              value="${currentNote.title}" 
              placeholder="Tiêu đề trang ghi chú..." 
              aria-label="Tiêu đề trang ghi chú"
            />

            <div class="paper-meta-subrow">
              <input 
                type="text" 
                id="noteSubjectInput" 
                class="paper-subject-input" 
                value="${currentNote.subject || ""}" 
                placeholder="Môn học / Chủ đề (Ví dụ: Cấu trúc dữ liệu)" 
              />
              <input 
                type="text" 
                id="noteTagsInput" 
                class="paper-tags-input" 
                value="${(currentNote.tags || []).join(", ")}" 
                placeholder="Tags cách nhau bởi dấu phẩy (Ví dụ: giữa-kỳ, lý-thuyết)" 
              />
              <span class="paper-time-badge">
                Cập nhật: ${formatDateTimeVN(currentNote.updatedAt)}
              </span>
            </div>
          </div>

          <!-- Thân trang giấy soạn thảo (Căn trái, rộng rãi, placeholder không lưu thành text thật) -->
          <div class="paper-content-sheet">
            <textarea 
              id="noteContentTextarea" 
              class="paper-textarea" 
              placeholder="Nhập nội dung ghi chú ôn tập tại đây... (Nội dung tự động lưu khi gõ)"
              aria-label="Nội dung trang ghi chú"
            >${currentNote.content || ""}</textarea>
          </div>
        `
            : `
          <div class="paper-empty-wrap">
            <p class="muted">Chưa có trang ghi chú nào được chọn.</p>
            <button type="button" class="button primary" id="paperEmptyCreateBtn">
              Tạo trang ghi chú mới
            </button>
          </div>
        `
        }
      </div>

      <!-- CỘT PHỤ BÊN PHẢI: Danh sách trang, tìm kiếm và nút Tạo trang mới -->
      <div class="notes-sidebar-pages" id="notesPagesSidebar">
        <div class="notes-sidebar-header">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
            <strong style="font-size:0.95rem;color:var(--ink-950);">Trang sổ tay (${allNotes.length})</strong>
            <!-- Giữ một nút tạo trang duy nhất trong cột danh sách -->
            <button type="button" class="button primary small" id="createNewNoteBtn" title="Tạo trang ghi chú mới">
              <svg style="width:14px;height:14px;"><use href="#i-plus"></use></svg>
              <span>Trang mới</span>
            </button>
          </div>

          <div class="notes-search-box">
            <input 
              type="search" 
              id="notesSearchInput" 
              placeholder="Tìm kiếm trang ghi chú..." 
              value="${searchQuery}" 
              aria-label="Tìm kiếm trang ghi chú"
            />
          </div>
        </div>

        <div class="notes-pages-list">
          ${
            filteredNotes.length > 0
              ? filteredNotes
                  .map((note) => {
                    const isActive = currentNote && currentNote.id === note.id;
                    const previewText = (note.content || "").slice(0, 60).replace(/\n/g, " ") || "Chưa có nội dung...";

                    return `
                      <div class="note-item-card ${isActive ? "active" : ""}" data-select-note-id="${note.id}" tabindex="0" role="button">
                        <strong class="note-item-title">${note.title || "Trang không tên"}</strong>
                        <p class="note-item-preview">${previewText}</p>
                        <div class="note-item-footer">
                          <span class="note-item-subject">${note.subject || "Chung"}</span>
                          <span class="note-item-date">${formatDateTimeVN(note.updatedAt).slice(0, 10)}</span>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : `<div class="small muted" style="text-align:center;padding:24px 12px;font-style:italic;">Không tìm thấy trang ghi chú nào</div>`
          }
        </div>
      </div>
    </div>
  `;
}

/**
 * Modal Tải lên tài liệu
 */
export function renderUploadDocumentModal() {
  const bodyHtml = `
    <form id="uploadDocForm" style="display:flex;flex-direction:column;gap:14px;">
      <label>
        <span class="small" style="font-weight:700;display:block;margin-bottom:4px;">Tên tài liệu *</span>
        <input type="text" name="title" required placeholder="Ví dụ: Slide bài giảng Chương 5 - Lập trình Web" style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:9px 12px;" />
      </label>

      <label>
        <span class="small" style="font-weight:700;display:block;margin-bottom:4px;">Môn học *</span>
        <input type="text" name="subject" required placeholder="Ví dụ: Phát triển ứng dụng Web" style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:9px 12px;" />
      </label>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:700;display:block;margin-bottom:4px;">Loại tài liệu</span>
          <select name="category" style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:9px 12px;background:white;">
            <option value="Slide bài giảng">Slide bài giảng</option>
            <option value="Đề cương & Tài liệu ôn">Đề cương & Tài liệu ôn</option>
            <option value="Tài liệu tham khảo">Tài liệu tham khảo</option>
            <option value="Bài tập & Đồ án">Bài tập & Đồ án</option>
          </select>
        </label>

        <label>
          <span class="small" style="font-weight:700;display:block;margin-bottom:4px;">Định dạng tệp</span>
          <select name="fileType" style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:9px 12px;background:white;">
            <option value="PDF">PDF</option>
            <option value="PPTX">PowerPoint (PPTX)</option>
            <option value="DOCX">Word (DOCX)</option>
          </select>
        </label>
      </div>

      <div style="padding:16px;border:2px dashed var(--violet-300);background:#fcfaff;border-radius:10px;text-align:center;">
        <svg style="width:28px;height:28px;color:var(--violet-600);margin-bottom:6px;"><use href="#i-folder"></use></svg>
        <p style="margin:0;font-size:0.86rem;color:var(--ink-700);">Chọn tệp từ máy tính để lưu trữ vào kho học tập cục bộ</p>
        <span class="tiny muted">Hỗ trợ PDF, PPTX, DOCX tối đa 25MB</span>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="uploadDocModal">Hủy</button>
    <button type="submit" form="uploadDocForm" class="button primary">Tải lên ngay</button>
  `;

  return renderModal({
    id: "uploadDocModal",
    title: "Tải lên tài liệu học tập",
    bodyHtml,
    footerHtml
  });
}
