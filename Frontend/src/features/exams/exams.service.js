/**
 * UniStudy CMC - Exams Service
 * Interface dịch vụ theo API_FUNCTION_MAP.md & API_CONTRACT.md
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";

export async function getExams() {
  return await apiRequest(ENDPOINTS.exams.list);
}

export async function getUpcomingExams() {
  return await apiRequest(ENDPOINTS.exams.upcoming);
}

export async function getExam(id) {
  return await apiRequest(ENDPOINTS.exams.getById, {
    params: { id }
  });
}
