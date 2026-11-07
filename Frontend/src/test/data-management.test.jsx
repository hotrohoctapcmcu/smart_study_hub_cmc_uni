import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings/Settings';
import { AppProvider } from '../components/common/ui';

const categories = [
  { id: 'timetable', label: 'Thời khóa biểu', description: 'Lịch đã lưu', count: 12 },
  { id: 'notes', label: 'Ghi chú, sổ tay & vở canvas', description: 'Ghi chép cá nhân', count: 3 },
  { id: 'connections', label: 'Phiên đăng nhập', description: 'Phiên các cổng trường', count: 0 }
];
afterEach(() => vi.unstubAllGlobals());
function mount(reset = vi.fn().mockResolvedValue({ restarting: true })) {
  vi.stubGlobal('__uniStudyData', { catalog: vi.fn().mockResolvedValue(categories), reset });
  render(<MemoryRouter initialEntries={['/settings?section=data']}><AppProvider><Settings /></AppProvider></MemoryRouter>);
  return reset;
}

describe('Data management', () => {
  it('requires explicit selection and confirmation, and sends only the selected types', async () => {
    const reset = mount();
    expect(screen.getByRole('button', { name: 'Xóa dữ liệu đã chọn' }).disabled).toBe(true);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Thời khóa biểu' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ghi chú, sổ tay & vở canvas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu đã chọn' }));
    expect(reset).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Xóa & khởi động lại' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu đã chọn' }));
    fireEvent.change(screen.getByLabelText('Nhập XÓA để xác nhận'), { target: { value: 'XÓA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa & khởi động lại' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith({ categories: ['timetable', 'notes'], confirmation: 'XÓA' }));
  });
  it('supports full reset and keeps a failed reset available to retry', async () => {
    const reset = mount(vi.fn().mockRejectedValue(new Error('Không thể ghi yêu cầu')));
    await screen.findByRole('checkbox', { name: 'Thời khóa biểu' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xóa toàn bộ dữ liệu' }));
    expect(screen.getByRole('checkbox', { name: 'Thời khóa biểu' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu đã chọn' }));
    fireEvent.change(screen.getByLabelText('Nhập XÓA để xác nhận'), { target: { value: 'XÓA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa & khởi động lại' }));
    await screen.findByText('Không thể ghi yêu cầu');
    expect(reset).toHaveBeenCalledWith({ categories: ['all'], confirmation: 'XÓA' });
    expect(screen.getByRole('button', { name: 'Xóa & khởi động lại' }).disabled).toBe(false);
  });
});
