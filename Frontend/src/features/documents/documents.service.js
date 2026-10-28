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
import { workspaceRequest, workspaceFileUrl } from "../../shared/services/workspace-api.js";

let documentsCache = null;
let notesCache = null;
let notebooksCache = [];
export const learningLibraryStatus = { error: "", loading: false };
export const getNotebooks = () => notebooksCache;
export const documentFileUrl = (id, download = false) => workspaceFileUrl(`/documents/${encodeURIComponent(id)}/file${download ? '?download=1' : ''}`);
export const noteExportUrl = id => workspaceFileUrl(`/notes/${encodeURIComponent(id)}/export`);
export const notebookExportUrl = id => workspaceFileUrl(`/notebooks/${encodeURIComponent(id)}/export`);

export async function refreshLearningLibrary() {
  learningLibraryStatus.loading = true;
  try {
    const local = getNotes();
    const remoteNotes = await workspaceRequest("GET", "/notes", { silent: true });
    const known = new Map(remoteNotes.map(note => [note.id, note]));
    for (const note of local) {
      if ((!known.has(note.id) && !note.databaseId) || (note.syncPending && !noteWrites.has(note.id))) {
        const saved = await workspaceRequest(known.has(note.id) ? "PUT" : "POST", known.has(note.id) ? `/notes/${encodeURIComponent(note.id)}` : "/notes", { body: note });
        known.set(saved.id, saved);
        if (getNotes().find(current => current.id === note.id) === note) updateNote(note.id, { ...saved, syncPending: false });
      }
    }
    const [docs, notebooks] = await Promise.all([workspaceRequest("GET", "/documents", { silent: true }), workspaceRequest("GET", "/notebooks", { silent: true })]);
    documentsCache = [...docs, ...getDocuments().filter(doc => !/^\d+$/.test(doc.id))];
    const latestDrafts = getNotes().filter(note => note.syncPending || (!known.has(note.id) && note.databaseId));
    for (const draft of latestDrafts) known.set(draft.id, draft);
    notesCache = [...known.values()]; notebooksCache = notebooks;
    saveStoredNotes(notesCache); saveStoredDocuments(documentsCache);
    learningLibraryStatus.error = "";
  } catch (error) { learningLibraryStatus.error = error.message; }
  finally { learningLibraryStatus.loading = false; }
}

export async function uploadDocument(file, data) {
  if (!file?.size) throw new Error("Vui lòng chọn tệp có nội dung.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Tệp tối đa 25 MB.");
  const saved = await workspaceRequest("POST", "/documents", {
    rawBody: file, headers: { "Content-Type": "application/octet-stream", "X-Document-Meta": encodeURIComponent(JSON.stringify({ ...data, filename: file.name })) }, timeout: 60000
  });
  documentsCache = [saved, ...getDocuments()]; saveStoredDocuments(documentsCache);
  return saved;
}

export async function deleteDocumentOnServer(id) {
  if (/^\d+$/.test(id)) await workspaceRequest("DELETE", `/documents/${encodeURIComponent(id)}`);
  return deleteDocument(id);
}

export async function updateDocumentTags(id, tags) {
  const saved = await workspaceRequest("PATCH", `/documents/${id}/tags`, { body: { tags } });
  documentsCache = getDocuments().map(doc => doc.id === id ? saved : doc); saveStoredDocuments(documentsCache);
}

export async function createNoteOnServer(data = {}) {
  const saved = await workspaceRequest("POST", "/notes", { body: data });
  notesCache = [saved, ...getNotes()]; saveStoredNotes(notesCache); return saved;
}

const noteWrites = new Map();
export function updateNoteOnServer(id, updates) {
  updateNote(id, { ...updates, syncPending: true });
  const pending = (noteWrites.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
    const saved = await workspaceRequest("PUT", `/notes/${encodeURIComponent(id)}`, { body: updates });
    const current = getNotes().find(note => note.id === id);
    // A newer queued edit must keep its local draft until its own request succeeds.
    if (noteWrites.get(id) === pending && current) updateNote(id, { ...saved, syncPending: false });
    return saved;
  });
  noteWrites.set(id, pending);
  return pending;
}

export async function deleteNoteOnServer(id) {
  await noteWrites.get(id)?.catch(() => {});
  await workspaceRequest("DELETE", `/notes/${encodeURIComponent(id)}`); deleteNote(id);
}

export async function createNotebook(title) {
  const saved = await workspaceRequest("POST", "/notebooks", { body: { title } });
  notebooksCache.unshift(saved); return saved;
}

export async function renameNotebook(id, title) {
  const saved = await workspaceRequest("PUT", `/notebooks/${id}`, { body: { title } });
  notebooksCache = notebooksCache.map(book => book.notebook_id === saved.notebook_id ? saved : book);
}

export async function deleteNotebook(id) {
  await Promise.allSettled([...noteWrites.values()]);
  await workspaceRequest("DELETE", `/notebooks/${id}`);
  notebooksCache = notebooksCache.filter(book => String(book.notebook_id) !== String(id));
  notesCache = getNotes().filter(note => String(note.notebookId) !== String(id)); saveStoredNotes(notesCache);
}

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
    isDifficult: Boolean(noteData.isDifficult),
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
