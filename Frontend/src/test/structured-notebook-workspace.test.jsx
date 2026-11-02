import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import NotebookEditor from '../pages/Notebooks/editor/NotebookEditor';
import PageSidebar from '../pages/Notebooks/editor/PageSidebar';
import { AppProvider } from '../components/common/ui';

beforeAll(() => {
  window.scrollBy = vi.fn();
  Range.prototype.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20 });
  Range.prototype.getClientRects = () => [];
});
const book = { id: 'book1', title: 'Database Notes', subject: 'Cơ sở dữ liệu', color: '#8b5cf6' };
const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const initialPage = { id: 'page1', notebookId: 'book1', title: 'ERD', order: 0, parentId: null, content: { type: 'doc', content: [paragraph('Alpha beta alpha gamma')] } };
function Workspace({ initial = initialPage }) {
  const [pages, setPages] = useState([initial]);
  const store = { pages, saveState: 'saved', flush: vi.fn(), retry: vi.fn(), updatePage: (id, patch) => setPages(rows => rows.map(page => page.id === id ? { ...page, ...patch } : page)) };
  return <AppProvider><NotebookEditor notebook={book} store={store} pageId={initial.id} onSelectPage={() => {}} onBack={() => {}} /></AppProvider>;
}
async function ready(initial = initialPage) {
  const view = render(<Workspace initial={initial} />);
  const textbox = await screen.findByRole('textbox', { name: 'Nội dung trang ghi chú' });
  await waitFor(() => expect(textbox.editor).toBeTruthy());
  return { ...view, editor: textbox.editor, textbox };
}
describe('structured notebook workspace integration', () => {
  it('applies toolbar fonts and colors to the retained text selection', async () => {
    const { editor } = await ready();
    act(() => editor.commands.setTextSelection({ from: 7, to: 11 }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Font chữ' }), { target: { value: 'Arial' } });
    fireEvent.change(screen.getByLabelText('Màu chữ'), { target: { value: '#ff0000' } });
    const marked = editor.getJSON().content[0].content.find(node => node.text === 'beta');
    expect(marked.marks.find(mark => mark.type === 'textStyle').attrs).toMatchObject({ fontFamily: 'Arial', color: '#ff0000' });
    expect(editor.state.selection.from).toBe(7);
    expect(editor.state.selection.to).toBe(11);
  });
  it('restores the selected phrase when inserting a link through a modal', async () => {
    const { editor } = await ready();
    act(() => editor.commands.setTextSelection({ from: 7, to: 11 }));
    fireEvent.click(screen.getByRole('button', { name: 'Chèn liên kết (Ctrl+K)' }));
    fireEvent.change(screen.getByLabelText('Địa chỉ liên kết'), { target: { value: 'https://example.org/database' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chèn vào trang' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(editor.getText()).toBe('Alpha beta alpha gamma');
    const linked = editor.getJSON().content[0].content.find(node => node.text === 'beta');
    expect(linked.marks.find(mark => mark.type === 'link').attrs.href).toBe('https://example.org/database');
  });
  it('finds the first match on Enter rather than skipping to the second', async () => {
    const { editor } = await ready();
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
    const input = screen.getByRole('textbox', { name: 'Tìm trong nội dung trang' });
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);
  });
  it('closes slash commands with Escape while keeping Focus mode active', async () => {
    const { editor, textbox } = await ready({ ...initialPage, content: { type: 'doc', content: [{ type: 'paragraph' }] } });
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    act(() => editor.commands.insertContent('/table'));
    expect(screen.getByRole('listbox', { name: 'Chèn block' })).toBeTruthy();
    fireEvent.keyDown(textbox, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Chèn block' })).toBeNull();
    expect(document.body.classList.contains('nw-focus-active')).toBe(true);
  });
  it('preserves TOC button identity while editor selection changes', async () => {
    const { editor } = await ready({ ...initialPage, content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Mô hình ERD' }] }, paragraph('Nội dung')] } });
    const toc = screen.getByRole('complementary', { name: 'Mục lục trang' });
    const before = within(toc).getByRole('button', { name: '1. Mô hình ERD' });
    act(() => editor.commands.setTextSelection(3));
    expect(within(toc).getByRole('button', { name: '1. Mô hình ERD' })).toBe(before);
  });
  it('opens page actions from search results', () => {
    render(<AppProvider><PageSidebar notebook={book} pages={[initialPage]} selectedId="page1" onSelect={() => {}} store={{ updatePage: vi.fn() }} open={false} onClose={() => {}} /></AppProvider>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm trang' }), { target: { value: 'ERD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thao tác trang ERD' }));
    expect(screen.getByRole('button', { name: 'Đổi tên' })).toBeTruthy();
  });
});
