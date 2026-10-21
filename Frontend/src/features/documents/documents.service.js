/**
 * UniStudy CMC - Documents & Notebook Service
 * Cung cấp API quản lý danh sách tài liệu và trang ghi chú
 */
import {
  loadStoredDocuments,
  saveStoredDocuments,
  loadStoredNotes,
  saveStoredNotes
} from "./documents.storage.js";

let documentsCache = null;
let notesCache = null;

export function getDocuments() {
  if (!documentsCache) {
    documentsCache = loadStoredDocuments();
  }
  return documentsCache;
}

export function addDocument(docData) {
  const docs = getDocuments();
  const newDoc = {
    id: `doc-${Date.now()}`,
    title: docData.title,
    subject: docData.subject || "Chung",
    category: docData.category || "Tài liệu tham khảo",
    fileType: docData.fileType || "PDF",
    sizeStr: docData.sizeStr || "1.0 MB",
    uploadedAt: new Date().toISOString()
  };
  docs.unshift(newDoc);
  saveStoredDocuments(docs);
  return newDoc;
}

export function deleteDocument(docId) {
  const docs = getDocuments().filter((d) => d.id !== docId);
  documentsCache = docs;
  saveStoredDocuments(docs);
  return true;
}

export function getNotes() {
  if (!notesCache) {
    notesCache = loadStoredNotes();
  }
  return notesCache;
}

export function createNote(noteData = {}) {
  const notes = getNotes();
  const newNote = {
    id: `note-${Date.now()}`,
    title: noteData.title || "Trang ghi chú mới",
    subject: noteData.subject || "Ghi chép tự học",
    tags: noteData.tags || [],
    content: noteData.content || "",
    updatedAt: new Date().toISOString()
  };
  notes.unshift(newNote);
  saveStoredNotes(notes);
  return newNote;
}

export function updateNote(noteId, updates) {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return null;

  notes[idx] = {
    ...notes[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveStoredNotes(notes);
  return notes[idx];
}

export function deleteNote(noteId) {
  const notes = getNotes().filter((n) => n.id !== noteId);
  notesCache = notes;
  saveStoredNotes(notes);
  return true;
}
