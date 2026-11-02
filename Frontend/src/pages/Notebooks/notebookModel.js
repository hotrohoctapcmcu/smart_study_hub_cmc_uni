import { templateDocument, NOTEBOOK_TEMPLATES } from './notebookTemplates';
export { NOTEBOOK_TEMPLATES };
export const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];
const MARKER = 'ssh-notebook';
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const valid = (value, kind) => value?.format === MARKER && value.version === 1 && value.kind === kind;
const identifier = () => globalThis.crypto?.randomUUID?.() || `page-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function normalizeNotebook(raw) {
  const data = parse(raw.description), metadata = valid(data, 'notebook') ? data : {};
  return { ...raw, id: String(raw.notebook_id ?? raw.id), title: raw.title || 'Sổ tay mới', description: metadata.description ?? raw.description ?? '',
    subject: metadata.subject || raw.subject || raw.subject_name || 'Ghi chép tự học', color: COLORS.includes(metadata.color) ? metadata.color : COLORS[0],
    bookmarked: !!metadata.bookmarked, template: metadata.template || 'blank', updatedAt: raw.updatedAt || raw.updated_at || raw.created_at || '' };
}
export function normalizePage(raw) {
  const data = parse(raw.content), metadata = valid(data, 'page') ? data : {};
  const plain = typeof raw.content === 'string' ? raw.content : '';
  const doc = metadata.doc?.type === 'doc' ? metadata.doc : data?.type === 'doc' ? data : {
    type: 'doc', content: plain.split(/\r?\n/).map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })),
  };
  return { ...raw, id: String(raw.id ?? raw.client_id ?? `note-db-${raw.note_id}`), notebookId: String(raw.notebookId ?? raw.notebook_id),
    title: raw.title || 'Trang mới', subject: raw.subject || raw.subject_label || 'Ghi chép tự học', doc, content: doc,
    parentId: metadata.parentId ? String(metadata.parentId) : null, order: Number(metadata.order) || 0, pinned: !!metadata.pinned,
    completed: !!metadata.completed, updatedAt: raw.updatedAt || raw.updated_at || '', tags: raw.tags || [], chapter: raw.chapter || '', documentId: raw.documentId || '' };
}
export function encodeNotebook(book) {
  return { title: book.title, description: JSON.stringify({ format: MARKER, version: 1, kind: 'notebook', description: book.description || '', subject: book.subject,
    color: book.color, bookmarked: !!book.bookmarked, template: book.template || 'blank' }) };
}
export function encodePage(page) {
  return { id: page.id, notebookId: page.notebookId, title: page.title || 'Trang mới', subject: page.subject, tags: page.tags || [], chapter: page.chapter || '', documentId: page.documentId || '',
    content: JSON.stringify({ format: MARKER, version: 1, kind: 'page', doc: page.content || page.doc, parentId: page.parentId || null, order: page.order || 0, pinned: !!page.pinned, completed: !!page.completed }) };
}
export function pageText(page) {
  function walk(node) {
    if (node?.type === 'text') return node.text || '';
    if (node?.type === 'hardBreak') return '\n';
    if (node?.type === 'cornell') return Object.values(node.attrs || {}).join('\n');
    if (node?.type === 'flashcard') return [node.attrs?.question, node.attrs?.answer].filter(Boolean).join('\n');
    if (node?.type === 'formula') return node.attrs?.latex || '';
    const value = (node?.content || []).map(walk).join('');
    return ['paragraph', 'heading', 'codeBlock', 'tableCell', 'tableHeader'].includes(node?.type) ? `${value}\n` : value;
  }
  return walk(page?.content || page?.doc).trim();
}
export const countWords = page => pageText(page).split(/\s+/u).filter(Boolean).length;
export function createPage(notebookId, template = 'blank', parentId = null) {
  const doc = templateDocument(template);
  return { id: identifier(), notebookId: String(notebookId), title: 'Trang mới', subject: '', doc, content: doc, parentId,
    order: Date.now(), pinned: false, completed: false, updatedAt: new Date().toISOString(), tags: [], chapter: '', documentId: '' };
}
