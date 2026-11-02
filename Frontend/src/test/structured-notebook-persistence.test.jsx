import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useNotebooks from '../pages/Notebooks/useNotebooks';
import { encodeNotebook, encodePage, createPage } from '../pages/Notebooks/notebookModel';

const api = vi.hoisted(() => ({ profile: vi.fn(), books: vi.fn(), notes: vi.fn(), create: vi.fn(), update: vi.fn(), updateBook: vi.fn(), remove: vi.fn() }));
vi.mock('../api', () => ({
  studentApi: { getProfile: api.profile },
  workspaceApi: {
    notebooks: { list: api.books, update: api.updateBook },
    notes: { list: api.notes, create: api.create, update: api.update, remove: api.remove },
  },
}));
const doc = value => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] });
let online = true;
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); online = true;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  api.profile.mockResolvedValue({ student_id: 'owner-one' });
  api.books.mockResolvedValue([{ notebook_id: 1, ...encodeNotebook({ title: 'SQL', subject: 'CSDL' }) }]);
  api.notes.mockResolvedValue([{ ...encodePage({ ...createPage(1), id: 'page-1', content: doc('Original') }) }]);
  api.update.mockImplementation(async (id, payload) => ({ ...payload, databaseId: 1 }));
  api.updateBook.mockResolvedValue({}); api.create.mockImplementation(async payload => payload);
});
afterEach(() => { online = true; });

