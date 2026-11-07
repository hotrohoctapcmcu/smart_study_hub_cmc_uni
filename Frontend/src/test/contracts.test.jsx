import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import Topbar from "../components/layout/Topbar";
import Exams from "../pages/Exams/Exams";
import AITutor from "../pages/AITutor/AITutor";
import Learning from "../pages/Learning/Learning";
import QuizPanel from "../components/learning/QuizPanel";
import PomodoroTimer from "../components/learning/PomodoroTimer";
import apiClient from "../api/apiClient";
import { taskApi, courseApi } from "../api";
import { mapProgress } from "../utils/progressAdapter";
import { buildAIRequest } from "../utils/aiAdapter";
function mount(Page) {
  return render(
    <MemoryRouter>
      <AppProvider>
        <Page />
      </AppProvider>
    </MemoryRouter>,
  );
}
const adapter = apiClient.defaults.adapter;
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  vi.useRealTimers();
});
describe("Compatibility with actual backend request/response fields", () => {
  it('loads flashcards from course detail when list response contains counts only', async () => {
    apiClient.defaults.adapter = async config => {
      const response = await adapter(config);
      if(config.url === '/learning/courses') response.data.data.courses = response.data.data.courses.map(({cards,chapters,...course}) => ({...course,cardCount:cards.length,chapterCount:chapters.length}));
      return response;
    };
    mount(Learning);
    await screen.findByRole('heading', {name:'Lập trình C#'});
    fireEvent.click(screen.getByRole('tab', {name:'Flashcard'}));
    expect(await screen.findByText('Bốn tính chất cơ bản của OOP là gì?')).toBeTruthy();
  });
  it('confirms an AI preview with explicit confirmed flag and actual sessions', async () => {
    const spy = vi.fn(adapter); apiClient.defaults.adapter = spy;
    mount(AITutor);
    fireEvent.click(screen.getByRole('button', {name:'Lập kế hoạch'}));
    fireEvent.click(screen.getByRole('button', {name:'Gửi tin nhắn'}));
    fireEvent.click(await screen.findByRole('button', {name:'Xác nhận kế hoạch'}));
    await screen.findByText('Đã xác nhận kế hoạch');
    const body = JSON.parse(spy.mock.calls.find(([c]) => c.url === '/ai/plan/confirm')[0].data);
    expect(body.confirmed).toBe(true); expect(body.sessions.length).toBeGreaterThan(0);
  });
  it("maps metrics.subjects and weeklyStudyHours without fabricated statistics", () => {
    const result = mapProgress({
      metrics: {
        subjects: [
          {
            subjectName: "CSDL",
            totalAssignments: 4,
            completedAssignments: 3,
            completionRate: 75,
          },
        ],
        weeklyStudyHours: {
          totalHours: 4,
          selfStudyHours: 3,
          pomodoroHours: 1,
        },
      },
    });
    expect(result.completionRate).toBe(75);
    expect(result.totalHours).toBe(4);
    expect(result.subjectProgress[0]).toMatchObject({
      name: "CSDL",
      value: 75,
    });
    expect(result.documentsOpened).toBe(null);
    expect(result.dailyHours).toEqual([]);
  });
  it("uses question for AI chat and structured fields for other tools", () => {
    expect(buildAIRequest("ask", "Câu hỏi", {}, "conversation-1")).toEqual({
      question: "Câu hỏi",
      conversationId: "conversation-1",
    });
    expect(buildAIRequest("check", "Đáp án", { question: "Đề bài" })).toEqual({
      question: "Đề bài",
      answer: "Đáp án",
    });
    expect(
      buildAIRequest("draftLeave", "Lý do", { date: "2026-11-01" }),
    ).toMatchObject({ date: "2026-11-01", reason: "Lý do" });
    expect(
      buildAIRequest("progressAdvice", "", {}, null, {
        metrics: { subjects: [] },
      }),
    ).toEqual({ progress: { subjects: [] } });
  });
  it("can uncheck an existing checklist using isCompleted:false", async () => {
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    await taskApi.toggleChecklist(1, false);
    const config = spy.mock.calls[0][0];
    expect(JSON.parse(config.data)).toEqual({ isCompleted: false });
  });
  it("sends required examTime instead of display field startTime", async () => {
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    mount(Exams);
    fireEvent.click(screen.getByRole("button", { name: "Thêm kỳ thi" }));
    await screen.findByRole("option", { name: "Lập trình C#" });
    fireEvent.change(screen.getByLabelText("Môn học"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Phòng thi"), {
      target: { value: "P.123" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Lưu kỳ thi" }).closest("form"),
    );
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([c]) => c.url === "/exams" && c.method === "post"),
      ).toBe(true),
    );
    const config = spy.mock.calls.find(
        ([c]) => c.url === "/exams" && c.method === "post",
      )[0],
      body = JSON.parse(config.data);
    expect(body.examTime).toBe("08:00");
    expect(body.startTime).toBeUndefined();
  });
  it("creates exam phases with phaseTitle and a date range", async () => {
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    mount(Exams);
    const buttons = await screen.findAllByRole("button", {
      name: "Lên lịch ôn",
    });
    fireEvent.click(buttons[0]);
    fireEvent.submit(
      screen.getByRole("button", { name: "Lưu kế hoạch" }).closest("form"),
    );
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([c]) => c.url === "/exams/study-plans" && c.method === "post",
        ),
      ).toBe(true),
    );
    const body = JSON.parse(
      spy.mock.calls.find(
        ([c]) => c.url === "/exams/study-plans" && c.method === "post",
      )[0].data,
    );
    expect(body).toHaveProperty("phaseTitle");
    expect(body.startDate).toBeTruthy();
    expect(body.endDate).toBeTruthy();
  });
  it("renders singular search result types returned by the workspace service", async () => {
    apiClient.defaults.adapter = async (config) =>
      config.url === "/search"
        ? {
            data: {
              success: true,
              data: [
                {
                  id: "1",
                  type: "task",
                  title: "Kết quả tìm kiếm",
                  route: "tasks",
                },
              ],
            },
            config,
            status: 200,
            headers: {},
          }
        : adapter(config);
    mount(Topbar);
    fireEvent.click(screen.getByRole("button", { name: /Tìm môn học/ }));
    fireEvent.change(screen.getByLabelText("Tìm kiếm toàn bộ"), {
      target: { value: "kết quả" },
    });
    expect(
      await screen.findByRole("button", { name: /Kết quả tìm kiếm/ }),
    ).toBeTruthy();
  });
  it("creates quiz with topic and renders nested backend results", async () => {
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    mount(QuizPanel);
    fireEvent.click(screen.getByRole("button", { name: "Tạo quiz" }));
    await screen.findByRole('option', { name: 'Lập trình C#' });
    fireEvent.change(screen.getByLabelText("Môn học / chủ đề"), {
      target: { value: "Lập trình C#" },
    });
    fireEvent.change(screen.getByLabelText("Chủ đề ôn tập"), {
      target: { value: "OOP" },
    });
    const dialog = screen.getByRole("dialog");
    fireEvent.submit(dialog.querySelector("form"));
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([c]) => c.method === "post" && c.url === "/ai/quizzes",
        ),
      ).toBe(true),
    );
    const body = JSON.parse(
      spy.mock.calls.find(
        ([c]) => c.method === "post" && c.url === "/ai/quizzes",
      )[0].data,
    );
    expect(body).toMatchObject({ subject: "Lập trình C#", topic: "OOP" });
  });
  it("keeps only active focus segments when saving Pomodoro", async () => {
    // Keep this timer test outside the sample classroom slots at any run time.
    const now = new Date('2026-11-07T00:00:00+07:00');
    vi.setSystemTime(now);
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    mount(PomodoroTimer);
    await waitFor(() =>
      expect(screen.queryAllByRole("status")).toHaveLength(0),
    );
    vi.useFakeTimers();
    vi.setSystemTime(now);
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên học" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Lưu phiên học" }).at(-1),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const config = spy.mock.calls.find(
        ([c]) => c.method === "post" && c.url === "/pomodoro",
      )[0],
      body = JSON.parse(config.data);
    expect(body.actualStudySeconds).toBe(5);
    expect(body.focusSegments).toHaveLength(2);
    expect(
      Date.parse(body.endTime) - Date.parse(body.startTime),
    ).toBeGreaterThanOrEqual(10000);
  });
});
