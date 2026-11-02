import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import BlockEditor, { runBlockCommand } from '../pages/Notebooks/editor/BlockEditor';
import { safeHref } from '../pages/Notebooks/editor/blockExtensions';

beforeAll(() => {
  window.scrollBy = vi.fn();
  Range.prototype.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20 });
  Range.prototype.getClientRects = () => [];
});
const blankPage = id => ({ id, content: { type: 'doc', content: [{ type: 'paragraph' }] } });
async function setup(page = blankPage('p1'), extra = {}) {
  const ready = vi.fn(), changed = vi.fn();
  const view = render(<BlockEditor page={page} onReady={ready} onChange={changed} {...extra} />);
  await waitFor(() => expect(ready.mock.calls.some(([editor]) => editor)).toBe(true));
  const editor = ready.mock.calls.find(([value]) => value)?.[0];
  return { ...view, editor, ready, changed };
}
describe('structured notebook keyboard editor', () => {
  it('preserves the editor and undo history when autosave updates the page object', async () => {
    const { editor, ready, changed, rerender } = await setup();
    act(() => editor.commands.insertContent('Kiến thức đang ghi'));
    expect(changed.mock.calls.at(-1)[0].content[0].content[0].text).toBe('Kiến thức đang ghi');
    const doc = editor.getJSON();
    rerender(<BlockEditor page={{ id: 'p1', content: doc }} onReady={ready} onChange={changed} />);
    expect(ready.mock.calls.filter(([value]) => value)).toHaveLength(1);
    expect(editor.isDestroyed).toBe(false);
    act(() => editor.commands.undo());
    expect(editor.getText()).toBe('');
  });
  it('uses slash commands with keyboard navigation and creates a resizable table', async () => {
    const { editor } = await setup();
    act(() => editor.commands.insertContent('/table'));
    expect(await screen.findByRole('listbox', { name: 'Chèn block' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nội dung trang ghi chú' }), { key: 'Enter' });
    expect(editor.getJSON().content.some(node => node.type === 'table')).toBe(true);
    expect(editor.getText()).not.toContain('/table');
    act(() => editor.chain().setTextSelection(3).setCellAttribute('backgroundColor', '#eadbff').run());
    const table = editor.getJSON().content.find(node => node.type === 'table');
    expect(table.content[0].content[0].attrs.backgroundColor).toBe('#eadbff');
  });
  it('persists formula, flashcard and Cornell edits as structured content', async () => {
    const { editor, changed } = await setup();
    act(() => {
      runBlockCommand(editor, 'formula');
      runBlockCommand(editor, 'flashcard');
      runBlockCommand(editor, 'cornell');
    });
    fireEvent.change(await screen.findByLabelText('Công thức LaTeX'), { target: { value: '\\frac{1}{2}' } });
    fireEvent.change(screen.getByLabelText('Câu hỏi flashcard'), { target: { value: 'Khóa ngoại là gì?' } });
    fireEvent.click(screen.getByText('Hiện đáp án'));
    fireEvent.change(screen.getByLabelText('Đáp án flashcard'), { target: { value: 'Khóa tham chiếu bảng khác.' } });
    fireEvent.change(screen.getByLabelText('Cornell: Ghi chú'), { target: { value: 'Entity là thực thể.' } });
    const nodes = changed.mock.calls.at(-1)[0].content;
    expect(nodes.find(node => node.type === 'formula').attrs.latex).toBe('\\frac{1}{2}');
    expect(nodes.find(node => node.type === 'flashcard').attrs).toMatchObject({ question: 'Khóa ngoại là gì?', answer: 'Khóa tham chiếu bảng khác.' });
    expect(nodes.find(node => node.type === 'cornell').attrs.notes).toBe('Entity là thực thể.');
    expect(document.querySelector('.katex')).toBeTruthy();
  });
  it('recreates content only when switching page identities and destroys the previous editor', async () => {
    const { editor, ready, changed, rerender } = await setup();
    act(() => editor.commands.insertContent('Trang một'));
    rerender(<BlockEditor page={{ id: 'p2', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Trang hai' }] }] } }} onReady={ready} onChange={changed} />);
    await waitFor(() => expect(ready.mock.calls.filter(([value]) => value)).toHaveLength(2));
    expect(editor.isDestroyed).toBe(true);
    expect(ready.mock.calls.filter(([value]) => value).at(-1)[0].getText()).toBe('Trang hai');
  });
  it('routes keyboard linking and slash AI to the parent with the active editor', async () => {
    const link = vi.fn(), ai = vi.fn();
    const { editor } = await setup(blankPage('p1'), { onLink: link, onAI: ai });
    const globalShortcut = vi.fn();
    document.addEventListener('keydown', globalShortcut);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nội dung trang ghi chú' }), { key: 'k', ctrlKey: true });
    expect(link).toHaveBeenCalledWith(editor);
    expect(globalShortcut).not.toHaveBeenCalled();
    document.removeEventListener('keydown', globalShortcut);
    act(() => editor.commands.insertContent('/ai'));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nội dung trang ghi chú' }), { key: 'Enter' });
    expect(ai).toHaveBeenCalledWith(editor);
  });
  it('retains image caption, percentage width and alignment through native HTML copy', async () => {
    const { editor } = await setup();
    act(() => editor.commands.setImage({ src: 'https://example.org/slide.png', caption: 'Ảnh slide thật', width: 65, align: 'right' }));
    const html = editor.getHTML();
    expect(html).toContain('width: 65%');
    expect(html).toContain('Ảnh slide thật');
    act(() => editor.commands.setContent(html));
    const image = editor.getJSON().content.find(node => node.type === 'image');
    expect(image.attrs).toMatchObject({ src: 'https://example.org/slide.png', caption: 'Ảnh slide thật', width: 65, align: 'right' });
  });
  it('rejects executable and temporary attachment/image URLs', () => {
    expect(safeHref('javascript:alert(1)')).toBe('');
    expect(safeHref('blob:https://example.org/temporary')).toBe('');
    expect(safeHref('https://example.org/lecture.png')).toBe('https://example.org/lecture.png');
  });
});
