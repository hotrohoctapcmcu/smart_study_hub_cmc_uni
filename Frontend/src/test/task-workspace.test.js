import { describe, expect, it } from "vitest";
import { workspaceTasks, workspaceDay, taskDueMeta, filterWorkspaceTasks, groupWorkspaceTasks, workspaceStats, upcomingWorkspaceTasks } from "../pages/Tasks/taskWorkspace";

const now = new Date("2026-10-30T10:00:00+07:00");
const local = [
  { assignment_id: 1, title: "Nộp báo cáo C#", subject_name: "Lập trình C#", deadline: "2026-10-29T18:00", priority: "URGENT", status: "IN_PROGRESS" },
  { assignment_id: 2, title: "Ôn ma trận", subject_name: "Đại số tuyến tính", deadline: "2026-10-30T20:00", priority: "MEDIUM", status: "PENDING" },
  { assignment_id: 3, title: "Bài thực hành", subject_name: "Lập trình Python", deadline: "2026-10-31", priority: "LOW", status: "COMPLETED" },
];
const external = [{ id: "edux-1", title: "Quiz cây", subject: "Cấu trúc dữ liệu", due: null, status: "Đang làm", priority: "Cao" }];

describe("Task workspace data", () => {
  it("keeps both source identities, normalizes EDUX fields and never invents its missing deadline", () => {
    const rows = workspaceTasks(local, external);
    expect(rows).toHaveLength(4);
    expect(rows[3]).toMatchObject({ key: "EDUX:edux-1", id: "edux-1", source: "EDUX", subject: "Cấu trúc dữ liệu", status: "IN_PROGRESS", priority: "HIGH", deadline: null });
    expect(taskDueMeta(rows[3], now)).toMatchObject({ status: "pending", label: "Chưa đặt hạn", isOverdue: false, dateKey: "" });
    expect(workspaceTasks([{ assignment_id: 1, title: "Personal" }], [{ id: 1, title: "EDUX" }]).map(row => row.key)).toEqual(["PERSONAL:1", "EDUX:1"]);
    expect(workspaceTasks([], [{ id: "no-priority" }])[0]).toMatchObject({ priority: null, priorityLabel: "Chưa đặt", deadline: null });
  });

  it("deduplicates a legacy EDUX assignment using its external id, preferring the current EDUX snapshot", () => {
    const rows = workspaceTasks([{ assignment_id: 42, external_id: "edux-1", source: "EDUX", title: "Stale", status: "PENDING" }], external);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Quiz cây");
    expect(rows[0].raw).toBe(external[0]);
  });

  it("filters both sources by subject, status, priority, date and text while preserving source ordering rules", () => {
    const rows = workspaceTasks(local, external);
    expect(filterWorkspaceTasks(rows, { source: "EDUX", query: "cấu trúc", priority: "HIGH", status: "IN_PROGRESS" }, now).map(row => row.id)).toEqual(["edux-1"]);
    expect(filterWorkspaceTasks(rows, { source: "PERSONAL", date: "2026-10-30", tab: "today" }, now).map(row => row.id)).toEqual([2]);
    expect(filterWorkspaceTasks(rows, { status: "OVERDUE" }, now).map(row => row.id)).toEqual([1]);
    expect(filterWorkspaceTasks(rows, { sort: "deadline" }, now).map(row => row.id)).toEqual([1, 2, 3, "edux-1"]);
    expect(filterWorkspaceTasks(rows, { tab: "completed" }, now).map(row => row.id)).toEqual([3]);
  });

  it("uses Vietnam dates at midnight and distinguishes past times, all-day deadlines and completed work", () => {
    expect(workspaceDay("2026-10-29T18:15:00Z")).toBe("2026-10-30");
    expect(workspaceDay("2026-02-30")).toBe("");
    const dateOnly = workspaceTasks([{ id: 1, deadline: "2026-10-30", status: "PENDING" }])[0];
    expect(taskDueMeta(dateOnly, now)).toMatchObject({ status: "today", isOverdue: false, hasTime: false });
    const early = { ...dateOnly, deadline: "2026-10-30 09:00:00" };
    expect(taskDueMeta(early, now)).toMatchObject({ status: "overdue", isOverdue: true, time: "09:00" });
    expect(taskDueMeta({ ...early, status: "COMPLETED" }, now).isOverdue).toBe(false);
    expect(taskDueMeta({ ...early, deadline: "2026-10-31T09:00+07:00" }, now)).toMatchObject({ status: "tomorrow", label: "Ngày mai 09:00" });
  });

  it("groups by actual subject, derives course attention and weekly counts without counting undated EDUX as overdue", () => {
    const rows = workspaceTasks(local, external);
    const groups = groupWorkspaceTasks(rows, now);
    expect(groups[0]).toMatchObject({ subject: "Lập trình C#", tone: "green", token: "csharp", overdue: 1, inProgress: 1, completed: 0 });
    expect(groups[1]).toMatchObject({ tone: "violet", token: "sigma" });
    expect(groups[2]).toMatchObject({ tone: "blue", token: "python", completed: 1, overdue: 0 });
    expect(workspaceStats(rows, now)).toMatchObject({ total: 4, completed: 1, overdue: 1, today: 1, week: { total: 3, completed: 1, inProgress: 1, pending: 1, percent: 33 } });
    expect(upcomingWorkspaceTasks(rows, 4, now).map(row => row.id)).toEqual([2]);
  });

  it("keeps late-today work in Today but excludes it from upcoming counts and the future schedule", () => {
    const rows = workspaceTasks([
      { id: "late", title: "Đã đến hạn sáng nay", deadline: "2026-10-30T09:00", status: "PENDING" },
      { id: "future", title: "Đến hạn tối nay", deadline: "2026-10-30T20:00", status: "PENDING" },
      { id: "all-day", title: "Trong ngày", deadline: "2026-10-30", status: "PENDING" },
    ]);
    expect(filterWorkspaceTasks(rows, { tab: "today", sort: "deadline" }, now).map(row => row.id)).toEqual(["late", "future", "all-day"]);
    expect(filterWorkspaceTasks(rows, { tab: "upcoming", sort: "deadline" }, now).map(row => row.id)).toEqual(["future", "all-day"]);
    expect(upcomingWorkspaceTasks(rows, 4, now).map(row => row.id)).toEqual(["future", "all-day"]);
    expect(workspaceStats(rows, now)).toMatchObject({ today: 3, upcoming: 2, overdue: 1 });
  });

  it("separates unfinished personal and EDUX work from completed work without changing All semantics", () => {
    const rows = workspaceTasks(local, external);
    const pending = filterWorkspaceTasks(rows, { tab: "pending" }, now);
    const completed = filterWorkspaceTasks(rows, { tab: "completed" }, now);
    expect(pending.map(row => row.id)).toEqual([1, "edux-1", 2]);
    expect(completed.map(row => row.id)).toEqual([3]);
    expect(filterWorkspaceTasks(rows, { tab: "all" }, now)).toHaveLength(4);
    expect(filterWorkspaceTasks(rows, {}, now)).toHaveLength(4);
    expect(workspaceStats(rows, now)).toMatchObject({ total: 4, pending: 3, completed: 1 });
  });

  it("orders subjects by their highest unfinished priority and tasks by priority then nearest deadline, placing unset priority last", () => {
    const rows = workspaceTasks([
      { id: "a-low", subject_name: "Môn A", priority: "LOW", deadline: "2026-10-30T12:00", status: "PENDING" },
      { id: "unknown", subject_name: "Môn chưa đặt ưu tiên", deadline: "2026-10-28", status: "PENDING" },
      { id: "a-high-later", subject_name: "Môn A", priority: "HIGH", deadline: "2026-11-02", status: "PENDING" },
      { id: "medium", subject_name: "Môn B", priority: "MEDIUM", deadline: "2026-10-31", status: "IN_PROGRESS" },
      { id: "a-high-sooner", subject_name: "Môn A", priority: "HIGH", deadline: "2026-10-31", status: "PENDING" },
      { id: "urgent-done", subject_name: "Môn đã hoàn thành", priority: "URGENT", deadline: "2026-10-28", status: "COMPLETED" },
      { id: "urgent", subject_name: "Môn khẩn cấp", priority: "URGENT", deadline: "2026-11-04", status: "PENDING" },
    ]);
    const sorted = filterWorkspaceTasks(rows, { tab: "pending", sort: "priority" }, now);
    expect(sorted.map(row => row.id)).toEqual(["urgent", "a-high-sooner", "a-high-later", "medium", "a-low", "unknown"]);
    const groups = groupWorkspaceTasks(sorted, now);
    expect(groups.map(group => group.subject)).toEqual(["Môn khẩn cấp", "Môn A", "Môn B", "Môn chưa đặt ưu tiên"]);
    expect(groups[1].tasks.map(row => row.id)).toEqual(["a-high-sooner", "a-high-later", "a-low"]);
  });
});
