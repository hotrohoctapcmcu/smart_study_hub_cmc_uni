import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AppProvider } from "../components/common/ui";
import PomodoroTimer from "../components/learning/PomodoroTimer";
import apiClient from "../api/apiClient";
import { POMODORO_SESSION_KEY } from "../utils/pomodoro";

const originalAdapter = apiClient.defaults.adapter;
let requests, rows, failSave, tasks, classes, exams;
beforeEach(() => {
  // Freeze the calendar before usePomodoroPlan expands dated lessons. Keep
  // native timers for async loading; clock() enables interval timers later.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-04T09:30:00Z'));
  sessionStorage.clear();
  rows = []; failSave = false; tasks = []; classes = []; exams = [];
  requests = vi.fn(async config => {
    if (config.method === "post") {
      if (failSave) throw new Error("Chưa kết nối được máy chủ");
      const body = JSON.parse(config.data);
      if (!rows.some(row => row.id === body.id)) rows.push(body);
    }
    const data = config.url === "/pomodoro" ? rows
      : config.url === "/sync/current-courses" ? { resolved: true, semester: "HK1", academicYear: "2026-2027", courses: [{ subjectId: 1, subjectName: "SQL" }] }
        : config.url === "/tasks" ? tasks
          : config.url === "/schedules/by-week" ? classes
            : config.url === "/exams" ? exams : [];
    return { config, status: 200, headers: {}, data: { success: true, data } };
  });
  apiClient.defaults.adapter = requests;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; vi.useRealTimers(); sessionStorage.clear(); });

