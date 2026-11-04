import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PomodoroGoalSuggestions from "../components/learning/PomodoroGoalSuggestions";
import PomodoroTimer from "../components/learning/PomodoroTimer";
import { AppProvider } from "../components/common/ui";
import { aiApi } from "../api";
import apiClient from "../api/apiClient";

const originalAdapter = apiClient.defaults.adapter;
const plan = { steps: [
  { id: "step-1", title: "Nhận diện điều kiện JOIN", minutes: 5, doneWhen: "Viết được hai điều kiện nối" },
  { id: "step-2", title: "Viết và chạy truy vấn", minutes: 10, doneWhen: "Truy vấn chạy đúng" },
], note: "Một phạm vi nhỏ vừa với phiên." };
const reply = data => ({ config: {}, data: { success: true, data } });
const props = { goal: "Ôn phép JOIN", subjectId: 1, durationMinutes: 25, autoAnalyze: true, disabled: false, hasPlan: false, onApply: vi.fn() };
async function advance(ms) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
afterEach(() => { apiClient.defaults.adapter = originalAdapter; vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.clear(); });

describe("AI breaks a Pomodoro goal into a preview", () => {
  it("waits until typing pauses and does not apply a plan without the user choosing it", async () => {
    vi.useFakeTimers(); const suggest = vi.spyOn(aiApi, "pomodoroGoals").mockResolvedValue(reply(plan)); const apply = vi.fn();
    const view = render(<PomodoroGoalSuggestions {...props} onApply={apply} />);
    await advance(600); expect(suggest).not.toHaveBeenCalled();
    view.rerender(<PomodoroGoalSuggestions {...props} goal="Ôn JOIN và thực hành" onApply={apply} />);
    await advance(1199); expect(suggest).not.toHaveBeenCalled(); await advance(1);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest.mock.calls[0][0]).toMatchObject({ goal: "Ôn JOIN và thực hành", durationMinutes: 25, subjectId: 1 });
    expect(screen.getByText("Nhận diện điều kiện JOIN")).toBeTruthy(); expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dùng các bước này" })); expect(apply).toHaveBeenCalledWith(plan.steps);
  });
  it("aborts old requests and ignores old results after the goal changes", async () => {
    vi.useFakeTimers(); let finishOld;
    const suggest = vi.spyOn(aiApi, "pomodoroGoals").mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(reply({ ...plan, steps: [{ ...plan.steps[0], title: "Bước cho mục tiêu mới" }, plan.steps[1]] }));
    const view = render(<PomodoroGoalSuggestions {...props} />); await advance(1200);
    view.rerender(<PomodoroGoalSuggestions {...props} goal="Mục tiêu mới" />);
    expect(suggest.mock.calls[0][1].signal.aborted).toBe(true); await advance(1200);
    await act(async () => { finishOld(reply(plan)); });
    expect(screen.getByText("Bước cho mục tiêu mới")).toBeTruthy(); expect(screen.queryByText("Nhận diện điều kiện JOIN")).toBeNull();
  });
  it("keeps manual planning available after an AI failure and supports retry", async () => {
    vi.useFakeTimers();
    const suggest = vi.spyOn(aiApi, "pomodoroGoals").mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue(reply(plan));
    render(<PomodoroGoalSuggestions {...props} />); await advance(1200);
    expect(screen.getByRole("alert").textContent).toContain("vẫn có thể tự viết mục tiêu");
    fireEvent.click(screen.getByRole("button", { name: "Thử phân tích lại" })); await advance(1200);
    expect(suggest).toHaveBeenCalledTimes(2); expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Dùng các bước này" })).toBeTruthy();
  });
  it("does not send a restored draft automatically and cancels when the session starts", async () => {
    vi.useFakeTimers(); const suggest = vi.spyOn(aiApi, "pomodoroGoals").mockResolvedValue(reply(plan));
    const view = render(<PomodoroGoalSuggestions {...props} autoAnalyze={false} />); await advance(2000); expect(suggest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "AI chia nhỏ mục tiêu" })); await advance(1200); expect(suggest).toHaveBeenCalledTimes(1);
    view.rerender(<PomodoroGoalSuggestions {...props} disabled />); expect(screen.queryByRole("region")).toBeNull();
  });
  it("uses the selected duration and reuses an unchanged successful analysis", async () => {
    vi.useFakeTimers(); const suggest = vi.spyOn(aiApi, "pomodoroGoals").mockResolvedValue(reply(plan));
    const view = render(<PomodoroGoalSuggestions {...props} durationMinutes={15} />); await advance(1200);
    expect(suggest.mock.calls[0][0].durationMinutes).toBe(15);
    view.rerender(<PomodoroGoalSuggestions {...props} durationMinutes={15} goal="Mục tiêu khác" />); await advance(300);
    view.rerender(<PomodoroGoalSuggestions {...props} durationMinutes={15} />); await advance(1200);
    expect(suggest).toHaveBeenCalledTimes(1);
  });
});

