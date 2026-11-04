import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import Learning from '../pages/Learning/Learning';
import Documents from '../pages/Documents/Documents';
import { courseApi } from '../api';

const response = data => ({ config: {}, data: { success: true, data } });
const ready = { id: 'sql', subject: 'SQL', complete: true, chapterCount: 2, sourceCount: 12, cardCount: 0 };
const pending = { id: 'pending-1', subject: 'SQL', pending: true, complete: false, chapterCount: 0, cardCount: 0 };
function mount(Page = Learning) { return render(<MemoryRouter><AppProvider><Page /></AppProvider></MemoryRouter>); }
afterEach(() => vi.restoreAllMocks());

describe('Manual AI summaries and visible sequential queue', () => {
  it('shows parallel part progress for the active course without starting more AI', async () => {
    const job = { jobId: 'parallel-sql', kind: 'summary', courseId: 'sql', subject: 'SQL', status: 'running', queuePosition: 1,
      totalParts: 8, completedParts: 3, activeWorkers: 4, parallelism: 4,
      message: 'Đang tóm tắt song song môn SQL: 3/8 phần đã lưu, 4/4 AI đang chạy…' };
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [ready], jobs: [job] }));
    vi.spyOn(courseApi, 'getJob').mockResolvedValue(response(job));
    const summarize = vi.spyOn(courseApi, 'summarize');
    mount();
    expect(await screen.findByText('3/8 phần đã lưu · 4 lượt AI đang chạy')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(screen.getByText(job.message)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn hàng đợi' }));
    expect(screen.queryByRole('listitem', { name: /Đang xử lý · Tóm tắt AI · SQL/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng hàng đợi' }));
    expect(screen.getByRole('listitem', { name: /Đang xử lý · Tóm tắt AI · SQL/ })).toBeTruthy();
    expect(summarize).not.toHaveBeenCalled();
  });
  it('keeps a long real summary available and labels partial card retries separately', async () => {
    const course = { ...ready, cardCount: 4,
      summary: { content: 'Bản AI đã lưu', stale: false, format: 'expanded', notice: 'AI trả bản dài hơn mục tiêu; nội dung được giữ đầy đủ.', cardsState: { status: 'partial', completedBatches: 1, totalBatches: 3 } },
      failures: [{ stage: 'cards', message: 'AI trả JSON không hợp lệ.' }] };
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [course], jobs: [] }));
    vi.spyOn(courseApi, 'detail').mockResolvedValue(response(course));
    vi.spyOn(courseApi, 'summary').mockResolvedValue(response('Bản AI đã lưu'));
    const summarize = vi.spyOn(courseApi, 'summarize').mockResolvedValue(response({ jobId: 'retry-cards', status: 'queued' }));
    vi.spyOn(courseApi, 'getJob').mockResolvedValue(response({ jobId: 'retry-cards', status: 'queued' }));
    mount();
    expect(await screen.findByText('Đã lưu bản tóm tắt dạng dài.')).toBeTruthy();
    expect(screen.getByText('Tạo Flashcard: AI trả JSON không hợp lệ.')).toBeTruthy();
    expect(screen.getByText(/Flashcard đã lưu 1\/3 lô/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vào học ↗' }));
    await screen.findByText('Bản AI đã lưu');
    expect(screen.getByRole('status').textContent).toContain('AI trả bản dài hơn mục tiêu');
    expect(summarize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tiếp Flashcard' }));
    await waitFor(() => expect(summarize).toHaveBeenCalledWith('sql'));
  });
  it('discovers a background scan and refreshes chapters before the job finishes', async () => {
    let saved = false;
    const job = { jobId: 'background', kind: 'sync', status: 'running', phase: 'materials', subject: 'SQL', queuePosition: 1 };
    vi.spyOn(courseApi, 'list').mockImplementation(async () => response({ courses: [saved ? ready : pending], jobs: [job] }));
    vi.spyOn(courseApi, 'getJob').mockImplementation(async () => { saved = true; return response({ ...job, materialsUpdatedAt: '2026-11-04T14:00:00Z', message: 'Đã lưu slide môn SQL' }); });
    const summarize = vi.spyOn(courseApi, 'summarize'), sync = vi.spyOn(courseApi, 'sync');
    mount();
    await screen.findByText('2 chương · 12 slide');
    expect(screen.getByRole('region', { name: 'Hàng đợi học liệu' })).toBeTruthy();
    expect(screen.getByRole('listitem', { name: /Đang xử lý · Đồng bộ slide · SQL/ })).toBeTruthy();
    expect(summarize).not.toHaveBeenCalled(); expect(sync).not.toHaveBeenCalled();
  });
  it('only starts AI on button click and lets another course enter the queue', async () => {
    const other = { ...ready, id: 'web', subject: 'Web' };
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [ready, other], jobs: [] }));
    vi.spyOn(courseApi, 'detail').mockResolvedValue(response({ chapters: [{ id: 'ch', title: 'Chương 1' }] }));
    const summarize = vi.spyOn(courseApi, 'summarize').mockImplementation(async id => response({ jobId: `summary-${id}`, kind: 'summary', courseId: id, subject: id === 'sql' ? 'SQL' : 'Web', status: id === 'sql' ? 'running' : 'queued', queuePosition: id === 'sql' ? 1 : 2 }));
    vi.spyOn(courseApi, 'getJob').mockImplementation(async id => response({ jobId: id, status: id === 'summary-sql' ? 'running' : 'queued', queuePosition: id === 'summary-sql' ? 1 : 2 }));
    mount();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Vào học ↗' }))[0]);
    await screen.findByText('Chương 1'); expect(summarize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo / cập nhật tóm tắt' }));
    await waitFor(() => expect(summarize).toHaveBeenCalledWith('sql'));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Vào học ↗' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo / cập nhật tóm tắt' }));
    await waitFor(() => expect(summarize).toHaveBeenCalledWith('web'));
    expect(await screen.findByRole('listitem', { name: /Chờ lượt 2 · Tóm tắt AI · Web/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đã vào hàng đợi tóm tắt' }).disabled).toBe(true);
  });
  it('syncs without requesting a summary and displays partial source failures honestly', async () => {
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [pending], jobs: [] }));
    const sync = vi.spyOn(courseApi, 'sync').mockResolvedValue(response({ jobId: 'sync', kind: 'sync', status: 'queued', queuePosition: 2 }));
    vi.spyOn(courseApi, 'getJob').mockResolvedValue(response({ jobId: 'sync', kind: 'sync', status: 'partial', message: 'Giải tích chưa có học liệu được cấp trên EDUX.' }));
    const summarize = vi.spyOn(courseApi, 'summarize'); mount();
    await screen.findByText('Chưa có slide đã quét');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ học liệu' }));
    await waitFor(() => expect(sync).toHaveBeenCalledOnce());
    await screen.findByRole('listitem', { name: /Chưa đầy đủ · Đồng bộ slide/ });
    expect(summarize).not.toHaveBeenCalled(); expect(screen.queryByText('Đã tạo tóm tắt')).toBeNull();
  });
  it('updates an idle page on focus and keeps the last good catalogue on network failure', async () => {
    let fail = false;
    const list = vi.spyOn(courseApi, 'list').mockImplementation(async () => { if (fail) throw new Error('Offline'); return response({ courses: [ready], jobs: [] }); });
    mount(); await screen.findByText('2 chương · 12 slide'); fail = true;
    await act(async () => window.dispatchEvent(new Event('focus')));
    await screen.findByText('Offline'); expect(screen.getByText('2 chương · 12 slide')).toBeTruthy();
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
  it('shows unavailable IU courses as unscanned with their source explanation', async () => {
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [{ ...pending, subject: 'Giải tích', failures: [{ code: 'EDUX_COURSE_UNAVAILABLE', message: 'Chưa được cấp học liệu.' }] }], jobs: [] }));
    const summarize = vi.spyOn(courseApi, 'summarize'); mount();
    await screen.findByText('Chưa được cấp học liệu.');
    expect(screen.queryByText('0 chương')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xem trạng thái' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tạo / cập nhật tóm tắt' }).disabled).toBe(true);
    expect(summarize).not.toHaveBeenCalled();
  });
  it('recognizes lowercase backend job statuses on the Documents screen', async () => {
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [], jobs: [{ jobId: 'background', kind: 'sync', subject: 'SQL', status: 'queued', queuePosition: 2 }] }));
    vi.spyOn(courseApi, 'getJob').mockResolvedValue(response({ jobId: 'background', status: 'queued', queuePosition: 2 }));
    mount(Documents);
    expect(await screen.findByRole('listitem', { name: /Chờ lượt 2 · Đồng bộ slide · SQL/ })).toBeTruthy();
  });
});
