import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import Textbook from '../pages/Textbook/Textbook';
import { createBook, getBook, listBooks, saveBook, setTextbookOwner } from '../utils/textbookStore';
function Location() { const location = useLocation(); return <output aria-label="Trang hiện tại">{location.pathname}</output>; }
function mount() { render(<MemoryRouter initialEntries={['/textbook']}><AppProvider><Textbook /><Location /></AppProvider></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); setTextbookOwner('device'); });
describe('Textbook library', () => {
  it('creates a real local notebook and navigates to its canvas', async () => {
    mount();
    expect(screen.getByText('Bạn chưa có vở ghi nào 📖')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạo vở mới' })[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tên vở ghi'), { target: { value: 'Những ý tưởng mới' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xanh lá' }));
    fireEvent.submit(dialog.querySelector('form'));
    await screen.findByText(`/textbook/${listBooks()[0].id}`);
    const stored = listBooks()[0];
    expect(stored.title).toBe('Những ý tưởng mới');
    expect(stored.coverColor).toBe('#6da98e');
    expect(stored.pages).toHaveLength(1);
  });
  it('searches inside pages and filters by real bookmark state', () => {
    const chemistry = createBook({ title: 'Hóa học' });
    chemistry.pages[0].objects.push({ id: 't', type: 'text', data: { text: 'Định luật bảo toàn' } });
    saveBook(chemistry);
    createBook({ title: 'Đại số' });
    mount();
    fireEvent.change(screen.getByLabelText('Tìm kiếm trong vở ghi'), { target: { value: 'dinh luat' } });
    expect(screen.getByRole('link', { name: 'Mở vở Hóa học' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Mở vở Đại số' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu vở Hóa học' }));
    expect(getBook(chemistry.id).bookmarked).toBe(true);
    fireEvent.change(screen.getByLabelText('Tìm kiếm trong vở ghi'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đã đánh dấu' }));
    expect(screen.getByRole('link', { name: 'Mở vở Hóa học' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Mở vở Đại số' })).toBeNull();
  });
});
