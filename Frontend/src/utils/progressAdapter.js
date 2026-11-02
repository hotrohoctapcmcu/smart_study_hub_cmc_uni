const list = (v) => (Array.isArray(v) ? v : []);
export function mapProgress(p = {}) {
  const metrics = p.metrics ?? p;
  const subjects = list(metrics.subjects),
    total = subjects.reduce((n, s) => n + Number(s.totalAssignments || 0), 0),
    completed = subjects.reduce(
      (n, s) => n + Number(s.completedAssignments || 0),
      0,
    );
  const series = (rows, type) =>
    list(rows).map((r) => ({
      ...r,
      name:
        r.name ??
        r.subjectName ??
        r.subject_name ??
        r.subject ??
        r.day ??
        r.date ??
        r.label ??
        "—",
      value:
        Number(
          r.value ??
            r[type] ??
            r.completionRate ??
            r.hours ??
            r.progress ??
            r.percentage ??
            0,
        ) || 0,
    }));
  const weekly = metrics.weeklyStudyHours;
  return {
    ...p,
    metrics,
    totalHours: Number(
      p.total_hours ?? p.totalHours ?? weekly?.totalHours ?? 0,
    ),
    studySessions: p.study_sessions ?? p.studySessions ?? null,
    completionRate: Number(
      p.completion_rate ??
        p.completionRate ??
        (total ? Math.round((completed / total) * 100) : 0),
    ),
    documentsOpened: p.documents_opened ?? p.documentsOpened ?? null,
    dailyHours: series(p.daily_hours ?? p.dailyHours, "hours"),
    subjectProgress: series(
      p.subject_progress ?? p.subjectProgress ?? subjects,
      "progress",
    ),
    timeAllocation: series(
      p.time_allocation ??
        p.timeAllocation ??
        (weekly
          ? [
              { name: "Tự học", hours: weekly.selfStudyHours },
              { name: "Pomodoro", hours: weekly.pomodoroHours },
            ].filter((s) => Number(s.hours) > 0)
          : []),
      "hours",
    ),
  };
}
export function mapTimeBlocks(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.activities)) return data.activities;
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([, rows]) => Array.isArray(rows))
    .flatMap(([date, rows]) => rows.map((r) => ({ ...r, date })));
}
export function dailyStudyHours(blocks) {
  const result = new Map();
  blocks
    .filter((b) => ["pomodoro", "self-study"].includes(b.type))
    .forEach((b) => {
      const hours = (Date.parse(b.endTime) - Date.parse(b.startTime)) / 3600000;
      if (Number.isFinite(hours) && hours > 0) {
        const date = b.date || b.startTime.slice(0, 10);
        result.set(date, (result.get(date) || 0) + hours);
      }
    });
  return [...result].map(([date, value]) => ({
    name: date.slice(5).split("-").reverse().join("/"),
    value: Math.round(value * 100) / 100,
  }));
}

// Align the backend's date or weekday series with the current study week.
export function weeklyActivity(days, hours = [], tasks = []) {
  return days.map((date, index) => {
    const iso = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const label = index === 6 ? 'CN' : `T${index + 2}`;
    const shortDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const source = hours.find(row => row.date?.slice(0, 10) === iso || row.name === iso || row.name === label || row.name === shortDate || row.name === (index === 6 ? 'Chủ nhật' : `Thứ ${index + 2}`));
    const completed = tasks.filter(task => {
      const status = String(task.status || '').toUpperCase();
      const recordedAt = task.completed_at || task.completedAt || task.completed_date;
      return status === 'COMPLETED' && String(recordedAt || '').slice(0, 10) === iso;
    }).length;
    return { date: iso, name: label, value: Math.max(0, Number(source?.value ?? source?.hours ?? 0) || 0), completed };
  });
}