function setupTimer({ scope = { resolved: true, semester: "HK1", academicYear: "2026-2027", courses: [{ subjectId: 1, subjectName: "SQL" }] }, edux = [] } = {}) {
  const rows = [];
  const adapter = vi.fn(async config => {
    if (config.url === "/pomodoro" && config.method === "post") rows.push(JSON.parse(config.data));
    const data = config.url === "/pomodoro" ? rows
      : config.url === "/sync/current-courses" ? scope
        : config.url === "/student/subjects" ? [{ subject_id: 1, subject_name: "SQL" }, { subject_id: 2, subject_name: "Môn kỳ cũ" }]
          : config.url === "/tasks" ? [{ assignment_id: 11, title: "Bài đang học", subject_id: 1, subject_name: "SQL", status: "PENDING" }, { assignment_id: 12, title: "Việc kỳ cũ", subject_id: 2, subject_name: "Môn kỳ cũ", status: "PENDING" }]
            : config.url === "/tasks/edux" ? { assignments: edux } : [];
    return { config, status: 200, headers: {}, data: { success: true, data } };
  });
  apiClient.defaults.adapter = adapter;
  return { adapter, rows };
}
async function mountTimer() {
  render(<AppProvider><PomodoroTimer /></AppProvider>);
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
}

describe("Current semester and adopted micro-goals", () => {
  it("shows only current-term subjects and tasks, with no fallback to historical subjects", async () => {
    const { adapter } = setupTimer(); await mountTimer();
    const choices = within(screen.getByLabelText("Môn cho phiên học"));
    expect(choices.getByRole("option", { name: "SQL" })).toBeTruthy(); expect(choices.queryByRole("option", { name: "Môn kỳ cũ" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Việc kỳ cũ" })).toBeNull();
    expect(adapter.mock.calls.some(([config]) => config.url === "/student/subjects")).toBe(false);
  });
  it("keeps the course list empty when the current term cannot be identified", async () => {
    setupTimer({ scope: { resolved: false, courses: [], message: "Hãy đồng bộ thời khóa biểu IU." } }); await mountTimer();
    expect(within(screen.getByLabelText("Môn cho phiên học")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Hãy đồng bộ thời khóa biểu IU.")).toBeTruthy();
  });
  it("does not mix two explicitly different EDUX cohorts", async () => {
    setupTimer({ scope: { resolved: true, courses: [{ subjectId: 1, subjectName: "SQL - K4" }] }, edux: [
      { id: "edux-k4", title: "Đúng khóa", subject: "SQL - K4", status: "Chưa làm" }, { id: "edux-k5", title: "Khác khóa", subject: "SQL - K5", status: "Chưa làm" },
    ] }); await mountTimer();
    expect(screen.getByRole("option", { name: "EDUX · Đúng khóa" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "EDUX · Khác khóa" })).toBeNull();
  });
  it("adopts steps, records checked progress and carries unfinished steps into the next action", async () => {
    const { rows } = setupTimer(); const suggest = vi.spyOn(aiApi, "pomodoroGoals").mockResolvedValue(reply(plan)); await mountTimer();
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Mục tiêu nhỏ của phiên"), { target: { value: "Ôn phép JOIN" } });
    await advance(1200); expect(suggest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Dùng các bước này" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Nhận diện điều kiện JOIN/ }));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" })); await advance(2000);
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên học" }));
    fireEvent.change(screen.getByLabelText("Kết quả phiên học"), { target: { value: "CONTINUE" } });
    expect(screen.getByLabelText("Phần cần làm tiếp").value).toBe("Viết và chạy truy vấn");
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })).getByRole("button", { name: "Lưu phiên học" })); });
    expect(rows[0].learningContext.microGoals.map(step => step.completed)).toEqual([true, false]);
    expect(rows[0].learningContext.goal).toBe("Ôn phép JOIN");
    expect(rows[0].learningContext.nextStep).toBe("Viết và chạy truy vấn");
  });
});
