import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { AppProvider } from '../components/common/ui';
import Documents from '../pages/Documents/Documents';
import { adaptCourse, studyStats } from '../utils/studyMaterials';
import { studyStorageKey } from '../hooks/useStudyProgress';
import * as fileUtils from '../utils/files';

const adapter = apiClient.defaults.adapter;
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';
const course = { id: 'sql', subject: 'Cơ sở dữ liệu', subjectCode: 'INFO2007', chapters: [
  { id: 'chapter-1', title: 'Tổng quan cơ sở dữ liệu', documents: [
    { id: 'same-id', title: 'Khái niệm dữ liệu', number: 1, content: 'Dữ liệu mô tả các sự vật.', image_base64: image.split(',')[1] },
    { id: 's2', title: 'Các loại khóa', number: 2, content: 'Khóa chính xác định duy nhất mỗi bản ghi.' },
  ] },
  { id: 'chapter-2', title: 'Mô hình thực thể liên kết', documents: [
    { id: 'same-id', title: 'Thực thể', number: 1, content: 'Entity là thực thể trong mô hình ER.' },
  ] },
] };
const response = (config, data) => ({ config, data: { success: true, data }, status: 200, statusText: 'OK', headers: {} });
function Location() { return <output aria-label="route">{useLocation().search}</output>; }
function mount(path = '/documents') { return render(<MemoryRouter initialEntries={[path]}><AppProvider><Documents /><Location /></AppProvider></MemoryRouter>); }
let requests;
beforeEach(() => {
  localStorage.clear(); requests = [];
  apiClient.defaults.adapter = async config => {
    requests.push(config);
    if (config.url === '/learning/courses') return response(config, { courses: [{ id: course.id, subject: course.subject, subjectCode: course.subjectCode, chapterCount: 2 }], scope: { semester: '1', academicYear: '2026-2027' } });
    if (config.url === '/learning/courses/sql') return response(config, course);
    if (config.url === '/student/profile') return response(config, { student_code: 'study-test' });
    if (config.url === '/documents') return response(config, [{ id: 'word', title: 'Hướng dẫn SQL.docx', type: 'docx', subject: course.subject }]);
    if (config.url === '/ai/ask') return response(config, { answer: 'Câu trả lời dựa trên slide.' });
    return adapter(config);
  };
});
afterEach(() => { apiClient.defaults.adapter = adapter; localStorage.clear(); });

