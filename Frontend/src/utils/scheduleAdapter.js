import { addDays, formatDateISO, parseDate } from "./date";

// The backend returns weekly timetable rules, rather than dated occurrences.
// Keep timetable_id intact so deleting an occurrence still targets its rule.
export function expandClassSchedules(rows = [], from, to) {
  return rows.flatMap((row) => {
    const explicitDate = row.study_date || row.date;
    if (explicitDate) {
      const date = formatDateISO(explicitDate);
      return date && (!from || date >= from) && (!to || date <= to)
        ? [{ ...row, study_date: date }]
        : [];
    }
    const starts = [from, row.start_date].filter(Boolean).sort();
    const ends = [to, row.end_date].filter(Boolean).sort();
    const first = starts.at(-1), last = ends[0];
    const weekday = Number(row.day_of_week);
    if (!parseDate(first) || !parseDate(last) || first > last ||
        !Number.isInteger(weekday) || weekday < 2 || weekday > 8) return [];
    const date = parseDate(first);
    const targetDay = weekday === 8 ? 0 : weekday - 1;
    let occurrence = addDays(date, (targetDay - date.getDay() + 7) % 7);
    const result = [];
    while (formatDateISO(occurrence) <= last) {
      result.push({ ...row, study_date: formatDateISO(occurrence) });
      occurrence = addDays(occurrence, 7);
    }
    return result;
  });
}

export function mapSchedule(row) {
  if (!row) return null;
  return {
    id: row.timetable_id ?? row.schedule_id ?? row.id,
    subjectName: row.subject_name || "",
    subjectCode: row.subject_code || "",
    className: row.class_name || "",
    room: row.room || "",
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    studyDate: row.study_date || row.date || "",
    title: row.title || row.subject_name || "",
    notes: row.notes || "",
    status: row.status || "",
    subjectId: row.subject_id,
  };
}

export function mapSchedules(rows = []) {
  return rows.map(mapSchedule).filter(Boolean);
}
