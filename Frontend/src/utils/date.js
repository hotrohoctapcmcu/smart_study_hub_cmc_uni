export function parseDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  const text = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(text + "T00:00:00")
    : new Date(text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}
export function formatDate(value, options = {}) {
  return (
    parseDate(value)?.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...options,
    }) || "—"
  );
}
export function formatTime(value) {
  const time = String(value || "").match(/^(\d{2}):(\d{2})/);
  return time
    ? time[1] + ":" + time[2]
    : parseDate(value)?.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }) || "—";
}
export function formatDateTime(value) {
  return parseDate(value) ? formatDate(value) + " " + formatTime(value) : "—";
}
export function formatDateISO(value = new Date()) {
  const d = parseDate(value);
  return d
    ? d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    : "";
}
export function addDays(value, n) {
  const d = parseDate(value);
  d.setDate(d.getDate() + n);
  return d;
}
export function startOfWeek(value = new Date()) {
  const d = parseDate(value);
  d.setHours(0, 0, 0, 0);
  return addDays(d, -((d.getDay() + 6) % 7));
}
export function weekDays(value) {
  return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(value), i));
}
export function daysAgo(value) {
  if (!parseDate(value)) return NaN;
  return Math.round(
    (parseDate(formatDateISO(value)) - parseDate(formatDateISO())) / 86400000,
  );
}
export function isSameDay(a, b) {
  return !!a && !!b && formatDateISO(a) === formatDateISO(b);
}
export function isToday(value) {
  return isSameDay(value, new Date());
}
export function getWeekdayName(value, short = false) {
  return (
    parseDate(value)?.toLocaleDateString("vi-VN", {
      weekday: short ? "short" : "long",
    }) || ""
  );
}
export function minutes(value) {
  const [h = 0, m = 0] = String(value || "")
    .split(":")
    .map(Number);
  return h * 60 + m;
}
