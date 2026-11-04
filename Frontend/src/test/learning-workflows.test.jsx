import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { aiApi, courseApi, documentApi, examApi, quizApi, studentApi, syncApi, taskApi } from '../api';
import { AppProvider } from '../components/common/ui';
import TaskEditor from '../components/tasks/TaskEditor';
import TaskAISteps from '../components/tasks/TaskAISteps';
import TaskDetail from '../components/tasks/TaskDetail';
import FlashcardReview from '../components/learning/FlashcardReview';
import QuizCreator from '../components/learning/QuizCreator';
import QuizPanel from '../components/learning/QuizPanel';
import AIExamPlanner from '../components/learning/AIExamPlanner';
import NotebookDashboard from '../pages/Notebooks/NotebookDashboard';
import { UploadForm } from '../pages/Documents/DocumentLibrary';
import AITutor from '../pages/AITutor/AITutor';

const response = data => ({ config: {}, data: { success: true, data } });
const scope = { resolved: true, semester: '1', academicYear: '2026-2027', courses: [{ subjectId: 1, subjectName: 'SQL' }] };
const task = { id: 7, subjectId: 1, subject: 'SQL', title: 'Bài JOIN', description: 'Viết 3 truy vấn', deadline: '2099-11-04T20:00', status: 'PENDING' };
const steps = [{ title: 'Đọc lược đồ', doneWhen: 'Có sơ đồ hai bảng', minutes: 10 }, { title: 'Viết JOIN', doneWhen: 'Có 3 truy vấn chạy đúng', minutes: 30 }];
function Location() { return <output aria-label="Đường dẫn">{useLocation().pathname + useLocation().search}</output>; }
function mount(children, entry = '/') { return render(<MemoryRouter initialEntries={[entry]}><AppProvider>{children}<Location /></AppProvider></MemoryRouter>); }
function change(label, value) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
beforeEach(() => {
  vi.spyOn(syncApi, 'currentCourses').mockResolvedValue(response(scope));
  vi.spyOn(studentApi, 'getSubjects').mockResolvedValue(response([{ subject_id: 9, subject_name: 'Môn lịch sử' }]));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Current term selectors and stored data', () => {
  it('creates with current courses and preserves only the saved historical course on edit', async () => {
    const saved = vi.fn(), update = vi.spyOn(taskApi, 'update').mockResolvedValue(response({}));
    const view = mount(<TaskEditor onSaved={saved} onClose={vi.fn()} />);
    await screen.findByRole('option', { name: 'SQL' });
    expect(screen.queryByRole('option', { name: 'Môn lịch sử' })).toBeNull();
    expect(studentApi.getSubjects).not.toHaveBeenCalled();
    view.unmount();
    mount(<TaskEditor task={{ ...task, subjectId: 9, subject: 'Môn lịch sử', deadline: '2020-01-01T10:00' }} onSaved={saved} onClose={vi.fn()} />);
    await screen.findByRole('option', { name: 'Môn lịch sử' });
    expect(screen.getByLabelText('Môn học').value).toBe('9');
    change('Mô tả', 'Sửa mô tả'); fireEvent.submit(screen.getByRole('button', { name: 'Lưu công việc' }).closest('form'));
    await waitFor(() => expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ subjectId: 9, deadline: '2020-01-01T10:00' })));
  });
  it('shows IU sync guidance when a term is unresolved and never reads all subjects', async () => {
    syncApi.currentCourses.mockResolvedValue(response({ resolved: false, courses: [] }));
    mount(<TaskEditor onSaved={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText(/Chưa xác định được kỳ hiện tại/);
    expect(screen.getByLabelText('Môn học').options).toHaveLength(1);
    expect(studentApi.getSubjects).not.toHaveBeenCalled();
  });
  it('keeps old notebooks visible while offering only current subjects for a new notebook', async () => {
    const store = { notebooks: [{ id: 'old', title: 'Sổ kỳ cũ', subject: 'Môn lịch sử', updatedAt: '' }], pages: [], loading: false };
    mount(<NotebookDashboard store={store} onOpen={vi.fn()} />);
    expect(screen.getByText('Sổ kỳ cũ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo sổ tay', exact: true }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'SQL' });
    expect(within(dialog).queryByRole('option', { name: 'Môn lịch sử' })).toBeNull();
  });
});

