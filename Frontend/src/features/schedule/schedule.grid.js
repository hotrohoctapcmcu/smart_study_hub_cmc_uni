/**
 * UniStudy CMC - Schedule Grid Layout Engine
 * Thuật toán tính toán vị trí pixel, độ cao tỷ lệ, chia cột khi chồng giờ,
 * và tách sự kiện qua nửa đêm theo chuẩn Google Calendar.
 */
import { timeStringToMinutes } from "../../shared/utils/date.js";

export const HOUR_HEIGHT = 60; // 60px cho mỗi giờ -> 1px mỗi phút
export const TOTAL_GRID_HEIGHT = 24 * HOUR_HEIGHT; // 1440px
export const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
export const GRID_HOURS_2H = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];


/**
 * Chuyển số phút sang chuỗi "HH:MM"
 */
export function minutesToTimeString(minutes) {
  const m = Math.max(0, Math.min(1440, Math.floor(minutes)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Tách các sự kiện qua nửa đêm thành 2 phần hiển thị độc lập trong ngày,
 * giữ nguyên id nguồn để không tạo bản ghi dữ liệu trùng.
 */
export function splitOvernightEvents(events) {
  if (!Array.isArray(events)) return [];

  const result = [];
  events.forEach((ev) => {
    if (!ev || !ev.date) return;

    // Sự kiện cả ngày hoặc không có giờ cụ thể
    if (ev.isAllDay || !ev.start || !ev.end) {
      result.push(ev);
      return;
    }

    const startMin = timeStringToMinutes(ev.start);
    const endMin = timeStringToMinutes(ev.end);

    // Nếu kết thúc trước hoặc bằng bắt đầu (qua nửa đêm, ví dụ 22:00 -> 02:00)
    if (endMin <= startMin && endMin > 0) {
      // Phần 1: từ start đến 24:00 của ngày hôm đó
      result.push({
        ...ev,
        originalId: ev.id,
        date: ev.date,
        start: ev.start,
        end: "24:00",
        isOvernightPart: true,
        overnightPartIndex: 1
      });

      // Phần 2: từ 00:00 đến end của ngày hôm sau
      const nextDate = getNextDateStr(ev.date);
      result.push({
        ...ev,
        originalId: ev.id,
        date: nextDate,
        start: "00:00",
        end: ev.end,
        isOvernightPart: true,
        overnightPartIndex: 2
      });
    } else {
      result.push(ev);
    }
  });

  return result;
}

function getNextDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Phân bổ vị trí, độ cao và chia cột cho các sự kiện trong một ngày
 * theo thuật toán Google Calendar (Interval Graph Coloring).
 */
export function layoutDayEvents(eventsForDay) {
  const timedEvents = [];
  const allDayEvents = [];
  const missingTimeEvents = [];

  eventsForDay.forEach((ev) => {
    if (ev.isAllDay) {
      allDayEvents.push(ev);
    } else if (!ev.start || !ev.end) {
      missingTimeEvents.push(ev);
    } else {
      const startMin = timeStringToMinutes(ev.start);
      let endMin = ev.end === "24:00" ? 1440 : timeStringToMinutes(ev.end);
      if (endMin <= startMin) endMin = 1440;

      timedEvents.push({
        ...ev,
        startMin,
        endMin,
        durationMin: endMin - startMin
      });
    }
  });

  // 1. Sắp theo thời điểm bắt đầu tăng dần; nếu bằng: giờ kết thúc rồi ID ổn định
  timedEvents.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.endMin !== b.endMin) return a.endMin - b.endMin;
    return String(a.id).localeCompare(String(b.id));
  });

  // 2. Nhóm các sự kiện chồng chéo nhau thành từng cụm liên thông (clusters)
  const clusters = [];
  let currentCluster = [];
  let clusterMaxEnd = -1;

  timedEvents.forEach((ev) => {
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterMaxEnd = ev.endMin;
    } else {
      if (ev.startMin < clusterMaxEnd) {
        // Có chồng giờ với cụm hiện tại
        currentCluster.push(ev);
        clusterMaxEnd = Math.max(clusterMaxEnd, ev.endMin);
      } else {
        // Bắt đầu cụm mới (hai buổi nối tiếp bằng giờ nhau không gộp vào chồng giờ)
        clusters.push(currentCluster);
        currentCluster = [ev];
        clusterMaxEnd = ev.endMin;
      }
    }
  });
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // 3. Phân chia cột cạnh nhau (columns allocation) trong từng cụm
  const positionedEvents = [];

  clusters.forEach((cluster) => {
    const colEndTimes = []; // Lưu thời điểm kết thúc gần nhất của từng cột

    // Gán cột cho từng sự kiện trong cụm
    cluster.forEach((ev) => {
      let assignedCol = -1;
      for (let c = 0; c < colEndTimes.length; c++) {
        // Cột c rảnh nếu sự kiện trước đó đã kết thúc <= startMin của sự kiện hiện tại
        if (colEndTimes[c] <= ev.startMin) {
          assignedCol = c;
          colEndTimes[c] = ev.endMin;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = colEndTimes.length;
        colEndTimes.push(ev.endMin);
      }
      ev.col = assignedCol;
    });

    const totalCols = Math.max(1, colEndTimes.length);

    cluster.forEach((ev) => {
      // Vị trí khối lịch tính từ số phút kể từ đầu ngày
      const top = (ev.startMin / 60) * HOUR_HEIGHT;
      // Chiều cao tỷ lệ với thời lượng (tối thiểu 24px để hiển thị thông tin và mở chi tiết)
      const height = Math.max(24, (ev.durationMin / 60) * HOUR_HEIGHT);
      const colWidthPercent = 100 / totalCols;
      const leftPercent = ev.col * colWidthPercent;

      positionedEvents.push({
        ...ev,
        top,
        height,
        leftPercent,
        widthPercent: colWidthPercent - (totalCols > 1 ? 1.5 : 0),
        totalCols
      });
    });
  });

  return {
    positionedEvents,
    allDayEvents,
    missingTimeEvents
  };
}
