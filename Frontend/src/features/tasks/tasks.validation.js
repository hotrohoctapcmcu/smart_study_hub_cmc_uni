/**
 * UniStudy CMC - Tasks Form Validation
 */
import { validateTaskInput } from "../../shared/utils/validation.js";

export function validateTask(data) {
  const result = validateTaskInput(data);
  const errors = { ...result.errors };

  // Nếu người dùng nhập cả thời gian bắt đầu và hạn hoàn thành
  if (data.startTime && data.due) {
    const tStart = new Date(data.startTime).getTime();
    const tDue = new Date(data.due).getTime();
    if (!isNaN(tStart) && !isNaN(tDue) && tDue < tStart) {
      errors.due = "Thời hạn hoàn thành phải diễn ra sau thời gian bắt đầu.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
