import { mapTask, mapPriorityLabel, mapStatusLabel } from "../../utils/taskAdapter";

const DAY_MS = 86400000;
const PRIORITIES = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const statusCodes = {
  PENDING: "PENDING", "Chưa làm": "PENDING", "Chưa hoàn thành": "PENDING",
  IN_PROGRESS: "IN_PROGRESS", "Đang làm": "IN_PROGRESS", "Đang thực hiện": "IN_PROGRESS",
  COMPLETED: "COMPLETED", "Hoàn thành": "COMPLETED", "Đã hoàn thành": "COMPLETED",
  OVERDUE: "OVERDUE", "Quá hạn": "OVERDUE",
};
const priorityCodes = { LOW: "LOW", "Thấp": "LOW", MEDIUM: "MEDIUM", "Trung bình": "MEDIUM", HIGH: "HIGH", "Cao": "HIGH", URGENT: "URGENT", "Khẩn cấp": "URGENT" };

/** School dates without an offset are Vietnam wall-clock dates, including SQL timestamps. */
export function workspaceDay(value = new Date()) {
  if (value == null || value === "") return "";
  const text = typeof value === "string" ? value.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}(?:$|[T ]\d{2}:\d{2})/.test(text) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const day = text.slice(0, 10);
    const parsed = new Date(day + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = name => parts.find(item => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function deadlineTime(value) {
  const text = String(value || "");
  if (!/[T ]\d{2}:\d{2}/.test(text)) return "";
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return text.match(/[T ](\d{2}:\d{2})/)?.[1] || "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function deadlineMillis(value) {
  const day = workspaceDay(value);
  if (!day) return Infinity;
  const text = String(value);
  if (!/[T ]\d{2}:\d{2}/.test(text)) return Date.parse(day + "T23:59:59+07:00");
  return Date.parse(text.replace(" ", "T") + (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? "" : "+07:00"));
}

function normalizeTask(row, fallbackSource) {
  const mapped = mapTask(row);
  const source = String(row.source || fallbackSource).toUpperCase() === "EDUX" ? "EDUX" : "PERSONAL";
  const id = source === "EDUX" ? row.external_id || row.id || row.assignment_id : mapped.id;
  const status = statusCodes[row.status] || "PENDING";
  const priority = priorityCodes[row.priority] || null;
  const deadline = row.deadline || row.due || null;
  return {
    ...mapped, id, key: `${source}:${id}`, source, raw: row,
    subject: row.subject_name || row.subject || row.subject_code || row.subjectCode || "Chưa phân loại",
    subjectCode: row.subject_code || row.subjectCode || "", subjectId: row.subject_id ?? row.subjectId,
    deadline: workspaceDay(deadline) ? deadline : null,
    dueSource: source === "EDUX" && ["subject", "exam"].includes(row.dueSource) ? row.dueSource : null,
    subjectDeadline: typeof row.subjectDeadline === "string" ? row.subjectDeadline : null,
    subjectStartTime: typeof row.subjectStartTime === "string" ? row.subjectStartTime : null,
    completedAt: row.completedAt || (row.completed_at ? row.completed_at.replace(" ", "T") + (/Z$|[+-]\d{2}:?\d{2}$/.test(row.completed_at) ? "" : "Z") : null),
    status, priority, statusLabel: mapStatusLabel(status), priorityLabel: priority ? mapPriorityLabel(priority) : "Chưa đặt",
  };
}

/** Include EDUX once when a legacy Assignments row and the EDUX collection share an external id. */
export function workspaceTasks(localRows = [], eduxRows = []) {
  const tasks = new Map();
  for (const row of localRows.filter(Boolean)) {
    const task = normalizeTask(row, "PERSONAL");
    tasks.set(task.key, task);
  }
  for (const row of eduxRows.filter(Boolean)) {
    const task = normalizeTask(row, "EDUX");
    tasks.set(task.key, task);
  }
  return [...tasks.values()];
}

export function taskDueMeta(task, now = new Date()) {
  const dateKey = workspaceDay(task.deadline);
  const today = workspaceDay(now);
  const time = deadlineTime(task.deadline);
  const days = dateKey ? (Date.parse(dateKey) - Date.parse(today)) / DAY_MS : null;
  const isOverdue = task.status !== "COMPLETED" && Boolean(dateKey) && (days < 0 || Boolean(time) && deadlineMillis(task.deadline) < new Date(now).getTime());
  const status = task.status === "COMPLETED" ? "completed" : isOverdue ? "overdue" : days === 0 ? "today" : days === 1 ? "tomorrow" : dateKey ? "upcoming" : "pending";
  const dateLabel = dateKey ? dateKey.split("-").reverse().join("/") : "Chưa đặt hạn";
  const label = days === 0 ? `Hôm nay${time ? " " + time : ""}` : days === 1 ? `Ngày mai${time ? " " + time : ""}` : dateLabel;
  return { dateKey, time, label, isOverdue, hasTime: Boolean(time), status,
    statusLabel: { completed: "Đã hoàn thành", overdue: "Quá hạn", today: "Hôm nay", tomorrow: "Ngày mai", upcoming: "Sắp tới", pending: "Chưa đặt hạn" }[status] };
}

export function filterWorkspaceTasks(tasks, filters = {}, now = new Date()) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("vi");
  const today = workspaceDay(now);
  const filtered = tasks.filter(task => {
    const due = taskDueMeta(task, now);
    const done = task.status === "COMPLETED";
    return (!query || `${task.title} ${task.subject}`.toLocaleLowerCase("vi").includes(query))
      && (!filters.source || filters.source === "all" || task.source === filters.source)
      && (!filters.subject || task.subject === filters.subject)
      && (!filters.priority || task.priority === filters.priority)
      && (!filters.status || (filters.status === "OVERDUE" ? due.isOverdue : task.status === filters.status))
      && (!filters.date || due.dateKey === filters.date)
      && (filters.tab === "pending" ? !done
        : filters.tab === "today" ? due.dateKey === today && !done
        : filters.tab === "upcoming" ? Boolean(due.dateKey) && due.dateKey >= today && !due.isOverdue && !done
          : filters.tab === "completed" ? done : true);
  });
  const deadlineOrder = (a, b) => deadlineMillis(a.deadline) - deadlineMillis(b.deadline);
  return filtered.sort((a, b) => filters.sort === "title" ? a.title.localeCompare(b.title, "vi")
    : filters.sort === "deadline" ? deadlineOrder(a, b) || a.title.localeCompare(b.title, "vi")
      : (PRIORITIES[a.priority] ?? 4) - (PRIORITIES[b.priority] ?? 4) || deadlineOrder(a, b) || a.title.localeCompare(b.title, "vi"));
}

function subjectAppearance(subject, index) {
  const title = subject.toLocaleLowerCase("vi");
  if (/c#|c sharp/.test(title)) return { tone: "green", token: "csharp" };
  if (/python/.test(title)) return { tone: "blue", token: "python" };
  if (/đại số|toán|giải tích|thống kê|xác suất/.test(title)) return { tone: "violet", token: "sigma" };
  if (/cấu trúc|giải thuật|lập trình|phát triển|công nghệ|phần mềm/.test(title)) return { tone: "pink", token: "code" };
  return { tone: ["pink", "violet", "green", "blue", "amber"][index % 5], token: "book" };
}

export function groupWorkspaceTasks(tasks, now = new Date()) {
  const groups = new Map();
  for (const task of tasks) {
    if (!groups.has(task.subject)) groups.set(task.subject, { key: task.subject, subject: task.subject, subjectCode: task.subjectCode, tasks: [], completed: 0, overdue: 0, inProgress: 0, ...subjectAppearance(task.subject, groups.size) });
    const group = groups.get(task.subject);
    group.tasks.push(task);
    group.completed += Number(task.status === "COMPLETED");
    group.overdue += Number(taskDueMeta(task, now).isOverdue);
    group.inProgress += Number(task.status === "IN_PROGRESS");
  }
  return [...groups.values()];
}

export function workspaceStats(tasks, now = new Date()) {
  const today = workspaceDay(now);
  const date = new Date(today + "T00:00:00Z");
  const weekday = (date.getUTCDay() + 6) % 7;
  const weekStart = new Date(date.getTime() - weekday * DAY_MS).toISOString().slice(0, 10);
  const weekEnd = new Date(date.getTime() + (6 - weekday) * DAY_MS).toISOString().slice(0, 10);
  const inWeek = value => { const day = workspaceDay(value); return Boolean(day && day >= weekStart && day <= weekEnd); };
  const weekTasks = tasks.filter(task => {
    if (inWeek(task.deadline) || task.status === "COMPLETED" && inWeek(task.completedAt)) return true;
    // EDUX often sets a course-wide window instead of an individual weekly due date.
    // Only include that window when both boundaries are known; sync time is not completion time.
    const start = workspaceDay(task.subjectStartTime), end = workspaceDay(task.subjectDeadline);
    return task.source === "EDUX" && Boolean(start && end && start <= end && start <= weekEnd && end >= weekStart);
  });
  const completed = weekTasks.filter(task => task.status === "COMPLETED").length;
  const inProgress = weekTasks.filter(task => task.status === "IN_PROGRESS").length;
  const eduxTasks = tasks.filter(task => task.source === "EDUX");
  const weekKeys = new Set(weekTasks.map(task => task.key));
  const progressFraction = task => {
    if (task.status === "COMPLETED") return 1;
    if (task.source !== "EDUX" || task.status !== "IN_PROGRESS") return 0;
    const done = Number(task.progress?.daHoc), total = Number(task.progress?.tongSo);
    return Number.isFinite(done) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  };
  const progressPercent = rows => rows.length ? Math.round(rows.reduce((sum, task) => sum + progressFraction(task), 0) / rows.length * 100) : null;
  return {
    total: tasks.length, completed: tasks.filter(task => task.status === "COMPLETED").length,
    pending: tasks.filter(task => task.status !== "COMPLETED").length,
    today: filterWorkspaceTasks(tasks, { tab: "today" }, now).length,
    upcoming: filterWorkspaceTasks(tasks, { tab: "upcoming" }, now).length,
    overdue: tasks.filter(task => taskDueMeta(task, now).isOverdue).length,
    week: { start: weekStart, end: weekEnd, total: weekTasks.length, completed, inProgress,
      pending: weekTasks.length - completed - inProgress, percent: progressPercent(weekTasks),
      edux: weekTasks.filter(task => task.source === "EDUX").length },
    edux: { total: eduxTasks.length, completed: eduxTasks.filter(task => task.status === "COMPLETED").length, percent: progressPercent(eduxTasks),
      outsideWeek: eduxTasks.filter(task => !weekKeys.has(task.key)).length },
  };
}

export function upcomingWorkspaceTasks(tasks, limit = 4, now = new Date()) {
  return filterWorkspaceTasks(tasks, { tab: "upcoming", sort: "deadline" }, now).slice(0, Math.max(0, limit));
}