async function mount(props = {}) {
  const view = render(<AppProvider><PomodoroTimer {...props} /></AppProvider>);
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
  return view;
}
function clock() { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T09:30:00Z")); }
async function advance(ms) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function click(label, scope = screen) { await act(async () => { fireEvent.click(scope.getByRole("button", { name: label })); }); }
function saves() { return requests.mock.calls.filter(([config]) => config.method === "post").map(([config]) => JSON.parse(config.data)); }

describe("Pomodoro session recovery and saving", () => {
  it('retains an explicit review topic and the fifteen-minute launch context after saving', async () => {
    const onReview = vi.fn();
    await mount({ onReview, initialMinutes: 15, initialContext: { subjectName: 'SQL', goal: 'Hoàn thành 3 truy vấn', topic: 'JOIN' } });
    expect(screen.getByRole('timer').textContent).toBe('15:00');
    expect(screen.getByLabelText('Môn cho phiên học').value).toBe('1');
    clock(); await click('Bắt đầu'); await advance(1000); await click('Lưu phiên học');
    await click('Lưu phiên học', within(screen.getByRole('dialog', { name: 'Lưu phiên vừa học' })));
    expect(saves()[0].learningContext).toMatchObject({ topic: 'JOIN', goal: 'Hoàn thành 3 truy vấn', subjectId: 1 });
    await click('Ôn flashcard');
    expect(onReview).toHaveBeenCalledWith('flashcard', expect.objectContaining({ topic: 'JOIN', subjectName: 'SQL' }));
  });
  it("does not block the clock while EDUX tasks are still loading", async () => {
    const adapter = requests.getMockImplementation();
    requests.mockImplementation(config => config.url === "/tasks/edux" ? new Promise(() => {}) : adapter(config));
    await mount(); clock(); await click("Bắt đầu"); await advance(1000);
    expect(screen.getByRole("timer").textContent).toBe("24:59");
    await click("Tạm dừng");
    expect(screen.getByRole("button", { name: "Bắt đầu" }).disabled).toBe(false);
  });
  it("shows missing schedule data and requires an explicit choice before starting", async () => {
    const adapter = requests.getMockImplementation();
    requests.mockImplementation(config => config.url === "/exams" ? Promise.reject(new Error("Offline")) : adapter(config));
    await mount(); clock(); await click("Bắt đầu");
    expect(screen.getByRole("dialog", { name: "Kiểm tra lịch trước khi tập trung" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    await click("Vẫn bắt đầu"); await advance(1000);
    expect(screen.getByRole("timer").textContent).toBe("24:59");
  });
  it("supports 15 and 50 minute sessions and matching breaks without changing an active session", async () => {
    await mount(); clock(); await click("15 phút");
    expect(screen.getByRole("timer").textContent).toBe("15:00");
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Nghỉ ngắn" })); });
    expect(screen.getByRole("timer").textContent).toBe("03:00");
    await click("50 phút");
    expect(screen.getByRole("timer").textContent).toBe("10:00");
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Tập trung" })); });
    await click("Bắt đầu"); await advance(2000);
    expect(screen.getByRole("button", { name: "15 phút" }).disabled).toBe(true);
    await click("Lưu phiên học"); await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(saves()[0].workDurationMinutes).toBe(50);
  });

  it.each([false, true])("records a task goal and only completes its task after explicit opt-in=%s", async optIn => {
    tasks = [{ assignment_id: 11, title: "Bài JOIN", subject_id: 1, subject_name: "SQL", deadline: "2026-11-05T23:59", status: "PENDING" }];
    await mount(); clock();
    fireEvent.change(screen.getByLabelText("Công việc cần tập trung"), { target: { value: "PERSONAL:11" } });
    fireEvent.change(screen.getByLabelText("Mục tiêu nhỏ của phiên"), { target: { value: "Làm 3 bài JOIN" } });
    await click("Bắt đầu"); await advance(3000); await click("Lưu phiên học");
    fireEvent.change(screen.getByLabelText("Kết quả phiên học"), { target: { value: "DONE" } });
    const checkbox = screen.getByRole("checkbox", { name: /Đánh dấu công việc/ });
    expect(checkbox.checked).toBe(false);
    if (optIn) fireEvent.click(checkbox);
    await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(saves()[0]).toMatchObject({ completeTask: optIn, learningContext: { taskId: "11", taskSource: "PERSONAL", subjectId: 1, goal: "Làm 3 bài JOIN", outcome: "DONE" } });
  });

  it("keeps a next step and reuses it as the next session's goal", async () => {
    await mount(); clock();
    fireEvent.change(screen.getByLabelText("Môn cho phiên học"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Mục tiêu nhỏ của phiên"), { target: { value: "Ôn JOIN" } });
    await click("Bắt đầu"); await advance(3000); await click("Lưu phiên học");
    fireEvent.change(screen.getByLabelText("Kết quả phiên học"), { target: { value: "CONTINUE" } });
    fireEvent.change(screen.getByLabelText("Phần cần làm tiếp"), { target: { value: "Làm bài LEFT JOIN" } });
    await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(saves()[0].learningContext.nextStep).toBe("Làm bài LEFT JOIN");
    expect(screen.getByLabelText("Mục tiêu nhỏ của phiên").value).toBe("Làm bài LEFT JOIN");
    expect(screen.getByRole("button", { name: "Ôn flashcard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tự kiểm tra bằng quiz" })).toBeTruthy();
  });
  it("retains a long next step in history and keeps the next goal within its limit", async () => {
    await mount(); clock(); await click("Bắt đầu"); await advance(2000); await click("Lưu phiên học");
    fireEvent.change(screen.getByLabelText("Kết quả phiên học"), { target: { value: "CONTINUE" } });
    fireEvent.change(screen.getByLabelText("Phần cần làm tiếp"), { target: { value: "a".repeat(500) } });
    await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(saves()[0].learningContext.nextStep).toHaveLength(500);
    expect(screen.getByLabelText("Mục tiêu nhỏ của phiên").value).toHaveLength(300);
  });

  it("warns about a lesson and offers a shorter session without starting automatically", async () => {
    classes = [{ timetable_id: 1, subject_name: "SQL", study_date: "2026-11-04", start_time: "16:50", end_time: "18:00" }];
    await mount(); clock(); await click("Bắt đầu");
    expect(screen.getByRole("dialog", { name: "Kiểm tra lịch trước khi tập trung" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    await click("Đổi sang 15 phút");
    expect(screen.getByRole("timer").textContent).toBe("15:00");
    expect(screen.queryByRole("button", { name: "Tạm dừng" })).toBeNull();
    await click("Bắt đầu"); await advance(1000);
    expect(screen.getByRole("timer").textContent).toBe("14:59");
  });

  it("opens save review in a dialog and excludes pauses and waiting for confirmation", async () => {
    await mount(); clock();
    await click("Bắt đầu"); await advance(2000); await click("Tạm dừng");
    await advance(5000); await click("Bắt đầu"); await advance(3000);
    await click("Lưu phiên học");
    const dialog = within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" }));
    const end = Date.now();
    await advance(10000);
    const updated = vi.fn(); window.addEventListener("workspace-updated", updated);
    try {
      await click("Lưu phiên học", dialog);
      expect(saves()).toHaveLength(1);
      expect(saves()[0].actualStudySeconds).toBe(5);
      expect(Date.parse(saves()[0].endTime)).toBe(end);
      expect(saves()[0].focusSegments).toHaveLength(2);
      expect(updated).toHaveBeenCalledOnce();
      expect(sessionStorage.getItem(POMODORO_SESSION_KEY)).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("timer").textContent).toBe("25:00");
    } finally { window.removeEventListener("workspace-updated", updated); }
  });

  it("protects unsaved focus time when resetting or switching to a break", async () => {
    await mount(); clock(); await click("Bắt đầu"); await advance(5000);
    await click("Đặt lại đồng hồ");
    expect(screen.getByRole("dialog", { name: "Phiên học chưa được lưu" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("24:55");
    await click("Giữ phiên hiện tại");
    expect(screen.getByRole("timer").textContent).toBe("24:55");
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Nghỉ ngắn" })); });
    await click("Lưu và tiếp tục");
    expect(saves()[0].actualStudySeconds).toBe(5);
    expect(screen.getByRole("timer").textContent).toBe("05:00");
    expect(screen.getByRole("tab", { name: "Nghỉ ngắn" }).getAttribute("aria-selected")).toBe("true");
  });

  it("keeps unsaved data and the same session ID after a failed save", async () => {
    await mount(); clock(); await click("Bắt đầu"); await advance(3000); await click("Lưu phiên học");
    failSave = true;
    await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(screen.getByText("Chưa kết nối được máy chủ")).toBeTruthy();
    expect(sessionStorage.getItem(POMODORO_SESSION_KEY)).not.toBeNull();
    await advance(10000); failSave = false;
    await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(saves()).toHaveLength(2);
    expect(saves()[0]).toEqual(saves()[1]);
    expect(rows).toHaveLength(1);
    expect(saves()[1].actualStudySeconds).toBe(3);
  });

  it("recovers a focus session that finished while away without adding extra elapsed time", async () => {
    const view = await mount(); clock(); await click("Bắt đầu"); await advance(2000);
    const start = Date.now() - 2000;
    view.unmount();
    vi.setSystemTime(new Date(start + 3600000));
    await act(async () => { render(<AppProvider><PomodoroTimer /></AppProvider>); });
    expect(screen.getByRole("timer").textContent).toBe("00:00");
    await click("Lưu phiên học", within(screen.getByRole("dialog", { name: "Lưu phiên vừa học" })));
    expect(saves()[0]).toMatchObject({ actualStudySeconds: 1500, status: "Hoàn thành" });
    expect(Date.parse(saves()[0].endTime)).toBe(start + 1500000);
    expect(saves()[0].focusSegments).toHaveLength(1);
  });

  it("never saves break time as focused study", async () => {
    await mount(); clock();
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: "Nghỉ ngắn" })); });
    await click("Bắt đầu"); await advance(300000);
    expect(screen.getByRole("timer").textContent).toBe("00:00");
    expect(screen.getByRole("button", { name: "Lưu phiên học" }).disabled).toBe(true);
    expect(saves()).toHaveLength(0);
  });

  it("requires an explicit choice before discarding a session", async () => {
    await mount(); clock(); await click("Bắt đầu"); await advance(2000); await click("Đặt lại đồng hồ");
    expect(sessionStorage.getItem(POMODORO_SESSION_KEY)).not.toBeNull();
    await click("Bỏ phiên chưa lưu");
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    expect(sessionStorage.getItem(POMODORO_SESSION_KEY)).toBeNull();
    expect(saves()).toHaveLength(0);
  });
});