describe('typed notebook draft persistence', () => {
  it('writes offline changes immediately and restores them over stale server data after remount', async () => {
    const first = renderHook(() => useNotebooks());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    online = false;
    act(() => first.result.current.updatePage('page-1', { content: doc('Offline latest') }));
    expect(first.result.current.saveState).toBe('offline');
    const snapshot = JSON.parse(localStorage.getItem('ssh:typed-notebooks:v1:owner-one'));
    expect(snapshot.pages[0].content).toEqual(doc('Offline latest'));
    first.unmount();
    const restored = renderHook(() => useNotebooks());
    await waitFor(() => expect(restored.result.current.loading).toBe(false));
    expect(restored.result.current.pages[0].content).toEqual(doc('Offline latest'));
    online = true;
    await act(async () => { await restored.result.current.retry(); });
    expect(restored.result.current.saveState).toBe('saved');
    expect(JSON.parse(api.update.mock.calls.at(-1)[1].content).doc).toEqual(doc('Offline latest'));
  });
  it('never acknowledges a newer revision while an older request is in flight', async () => {
    let acknowledge;
    api.update.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => hook.result.current.updatePage('page-1', { content: doc('First revision') }));
    let flushing;
    act(() => { flushing = hook.result.current.flush(); });
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'));
    act(() => hook.result.current.updatePage('page-1', { content: doc('Second revision') }));
    await act(async () => { acknowledge({ databaseId: 1 }); await flushing; });
    expect(hook.result.current.pages[0].content).toEqual(doc('Second revision'));
    expect(JSON.parse(api.update.mock.calls.at(-1)[1].content).doc).toEqual(doc('Second revision'));
    expect(hook.result.current.saveState).toBe('saved');
  });
  it('does not expose another owner cache when the current profile cannot be verified', async () => {
    localStorage.setItem('ssh:typed-notebooks:v1:owner-one', JSON.stringify({ version: 1, notebooks: [{ id: 'secret' }], pages: [], pending: {} }));
    api.profile.mockRejectedValue(new Error('Offline'));
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.notebooks).toEqual([]);
    expect(hook.result.current.error.message).toBe('Offline');
  });
  it('retries the same stable creation id after a lost POST response', async () => {
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    api.create.mockRejectedValueOnce(new Error('Connection lost'));
    let created;
    await act(async () => { created = await hook.result.current.createPage('1'); await hook.result.current.flush(); });
    expect(hook.result.current.saveState).toBe('offline');
    act(() => hook.result.current.updatePage(created.id, { content: doc('Edited after lost creation response') }));
    await act(async () => { await hook.result.current.retry(); });
    expect(api.create.mock.calls.map(call => call[0].id)).toEqual([created.id, created.id]);
    expect(api.update.mock.calls.at(-1)[0]).toBe(created.id);
    expect(JSON.parse(api.update.mock.calls.at(-1)[1].content).doc).toEqual(doc('Edited after lost creation response'));
    expect(hook.result.current.saveState).toBe('saved');
  });
  it.each(['books', 'notes'])('falls back to verified-owner cache when the %s list fails and refetches on online', async failing => {
    const first = renderHook(() => useNotebooks());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    online = false;
    act(() => first.result.current.updatePage('page-1', { content: doc('Restored offline draft') }));
    first.unmount();
    api[failing].mockRejectedValueOnce(new Error('Offline list'));
    const restored = renderHook(() => useNotebooks());
    await waitFor(() => expect(restored.result.current.loading).toBe(false));
    expect(restored.result.current.pages[0].content).toEqual(doc('Restored offline draft'));
    expect(restored.result.current.notebooks[0].title).toBe('SQL');
    online = true;
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(restored.result.current.saveState).toBe('saved'));
    expect(restored.result.current.pages[0].content).toEqual(doc('Restored offline draft'));
    expect(api[failing].mock.calls.length).toBeGreaterThanOrEqual(3);
  });
  it('durably restores and syncs notebook metadata after reload', async () => {
    const first = renderHook(() => useNotebooks());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    online = false;
    act(() => first.result.current.updateNotebook('1', { subject: 'Đại số', color: '#ec4899', bookmarked: true }));
    first.unmount();
    const restored = renderHook(() => useNotebooks());
    await waitFor(() => expect(restored.result.current.loading).toBe(false));
    expect(restored.result.current.notebooks[0]).toMatchObject({ subject: 'Đại số', color: '#ec4899', bookmarked: true });
    online = true;
    await act(async () => { await restored.result.current.retry(); });
    expect(JSON.parse(api.updateBook.mock.calls[0][1].description)).toMatchObject({ subject: 'Đại số', color: '#ec4899', bookmarked: true });
  });
  it('blocks payloads above the API cap while retaining the draft and saving unrelated metadata', async () => {
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const huge = doc('x'.repeat(1000001));
    await act(async () => {
      hook.result.current.updatePage('page-1', { content: huge });
      hook.result.current.updateNotebook('1', { title: 'Still saves' });
      await hook.result.current.flush();
    });
    expect(api.update).not.toHaveBeenCalled();
    expect(api.updateBook).toHaveBeenCalled();
    expect(hook.result.current.saveState).toBe('error');
    expect(hook.result.current.error.response.status).toBe(413);
    const snapshot = JSON.parse(localStorage.getItem('ssh:typed-notebooks:v1:owner-one'));
    expect(snapshot.pages[0].content).toEqual(huge);
    expect(snapshot.pending['page:page-1']).toBeDefined();
    await act(async () => { hook.result.current.updatePage('page-1', { content: doc('Reduced') }); await hook.result.current.retry(); });
    expect(hook.result.current.saveState).toBe('saved');
  });
  it('accepts a payload exactly at the API one-million-character cap', async () => {
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const page = hook.result.current.pages[0];
    const overhead = encodePage({ ...page, content: doc('') }).content.length;
    await act(async () => { hook.result.current.updatePage('page-1', { content: doc('x'.repeat(1000000 - overhead)) }); await hook.result.current.flush(); });
    expect(api.update.mock.calls[0][1].content).toHaveLength(1000000);
    expect(hook.result.current.saveState).toBe('saved');
  });
  it('preserves typing acknowledged while a stale refetch remains in flight', async () => {
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    let resolveNotes;
    api.notes.mockImplementationOnce(() => new Promise(resolve => { resolveNotes = resolve; }));
    let fetching;
    act(() => { fetching = hook.result.current.refetch(); });
    await waitFor(() => expect(resolveNotes).toBeTypeOf('function'));
    await act(async () => { hook.result.current.updatePage('page-1', { content: doc('Typing during refetch') }); await hook.result.current.flush(); });
    await act(async () => { resolveNotes([{ ...encodePage({ ...createPage(1), id: 'page-1', content: doc('Stale server') }) }]); await fetching; });
    expect(hook.result.current.pages[0].content).toEqual(doc('Typing during refetch'));
  });
  it('does not let an unmounted editor acknowledgement overwrite the new editor draft', async () => {
    let acknowledge;
    api.update.mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    const first = renderHook(() => useNotebooks());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    act(() => { first.result.current.updatePage('page-1', { content: doc('Old mount') }); first.result.current.flush(); });
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'));
    first.unmount(); online = false;
    const next = renderHook(() => useNotebooks());
    await waitFor(() => expect(next.result.current.loading).toBe(false));
    act(() => next.result.current.updatePage('page-1', { content: doc('New mount unsynced') }));
    await act(async () => { acknowledge({ databaseId: 1 }); });
    const cache = JSON.parse(localStorage.getItem('ssh:typed-notebooks:v1:owner-one'));
    expect(cache.pages[0].content).toEqual(doc('New mount unsynced'));
    expect(cache.pending['page:page-1'].value.content).toEqual(doc('New mount unsynced'));
  });
  it('updates notebook recency during typing without sending notebook metadata on each keystroke', async () => {
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { hook.result.current.updatePage('page-1', { content: doc('Recent typing') }); await hook.result.current.flush(); });
    expect(hook.result.current.notebooks[0].updatedAt).toBe(hook.result.current.pages[0].updatedAt);
    expect(api.updateBook).not.toHaveBeenCalled();
  });
  it('propagates notebook subject moves to contained pages and their API payloads', async () => {
    const hook = renderHook(() => useNotebooks());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { hook.result.current.updateNotebook('1', { subject: 'Mạng máy tính' }); await hook.result.current.flush(); });
    expect(hook.result.current.pages[0].subject).toBe('Mạng máy tính');
    expect(api.update.mock.calls[0][1].subject).toBe('Mạng máy tính');
    expect(JSON.parse(api.updateBook.mock.calls[0][1].description).subject).toBe('Mạng máy tính');
  });
  it('serializes old in-flight creation before the new editor writes and gives the new editor final ownership', async () => {
    const stored = new Map(); let releaseOldPost;
    api.create.mockImplementationOnce(payload => new Promise(resolve => {
      releaseOldPost = () => { stored.set(payload.id, payload); resolve({ ...payload, databaseId: 99 }); };
    })).mockImplementation(async payload => {
      if (!stored.has(payload.id)) stored.set(payload.id, payload);
      return stored.get(payload.id);
    });
    api.update.mockImplementation(async (id, payload) => { stored.set(id, payload); return { ...payload, databaseId: 99 }; });
    const oldEditor = renderHook(() => useNotebooks());
    await waitFor(() => expect(oldEditor.result.current.loading).toBe(false));
    let created;
    await act(async () => { created = await oldEditor.result.current.createPage('1'); oldEditor.result.current.updatePage(created.id, { content: doc('Old editor content') }); oldEditor.result.current.flush(); });
    await waitFor(() => expect(releaseOldPost).toBeTypeOf('function'));
    oldEditor.unmount();
    const nextEditor = renderHook(() => useNotebooks());
    await waitFor(() => expect(nextEditor.result.current.pages.some(page => page.id === created.id)).toBe(true));
    act(() => nextEditor.result.current.updatePage(created.id, { content: doc('Latest from new editor') }));
    expect(api.create).toHaveBeenCalledTimes(1);
    await act(async () => { releaseOldPost(); });
    await waitFor(() => expect(nextEditor.result.current.loading).toBe(false));
    await act(async () => { await nextEditor.result.current.flush(); });
    expect(JSON.parse(stored.get(created.id).content).doc).toEqual(doc('Latest from new editor'));
    const pageUpdates = api.update.mock.calls.filter(([id]) => id === created.id);
    expect(pageUpdates).toHaveLength(1);
    expect(JSON.parse(pageUpdates[0][1].content).doc).toEqual(doc('Latest from new editor'));
    expect(nextEditor.result.current.saveState).toBe('saved');
  });
});
