import { planningNow } from "./planning";

export const POMODORO_SESSION_KEY = "smart-study-hub:pomodoro:v1";
export const POMODORO_PRESETS = [{ work: 15, rest: 3 }, { work: 25, rest: 5 }, { work: 50, rest: 10 }];
export const emptyLearningContext = () => ({ subjectId: "", subjectName: "", taskId: "", taskSource: null, taskTitle: "", goal: "", outcome: "UNRECORDED", reflection: "", nextStep: "", microGoals: [] });
export const breakMinutes = work => POMODORO_PRESETS.find(preset => preset.work === work)?.rest || 5;

export function focusSeconds(segments) {
  return segments.reduce((total, segment) => total + (Date.parse(segment.end) - Date.parse(segment.start)) / 1000, 0);
}

export function readPomodoroSession(storage = sessionStorage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(POMODORO_SESSION_KEY));
    if (!saved || !["focus", "break"].includes(saved.mode) || !Number.isFinite(saved.remaining)
      || !Number.isFinite(saved.start) || !saved.sessionId || !Array.isArray(saved.segments)) return null;
    let last = saved.start;
    for (const segment of saved.segments) {
      const start = Date.parse(segment.start), end = Date.parse(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < last || end <= start) return null;
      last = end;
    }
    saved.workMinutes = POMODORO_PRESETS.some(preset => preset.work === saved.workMinutes) ? saved.workMinutes : 25;
    saved.learningContext = saved.learningContext && typeof saved.learningContext === "object" && !Array.isArray(saved.learningContext)
      ? { ...emptyLearningContext(), ...saved.learningContext } : emptyLearningContext();
    if (!Array.isArray(saved.learningContext.microGoals) || saved.learningContext.microGoals.length > 5
      || saved.learningContext.microGoals.some(step => !step || typeof step.title !== 'string' || !step.title.trim() || step.title.length > 180 || !Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > saved.workMinutes
        || typeof step.doneWhen !== 'string' || !step.doneWhen.trim() || step.doneWhen.length > 250 || typeof step.completed !== 'boolean')
      || saved.learningContext.microGoals.reduce((sum, step) => sum + step.minutes, 0) > saved.workMinutes) saved.learningContext.microGoals = [];
    const total = (saved.mode === "focus" ? saved.workMinutes : breakMinutes(saved.workMinutes)) * 60;
    saved.remaining = Math.max(0, Math.min(total, saved.remaining));
    if (saved.running) {
      if (!Number.isFinite(saved.end) || !Number.isFinite(saved.segment) || saved.segment < last || saved.end <= saved.segment) return null;
      saved.remaining = Math.max(0, Math.min(total, Math.ceil((saved.end - now) / 1000)));
      if (saved.remaining === 0) {
        saved.segments.push({ start: new Date(saved.segment).toISOString(), end: new Date(saved.end).toISOString() });
        saved.segment = null;
        saved.running = false;
        saved.pending = saved.mode === "focus";
      }
    }
    return saved;
  } catch {
    return null;
  }
}

export function focusStatsForRange(rows, from, to) {
  const dayStart = Date.parse(`${from}T00:00:00+07:00`);
  const dayEnd = Date.parse(`${to}T00:00:00+07:00`) + 86400000;
  let seconds = 0, sessions = 0;
  for (const row of rows) {
    const start = Date.parse(row.startTime || row.createdAt || row.created_at);
    const duration = Number(row.actualStudySeconds || 0);
    const segments = Array.isArray(row.focusSegments) && row.focusSegments.length ? row.focusSegments
      : Number.isFinite(start) && Number.isFinite(duration) && duration > 0
        ? [{ start: new Date(start).toISOString(), end: new Date(start + duration * 1000).toISOString() }] : [];
    const overlap = segments.reduce((total, segment) => {
      const start = Date.parse(segment.start), end = Date.parse(segment.end);
      return Number.isFinite(start) && Number.isFinite(end)
        ? total + Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart)) / 1000 : total;
    }, 0);
    if (overlap > 0) { seconds += overlap; sessions += 1; }
  }
  return { minutes: Math.round(seconds / 60), sessions };
}

export function todayFocusStats(rows, now = new Date()) {
  const day = planningNow(now).date;
  return focusStatsForRange(rows, day, day);
}

export function weeklyFocusSummary(rows, now = new Date()) {
  const date = new Date(`${planningNow(now).date}T00:00:00Z`);
  const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
  const from = monday.toISOString().slice(0, 10), to = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const groups = new Map();
  for (const row of rows) {
    const stats = focusStatsForRange([row], from, to);
    if (!stats.sessions) continue;
    const name = row.learningContext?.subjectName || "Chưa phân loại";
    if (!groups.has(name)) groups.set(name, { subject: name, rows: [], goalsDone: 0 });
    const group = groups.get(name);
    group.rows.push(row);
    group.goalsDone += Number(row.learningContext?.outcome === "DONE");
  }
  return { from, to, ...focusStatsForRange(rows, from, to), subjects: [...groups.values()].map(({ rows, ...group }) => ({ ...group, ...focusStatsForRange(rows, from, to) })) };
}

export function unfinishedPomodoroGoal(rows) {
  const resolved = new Set();
  for (const row of [...rows].sort((a, b) => Date.parse(b.startTime || b.createdAt) - Date.parse(a.startTime || a.createdAt))) {
    const context = row.learningContext;
    if (!context?.goal) continue;
    const scope = context.taskId ? `${context.taskSource}:${context.taskId}` : `subject:${context.subjectName || ""}`;
    const key = `${scope}:${context.goal}`;
    if (context.outcome === "DONE") resolved.add(key);
    else if (context.outcome === "CONTINUE" && !resolved.has(key) && !(context.nextStep && resolved.has(`${scope}:${context.nextStep.slice(0, 300)}`))) return row;
  }
  return null;
}

export function pomodoroConflicts(classes, exams, workMinutes, now = Date.now()) {
  const finish = now + workMinutes * 60000;
  const at = (date, time) => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && /^\d{2}:\d{2}/.test(time || "") ? Date.parse(`${date}T${time.slice(0, 5)}:00+07:00`) : NaN;
  const events = classes.map(row => ({ title: row.subject_name || row.title || "Tiết học", start: at(row.study_date, row.start_time), end: at(row.study_date, row.end_time) }));
  for (const exam of exams) {
    if (["CANCELLED", "CANCELED", "HUY", "HỦY"].includes(String(exam.exam_status || exam.status || "").toUpperCase())) continue;
    const date = String(exam.exam_date || exam.examDate || "").slice(0, 10);
    const start = at(date, exam.exam_time || exam.start_time || exam.examTime);
    events.push({ title: `Kỳ thi: ${exam.subject_name || exam.exam_name || "Kỳ thi"}`,
      start: Number.isFinite(start) ? start : at(date, "00:00"),
      end: Number.isFinite(start) && Number(exam.duration_minutes) > 0 ? start + Number(exam.duration_minutes) * 60000 : at(date, "23:59") + 60000 });
  }
  return events.filter(event => event.start < finish && event.end > now).sort((a, b) => a.start - b.start);
}
