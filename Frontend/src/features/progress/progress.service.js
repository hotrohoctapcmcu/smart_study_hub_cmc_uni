/**
 * UniStudy CMC - Progress & Study Time Map Service (Sprint 2 & Refactored)
 * Thống kê tổng hợp thời gian học, phiên Pomodoro, tỷ lệ hoàn thành tasks và bản đồ thời gian
 * Toàn bộ số liệu lấy từ dữ liệu thực tế (Pomodoro history & user tasks), không dùng số liệu mẫu/seed
 */
import { state } from "../../app/state.js";
import { getPomodoroStats } from "../pomodoro/pomodoro.storage.js";
import { 
  formatDateISO, 
  formatDateVN, 
  getDaysOfWeek, 
  getWeeksOfMonth, 
  getMonthDays 
} from "../../shared/utils/date.js";

/**
 * Phân bổ thời gian thực tế của một phiên học vào các khung giờ trong ngày
 * Đảm bảo: phiên 19:45–20:15 đóng góp 15 phút cho khung 19:00–20:00 và 15 phút cho 20:00–21:00
 * Phiên qua nửa đêm chia đúng cho hai ngày
 * @param {number} sessionStartMs
 * @param {number} sessionEndMs
 * @param {string} targetDateStr - "YYYY-MM-DD"
 * @returns {Array<number>} mảng 24 phần tử (số phút học thực tế cho từng giờ 0..23)
 */
export function allocateSessionToHours(sessionStartMs, sessionEndMs, targetDateStr) {
  const hourlyMinutes = new Array(24).fill(0);
  if (sessionEndMs <= sessionStartMs) return hourlyMinutes;

  const [y, m, d] = targetDateStr.split("-").map(Number);
  const dayStartMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const dayEndMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime() + 1;

  // Cắt khoảng phiên học theo ngày mục tiêu
  const clippedStartMs = Math.max(sessionStartMs, dayStartMs);
  const clippedEndMs = Math.min(sessionEndMs, dayEndMs);

  if (clippedEndMs <= clippedStartMs) return hourlyMinutes;

  for (let hour = 0; hour < 24; hour++) {
    const slotStartMs = new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
    const slotEndMs = new Date(y, m - 1, d, hour + 1, 0, 0, 0).getTime();

    const overlapStart = Math.max(clippedStartMs, slotStartMs);
    const overlapEnd = Math.min(clippedEndMs, slotEndMs);

    if (overlapEnd > overlapStart) {
      const mins = Math.round((overlapEnd - overlapStart) / 60000);
      hourlyMinutes[hour] += mins;
    }
  }

  return hourlyMinutes;
}

/**
 * Trích xuất khoảng thời gian [startMs, endMs] thực tế của một phiên Pomodoro trong lịch sử
 * Chống trùng lặp ID phiên và xử lý an toàn dữ liệu lịch sử
 */
export function extractSessionTimeRange(item) {
  const actualSeconds = Math.max(0, item.actualStudySeconds || 0);
  let endMs;
  let startMs;

  if (item.endTime && !isNaN(new Date(item.endTime).getTime())) {
    endMs = new Date(item.endTime).getTime();
  } else if (item.createdAt && !isNaN(new Date(item.createdAt).getTime())) {
    endMs = new Date(item.createdAt).getTime();
  } else {
    endMs = Date.now();
  }

  if (item.startTime && !isNaN(new Date(item.startTime).getTime())) {
    startMs = new Date(item.startTime).getTime();
  } else {
    startMs = endMs - actualSeconds * 1000;
  }

  // Đảm bảo startMs <= endMs
  if (startMs > endMs) startMs = endMs - actualSeconds * 1000;

  return { startMs, endMs, actualSeconds };
}

/**
 * Lấy toàn bộ số liệu phân tích tiến độ học tập (dùng chung cho cả Tiến độ và Dashboard)
 * @param {string} [period="week"] - "day" | "week" | "month"
 * @param {string} [selectedDateStr=null] - "YYYY-MM-DD"
 */
