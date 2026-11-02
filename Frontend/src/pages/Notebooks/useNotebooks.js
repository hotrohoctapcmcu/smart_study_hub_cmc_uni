import { useCallback, useEffect, useRef, useState } from 'react';
import { studentApi, workspaceApi } from '../../api';
import { responseList, unwrapResponse } from '../../api/apiClient';
import { normalizeNotebook, normalizePage, encodeNotebook, encodePage, createPage as newPage } from './notebookModel';

// Route changes can briefly leave two hook instances alive. A per-owner queue
// orders remote writes across instances, and the newest identified instance
// owns subsequent work. In-flight writes finish before the new editor writes.
const ownerQueues = new Map();
function ownerQueue(identity) {
  if (!ownerQueues.has(identity)) ownerQueues.set(identity, { lease: null, tail: Promise.resolve() });
  return ownerQueues.get(identity);
}
function remoteWrite(identity, lease, action) {
  const coordinator = ownerQueue(identity);
  const request = coordinator.tail.then(() => {
    if (coordinator.lease !== lease) throw Object.assign(new Error('Editor replaced'), { superseded: true });
    return action();
  });
  coordinator.tail = request.catch(() => {});
  return request;
}

// Drafts are written synchronously before the debounce. The API queue is serialized,
// and acknowledgements remove only the exact revision sent, never newer typing.
export default function useNotebooks() {
  const [notebooks, setNotebooks] = useState([]), [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(null);
  const [saveState, setSaveState] = useState('saved'), [storageError, setStorageError] = useState(null);
  const state = useRef({ notebooks: [], pages: [], pending: {} });
  const key = useRef(null), owner = useRef(null), timer = useRef(null), running = useRef(null), mounted = useRef(true), ready = useRef(false), needsRefetch = useRef(true);
  const lease = useRef(Symbol('notebook-editor'));
  const persist = useCallback(() => {
    // An older unmounted editor can still receive its API acknowledgement.
    // It must never overwrite drafts written by the newly mounted editor.
    if (!key.current || !mounted.current) return;
    try { localStorage.setItem(key.current, JSON.stringify({ version: 1, ...state.current })); if (mounted.current) setStorageError(null); }
    catch { if (mounted.current) { setStorageError(new Error('Bộ nhớ trình duyệt đã đầy hoặc bị chặn. Giữ trang mở và kết nối mạng để lưu dữ liệu.')); setSaveState('error'); } }
  }, []);
  const publish = useCallback(() => {
    if (mounted.current) { setNotebooks([...state.current.notebooks]); setPages([...state.current.pages]); }
    persist();
  }, [persist]);
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!ready.current) return;
    if (running.current) return running.current;
    const requestOwner = owner.current;
    const work = async () => {
      const blocked = new Set();
      let validationError = null;
      while (Object.keys(state.current.pending).length) {
        if (ownerQueue(requestOwner).lease !== lease.current) return;
        if (navigator.onLine === false) { if (mounted.current) setSaveState('offline'); return; }
        const next = Object.entries(state.current.pending).find(([entryKey]) => !blocked.has(entryKey));
        if (!next) break;
        const [entryKey, entry] = next;
        if (mounted.current) setSaveState('saving');
        try {
          const api = workspaceApi[entry.kind === 'page' ? 'notes' : 'notebooks'];
          const payload = entry.kind === 'page' ? encodePage(entry.value) : encodeNotebook(entry.value);
          if (entry.kind === 'page' && payload.content.length > 1000000) {
            validationError = new Error('Trang vượt giới hạn 1 triệu ký tự. Bản nháp vẫn được giữ trên trình duyệt; hãy giảm kích thước ảnh hoặc chia nội dung thành nhiều trang.');
            validationError.response = { status: 413 }; blocked.add(entryKey); continue;
          }
          const result = unwrapResponse(await remoteWrite(requestOwner, lease.current, () => entry.create ? api.create(payload) : api.update(entry.value.id, payload)));
          if (ownerQueue(requestOwner).lease !== lease.current) return;
          // A creation uses a stable client_id. If the response was lost, the POST
          // is idempotent; the subsequent PUT applies the latest draft content.
          if (entry.create) {
            const current = state.current.pending[entryKey];
            // ON CONFLICT returns the previously inserted row without changing
            // its content, so always PUT after POST (including lost-response retries).
            if (current) state.current.pending[entryKey] = { ...current, create: false };
          }
          if (state.current.pending[entryKey] === entry) delete state.current.pending[entryKey];
          if (entry.kind === 'page' && result?.databaseId) {
            state.current.pages = state.current.pages.map(page => page.id === entry.value.id ? { ...page, databaseId: result.databaseId } : page);
          }
          persist();
        } catch (cause) {
          if (cause.superseded) return;
          if (mounted.current) { setError(cause); setSaveState(navigator.onLine === false || !cause.response ? 'offline' : 'error'); }
          persist();
          return;
        }
      }
      if (mounted.current) {
        if (validationError) { setSaveState('error'); setError(validationError); }
        else if (!needsRefetch.current) { setSaveState('saved'); setError(null); }
      }
    };
    running.current = work().finally(() => { running.current = null; });
    return running.current;
  }, [persist]);
  const queue = useCallback((kind, value, create = false) => {
    const entryKey = `${kind}:${value.id}`, previous = state.current.pending[entryKey];
    state.current.pending[entryKey] = { kind, value, create: previous?.create || create };
    publish();
    if (mounted.current) setSaveState(navigator.onLine === false ? 'offline' : 'saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 650);
  }, [publish, flush]);
  const refetch = useCallback(async () => {
    needsRefetch.current = true;
    if (mounted.current) { setLoading(true); setError(null); }
    try {
      const profile = unwrapResponse(await studentApi.getProfile());
      if (!mounted.current) return;
      const identity = profile?.student_id ?? profile?.studentId ?? profile?.student_code ?? profile?.ma_sinh_vien;
      if (identity == null || identity === '') throw new Error('Hãy đồng bộ hồ sơ sinh viên trước khi sử dụng sổ tay.');
      const nextOwner = String(identity);
      ownerQueue(nextOwner).lease = lease.current;
      if (owner.current !== nextOwner) {
        owner.current = nextOwner; key.current = `ssh:typed-notebooks:v1:${encodeURIComponent(nextOwner)}`;
        state.current = { notebooks: [], pages: [], pending: {} };
        try {
          const cache = JSON.parse(localStorage.getItem(key.current) || 'null');
          if (cache?.version === 1 && Array.isArray(cache.notebooks) && Array.isArray(cache.pages) && cache.pending && typeof cache.pending === 'object') {
            state.current = { notebooks: cache.notebooks, pages: cache.pages, pending: cache.pending };
          }
        } catch { if (mounted.current) setStorageError(new Error('Không đọc được bản nháp trên trình duyệt.')); }
      }
      const initialBooks = new Map(state.current.notebooks.map(book => [book.id, book]));
      const initialPages = new Map(state.current.pages.map(page => [page.id, page]));
      const [booksResponse, notesResponse] = await Promise.all([workspaceApi.notebooks.list(), workspaceApi.notes.list()]);
      const books = responseList(booksResponse, 'notebooks').map(normalizeNotebook), notes = responseList(notesResponse, 'notes').map(normalizePage);
      // A save may finish while the list request is still in flight. Preserve
      // any local object changed after this read began even if already acknowledged.
      for (const [local, initial, remote] of [[state.current.notebooks, initialBooks, books], [state.current.pages, initialPages, notes]]) {
        local.filter(item => initial.get(item.id) !== item).forEach(item => {
          const index = remote.findIndex(value => value.id === item.id);
          if (index >= 0) remote[index] = item; else remote.push(item);
        });
      }
      for (const entry of Object.values(state.current.pending)) {
        const list = entry.kind === 'page' ? notes : books;
        const index = list.findIndex(item => item.id === entry.value.id);
        if (index >= 0) list[index] = entry.value; else list.push(entry.value);
      }
      state.current.notebooks = books; state.current.pages = notes; ready.current = true; needsRefetch.current = false;
      publish(); await flush();
    } catch (cause) {
      if (mounted.current) { setError(cause); setSaveState(cause.response ? 'error' : 'offline'); }
      // Only a positively identified owner may read their cached drafts.
      if (owner.current) { ready.current = true; publish(); }
    } finally { if (mounted.current) setLoading(false); }
  }, [publish, flush]);
  useEffect(() => {
    mounted.current = true; refetch();
    const online = () => { if (ready.current && !needsRefetch.current) flush(); else refetch(); };
    const offline = () => { if (Object.keys(state.current.pending).length) setSaveState('offline'); };
    const visibility = () => { if (document.visibilityState === 'hidden') { persist(); flush(); } };
    const beforeUnload = () => { persist(); flush(); };
    window.addEventListener('online', online); window.addEventListener('offline', offline); window.addEventListener('beforeunload', beforeUnload); document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer.current); persist(); flush(); mounted.current = false; window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', visibility); };
  }, [refetch, flush, persist]);
  const requireReady = () => { if (!ready.current || !owner.current) throw new Error('Chưa xác định hồ sơ sinh viên. Vui lòng thử tải lại.'); };
  const updatePage = useCallback((id, patch) => {
    if (!ready.current) return;
    const previous = state.current.pages.find(page => page.id === String(id));
    if (!previous) return;
    const content = patch.content || patch.doc || previous.content || previous.doc;
    const value = { ...previous, ...patch, content, doc: content, updatedAt: new Date().toISOString() };
    state.current.pages = state.current.pages.map(page => page.id === String(id) ? value : page);
    state.current.notebooks = state.current.notebooks.map(book => book.id === value.notebookId ? { ...book, updatedAt: value.updatedAt } : book);
    queue('page', value); return value;
  }, [queue]);
  const createPage = useCallback(async (notebookId, options = {}) => {
    requireReady();
    const book = state.current.notebooks.find(item => item.id === String(notebookId));
    if (!book) throw new Error('Không tìm thấy sổ tay.');
    const value = { ...newPage(notebookId, options.template || 'blank', options.parentId || null), title: options.title || 'Trang mới', subject: book.subject };
    state.current.pages = [...state.current.pages, value];
    state.current.notebooks = state.current.notebooks.map(item => item.id === value.notebookId ? { ...item, updatedAt: value.updatedAt } : item);
    queue('page', value, true); return value;
  }, [queue]);
  const createNotebook = useCallback(async (options) => {
    requireReady();
    const value = { title: options.title.trim(), subject: options.subject || 'Ghi chép tự học', color: options.color || '#8b5cf6', template: options.template || 'blank', description: '', bookmarked: false };
    if (!value.title) throw new Error('Vui lòng nhập tên sổ tay.');
    const result = normalizeNotebook(unwrapResponse(await workspaceApi.notebooks.create(encodeNotebook(value))));
    state.current.notebooks = [...state.current.notebooks, result]; publish();
    await createPage(result.id, { title: 'Trang đầu tiên', template: value.template });
    return result;
  }, [publish, createPage]);
  const updateNotebook = useCallback((id, patch) => {
    const previous = state.current.notebooks.find(item => item.id === String(id));
    if (!previous) return;
    const value = { ...previous, ...patch, updatedAt: new Date().toISOString() };
    state.current.notebooks = state.current.notebooks.map(item => item.id === String(id) ? value : item);
    queue('notebook', value);
    if (patch.subject != null && patch.subject !== previous.subject) {
      state.current.pages.filter(page => page.notebookId === String(id)).forEach(page => updatePage(page.id, { subject: patch.subject }));
    }
    return value;
  }, [queue, updatePage]);
  const deletePage = useCallback(async (id) => {
    requireReady(); await flush();
    if (Object.keys(state.current.pending).length) throw new Error('Hãy đồng bộ bản nháp trước khi xóa trang.');
    const target = String(id), descendants = new Set([target]);
    let size;
    do { size = descendants.size; state.current.pages.forEach(page => { if (descendants.has(page.parentId)) descendants.add(page.id); }); } while (size !== descendants.size);
    // Deleting one at a time records partial success if the connection drops.
    for (const pageId of [...descendants].reverse()) {
      await workspaceApi.notes.remove(pageId);
      state.current.pages = state.current.pages.filter(page => page.id !== pageId);
      publish();
    }
  }, [flush, publish, updatePage]);
  const deleteNotebook = useCallback(async (id) => {
    requireReady(); await flush();
    if (Object.keys(state.current.pending).length) throw new Error('Hãy đồng bộ bản nháp trước khi xóa sổ tay.');
    await workspaceApi.notebooks.remove(id);
    state.current.notebooks = state.current.notebooks.filter(item => item.id !== String(id));
    state.current.pages = state.current.pages.filter(item => item.notebookId !== String(id)); publish();
  }, [flush, publish]);
  const duplicatePage = useCallback(async id => {
    requireReady();
    const source = state.current.pages.find(page => page.id === String(id));
    if (!source) throw new Error('Không tìm thấy trang.');
    const copy = { ...source, ...newPage(source.notebookId), title: `${source.title} (bản sao)`, content: structuredClone(source.content || source.doc), parentId: source.parentId, subject: source.subject };
    copy.doc = copy.content;
    state.current.pages = [...state.current.pages, copy]; queue('page', copy, true); return copy;
  }, [queue]);
  const duplicateNotebook = useCallback(async id => {
    requireReady();
    const source = state.current.notebooks.find(book => book.id === String(id));
    if (!source) throw new Error('Không tìm thấy sổ tay.');
    const copy = normalizeNotebook(unwrapResponse(await workspaceApi.notebooks.create(encodeNotebook({ ...source, title: `${source.title} (bản sao)` }))));
    state.current.notebooks = [...state.current.notebooks, copy];
    const sourcePages = state.current.pages.filter(page => page.notebookId === String(id));
    const ids = Object.fromEntries(sourcePages.map(page => [page.id, newPage(copy.id).id]));
    sourcePages.forEach(page => {
      const value = { ...structuredClone(page), id: ids[page.id], notebookId: copy.id, parentId: ids[page.parentId] || null, databaseId: undefined, updatedAt: new Date().toISOString() };
      state.current.pages = [...state.current.pages, value]; queue('page', value, true);
    });
    publish(); return copy;
  }, [queue, publish]);
  const retry = useCallback(() => needsRefetch.current ? refetch() : flush(), [refetch, flush]);
  return { notebooks, pages, loading, error, saveState, storageError, refetch, createNotebook, updateNotebook, deleteNotebook, duplicateNotebook, createPage, updatePage, deletePage, duplicatePage, flush, retry };
}