describe('Flashcard and upload workflows', () => {
  it('matches subject/topic, prioritizes forgotten due cards and ends five-minute review without an automatic write', async () => {
    vi.spyOn(courseApi, 'detail').mockResolvedValue(response({ cards: [
      { id: 'a', front: 'Đã nhớ', chapter: 'JOIN', dueAt: '2020-01-01' },
      { id: 'b', front: 'Từng quên', chapter: 'JOIN', dueAt: '2020-01-01', forgottenCount: 2 },
      { id: 'c', front: 'Chủ đề khác', chapter: 'GROUP BY', dueAt: '2020-01-01' },
    ] }));
    const review = vi.spyOn(courseApi, 'review');
    mount(<FlashcardReview courses={[{ id: 'sql', subject: 'SQL - K4' }]} subject="SQL" topic="JOIN" />);
    await screen.findByText('Từng quên'); expect(screen.queryByText('Chủ đề khác')).toBeNull();
    vi.useFakeTimers(); fireEvent.click(screen.getByRole('button', { name: 'Ôn 5 phút' }));
    act(() => vi.advanceTimersByTime(300000));
    expect(screen.getByText(/Đã kết thúc lượt ôn 5 phút/)).toBeTruthy(); expect(review).not.toHaveBeenCalled();
  });
  it('explains a missing topic rather than substituting unrelated cards', async () => {
    vi.spyOn(courseApi, 'detail').mockResolvedValue(response({ cards: [{ id: 'a', front: 'JOIN', chapter: 'JOIN' }] }));
    mount(<FlashcardReview courses={[{ id: 'sql', subject: 'SQL' }]} subject="SQL" topic="GROUP BY" />);
    await screen.findByText('Chưa có flashcard phù hợp'); expect(screen.queryByRole('button', { name: /CÂU HỎI/ })).toBeNull();
  });
  it('uploads with a selected current course ID, and shows its term before upload', async () => {
    const upload = vi.spyOn(documentApi, 'upload').mockResolvedValue(response({ id: '1' })), saved = vi.fn();
    mount(<UploadForm onSaved={saved} onClose={vi.fn()} />);
    await screen.findByRole('option', { name: 'SQL' }); change('Môn học', '1');
    const file = new File(['JOIN'], 'join.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Tập tin'), { target: { files: [file] } });
    expect(screen.getByText(/Học kỳ 1 · 2026-2027/)).toBeTruthy();
    fireEvent.submit(screen.getByRole('button', { name: 'Tải lên' }).closest('form'));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(file, expect.objectContaining({ subjectId: '1', filename: 'join.txt' })));
    expect(saved).toHaveBeenCalledOnce();
  });
});