export function getProgressAnalytics(period = "week", selectedDateStr = null) {
  const pomoStats = getPomodoroStats();
  const tasks = state.tasks || [];
  const baseDateStr = selectedDateStr || formatDateISO(new Date());

  // 1. Chuẩn hóa chu kỳ xem (bỏ semester tại trang tiến độ, fallback về month)
  const activePeriod = (period === "day" || period === "month") ? period : "week";

  // 2. Xác định phạm vi ngày [startStr, endStr] và Date objects theo chu kỳ
  let rangeStartMs = 0;
  let rangeEndMs = 0;
  let periodTitle = "";
  let weekDays = [];
  let monthWeeks = [];
  let monthDays = [];

  const [baseYear, baseMonthNum, baseDayNum] = baseDateStr.split("-").map(Number);
  const baseMonthIndex = baseMonthNum - 1;

  if (activePeriod === "day") {
    rangeStartMs = new Date(baseYear, baseMonthIndex, baseDayNum, 0, 0, 0, 0).getTime();
    rangeEndMs = new Date(baseYear, baseMonthIndex, baseDayNum, 23, 59, 59, 999).getTime();
    periodTitle = `Ngày ${formatDateVN(baseDateStr)}`;
  } else if (activePeriod === "week") {
    weekDays = getDaysOfWeek(baseDateStr);
    const startParts = weekDays[0].dateStr.split("-").map(Number);
    const endParts = weekDays[6].dateStr.split("-").map(Number);
    rangeStartMs = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0).getTime();
    rangeEndMs = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999).getTime();
    periodTitle = `Tuần ${formatDateVN(weekDays[0].date)} – ${formatDateVN(weekDays[6].date)}`;
  } else {
    // Tháng
    monthWeeks = getWeeksOfMonth(baseYear, baseMonthIndex);
    monthDays = getMonthDays(baseYear, baseMonthIndex);
    rangeStartMs = new Date(baseYear, baseMonthIndex, 1, 0, 0, 0, 0).getTime();
    const lastDayOfMonth = new Date(baseYear, baseMonthIndex + 1, 0).getDate();
    rangeEndMs = new Date(baseYear, baseMonthIndex, lastDayOfMonth, 23, 59, 59, 999).getTime();
    const mStr = String(baseMonthNum).padStart(2, "0");
    periodTitle = `Tháng ${mStr}/${baseYear}`;
  }

  // 3. Lọc danh sách phiên Pomodoro duy nhất (chống trùng lặp theo ID)
  const rawHistory = pomoStats.history || [];
  const seenSessionIds = new Set();
  const uniqueHistory = [];

  for (const item of rawHistory) {
    const id = item.id || `pomo-${item.createdAt}`;
    if (!seenSessionIds.has(id)) {
      seenSessionIds.add(id);
      uniqueHistory.push(item);
    }
  }

  // 4. Thống kê phiên Pomodoro hoàn thành và thời lượng thực tế trong chu kỳ
  let periodActualSeconds = 0;
  let periodCompletedSessions = 0;
  let hasZeroDurationSession = false;

  const validSessionsInPeriod = [];

  for (const item of uniqueHistory) {
    const { startMs, endMs, actualSeconds } = extractSessionTimeRange(item);

    // Đếm phiên hoàn thành theo thời điểm kết thúc
    if (endMs >= rangeStartMs && endMs <= rangeEndMs && item.status === "Hoàn thành") {
      periodCompletedSessions++;
      if (actualSeconds === 0) {
        hasZeroDurationSession = true;
      }
    }

    // Thời lượng thực học được phân bổ theo khoảng thực tế
    const overlapStart = Math.max(startMs, rangeStartMs);
    const overlapEnd = Math.min(endMs, rangeEndMs);
    if (overlapEnd > overlapStart) {
      const durSec = Math.round((overlapEnd - overlapStart) / 1000);
      periodActualSeconds += durSec;
      validSessionsInPeriod.push({
        item,
        startMs,
        endMs,
        actualSeconds
      });
    }
  }

  const periodActualMinutes = Math.round(periodActualSeconds / 60);
  const periodActualHours = Number((periodActualSeconds / 3600).toFixed(1));
  const hasStudyData = periodActualMinutes > 0;

  // 5. Tính toán dữ liệu Biểu đồ theo từng chu kỳ cụ thể
  let chartData = {
    title: "",
    labels: [],
    subLabels: [],
    values: [],
    tooltips: [],
    unit: "giờ",
    highlightIndices: [],
    insight: null
  };

  if (activePeriod === "day") {
    // Biểu đồ Ngày: 24 khung 00:00–01:00, ..., 23:00–24:00 (đơn vị: phút)
    const dayLabels = [];
    const dayValues = new Array(24).fill(0);
    const dayTooltips = [];

    for (let h = 0; h < 24; h++) {
      const hStart = String(h).padStart(2, "0") + ":00";
      const hEnd = String((h + 1) % 24 === 0 ? 24 : (h + 1) % 24).padStart(2, "0") + ":00";
      dayLabels.push(`${hStart}–${hEnd}`);
    }

    // Phân bổ thời gian thực tế của các phiên học vào từng khung giờ
    for (const session of validSessionsInPeriod) {
      const hourly = allocateSessionToHours(session.startMs, session.endMs, baseDateStr);
      for (let h = 0; h < 24; h++) {
        dayValues[h] += hourly[h];
      }
    }

    const maxDayMinutes = Math.max(...dayValues);
    const highlightIndices = [];
    if (maxDayMinutes > 0) {
      dayValues.forEach((val, idx) => {
        if (val === maxDayMinutes) highlightIndices.push(idx);
      });
    }

    for (let h = 0; h < 24; h++) {
      dayTooltips.push(`Khung ${dayLabels[h]}: ${dayValues[h]} phút học thực tế`);
    }

    let dayInsight = null;
    if (maxDayMinutes > 0) {
      const bestSlots = highlightIndices.map((idx) => dayLabels[idx]).join(", ");
      dayInsight = `Bạn học nhiều nhất trong khung ${bestSlots}: ${maxDayMinutes} phút`;
    }

    chartData = {
      title: "Thời lượng học trong ngày",
      unit: "phút",
      labels: dayLabels,
      subLabels: [],
      values: dayValues,
      tooltips: dayTooltips,
      highlightIndices,
      insight: dayInsight
    };
  } else if (activePeriod === "week") {
    // Biểu đồ Tuần: Thứ 2 – Chủ nhật kèm ngày/tháng (đơn vị: giờ)
    const weekLabels = [];
    const weekValues = [0, 0, 0, 0, 0, 0, 0];
    const weekTooltips = [];

    weekDays.forEach((d, idx) => {
      const shortDate = formatDateVN(d.date).slice(0, 5);
      weekLabels.push(`${d.dayName} (${shortDate})`);

      // Tính tổng phút cho ngày d.dateStr
      let dayMins = 0;
      for (const session of validSessionsInPeriod) {
        const hourly = allocateSessionToHours(session.startMs, session.endMs, d.dateStr);
        dayMins += hourly.reduce((sum, m) => sum + m, 0);
      }
      weekValues[idx] = Number((dayMins / 60).toFixed(1));
      weekTooltips.push(`${d.dayName} (${shortDate}): ${weekValues[idx]} giờ (${dayMins} phút)`);
    });

    const maxWeekHours = Math.max(...weekValues);
    const highlightIndices = [];
    if (maxWeekHours > 0) {
      weekValues.forEach((val, idx) => {
        if (val === maxWeekHours) highlightIndices.push(idx);
      });
    }

    let weekInsight = null;
    if (maxWeekHours > 0) {
      const bestDays = highlightIndices.map((idx) => weekLabels[idx]).join(", ");
      weekInsight = `Ngày học nhiều nhất: ${bestDays} (${maxWeekHours} giờ)`;
    }

    chartData = {
      title: "Thời lượng học trong tuần",
      unit: "giờ",
      labels: weekLabels,
      subLabels: [],
      values: weekValues,
      tooltips: weekTooltips,
      highlightIndices,
      insight: weekInsight
    };
  } else {
    // Biểu đồ Tháng: Tuần 1, Tuần 2, ... theo phân đoạn tuần thuộc tháng (đơn vị: giờ)
    const monthLabels = [];
    const monthSubLabels = [];
    const monthValues = [];
    const monthTooltips = [];

    monthWeeks.forEach((w) => {
      monthLabels.push(w.weekLabel);
      monthSubLabels.push(w.dateRangeLabel);

      let weekMins = 0;
      // Duyệt qua từng ngày trong phân đoạn tuần thuộc tháng
      for (let dayNum = w.startDay; dayNum <= w.endDay; dayNum++) {
        const dPad = String(dayNum).padStart(2, "0");
        const mPad = String(baseMonthNum).padStart(2, "0");
        const dateStr = `${baseYear}-${mPad}-${dPad}`;

        for (const session of validSessionsInPeriod) {
          const hourly = allocateSessionToHours(session.startMs, session.endMs, dateStr);
          weekMins += hourly.reduce((sum, m) => sum + m, 0);
        }
      }

      const hours = Number((weekMins / 60).toFixed(1));
      monthValues.push(hours);
      monthTooltips.push(`${w.weekLabel} (${w.dateRangeLabel}): ${hours} giờ (${weekMins} phút)`);
    });

    const maxMonthHours = Math.max(...monthValues, 0);
    const highlightIndices = [];
    if (maxMonthHours > 0) {
      monthValues.forEach((val, idx) => {
        if (val === maxMonthHours) highlightIndices.push(idx);
      });
    }

    let monthInsight = null;
    if (maxMonthHours > 0) {
      const bestWeeks = highlightIndices.map((idx) => `${monthLabels[idx]} (${monthSubLabels[idx]})`).join(", ");
      monthInsight = `Tuần học nhiều nhất: ${bestWeeks} (${maxMonthHours} giờ)`;
    }

    chartData = {
      title: "Thời lượng học trong tháng",
      unit: "giờ",
      labels: monthLabels,
      subLabels: monthSubLabels,
      values: monthValues,
      tooltips: monthTooltips,
      highlightIndices,
      insight: monthInsight
    };
  }

  // 6. Tính toán Heatmap theo chu kỳ xem
  // Đảm bảo: ô 0 phút luôn có mức 0 (không tạo ô tím đậm khi không có dữ liệu)
  let heatmapData = [];
  if (activePeriod === "day") {
    // 24 giờ trong ngày
    const dayHourly = new Array(24).fill(0);
    for (const session of validSessionsInPeriod) {
      const hourly = allocateSessionToHours(session.startMs, session.endMs, baseDateStr);
      for (let h = 0; h < 24; h++) dayHourly[h] += hourly[h];
    }
    heatmapData = dayHourly.map((mins, h) => {
      let level = 0;
      if (mins > 45) level = 3;
      else if (mins > 20) level = 2;
      else if (mins > 0) level = 1;
      return {
        slot: `${String(h).padStart(2, "0")}:00`,
        minutes: mins,
        level,
        tooltip: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00: ${mins} phút học`
      };
    });
  } else if (activePeriod === "week") {
    // 7 ngày x 3 khung (Sáng, Chiều, Tối)
    heatmapData = weekDays.map((d) => {
      const hourly = new Array(24).fill(0);
      for (const session of validSessionsInPeriod) {
        const hList = allocateSessionToHours(session.startMs, session.endMs, d.dateStr);
        for (let h = 0; h < 24; h++) hourly[h] += hList[h];
      }

      // Sáng (06:00 - 12:00)
      const morningMins = hourly.slice(6, 12).reduce((a, b) => a + b, 0);
      // Chiều (12:00 - 18:00)
      const afternoonMins = hourly.slice(12, 18).reduce((a, b) => a + b, 0);
      // Tối (18:00 - 24:00)
      const eveningMins = hourly.slice(18, 24).reduce((a, b) => a + b, 0);

      const calcLevel = (mins) => {
        if (mins === 0) return 0;
        if (mins > 60) return 3;
        if (mins > 30) return 2;
        return 1;
      };

      return {
        day: d.dayName,
        dateStr: d.dateStr,
        morning: calcLevel(morningMins),
        afternoon: calcLevel(afternoonMins),
        evening: calcLevel(eveningMins),
        morningMins,
        afternoonMins,
        eveningMins
      };
    });
  } else {
    // Tháng: các ngày trong tháng (1..daysInMonth)
    heatmapData = monthDays.map((md) => {
      const hourly = new Array(24).fill(0);
      for (const session of validSessionsInPeriod) {
        const hList = allocateSessionToHours(session.startMs, session.endMs, md.dateStr);
        for (let h = 0; h < 24; h++) hourly[h] += hList[h];
      }
      const totalDayMins = hourly.reduce((a, b) => a + b, 0);
      let level = 0;
      if (totalDayMins > 90) level = 3;
      else if (totalDayMins > 30) level = 2;
      else if (totalDayMins > 0) level = 1;

      return {
        dayNumber: md.dayNumber,
        dateStr: md.dateStr,
        dayName: md.dayName,
        minutes: totalDayMins,
        hours: Number((totalDayMins / 60).toFixed(1)),
        level,
        tooltip: `${formatDateVN(md.date)}: ${totalDayMins} phút (${(totalDayMins / 60).toFixed(1)} giờ)`
      };
    });
  }

  // 7. Thống kê Tasks & Deadline thực tế
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "Hoàn thành").length;
  const inProgressTasks = tasks.filter((t) => t.status === "Đang làm").length;
  const hasTaskData = totalTasks > 0;
  const taskCompletionRate = hasTaskData ? Math.round((completedTasks / totalTasks) * 100) : null;

  // 8. Tiến độ theo môn học
  const defaultSubjects = ["Lập trình Web", "Cơ sở dữ liệu", "Cấu trúc dữ liệu", "Tiếng Anh"];
  const dynamicSubjects = Array.from(
    new Set([
      ...tasks.map((t) => t.subject).filter(Boolean),
      ...(state.schoolEvents || []).map((e) => e.subject).filter(Boolean)
    ])
  );
  const targetSubjects = dynamicSubjects.length > 0 ? dynamicSubjects : defaultSubjects;

  const subjectProgress = targetSubjects.map((subjectName) => {
    const subjectTasks = tasks.filter((t) => t.subject === subjectName);
    const subTotal = subjectTasks.length;
    const subCompleted = subjectTasks.filter((t) => t.status === "Hoàn thành").length;
    const subRate = subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : null;

    let statusLabel = "Chưa có công việc để tính tiến độ";
    if (subRate !== null) {
      statusLabel = subRate >= 80 ? "Tiến độ xuất sắc" : subRate >= 50 ? "Đang tiến triển" : "Cần tập trung thêm";
    }

    return {
      name: subjectName,
      totalTasks: subTotal,
      completedTasks: subCompleted,
      completionRate: subRate,
      statusLabel
    };
  });

  // 9. Dữ liệu tương thích ngược cho test runner Sprint 2
  // Cung cấp weekChart chuẩn 7 ngày T2 - CN
  const weekDaysLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
  const dailyHoursMap = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  const standardWeekDays = getDaysOfWeek(baseDateStr);
  standardWeekDays.forEach((d, idx) => {
    let dayMins = 0;
    for (const session of uniqueHistory) {
      const { startMs, endMs } = extractSessionTimeRange(session);
      const hourly = allocateSessionToHours(startMs, endMs, d.dateStr);
      dayMins += hourly.reduce((sum, m) => sum + m, 0);
    }
    dailyHoursMap[idx] = Number((dayMins / 60).toFixed(1));
  });

  // Tương thích ngược heatmap 7 ngày x 3 khung
  const fallbackWeekHeatmap = standardWeekDays.map((d) => {
    const hourly = new Array(24).fill(0);
    for (const session of uniqueHistory) {
      const { startMs, endMs } = extractSessionTimeRange(session);
      const hList = allocateSessionToHours(startMs, endMs, d.dateStr);
      for (let h = 0; h < 24; h++) hourly[h] += hList[h];
    }
    const morningMins = hourly.slice(6, 12).reduce((a, b) => a + b, 0);
    const afternoonMins = hourly.slice(12, 18).reduce((a, b) => a + b, 0);
    const eveningMins = hourly.slice(18, 24).reduce((a, b) => a + b, 0);
    const calcLevel = (mins) => (mins === 0 ? 0 : mins > 60 ? 3 : mins > 30 ? 2 : 1);
    return {
      day: d.dayName,
      morning: calcLevel(morningMins),
      afternoon: calcLevel(afternoonMins),
      evening: calcLevel(eveningMins)
    };
  });

  return {
    period: activePeriod,
    selectedDate: baseDateStr,
    periodTitle,
    totalStudyHours: periodActualHours,
    totalStudyMinutes: periodActualMinutes,
    hasStudyData,
    pomodoroSessions: periodCompletedSessions,
    totalPomodoroMinutes: periodActualMinutes,
    hasZeroDurationSession,
    completedTasks,
    totalTasks,
    hasTaskData,
    taskCompletionRate,
    inProgressTasks,
    chart: chartData,
    weekChart: {
      labels: activePeriod === "week" ? chartData.labels : weekDaysLabels,
      values: activePeriod === "week" ? chartData.values : dailyHoursMap
    },
    heatmap: activePeriod === "week" ? heatmapData : fallbackWeekHeatmap,
    periodHeatmap: heatmapData,
    subjects: subjectProgress,
    habits: {
      peakHour: chartData.insight || "Chưa có dữ liệu",
      peakPeriodLabel: "",
      hasPeakData: Boolean(chartData.insight),
      streakDays: hasStudyData ? 1 : 0
    },
    cumulative: {
      totalHours: pomoStats.totalHours || 0,
      totalMinutes: pomoStats.totalMinutes || 0,
      completedSessions: pomoStats.completedSessions || 0
    }
  };
}
