import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { aiApi, examApi, syncApi } from '../api';
import { AppProvider } from '../components/common/ui';
import AITutor from '../pages/AITutor/AITutor';

const response = data => ({ config: {}, data: { success: true, data } });
const rows = [
  { id: 'saved-join', title: 'Ôn tập phép JOIN', updatedAt: '2026-11-04T16:00:00Z' },
  { id: 'saved-sort', title: 'Độ phức tạp thuật toán', updatedAt: '2026-11-03T16:00:00Z' },
];
const saved = {
  id: 'saved-join', title: rows[0].title,
  messages: [
    { role: 'user', text: 'INNER JOIN là gì?', createdAt: '2026-11-04T16:00:00Z' },
    { role: 'assistant', text: '**JOIN** ghép các dòng thỏa điều kiện.', createdAt: '2026-11-04T16:00:01Z' },
  ],
};
function mount() { return render(<MemoryRouter><AppProvider><AITutor /></AppProvider></MemoryRouter>); }
const enter = text => fireEvent.change(screen.getByLabelText('Tin nhắn cho AI Tutor'), { target: { value: text } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Lịch sử trò chuyện' }));
  return screen.findByRole('dialog', { name: 'Lịch sử trò chuyện' });
}
beforeEach(() => {
  vi.spyOn(aiApi, 'status').mockResolvedValue(response({ available: true }));
  vi.spyOn(syncApi, 'currentCourses').mockResolvedValue(response({ resolved: true, courses: [] }));
  vi.spyOn(examApi, 'list').mockResolvedValue(response([]));
  vi.spyOn(aiApi, 'conversations').mockResolvedValue(response(rows));
  vi.spyOn(aiApi, 'conversation').mockResolvedValue(response(saved));
});

describe('AI conversation history', () => {
  it('opens saved messages and continues the same conversation while preserving the draft', async () => {
    const ask = vi.spyOn(aiApi, 'ask').mockResolvedValue(response({ answer: 'Ví dụ tiếp theo', conversationId: saved.id }));
    mount(); enter('Cho ví dụ tiếp theo');
    const dialog = await open();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Ôn tập phép JOIN/ }));
    await screen.findByText('INNER JOIN là gì?');
    expect(screen.getByText('JOIN').tagName).toBe('STRONG');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Tin nhắn cho AI Tutor').value).toBe('Cho ví dụ tiếp theo');
    send();
    await screen.findByText('Ví dụ tiếp theo');
    expect(ask).toHaveBeenCalledWith({ question: 'Cho ví dụ tiếp theo', conversationId: saved.id }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(aiApi.conversation).toHaveBeenCalledWith(saved.id, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it('searches Vietnamese titles without accents and keeps history after starting a new chat or remounting', async () => {
    let page = mount();
    let dialog = await open();
    await within(dialog).findByRole('button', { name: /Độ phức tạp/ });
    fireEvent.change(within(dialog).getByLabelText('Tìm cuộc trò chuyện'), { target: { value: 'do phuc tap' } });
    expect(within(dialog).getByRole('button', { name: /Độ phức tạp/ })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Ôn tập phép JOIN/ })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Tìm cuộc trò chuyện'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Ôn tập phép JOIN/ }));
    await screen.findByText('INNER JOIN là gì?');
    fireEvent.click(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
    expect(screen.queryByText('INNER JOIN là gì?')).toBeNull();
    page.unmount(); page = mount();
    dialog = await open();
    expect(await within(dialog).findByRole('button', { name: /Ôn tập phép JOIN/ })).toBeTruthy();
    expect(aiApi.conversations).toHaveBeenCalledTimes(2);
  });
  it('shows an empty history without inventing sample conversations', async () => {
    aiApi.conversations.mockResolvedValue(response([]));
    mount(); await open();
    expect(await screen.findByText('Chưa có cuộc trò chuyện đã lưu')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Các cuộc trò chuyện đã lưu' })).toBeNull();
  });
  it('retries a failed history list', async () => {
    aiApi.conversations.mockRejectedValueOnce(new Error('Mất kết nối lịch sử'));
    mount(); const dialog = await open();
    await within(dialog).findByText('Không tải được lịch sử');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thử lại' }));
    expect(await within(dialog).findByRole('button', { name: /Ôn tập phép JOIN/ })).toBeTruthy();
  });
  it('keeps the current conversation when loading another history fails', async () => {
    vi.spyOn(aiApi, 'ask').mockResolvedValue(response({ answer: 'Nội dung hiện tại', conversationId: 'current-chat' }));
    aiApi.conversation.mockRejectedValueOnce(new Error('Hội thoại không còn tồn tại'));
    mount(); enter('Câu hỏi hiện tại'); send();
    await screen.findByText('Nội dung hiện tại');
    const dialog = await open();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Ôn tập phép JOIN/ }));
    expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'Hội thoại không còn tồn tại');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }));
    expect(screen.getByText('Nội dung hiện tại')).toBeTruthy();
  });
  it('cancels a pending history load when closed and ignores its late response', async () => {
    let finish;
    aiApi.conversation.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mount(); const dialog = await open();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Ôn tập phép JOIN/ }));
    await waitFor(() => expect(aiApi.conversation).toHaveBeenCalledOnce());
    const signal = aiApi.conversation.mock.calls[0][1].signal;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }));
    expect(signal.aborted).toBe(true);
    await act(async () => finish(response(saved)));
    expect(screen.queryByText('INNER JOIN là gì?')).toBeNull();
  });
});
