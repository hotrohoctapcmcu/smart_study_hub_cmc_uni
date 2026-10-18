/**
 * UniStudy CMC - Schedule Form Validation
 */
import { validateTimeRange, isNonEmptyString } from "../../shared/utils/validation.js";

export function validateStudySessionForm(data) {
  const errors = {};

  if (!isNonEmptyString(data.title)) {
    errors.title = "Vui lòng nhập tên hoặc mục tiêu buổi tự học.";
  }
  if (!data.date) {
    errors.date = "Vui lòng chọn ngày học.";
  }

  const timeCheck = validateTimeRange(data.start, data.end);
  if (!timeCheck.valid) {
    errors.time = timeCheck.message;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
