/**
 * UniStudy CMC - Timemap Service
 * ===================================================================================
 * Quản lý dữ liệu Bản đồ thời gian học tập:
 * - Timeline 7 ngày (Thứ 2 đến Chủ nhật)
 * - Phân loại 4 nhóm sự kiện:
 *   1. Thời khóa biểu (SCHEDULE) - Lớp học chính khóa
 *   2. Lịch thi (EXAM) - Kỳ thi học kỳ
 *   3. Lịch tự học (SELF_STUDY) - Buổi tự học cá nhân
 *   4. Thời gian trống (FREE_TIME) - Khung giờ rảnh có thể xếp lịch
 * - Heatmap mật độ học theo giờ (24 giờ x 7 ngày)
 * - Tạo buổi tự học từ khoảng trống
 * ===================================================================================
 */

import { state } from "../../app/state.js";
import { 
  formatDateISO, 
  formatDateVN, 
  getDaysOfWeek, 
  shiftDateByDays, 
  timeStringToMinutes, 
  minutesToTimeString 
} from "../../shared/utils/date.js";
import { createSelfStudy } from "../schedule/schedule.service.js";

/**
 * Lấy toàn bộ sự kiện của một ngày cụ thể từ state
 */
export function getEventsForDate(dateStr) {
  const events = [];

  // 1. Thời khóa biểu trên lớp
  const schoolEvents = (state.schoolEvents || []).filter((e) => e.date === dateStr);
  for (const s of schoolEvents) {
    events.push({
      id: s.id || `school-${s.scheduleId || Math.random()}`,
      type: "schedule",
      title: s.title || s.subject || "Lớp học chính khóa",
      subject: s.subject || s.title || "",
      room: s.room || s.location || "Phòng học",
      teacher: s.teacher || "",
      date: dateStr,
      start: s.start || "08:00",
      end: s.end || "10:00",
      startMin: timeStringToMinutes(s.start || "08:00"),
      endMin: timeStringToMinutes(s.end || "10:00"),
      colorType: "schedule"
    });
  }

  // 2. Lịch thi
  const exams = (state.exams || []).filter((e) => (e.examDate || e.date) === dateStr);
  for (const ex of exams) {
    const rawStart = ex.examTime || ex.start || "08:00";
    const rawEnd = ex.endTime || ex.end || minutesToTimeString(timeStringToMinutes(rawStart) + 90);
    events.push({
      id: ex.id || `exam-${ex.examId || Math.random()}`,
      type: "exam",
      title: `Thi: ${ex.subjectName || ex.subject || "Môn thi"}`,
      subject: ex.subjectName || ex.subject || "",
      room: ex.room || "Phòng thi",
      date: dateStr,
      start: rawStart.slice(0, 5),
      end: rawEnd.slice(0, 5),
      startMin: timeStringToMinutes(rawStart),
      endMin: timeStringToMinutes(rawEnd),
      colorType: "exam"
    });
  }

  // 3. Lịch tự học
  const studyEvents = (state.studyEvents || []).filter((e) => e.date === dateStr);
  for (const st of studyEvents) {
    events.push({
      id: st.id,
      type: "self_study",
      title: st.title || "Tự học",
      subject: st.subject || "Tự học",
      room: st.note || "Bàn học cá nhân",
      date: dateStr,
      start: st.start || "14:00",
      end: st.end || "16:00",
      startMin: timeStringToMinutes(st.start || "14:00"),
      endMin: timeStringToMinutes(st.end || "16:00"),
      colorType: "self_study"
    });
  }

  // Sắp xếp theo giờ bắt đầu
  events.sort((a, b) => a.startMin - b.startMin);
  return events;
}

/**
 * Tính toán các khoảng thời gian trống (FREE_TIME) trong khung hoạt động (07:00 - 22:00)
 */
export function calculateFreeTimeSlots(dateStr, busyEvents) {
  const freeSlots = [];
  const DAY_START = 7 * 60;  // 07:00
  const DAY_END = 22 * 60;   // 22:00
  const MIN_FREE_DURATION = 30; // Tối thiểu 30 phút rảnh mới xếp thành slot

  if (busyEvents.length === 0) {
    freeSlots.push({
      id: `free-${dateStr}-all`,
      type: "free_time",
      title: "Thời gian trống",
      date: dateStr,
      start: minutesToTimeString(DAY_START),
      end: minutesToTimeString(DAY_END),
      startMin: DAY_START,
      endMin: DAY_END,
      durationMinutes: DAY_END - DAY_START,
      colorType: "free_time"
    });
    return freeSlots;
  }

  let currentCursor = DAY_START;

  for (const ev of busyEvents) {
    const evStart = Math.max(DAY_START, ev.startMin);
    const evEnd = Math.min(DAY_END, ev.endMin);

    if (evStart > currentCursor && (evStart - currentCursor) >= MIN_FREE_DURATION) {
      freeSlots.push({
        id: `free-${dateStr}-${currentCursor}-${evStart}`,
        type: "free_time",
        title: "Thời gian trống",
        date: dateStr,
        start: minutesToTimeString(currentCursor),
        end: minutesToTimeString(evStart),
        startMin: currentCursor,
        endMin: evStart,
        durationMinutes: evStart - currentCursor,
        colorType: "free_time"
      });
    }

    if (evEnd > currentCursor) {
      currentCursor = evEnd;
    }
  }

  if (DAY_END > currentCursor && (DAY_END - currentCursor) >= MIN_FREE_DURATION) {
    freeSlots.push({
      id: `free-${dateStr}-${currentCursor}-${DAY_END}`,
      type: "free_time",
      title: "Thời gian trống",
      date: dateStr,
      start: minutesToTimeString(currentCursor),
      end: minutesToTimeString(DAY_END),
      startMin: currentCursor,
      endMin: DAY_END,
      durationMinutes: DAY_END - currentCursor,
      colorType: "free_time"
    });
  }

  return freeSlots;
}