describe('Study library and viewer', () => {
  it('ignores EDUX image fields and image-only content', () => {
    const adapted = adaptCourse({ id: 'image-course', chapters: [{ id: 'c', documents: [
      { id: 's', content: image.split(',')[1], image_base64: image, images: [image] },
      { id: 'text', content: '<p>Kiến thức thật.</p><img src="' + image + '">', imageUrl: '/old.png' },
    ] }] });
    expect(adapted.chapters[0].slides[0]).toMatchObject({ text: '', images: [] });
    expect(adapted.chapters[0].slides[1]).toMatchObject({ text: 'Kiến thức thật.', images: [] });
  });
  it('opens subject, chapter and slide using lecture text', async () => {
    mount();
    expect(screen.getByRole('tab', { name: 'Bài giảng' }).getAttribute('aria-selected')).toBe('true');
    const card = await screen.findByRole('button', { name: 'Mở môn Cơ sở dữ liệu' });
    expect(within(card).queryByRole('img')).toBeNull();
    fireEvent.click(card);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mở Tổng quan cơ sở dữ liệu' }));
    expect(screen.getAllByRole('button', { name: /^Mở slide/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Mở slide 1: Khái niệm dữ liệu' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('img')).toBeNull();
    expect(within(dialog).getAllByText('Dữ liệu mô tả các sự vật.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('route').textContent).toContain('slide=same-id');
    expect(requests.some(c => c.url.endsWith('/file'))).toBe(false);
  });
  it('persists per-slide notes, bookmarks and explicit completion, and resumes the last opened slide', async () => {
    mount('/documents?subject=sql&chapter=chapter-1&slide=same-id');
    let dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi chú' }));
    fireEvent.change(screen.getByLabelText('Ghi chú cho slide 1'), { target: { value: 'Ghi chú riêng chương 1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đánh dấu slide' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đánh dấu đã học' }));
    const key = adaptCourse(course).chapters[0].slides[0].key;
    expect(JSON.parse(localStorage.getItem(studyStorageKey('study-test'))).records[key]).toMatchObject({ learned: true, bookmarked: true, note: 'Ghi chú riêng chương 1' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByLabelText('Ghi chú cho slide 2').value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tài liệu' }));
    expect(screen.getByText('TIẾP TỤC HỌC')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục học' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Đến slide 2' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đến slide 1' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi chú' }));
    expect(screen.getByLabelText('Ghi chú cho slide 1').value).toBe('Ghi chú riêng chương 1');
    expect(within(dialog).getByRole('button', { name: 'Đã học' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('sends subject, chapter, slide and actual content to AI and keeps keyboard shortcuts out of note fields', async () => {
    mount('/documents?subject=sql&chapter=chapter-2&slide=same-id');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'AI Tutor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giải thích slide này' }));
    await screen.findByText('Câu trả lời dựa trên slide.');
    const body = JSON.parse(requests.find(c => c.url === '/ai/ask').data);
    expect(body.question).toContain('Môn: Cơ sở dữ liệu');
    expect(body.question).toContain('Chương 2: Mô hình thực thể liên kết');
    expect(body.question).toContain('Slide: 1');
    expect(body.question).toContain('Entity là thực thể trong mô hình ER.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ghi chú' }));
    fireEvent.keyDown(screen.getByLabelText('Ghi chú cho slide 1'), { key: '+' });
    expect(screen.getByLabelText('Tỷ lệ thu phóng').textContent).toBe('100%');
    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByLabelText('Tỷ lệ thu phóng').textContent).toBe('125%');
  });
  it('finds chapters, slide content and Word documents with accent-insensitive search', async () => {
    mount(); await screen.findByRole('button', { name: 'Mở môn Cơ sở dữ liệu' });
    const search = screen.getByPlaceholderText('Tìm môn học, chương, slide, tài liệu...');
    fireEvent.change(search, { target: { value: 'thuc the lien ket' } });
    expect(screen.getByRole('button', { name: /Mô hình thực thể liên kết/ })).toBeTruthy();
    fireEvent.change(search, { target: { value: 'duy nhat' } });
    expect(screen.getByRole('button', { name: /Các loại khóa/ })).toBeTruthy();
    fireEvent.change(search, { target: { value: 'huong dan sql' } });
    fireEvent.click(screen.getByRole('button', { name: /Hướng dẫn SQL.docx.*Word/ }));
    expect(screen.getByLabelText('route').textContent).toContain('document=word');
    expect(screen.getByRole('tab', { name: 'File' }).getAttribute('aria-selected')).toBe('true');
  });
  it('filters by actual learning status without inventing progress', async () => {
    mount(); await screen.findByRole('button', { name: 'Mở môn Cơ sở dữ liệu' });
    fireEvent.change(screen.getByLabelText('Trạng thái học'), { target: { value: 'completed' } });
    expect(screen.getByText('Chưa có môn học phù hợp')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByRole('button', { name: 'Mở môn Cơ sở dữ liệu' })).toBeTruthy();
    expect(within(screen.getByRole('button', { name: 'Mở môn Cơ sở dữ liệu' })).getByText('Chưa học')).toBeTruthy();
  });
  it('preserves corrupt local notes instead of overwriting them when opening a slide', async () => {
    const key = studyStorageKey('study-test'); localStorage.setItem(key, 'broken-json');
    mount('/documents?subject=sql&chapter=chapter-1&slide=same-id');
    await screen.findByRole('dialog');
    await waitFor(() => expect(screen.getAllByText(/Dữ liệu học tập trên thiết bị không đọc được|Unexpected token/).length).toBeGreaterThan(0));
    expect(localStorage.getItem(key)).toBe('broken-json');
  });
  it('downloads actual slide text, respects chapter boundaries and invokes fullscreen from F', async () => {
    const save = vi.spyOn(fileUtils, 'saveBlob').mockImplementation(() => {}), fullscreen = vi.fn().mockResolvedValue();
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: fullscreen });
    try {
      mount('/documents?subject=sql&chapter=chapter-1&slide=s2');
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: 'Slide sau' }).disabled).toBe(true);
      fireEvent.keyDown(window, { key: 'f' });
      expect(fullscreen).toHaveBeenCalledOnce();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Tải slide' }));
      await waitFor(() => expect(save).toHaveBeenCalledOnce());
      const [payload, filename] = save.mock.calls[0];
      expect(filename).toBe('Các loại khóa.txt');
      const content = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(payload.data); });
      expect(content).toBe('Khóa chính xác định duy nhất mỗi bản ghi.');
    } finally { delete HTMLElement.prototype.requestFullscreen; save.mockRestore(); }
  });
  it('keeps readable courses available when another course detail fails', async () => {
    const base = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async config => {
      if (config.url === '/learning/courses') return response(config, { courses: [{ id: 'sql', subject: course.subject }, { id: 'broken', subject: 'Môn chưa tải được' }] });
      if (config.url === '/learning/courses/broken') throw new Error('Nguồn học liệu tạm gián đoạn');
      return base(config);
    };
    mount();
    expect(await screen.findByRole('button', { name: 'Mở môn Cơ sở dữ liệu' })).toBeTruthy();
    expect(screen.getByText('Một số tài liệu chưa tải được (1)')).toBeTruthy();
    expect(screen.getByText('Nguồn học liệu tạm gián đoạn')).toBeTruthy();
  });
});
describe('Existing material payload compatibility', () => {
  it('distinguishes opened from learned and isolates repeated slide IDs across chapters', () => {
    const normalized = adaptCourse(course), first = normalized.chapters[0].slides[0], second = normalized.chapters[1].slides[0];
    expect(first.key).not.toBe(second.key);
    expect(studyStats([first, second], { [first.key]: { openedAt: '2026-10-30', learned: true } })).toMatchObject({ learned: 1, opened: 1, percent: 50, status: 'learning' });
    expect(studyStats([second], { [second.key]: { openedAt: '2026-10-30' } })).toMatchObject({ learned: 0, percent: 0, status: 'learning' });
  });
});
