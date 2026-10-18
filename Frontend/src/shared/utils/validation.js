/**
 * UniStudy CMC - Validation Utilities
 */
import { timeStringToMinutes } from "./date.js";

/**
 * Kiểm tra chuỗi không rỗng
 */
export function isNonEmptyString(val) {
  return typeof val === "string" && val.trim().length > 0;
}

/**
 * Kiểm tra khoảng thời gian bắt đầu trước kết thúc
 * @param {string} start - "HH:mm"
 * @param {string} end - "HH:mm"
 * @returns {{valid: boolean, message?: string}}
 */
export function validateTimeRange(start, end) {
  if (!start || !end) {
    return { valid: false, message: "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc." };
  }
  const startMin = timeStringToMinutes(start);
  const endMin = timeStringToMinutes(end);
  if (endMin <= startMin) {
    return { valid: false, message: "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày." };
  }
  return { valid: true };
}

/**
 * Kiểm tra form công việc
 */
export function validateTaskInput(data) {
  const errors = {};
  if (!isNonEmptyString(data.title)) {
    errors.title = "Tên công việc không được để trống.";
  }
  if (!data.due) {
    errors.due = "Vui lòng chọn thời hạn nộp.";
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Kiểm tra form kỳ thi
 */
export function validateExamInput(data) {
  const errors = {};
  if (!isNonEmptyString(data.subject)) {
    errors.subject = "Tên môn thi không được để trống.";
  }
  if (!data.date) {
    errors.date = "Vui lòng chọn ngày thi.";
  }
  if (!data.start) {
    errors.start = "Vui lòng chọn giờ bắt đầu.";
  }
  const duration = parseInt(data.duration, 10);
  if (isNaN(duration) || duration <= 0) {
    errors.duration = "Thời lượng thi phải là số phút dương.";
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
