/**
 * UniStudy CMC - Documents & Notebook Storage
 * Lưu trữ cục bộ danh sách tài liệu và các trang sổ tay ghi chú
 */

const STORAGE_KEYS = {
  documents: "unistudy_documents_list",
  notes: "unistudy_notebook_pages"
};

// ID của dữ liệu mẫu cũ từng được seed sẵn (doc-1..3, note-1..2).
// Chỉ loại đúng các ID này — KHÔNG lọc theo tiền tố, vì tài liệu/ghi chú do
// người dùng tạo cũng sinh ID dạng `doc-<timestamp>` / `note-<timestamp>`
// (xem documents.service.js), lọc theo tiền tố sẽ xoá sạch dữ liệu thật khi
// tải lại trang.
const LEGACY_SEED_IDS = new Set([
  "doc-1", "doc-2", "doc-3",
  "note-1", "note-2"
]);

function locBoDuLieuMau(danhSach) {
  if (!Array.isArray(danhSach)) return [];
  return danhSach.filter((item) => !LEGACY_SEED_IDS.has(item?.id));
}

export function loadStoredDocuments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.documents);
    if (!raw) return [];
    return locBoDuLieuMau(JSON.parse(raw));
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
    return locBoDuLieuMau(JSON.parse(raw));
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