describe('Reviewed AI proposals and source context', () => {
  it('edits AI checklist steps before explicit batch confirmation', async () => {
    vi.spyOn(aiApi, 'pomodoroGoals').mockResolvedValue(response({ steps, persisted: false }));
    const save = vi.spyOn(taskApi, 'createChecklist').mockResolvedValue(response([]));
    mount(<TaskAISteps task={task} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI chia nhỏ công việc' }));
    await screen.findByLabelText('Bước 1'); expect(save).not.toHaveBeenCalled();
    change('Đầu ra bước 1', 'ERD do tôi sửa');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thêm các bước' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(7, { steps: [expect.objectContaining({ doneWhen: 'ERD do tôi sửa', minutes: 10 }), steps[1]] }));
    expect(aiApi.pomodoroGoals).toHaveBeenCalledWith(expect.objectContaining({ kind: 'task', taskId: '7', taskSource: 'PERSONAL' }), expect.any(Object));
  });
  it('keeps manual checklist entry available after an AI error', async () => {
    vi.spyOn(taskApi, 'taskChecklist').mockResolvedValue(response([]));
    vi.spyOn(aiApi, 'pomodoroGoals').mockRejectedValue(new Error('AI đang bận'));
    const create = vi.spyOn(taskApi, 'createChecklist').mockResolvedValue(response({}));
    mount(<TaskDetail task={task} onUpdate={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI chia nhỏ công việc' }));
    await screen.findByRole('alert'); expect(create).not.toHaveBeenCalled();
    change('Bước checklist mới', 'Viết JOIN thủ công'); change('Đầu ra bước mới', '3 truy vấn'); change('Thời lượng bước mới (phút)', '15');
    fireEvent.submit(screen.getByRole('button', { name: 'Thêm', exact: true }).closest('form'));
    await waitFor(() => expect(create).toHaveBeenCalledWith(7, { title: 'Viết JOIN thủ công', doneWhen: '3 truy vấn', minutes: 15 }));
  });
  it('discards an obsolete AI reply when task context changes', async () => {
    let resolve;
    vi.spyOn(aiApi, 'pomodoroGoals').mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<TaskAISteps task={task} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI chia nhỏ công việc' }));
    view.rerender(<TaskAISteps task={{ ...task, description: 'Đề bài đã đổi' }} onSaved={vi.fn()} />);
    await act(async () => resolve(response({ steps })));
    expect(screen.queryByLabelText('Bước 1')).toBeNull();
  });
  it('rejects malformed AI steps and retains the manual fallback', async () => {
    vi.spyOn(aiApi, 'pomodoroGoals').mockResolvedValue(response({ steps: [{ title: 'Bước thiếu đầu ra', minutes: -10 }] }));
    const save = vi.spyOn(taskApi, 'createChecklist');
    mount(<TaskAISteps task={task} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI chia nhỏ công việc' }));
    await screen.findByRole('alert'); expect(screen.queryByLabelText('Bước 1')).toBeNull(); expect(save).not.toHaveBeenCalled();
  });
  it('does not show a successful quiz result when a submit response has no measured score', async () => {
    vi.spyOn(quizApi, 'list').mockResolvedValue(response([{ id: 'test', title: 'Quiz JOIN' }]));
    vi.spyOn(quizApi, 'detail').mockResolvedValue(response({ questions: [{ id: 'q1', question: 'JOIN?', options: ['A', 'B', 'C', 'D'] }] }));
    vi.spyOn(quizApi, 'submit').mockResolvedValue(response({}));
    mount(<QuizPanel />); fireEvent.click(await screen.findByRole('button', { name: 'Làm bài' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'A', exact: true }));
    fireEvent.submit(screen.getByRole('button', { name: 'Nộp bài' }).closest('form'));
    await screen.findByText(/Máy chủ chưa trả kết quả chấm bài hợp lệ/);
    expect(screen.queryByText(/Kết quả:/)).toBeNull(); expect(screen.queryByText('Đã nộp bài')).toBeNull();
    expect(screen.getByRole('radio', { name: 'A', exact: true }).checked).toBe(true);
  });
  it('opens Pomodoro from a stored checklist step with its output and duration', async () => {
    vi.spyOn(taskApi, 'taskChecklist').mockResolvedValue(response([{ checklist_id: 1, title: 'Viết JOIN', done_when: '3 truy vấn', estimated_minutes: 15 }]));
    mount(<TaskDetail task={task} onUpdate={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pomodoro', exact: true }));
    const route = screen.getByLabelText('Đường dẫn').textContent;
    expect(route).toContain('/learning?tab=pomodoro'); expect(new URLSearchParams(route.split('?')[1]).get('goal')).toBe('Viết JOIN · 3 truy vấn');
    expect(route).toContain('minutes=15');
  });
  it('selects chapter, real source, question count and difficulty without calling AI until submit', async () => {
    vi.spyOn(courseApi, 'list').mockResolvedValue(response({ courses: [{ id: 'sql', subject: 'SQL' }] }));
    vi.spyOn(courseApi, 'detail').mockResolvedValue(response({ id: 'sql', chapters: [{ id: 'ch1', title: 'JOIN', documents: [{ id: 's1', title: 'INNER JOIN' }] }] }));
    vi.spyOn(documentApi, 'list').mockResolvedValue(response([]));
    const create = vi.fn(); mount(<QuizCreator initialSubject="SQL" initialTopic="JOIN" onCreate={create} />);
    await screen.findByRole('option', { name: 'JOIN' }); change('Chương', 'ch1'); change('Tài liệu nguồn', 'slide:ch1:s1'); change('Số câu', '15'); change('Độ khó', 'hard');
    expect(create).not.toHaveBeenCalled(); fireEvent.submit(screen.getByRole('button', { name: 'Tạo quiz' }).closest('form'));
    expect(create).toHaveBeenCalledWith({ subject: 'SQL', topic: 'JOIN', count: 15, difficulty: 'hard', source: { courseId: 'sql', chapterId: 'ch1', documentId: 's1' } });
  });
  it('keeps exam sessions as editable previews and does not report a non-persisted response as saved', async () => {
    vi.spyOn(aiApi, 'examPlan').mockResolvedValue(response({ phases: [{ examId: 1, title: 'Ôn JOIN', startDate: '2099-11-04', endDate: '2099-11-05' }], sessions: [{ examId: 1, date: '2099-11-04', start: '19:00', end: '20:00', title: 'JOIN', objective: 'Viết JOIN', selfTest: 'Giải thích INNER JOIN' }] }));
    const confirm = vi.spyOn(aiApi, 'confirmExamPlan').mockResolvedValue(response({ persisted: false })), saved = vi.fn();
    mount(<AIExamPlanner exam={{ id: 1, examDate: '2099-11-06', startTime: '08:00' }} onSaved={saved} />);
    change('Nội dung cần chia buổi', 'JOIN'); fireEvent.click(screen.getByRole('button', { name: 'AI chia buổi ôn thi' }));
    await screen.findByLabelText('Mục tiêu buổi 1'); expect(confirm).not.toHaveBeenCalled();
    change('Mục tiêu buổi 1', 'Đầu ra đã sửa'); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu các buổi ôn' }));
    await screen.findByRole('alert'); expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ sessions: [expect.objectContaining({ objective: 'Đầu ra đã sửa' })] })); expect(saved).not.toHaveBeenCalled();
  });
  it('lists only upcoming exams and sends source context from the calling screen', async () => {
    vi.spyOn(examApi, 'list').mockResolvedValue(response([{ exam_id: 1, subject_name: 'SQL', exam_date: '2099-11-06', exam_time: '08:00' }, { exam_id: 2, subject_name: 'Cũ', exam_date: '2020-01-01', exam_time: '08:00' }]));
    vi.spyOn(aiApi, 'status').mockResolvedValue(response({ available: true }));
    const ask = vi.spyOn(aiApi, 'ask').mockResolvedValue(response({ answer: 'Giải thích JOIN' }));
    mount(<AITutor />, { pathname: '/ai', state: { learningContext: { subject: 'SQL', topic: 'JOIN', text: 'INNER JOIN nối các dòng', prompt: 'Giải thích bài này' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith({ question: expect.stringContaining('INNER JOIN nối các dòng'), conversationId: null }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await screen.findByText('Giải thích JOIN'); change('Công cụ AI', 'examPlan');
    await screen.findByRole('option', { name: /SQL.*2099-11-06/ }); expect(screen.queryByRole('option', { name: /Cũ/ })).toBeNull();
    expect(screen.queryByLabelText('Mã kỳ thi (để trống để ôn tất cả)')).toBeNull();
  });
});
