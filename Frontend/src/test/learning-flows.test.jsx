import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../components/common/ui";
import apiClient from "../api/apiClient";
import Learning from "../pages/Learning/Learning";
import PomodoroTimer from "../components/learning/PomodoroTimer";
import QuizPanel from "../components/learning/QuizPanel";
import Sync from "../pages/Sync/Sync";

const adapter = apiClient.defaults.adapter;
function mount(Page) {
  return render(<MemoryRouter><AppProvider><Page /></AppProvider></MemoryRouter>);
}
function response(config, data) {
  return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, data } };
}
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  vi.useRealTimers();
  sessionStorage.clear();
});

describe("Learning flows", () => {
  it("joins weakness advice to its measured topic by key", async () => {
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/ai/weaknesses") return response(config, {
        topics: [{ key: "cs-oop", subject: "C#", topic: "Kế thừa", priority: "high", latestScore: 25 }],
        advice: [{ key: "cs-oop", recommendation: "Ôn lại lớp cơ sở và lớp dẫn xuất.", exercise: "Viết hai lớp có kế thừa." }],
      });
      return adapter(config);
    };
    mount(Learning);
    fireEvent.click(screen.getByRole("tab", { name: "Điểm cần cải thiện" }));
    expect(await screen.findByText("Ôn lại lớp cơ sở và lớp dẫn xuất.")).toBeTruthy();
    expect(screen.getByText("Bài luyện tập: Viết hai lớp có kế thừa.")).toBeTruthy();
    expect(screen.getByText("Kết quả gần nhất: 25%")).toBeTruthy();
    expect(screen.getByText("Ưu tiên cao")).toBeTruthy();
  });

  it("keeps the active Pomodoro deadline and focus segments after leaving the page", async () => {
    const spy = vi.fn(adapter);
    apiClient.defaults.adapter = spy;
    const page = mount(PomodoroTimer);
    await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    await act(async () => { vi.advanceTimersByTime(2000); });
    page.unmount();
    await act(async () => { vi.advanceTimersByTime(3000); });
    mount(PomodoroTimer);
    expect(screen.getByText("24:55")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
    await act(async () => { vi.advanceTimersByTime(4000); });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên học" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Lưu phiên học" }).at(-1));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const request = spy.mock.calls.find(([config]) => config.method === "post" && config.url === "/pomodoro")[0];
    const body = JSON.parse(request.data);
    expect(body.actualStudySeconds).toBe(5);
    expect(body.focusSegments).toHaveLength(1);
    expect(Date.parse(body.focusSegments[0].end) - Date.parse(body.focusSegments[0].start)).toBe(5000);
    expect(sessionStorage.getItem("smart-study-hub:pomodoro:v1")).toBeNull();
  });

  it("ignores an old quiz result after another quiz is opened", async () => {
    let resolveFirst;
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/ai/quizzes") return response(config, [
        { id: "first", title: "Quiz trước" }, { id: "second", title: "Quiz sau" },
      ]);
      if (config.url === "/ai/quizzes/first") return new Promise((resolve) => {
        resolveFirst = () => resolve(response(config, { result: { score: 99 }, questions: [] }));
      });
      if (config.url === "/ai/quizzes/second") return response(config, {
        questions: [{ id: "q1", question: "Câu hỏi của quiz sau", options: ["A", "B"] }],
      });
      return adapter(config);
    };
    mount(QuizPanel);
    await screen.findByText("Quiz trước");
    fireEvent.click(screen.getAllByRole("button", { name: "Làm bài" })[0]);
    await waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Làm bài" })[1]);
    await screen.findByText("Câu hỏi của quiz sau");
    await act(async () => { resolveFirst(); });
    expect(screen.queryByText("Kết quả: 99")).toBeNull();
    expect(screen.getByText("Câu hỏi của quiz sau")).toBeTruthy();
  });

  it("refreshes successful sync sources even when a different source fails", async () => {
    const spy = vi.fn(async (config) => {
      if (config.url === "/sync") return response(config, {
        jobId: "partial-learning", status: "PARTIAL", ok: false,
        results: { iu: { ok: true }, edux: { ok: false, message: "Phiên EDUX đã hết hạn" }, outlook: { ok: true } },
      });
      return adapter(config);
    });
    apiClient.defaults.adapter = spy;
    mount(Sync);
    await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ tất cả" }));
    await screen.findByText("EDUX: Chưa đồng bộ — Phiên EDUX đã hết hạn");
    await waitFor(() => {
      expect(spy.mock.calls.filter(([config]) => config.url === "/sync/current-courses").length).toBeGreaterThanOrEqual(2);
      expect(spy.mock.calls.filter(([config]) => config.url === "/sync/iu/status").length).toBeGreaterThanOrEqual(2);
    });
  });
});
