// Planning inputs use the same UTC+7 clock as the backend, independent of device timezone.
export function planningNow(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16), dateTime: local.slice(0, 16) };
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assertPlanningDate(value, label = "Ngày bắt đầu", now = new Date()) {
  if (!validDate(value)) throw new Error(`${label} không hợp lệ.`);
  if (value < planningNow(now).date) throw new Error(`${label} không được là ngày đã qua.`);
}

export function assertBirthDate(value, now = new Date()) {
  if (!value) return;
  if (!validDate(value)) throw new Error("Ngày sinh không hợp lệ.");
  if (value > planningNow(now).date) throw new Error("Ngày sinh không được sau ngày hiện tại.");
}

export function assertFutureDateTime(value, label = "Thời gian bắt đầu", now = new Date()) {
  const [date, time] = String(value || "").split("T");
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) {
    throw new Error(`${label} không hợp lệ.`);
  }
  if (new Date(`${date}T${time}:00+07:00`) <= now) {
    throw new Error(`${label} phải sau thời điểm hiện tại.`);
  }
}

export function isFutureStart(date, time, now = new Date()) {
  try {
    assertFutureDateTime(`${date}T${time?.slice(0, 5)}`, "Thời gian bắt đầu", now);
    return true;
  } catch {
    return false;
  }
}

export function nextPlanningMinute(now = new Date()) {
  return planningNow(new Date(now.getTime() + 60 * 1000)).dateTime;
}

export function nextDateForTime(time, now = new Date()) {
  const today = planningNow(now).date;
  return isFutureStart(today, time, now) ? today : planningNow(new Date(now.getTime() + 86400000)).date;
}

export function defaultStudySlot(now = new Date()) {
  const current = planningNow(now);
  const [hour, minute] = current.time.split(":").map(Number);
  let start = Math.max(19 * 60, Math.ceil((hour * 60 + minute + 1) / 15) * 15);
  let date = current.date;
  if (start > 21 * 60) {
    date = planningNow(new Date(now.getTime() + 24 * 60 * 60 * 1000)).date;
    start = 19 * 60;
  }
  const time = value => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  return { studyDate: date, startTime: time(start), endTime: time(start + 60) };
}

export function validateAIPlanningOptions(options, now = new Date()) {
  assertPlanningDate(options.startDate, "Ngày bắt đầu", now);
  assertPlanningDate(options.endDate, "Ngày kết thúc", now);
  if (options.endDate < options.startDate) throw new Error("Ngày kết thúc không được trước ngày bắt đầu.");
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
  if (!validTime(options.freeStartTime) || !validTime(options.freeEndTime)) throw new Error("Giờ học không hợp lệ.");
  if (options.freeEndTime <= options.freeStartTime) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  const duration = Number(options.durationMinutes);
  if (!Number.isFinite(duration) || duration < 30 || duration > 240) throw new Error("Thời lượng mỗi buổi phải từ 30 đến 240 phút.");
  if (options.endDate === planningNow(now).date) {
    assertFutureDateTime(`${options.endDate}T${options.freeEndTime}`, "Giờ kết thúc học", now);
  }
}
