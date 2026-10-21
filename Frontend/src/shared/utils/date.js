/**
 * UniStudy CMC - Date & Time Utilities
 * Xử lý ngày, giờ theo Asia/Ho_Chi_Minh
 */

/**
 * Lấy đối tượng Date hiện tại
 */
export function getCurrentDate() {
  return new Date();
}

/**
 * Format ngày thành chuỗi YYYY-MM-DD
 * @param {Date|string} date
 */
export function formatDateISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format ngày thành chuỗi DD/MM/YYYY
 * @param {Date|string} date
 */
export function formatDateVN(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format ngày và giờ thành DD/MM/YYYY · HH:mm
 */
export function formatDateTimeVN(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${formatDateVN(d)} · ${time}`;
}

/**
 * Chuyển đổi chuỗi giờ "HH:mm" thành số phút từ đầu ngày
 * @param {string} timeStr - Ví dụ "08:30"
 * @returns {number}
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Chuyển số phút từ đầu ngày thành chuỗi "HH:mm"
 * @param {number} totalMinutes
 * @returns {string}
 */
export function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Lấy danh sách 7 ngày trong tuần chứa ngày được chọn (Bắt đầu từ Thứ Hai)
 * @param {Date|string} selectedDate
 * @returns {Array<{dateStr: string, dayOfWeek: number, dayName: string, date: Date}>}
 */
export function getDaysOfWeek(selectedDate) {
  const d = selectedDate instanceof Date ? new Date(selectedDate) : new Date(selectedDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const days = [];
  const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push({
      dateStr: formatDateISO(cur),
      dayOfWeek: i + 1, // 1 to 7
      dayName: dayNames[i],
      date: cur
    });
  }
  return days;
}

/**
 * Tính số giờ/ngày còn lại đến deadline so với hiện tại
 * @param {string|Date} dueTarget
 * @returns {{isOverdue: boolean, hoursLeft: number, text: string}}
 */
export function calculateRemainingTime(dueTarget) {
  const due = dueTarget instanceof Date ? dueTarget : new Date(dueTarget);
  if (isNaN(due.getTime())) {
    return { isOverdue: false, hoursLeft: 0, text: "Chưa rõ" };
  }
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs <= 0) {
    const passedHours = Math.abs(diffHours);
    if (passedHours < 24) {
      return { isOverdue: true, hoursLeft: diffHours, text: `Quá hạn ${passedHours} giờ` };
    }
    const passedDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return { isOverdue: true, hoursLeft: diffHours, text: `Quá hạn ${passedDays} ngày` };
  }

  if (diffHours < 24) {
    return { isOverdue: false, hoursLeft: diffHours, text: `Còn ${Math.max(1, diffHours)} giờ` };
  }
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { isOverdue: false, hoursLeft: diffHours, text: `Còn ${daysLeft} ngày` };
}

/**
 * Tăng/giảm số ngày từ chuỗi ISO YYYY-MM-DD, chuyển tháng/năm chính xác
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} daysDelta - Số ngày cần dịch chuyển (+ hoặc -)
 * @returns {string} - "YYYY-MM-DD"
 */
export function shiftDateByDays(dateStr, daysDelta) {
  if (!dateStr || typeof dateStr !== "string") {
    dateStr = formatDateISO(new Date());
  }
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;

  const dt = new Date(year, month, day + daysDelta);
  return formatDateISO(dt);
}

/**
 * Tăng/giảm số tháng từ chuỗi ISO YYYY-MM-DD, xử lý chính xác số ngày khác nhau của các tháng và cuối năm
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} monthsDelta - Số tháng cần dịch chuyển (+ hoặc -)
 * @returns {string} - "YYYY-MM-DD"
 */
export function shiftDateByMonths(dateStr, monthsDelta) {
  if (!dateStr || typeof dateStr !== "string") {
    dateStr = formatDateISO(new Date());
  }
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const monthIndex = (parts[1] || 1) - 1;
  const day = parts[2] || 1;

  // Tính tháng và năm mới
  const totalMonths = year * 12 + monthIndex + monthsDelta;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths % 12;

  // Số ngày tối đa của tháng đích (ví dụ tháng 2 năm 2026 có 28 ngày)
  const maxDaysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  const dt = new Date(targetYear, targetMonthIndex, targetDay);
  return formatDateISO(dt);
}

/**
 * Lấy các phân đoạn tuần (Thứ Hai – Chủ Nhật) thuộc một tháng cụ thể (chỉ tính phần ngày trong tháng)
 * @param {number} year - Ví dụ 2026
 * @param {number} monthIndex - 0 đến 11 (0 = Tháng 1, 9 = Tháng 10)
 * @returns {Array<{
 *   weekIndex: number,
 *   weekLabel: string,
 *   dateRangeLabel: string,
 *   startDateStr: string,
 *   endDateStr: string,
 *   startDay: number,
 *   endDay: number,
 *   daysCount: number
 * }>}
 */
export function getWeeksOfMonth(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weeks = [];
  let currentStartDay = 1;
  let weekIndex = 1;

  while (currentStartDay <= daysInMonth) {
    const curDate = new Date(year, monthIndex, currentStartDay);
    const dayOfWeek = curDate.getDay(); // 0 is Sunday, 1 is Monday
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const currentEndDay = Math.min(daysInMonth, currentStartDay + daysToSunday);

    const pad = (n) => String(n).padStart(2, "0");
    const mPad = pad(monthIndex + 1);
    const startDateStr = `${year}-${mPad}-${pad(currentStartDay)}`;
    const endDateStr = `${year}-${mPad}-${pad(currentEndDay)}`;

    weeks.push({
      weekIndex,
      weekLabel: `Tuần ${weekIndex}`,
      dateRangeLabel: `${pad(currentStartDay)}/${mPad} – ${pad(currentEndDay)}/${mPad}`,
      startDateStr,
      endDateStr,
      startDay: currentStartDay,
      endDay: currentEndDay,
      daysCount: currentEndDay - currentStartDay + 1
    });

    currentStartDay = currentEndDay + 1;
    weekIndex++;
  }

  return weeks;
}

/**
 * Lấy danh sách tất cả các ngày trong một tháng cụ thể (1 đến 28/29/30/31)
 * @param {number} year
 * @param {number} monthIndex
 * @returns {Array<{dateStr: string, dayNumber: number, dayOfWeek: number, dayName: string, date: Date}>}
 */
export function getMonthDays(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days = [];
  const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const pad = (n) => String(n).padStart(2, "0");
  const mPad = pad(monthIndex + 1);

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    days.push({
      dateStr: `${year}-${mPad}-${pad(d)}`,
      dayNumber: d,
      dayOfWeek: dt.getDay(),
      dayName: dayNames[dt.getDay()],
      date: dt
    });
  }
  return days;
}


