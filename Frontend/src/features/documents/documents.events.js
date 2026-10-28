import { getDocuments, getNotes, getNotebooks, uploadDocument, deleteDocumentOnServer,
  updateDocumentTags, createNoteOnServer, updateNote, updateNoteOnServer, deleteNoteOnServer,
  createNotebook, renameNotebook, deleteNotebook } from "./documents.service.js";
import { renderUploadDocumentModal } from "./documents.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";
import { analyzeDifficultNotes } from "../ai-tutor/ai-tutor.service.js";
import { runAIAnalysis } from "../ai-tutor/ai-analysis.store.js";

// Timers belong to individual notes. Switching pages never cancels another
// page's draft; values are captured before its DOM is detached.
const pendingSaves = new Map();

export function attachDocumentsEvents(containerEl, uiState, onStateChange) {
  const render = () => onStateChange(uiState);
  const run = fn => async event => {
    try { await fn(event); } catch (error) { alert(error.message); }
  };
  const on = (selector, event, fn) => containerEl.querySelector(selector)?.addEventListener(event, run(fn));
  const each = (selector, attr, fn) => containerEl.querySelectorAll(selector).forEach(element => element.addEventListener("click", run(() => fn(element.getAttribute(attr), element))));

  each("[data-doc-tab]", "data-doc-tab", tab => { uiState.docTab = tab; uiState.searchQuery = ""; render(); });
  each("[data-select-category]", "data-select-category", category => { uiState.selectedCategory = category; render(); });
  on("#docCategorySelect", "change", e => { uiState.selectedCategory = e.target.value; render(); });
  on("#docSubjectSelect", "change", e => { uiState.selectedSubject = e.target.value; render(); });
  for (const selector of ["#docSearchInput", "#notesSearchInput"]) {
    let searchTimer;
    on(selector, "input", e => { const value = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { uiState.searchQuery = value; render(); }, 300); });
  }
  on("#resetDocFiltersBtn", "click", () => { uiState.searchQuery = ""; uiState.selectedCategory = uiState.selectedSubject = "Tất cả"; render(); });

  function openUpload() {
    const host = containerEl.querySelector("#uploadDocModalHost");
    if (!host) return;
    host.innerHTML = renderUploadDocumentModal();
    const modal = host.querySelector("#uploadDocModal");
    attachModalEvents(modal, () => { host.innerHTML = ""; });
    modal.querySelector("#uploadDocForm").addEventListener("submit", run(async event => {
      event.preventDefault();
      const fd = new FormData(event.target);
      const button = modal.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await uploadDocument(fd.get("file"), { title: fd.get("title"), subject: fd.get("subject"), category: fd.get("category"),
          tags: String(fd.get("tags") || "").split(","), isTextbook: fd.get("isTextbook") === "on" });
        host.innerHTML = ""; render();
      } finally { button.disabled = false; }
    }));
  }
  on("#openUploadDocBtn", "click", openUpload);
  on("#emptyUploadDocBtn", "click", openUpload);
  each("[data-delete-doc-id]", "data-delete-doc-id", async id => {
    if (confirm("Xóa tài liệu và tệp đã lưu?")) { await deleteDocumentOnServer(id); render(); }
  });
  each("[data-edit-doc-tags]", "data-edit-doc-tags", async id => {
    const value = prompt("Tags, cách nhau bởi dấu phẩy", (getDocuments().find(doc => doc.id === id)?.tags || []).join(", "));
    if (value !== null) { await updateDocumentTags(id, value.split(",")); render(); }
  });
  each("[data-select-note-id]", "data-select-note-id", id => { uiState.activeNoteId = id; render(); });
  const create = async () => {
    const note = await createNoteOnServer({ title: "Trang ghi chú mới", notebookId: getNotes().find(n => n.id === uiState.activeNoteId)?.notebookId });
    uiState.activeNoteId = note.id; render();
  };
  on("#createNewNoteBtn", "click", create);
  on("#paperEmptyCreateBtn", "click", create);

  const noteId = uiState.activeNoteId || getNotes()[0]?.id;
  const value = selector => containerEl.querySelector(selector)?.value || "";
  const snapshot = () => ({ title: value("#noteTitleInput") || "Trang không tên", subject: value("#noteSubjectInput"),
    content: value("#noteContentTextarea"), tags: value("#noteTagsInput").split(",").map(tag => tag.trim()).filter(Boolean),
    isDifficult: Boolean(containerEl.querySelector("#noteDifficultInput")?.checked), chapter: value("#noteChapterInput"),
    documentId: value("#noteDocumentSelect"), notebookId: Number(value("#noteNotebookSelect")) || undefined });
  const status = containerEl.querySelector("#saveStatusText");
  const save = async updates => {
    if (!noteId) return;
    clearTimeout(pendingSaves.get(noteId)); pendingSaves.delete(noteId);
    if (status) status.textContent = "Đang lưu...";
    try {
      await updateNoteOnServer(noteId, updates);
      if (status) status.textContent = "✓ Đã lưu vào sổ tay";
      const card = [...containerEl.querySelectorAll("[data-select-note-id]")].find(el => el.getAttribute("data-select-note-id") === noteId);
      if (card?.querySelector(".note-item-title")) card.querySelector(".note-item-title").textContent = updates.title;
    } catch (error) {
      if (status) status.textContent = `Chưa lưu được: ${error.message}. Bản nháp vẫn được giữ.`;
      throw error;
    }
  };
  for (const selector of ["#noteTitleInput", "#noteSubjectInput", "#noteTagsInput", "#noteContentTextarea", "#noteChapterInput", "#noteDifficultInput", "#noteNotebookSelect", "#noteDocumentSelect"]) {
    const change = ["#noteDifficultInput", "#noteNotebookSelect", "#noteDocumentSelect"].includes(selector);
    on(selector, change ? "change" : "input", () => {
      if (!noteId) return;
      const updates = snapshot(); updateNote(noteId, { ...updates, syncPending: true });
      if (status) status.textContent = "Đang lưu thay đổi...";
      clearTimeout(pendingSaves.get(noteId));
      pendingSaves.set(noteId, setTimeout(() => { save(updates).then(() => { if (selector === "#noteDocumentSelect" && containerEl.isConnected) render(); }).catch(() => {}); }, 500));
    });
  }
  on("#saveNoteManualBtn", "click", () => save(snapshot()));
  on("#analyzeDifficultNotesBtn", "click", async () => {
    await save(snapshot());
    await runAIAnalysis("difficult-notes", analyzeDifficultNotes, data => data.difficultNotesCount
      ? [...data.topics.map(item => `${item.topic}: ${item.reason || ""}`), ...data.suggestions].join("\n\n") : "Chưa có ghi chú được đánh dấu khó hiểu.");
  });
  on("#deleteCurrentNoteBtn", "click", async () => {
    if (noteId && confirm("Xóa trang ghi chú này?")) {
      clearTimeout(pendingSaves.get(noteId)); pendingSaves.delete(noteId);
      await deleteNoteOnServer(noteId); uiState.activeNoteId = null; render();
    }
  });
  on("#createNotebookBtn", "click", async () => {
    const title = prompt("Tên sổ tay mới");
    if (title?.trim()) { await save(snapshot()); const book = await createNotebook(title); const note = await createNoteOnServer({ notebookId: book.notebook_id }); uiState.activeNoteId = note.id; render(); }
  });
  on("#renameNotebookBtn", "click", async () => {
    const id = value("#noteNotebookSelect");
    const title = prompt("Tên sổ tay", getNotebooks().find(book => String(book.notebook_id) === id)?.title);
    if (title?.trim()) { await renameNotebook(id, title); render(); }
  });
  on("#deleteNotebookBtn", "click", async () => {
    const id = value("#noteNotebookSelect");
    if (id && confirm("Xóa sổ tay cùng tất cả trang bên trong?")) {
      for (const note of getNotes().filter(item => String(item.notebookId) === id)) { clearTimeout(pendingSaves.get(note.id)); pendingSaves.delete(note.id); }
      await deleteNotebook(id); uiState.activeNoteId = null; render();
    }
  });
  on("#togglePagesSidebarBtn", "click", () => containerEl.querySelector("#notesPagesSidebar")?.classList.toggle("open-mobile"));
}