/**
 * Lấy toàn bộ dữ liệu Timeline 7 ngày cho tuần được chọn
 */
export function getTimemapWeekData(selectedDateStr = null) {
  const baseDateStr = selectedDateStr || formatDateISO(new Date());
  const weekDays = getDaysOfWeek(baseDateStr);

  let totalScheduleHours = 0;
  let totalExamCount = 0;
  let totalSelfStudyHours = 0;
  let totalFreeHours = 0;

  const daysData = weekDays.map((d) => {
    const busyEvents = getEventsForDate(d.dateStr);
    const freeSlots = calculateFreeTimeSlots(d.dateStr, busyEvents);

    // Thống kê nhanh
    for (const b of busyEvents) {
      const durationHours = Math.max(0, (b.endMin - b.startMin) / 60);
      if (b.type === "schedule") totalScheduleHours += durationHours;
      else if (b.type === "exam") totalExamCount++;
      else if (b.type === "self_study") totalSelfStudyHours += durationHours;
    }

    for (const f of freeSlots) {
      totalFreeHours += (f.durationMinutes / 60);
    }

    return {
      dayName: d.dayName,
      dateStr: d.dateStr,
      dateFormatted: formatDateVN(d.date).slice(0, 5), // "DD/MM"
      isToday: d.dateStr === formatDateISO(new Date()),
      busyEvents,
      freeSlots,
      allTimelineItems: [...busyEvents, ...freeSlots].sort((a, b) => a.startMin - b.startMin)
    };
  });

  const weekRangeTitle = `Tuần ${formatDateVN(weekDays[0].date)} – ${formatDateVN(weekDays[6].date)}`;

  return {
    selectedDate: baseDateStr,
    weekRangeTitle,
    days: daysData,
    summary: {
      totalScheduleHours: Number(totalScheduleHours.toFixed(1)),
      totalExamCount,
      totalSelfStudyHours: Number(totalSelfStudyHours.toFixed(1)),
      totalFreeHours: Number(totalFreeHours.toFixed(1))
    }
  };
}

/**
 * Tính Heatmap mật độ học theo 24 khung giờ trong ngày x 7 ngày
 */
export function getHourlyStudyDensityHeatmap(selectedDateStr = null) {
  const baseDateStr = selectedDateStr || formatDateISO(new Date());
  const weekDays = getDaysOfWeek(baseDateStr);

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  let maxHourlyMinutes = 0;
  let peakHour = 0;
  let peakDay = weekDays[0].dayName;
  let totalWeekStudyMinutes = 0;

  const matrix = weekDays.map((d) => {
    const busyEvents = getEventsForDate(d.dateStr);
    const hourlyMins = new Array(24).fill(0);

    for (const ev of busyEvents) {
      for (let h = 0; h < 24; h++) {
        const slotStart = h * 60;
        const slotEnd = (h + 1) * 60;
        const overlapStart = Math.max(ev.startMin, slotStart);
        const overlapEnd = Math.min(ev.endMin, slotEnd);

        if (overlapEnd > overlapStart) {
          hourlyMins[h] += (overlapEnd - overlapStart);
        }
      }
    }

    const cells = hourlyMins.map((mins, hour) => {
      totalWeekStudyMinutes += mins;
      if (mins > maxHourlyMinutes) {
        maxHourlyMinutes = mins;
        peakHour = hour;
        peakDay = d.dayName;
      }

      let level = 0;
      if (mins >= 45) level = 3;
      else if (mins >= 25) level = 2;
      else if (mins > 0) level = 1;

      return {
        hour,
        hourLabel: `${String(hour).padStart(2, "0")}:00`,
        minutes: mins,
        level,
        tooltip: `${d.dayName} (${formatDateVN(d.date).slice(0, 5)}) lúc ${String(hour).padStart(2, "0")}:00 – ${String(hour + 1).padStart(2, "0")}:00: ${mins} phút học`
      };
    });

    return {
      dayName: d.dayName,
      dateStr: d.dateStr,
      dateShort: formatDateVN(d.date).slice(0, 5),
      cells,
      totalDayMinutes: hourlyMins.reduce((a, b) => a + b, 0)
    };
  });

  return {
    hoursList,
    matrix,
    totalWeekHours: Number((totalWeekStudyMinutes / 60).toFixed(1)),
    peakInfo: maxHourlyMinutes > 0
      ? `Khung giờ tập trung cao nhất: ${peakDay} lúc ${String(peakHour).padStart(2, "0")}:00 (${maxHourlyMinutes} phút)`
      : "Chưa ghi nhận giờ học trong tuần này"
  };
}

/**
 * Thêm buổi tự học mới từ khoảng trống hoặc form
 */
export async function addSelfStudySession(sessionData) {
  return await createSelfStudy({
    title: sessionData.title || "Tự học",
    subject: sessionData.subject || "Tự học",
    subjectId: sessionData.subjectId || null,
    date: sessionData.date,
    start: sessionData.start,
    end: sessionData.end,
    note: sessionData.note || ""
  });
}
