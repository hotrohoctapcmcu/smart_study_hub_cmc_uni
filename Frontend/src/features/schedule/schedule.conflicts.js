/**
 * UniStudy CMC - Schedule Conflicts Engine
 * Thuật toán thuần phát hiện và quản lý xung đột lịch học theo SPRINT_1.md:
 * Có trùng khi: A.start < B.end AND B.start < A.end (trong cùng ngày)
 * A.end == B.start hoặc B.end == A.start thì KHÔNG trùng.
 */
import { timeStringToMinutes } from "../../shared/utils/date.js";

/**
 * Kiểm tra 2 sự kiện có trùng thời gian hay không
 * @param {object} evA - { id, date, start, end }
 * @param {object} evB - { id, date, start, end }
 * @returns {boolean}
 */
export function areEventsConflicting(evA, evB) {
  if (evA.id === evB.id) return false;
  if (evA.date !== evB.date) return false;

  const aStart = timeStringToMinutes(evA.start);
  const aEnd = timeStringToMinutes(evA.end);
  const bStart = timeStringToMinutes(evB.start);
  const bEnd = timeStringToMinutes(evB.end);

  // A.start < B.end AND B.start < A.end
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Tạo khóa định danh ổn định cho cặp xung đột (chống đếm trùng A-B và B-A)
 */
export function makeConflictPairKey(idA, idB) {
  return [String(idA), String(idB)].sort().join("___");
}

/**
 * Tìm tất cả các cặp xung đột trong danh sách sự kiện
 * @param {Array<object>} allEvents
 * @returns {{
 *   conflictPairs: Array<{key: string, eventA: object, eventB: object}>,
 *   conflictingEventIds: Set<string|number>,
 *   count: number
 * }}
 */
export function findScheduleConflicts(allEvents) {
  const pairsMap = new Map();
  const conflictingEventIds = new Set();

  if (!Array.isArray(allEvents) || allEvents.length < 2) {
    return {
      conflictPairs: [],
      conflictingEventIds,
      count: 0
    };
  }

  for (let i = 0; i < allEvents.length; i++) {
    for (let j = i + 1; j < allEvents.length; j++) {
      const evA = allEvents[i];
      const evB = allEvents[j];

      if (areEventsConflicting(evA, evB)) {
        const key = makeConflictPairKey(evA.id, evB.id);
        if (!pairsMap.has(key)) {
          pairsMap.set(key, { key, eventA: evA, eventB: evB });
          conflictingEventIds.add(evA.id);
          conflictingEventIds.add(evB.id);
        }
      }
    }
  }

  const conflictPairs = Array.from(pairsMap.values());
  return {
    conflictPairs,
    conflictingEventIds,
    count: conflictPairs.length
  };
}
