import { describe, expect, it } from "vitest";
import { readPomodoroSession, todayFocusStats, weeklyFocusSummary, pomodoroConflicts, unfinishedPomodoroGoal } from "../utils/pomodoro";

describe("Pomodoro saved time", () => {
  it("does not remind an old unfinished task after a later session achieved it", () => {
    const context = { taskId: "1", taskSource: "PERSONAL", goal: "Ôn JOIN" };
    expect(unfinishedPomodoroGoal([
      { startTime: "2026-11-04T10:00:00Z", learningContext: { ...context, outcome: "CONTINUE" } },
      { startTime: "2026-11-04T11:00:00Z", learningContext: { ...context, outcome: "DONE" } },
    ])).toBeNull();
  });
  it("keeps an unfinished goal when a different goal on the same task was achieved", () => {
    const unfinished = { startTime: "2026-11-04T10:00:00Z", learningContext: { taskId: "1", taskSource: "PERSONAL", goal: "Ôn JOIN", outcome: "CONTINUE", nextStep: "Luyện LEFT JOIN" } };
    const later = { startTime: "2026-11-04T11:00:00Z", learningContext: { taskId: "1", taskSource: "PERSONAL", goal: "Đọc chương 1", outcome: "DONE" } };
    expect(unfinishedPomodoroGoal([unfinished, later])).toBe(unfinished);
    expect(unfinishedPomodoroGoal([unfinished, { ...later, learningContext: { ...later.learningContext, goal: "Luyện LEFT JOIN" } }])).toBeNull();
  });
  it("restores a custom duration and goal while retaining the original deadline", () => {
    const start = Date.parse("2026-11-04T10:00:00Z");
    const microGoals = [{ id: 'step-1', title: 'Viết truy vấn JOIN', minutes: 10, doneWhen: 'Truy vấn chạy đúng', completed: true }];
    const saved = { mode: "focus", workMinutes: 50, remaining: 3000, start, segment: start, end: start + 3000000, running: true, sessionId: "custom", segments: [], learningContext: { goal: "Ôn JOIN", subjectId: 1, microGoals } };
    const restored = readPomodoroSession({ getItem: () => JSON.stringify(saved) }, start + 60000);
    expect(restored).toMatchObject({ workMinutes: 50, remaining: 2940, learningContext: { goal: "Ôn JOIN", subjectId: 1, microGoals } });
  });
  it("summarizes this week by subject and only counts self-reported completed goals", () => {
    const row = { startTime: "2026-11-04T10:00:00+07:00", actualStudySeconds: 1500, learningContext: { subjectName: "SQL", outcome: "DONE" } };
    const summary = weeklyFocusSummary([row, { ...row, learningContext: { subjectName: "Web", outcome: "CONTINUE" } }, { ...row, startTime: "2026-10-01T10:00:00+07:00" }], new Date("2026-11-04T17:00:00+07:00"));
    expect(summary).toMatchObject({ from: "2026-11-02", to: "2026-11-08", minutes: 50, sessions: 2 });
    expect(summary.subjects).toMatchObject([{ subject: "SQL", goalsDone: 1, minutes: 25 }, { subject: "Web", goalsDone: 0, minutes: 25 }]);
  });
  it("detects an exam across midnight and allows adjacent nonoverlapping sessions", () => {
    const now = Date.parse("2026-11-04T23:50:00+07:00");
    expect(pomodoroConflicts([], [{ exam_date: "2026-11-05", exam_time: "00:10", duration_minutes: 60 }], 25, now)).toHaveLength(1);
    expect(pomodoroConflicts([], [{ exam_date: "2026-11-05", exam_time: "00:15", duration_minutes: 60 }], 25, now)).toHaveLength(0);
    expect(pomodoroConflicts([], [{ exam_date: "2026-11-05", exam_time: "00:10", duration_minutes: 60, exam_status: "CANCELLED" }], 25, now)).toHaveLength(0);
  });
  it("splits midnight sessions and counts only focus segments in today's UTC+7 boundary", () => {
    const rows = [{ startTime: "2026-11-03T23:50:00+07:00", actualStudySeconds: 1200, focusSegments: [
      { start: "2026-11-03T23:50:00+07:00", end: "2026-11-04T00:05:00+07:00" },
      { start: "2026-11-04T00:20:00+07:00", end: "2026-11-04T00:25:00+07:00" },
    ] }];
    expect(todayFocusStats(rows, new Date("2026-11-04T10:00:00+07:00"))).toEqual({ minutes: 10, sessions: 1 });
    expect(todayFocusStats(rows, new Date("2026-11-03T22:00:00+07:00"))).toEqual({ minutes: 10, sessions: 1 });
  });
  it("handles legacy sessions and missing timestamps without breaking the timer", () => {
    expect(todayFocusStats([
      { startTime: "2026-11-04T16:00:00+07:00", actualStudySeconds: 600 },
      { actualStudySeconds: 600 },
      { startTime: "bad", actualStudySeconds: 600 },
    ], new Date("2026-11-04T17:00:00+07:00"))).toEqual({ minutes: 10, sessions: 1 });
  });
  it("ignores corrupt or overlapping stored segments", () => {
    const saved = { mode: "focus", remaining: 1400, start: Date.parse("2026-11-04T10:00:00Z"), sessionId: "test", segments: [
      { start: "bad", end: "2026-11-04T10:01:00Z" },
    ] };
    expect(readPomodoroSession({ getItem: () => JSON.stringify(saved) })).toBeNull();
    saved.segments = [
      { start: "2026-11-04T10:00:00Z", end: "2026-11-04T10:01:00Z" },
      { start: "2026-11-04T10:00:30Z", end: "2026-11-04T10:02:00Z" },
    ];
    expect(readPomodoroSession({ getItem: () => JSON.stringify(saved) })).toBeNull();
  });
});
