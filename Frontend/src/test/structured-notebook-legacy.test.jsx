import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import DocumentLibrary, { isStructuredNote } from '../pages/Documents/DocumentLibrary';
import apiClient from '../api/apiClient';
import { encodePage, createPage } from '../pages/Notebooks/notebookModel';
import { saveBlob } from '../utils/files';
vi.mock('../utils/files', () => ({ saveBlob: vi.fn(), fileSize: () => '0 KB' }));
const originalAdapter = apiClient.defaults.adapter;
let rows, requests;
const structured = { ...encodePage({ ...createPage(8), id: 'structured', title: 'CSDL', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Khóa ngoại tham chiếu bảng khác.' }] }] } }) };
beforeEach(() => {
  rows = [structured, { id: 'legacy', notebookId: 8, title: 'Ghi chú cũ', content: 'Văn bản nguyên vẹn' }]; requests = [];
  apiClient.defaults.adapter = async config => {
    requests.push(config);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { success: true, data: config.url === '/notes' ? rows : [] } };
  };
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; vi.clearAllMocks(); });
function Location() { const location = useLocation(); return <output aria-label="Đường dẫn">{location.search}</output>; }
function mount(path = '/documents?tab=notes') { return render(<MemoryRouter initialEntries={[path]}><AppProvider><DocumentLibrary /><Location /></AppProvider></MemoryRouter>); }
describe('legacy note compatibility with structured notebook pages', () => {
  it('recognizes only known envelopes or Tiptap documents', () => {
    expect(isStructuredNote(structured)).toBe(true);
    expect(isStructuredNote({ content: JSON.stringify({ type: 'doc', content: [] }) })).toBe(true);
    expect(isStructuredNote({ content: '{"format":"ssh-notebook","kind":"page","version":2}' })).toBe(false);
    expect(isStructuredNote({ content: '{"unrelated":true}' })).toBe(false);
  });
  it('shows and searches readable text, and exports a correctly labeled plain-text file', async () => {
    mount();
    expect(await screen.findByText('Khóa ngoại tham chiếu bảng khác.')).toBeTruthy();
    expect(screen.queryByText(/ssh-notebook/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm ghi chú...' }), { target: { value: 'tham chiếu' } });
    expect(screen.getByText('CSDL')).toBeTruthy();
    expect(screen.queryByText('Ghi chú cũ')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất TXT' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(saveBlob.mock.calls[0][1]).toBe('CSDL.txt');
    expect(saveBlob.mock.calls[0][0].data.type).toBe('text/plain;charset=utf-8');
    expect(requests.some(request => request.url.includes('/export'))).toBe(false);
  });
  it('routes a structured deep link to its notebook page without opening the old textarea', async () => {
    mount('/documents?tab=notes&note=structured&keep=yes');
    await waitFor(() => expect(screen.getByLabelText('Đường dẫn').textContent).toContain('tab=notebooks'));
    const target = new URLSearchParams(screen.getByLabelText('Đường dẫn').textContent);
    expect(target.get('notebook')).toBe('8'); expect(target.get('page')).toBe('structured'); expect(target.get('keep')).toBe('yes'); expect(target.has('note')).toBe(false);
    expect(screen.queryByRole('textbox', { name: 'Nội dung' })).toBeNull();
  });
  it('preserves the legacy plaintext edit and save behavior', async () => {
    mount('/documents?tab=notes&note=legacy');
    const textarea = await screen.findByDisplayValue('Văn bản nguyên vẹn');
    fireEvent.change(textarea, { target: { value: 'Văn bản đã sửa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(requests.some(request => request.url === '/notes/legacy' && request.method === 'put')).toBe(true));
    const request = requests.find(request => request.url === '/notes/legacy' && request.method === 'put');
    expect(JSON.parse(request.data).content).toBe('Văn bản đã sửa');
  });
});
