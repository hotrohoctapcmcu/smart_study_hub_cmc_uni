/**
 * UniStudy CMC - Tasks Form Validation
 */
import { validateTaskInput } from "../../shared/utils/validation.js";

export function validateTask(data) {
  return validateTaskInput(data);
}
