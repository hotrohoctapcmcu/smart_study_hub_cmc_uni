/**
 * UniStudy CMC - Documents & Notebook Storage
 * Lưu trữ cục bộ danh sách tài liệu và các trang sổ tay ghi chú
 */

const STORAGE_KEYS = {
  documents: "unistudy_documents_list",
  notes: "unistudy_notebook_pages"
};

export function loadStoredDocuments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.documents);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Lọc bỏ dữ liệu seed mock cũ nếu có trong localStorage
    return Array.isArray(parsed) ? parsed.filter(d => !d.id?.startsWith("doc-")) : [];
  } catch {
    return [];
  }
}

export function saveStoredDocuments(docs) {
  try {
    localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(docs));
  } catch (err) {
    console.error("[Documents Storage] Lưu thất bại:", err);
  }
}

export function loadStoredNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.notes);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Lọc bỏ dữ liệu seed mock cũ nếu có trong localStorage
    return Array.isArray(parsed) ? parsed.filter(n => !n.id?.startsWith("note-")) : [];
  } catch {
    return [];
  }
}

export function saveStoredNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  } catch (err) {
    console.error("[Notes Storage] Lưu thất bại:", err);
  }
}
