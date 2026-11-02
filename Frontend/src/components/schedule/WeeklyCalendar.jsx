import { formatDateISO, formatTime, isToday, minutes } from "../../utils/date";
const labels = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];
export function layoutDayEvents(rows) {
  const sorted = [...rows].sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || minutes(b.endTime) - minutes(a.endTime));
  const result = [];
  let group = [], lanes = [], groupEnd = -1;
  const flush = () => {
    group.forEach((entry) => result.push({ ...entry, laneCount: lanes.length }));
    group = []; lanes = []; groupEnd = -1;
  };
  sorted.forEach((event) => {
    const start = minutes(event.startTime), end = minutes(event.endTime);
    if (group.length && start >= groupEnd) flush();
    let lane = lanes.findIndex((lastEnd) => lastEnd <= start);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = end;
    groupEnd = Math.max(groupEnd, end);
    group.push({ event, lane });
  });
  flush();
  return result;
}
export function CalendarEvent({ event, onSelect, lane = 0, laneCount = 1 }) {
  const top = (Math.max(0, minutes(event.startTime) - 420) / 60) * 56;
  const height = Math.max(
    30,
    ((minutes(event.endTime) - Math.max(420, minutes(event.startTime))) / 60) *
      56,
  );
  return (
    <button
      className={"calendar-event " + event.kind + " event-tone-" + (String(event.subjectId || event.subjectName || "").split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 4)}
      style={{ top, height: Math.min(height, 840 - top), left: `calc(${lane / laneCount * 100}% + 3px)`, width: `calc(${100 / laneCount}% - 6px)`, right: "auto" }}
      title={`${event.title || event.subjectName} · ${formatTime(event.startTime)} – ${formatTime(event.endTime)} · ${event.room || "Tự học"}`}
      onClick={() => onSelect(event)}
    >
      <strong>{event.title || event.subjectName}</strong>
      <small>
        {formatTime(event.startTime)} - {formatTime(event.endTime)}
      </small>
      <small>{event.room || "Tự học"}</small>
    </button>
  );
}
export default function WeeklyCalendar({ days, rows, onSelect }) {
  return (
    <div className="calendar-wrap">
      <div className="weekly-calendar">
        <div className="calendar-day">Giờ</div>
        {days.map((d, i) => (
          <div
            key={i}
            className={"calendar-day " + (isToday(d) ? "today" : "")}
          >
            <strong>{labels[i]}</strong>
            <small>
              {d.getDate()}/{d.getMonth() + 1}
            </small>
          </div>
        ))}
        <div className="time-axis">
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="hour-label">
              {String(7 + i).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d, i) => (
          <div key={i} className={"day-track " + (isToday(d) ? "today" : "")}>
            {layoutDayEvents(rows
              .filter(
                (s) =>
                  formatDateISO(s.studyDate) === formatDateISO(d) &&
                  minutes(s.startTime) < 1320 &&
                  minutes(s.endTime) > 420,
              ))
              .map(({ event: s, lane, laneCount }, j) => (
                <CalendarEvent
                  key={s.kind + s.id + "-" + j}
                  event={s}
                  onSelect={onSelect}
                  lane={lane}
                  laneCount={laneCount}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
