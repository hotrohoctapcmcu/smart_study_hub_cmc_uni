import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { addLocalStudySession, updateLocalStudySession, deleteLocalStudySession } from "../../app/state.js";

/**
 * Lấy danh sách lịch học từ server (khi có backend)
 */
export async function getSchedules() {
  return await apiRequest(ENDPOINTS.schedules.list);
}

/**
 * Thêm mới lịch tự học (Mock adapter cập nhật state in-memory theo API contract)
 * @param {object} sessionData
 * @returns {Promise<object>}
 */
export async function createSelfStudy(sessionData) {
  return addLocalStudySession(sessionData);
}

/**
 * Cập nhật lịch tự học theo ID (Mock adapter cập nhật state in-memory theo API contract)
 * @param {string} id - ID duy nhất của buổi học
 * @param {object} changes - Các trường cần cập nhật
 * @returns {Promise<object|null>}
 */
export async function updateSelfStudy(id, changes) {
  return updateLocalStudySession(id, changes);
}

/**
 * Xóa lịch tự học theo ID (Mock adapter cập nhật state in-memory theo API contract)
 * @param {string} id - ID duy nhất của buổi học
 * @returns {Promise<boolean>}
 */
export async function deleteSelfStudy(id) {
  deleteLocalStudySession(id);
  return true;
}

/**
 * Gửi yêu cầu kiểm tra xung đột lên server (khi có backend)
 */
export async function checkScheduleConflicts(events) {
  return await apiRequest(ENDPOINTS.schedules.checkConflicts, {
    body: { events }
  });
}
