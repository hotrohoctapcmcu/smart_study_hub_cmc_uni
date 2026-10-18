/**
 * UniStudy CMC - Profile Service
 * Theo API_FUNCTION_MAP.md & API_CONTRACT.md
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";

export async function getStudentProfile() {
  return await apiRequest(ENDPOINTS.student.getProfile);
}

export async function updateStudentProfile(profileData) {
  return await apiRequest(ENDPOINTS.student.updateProfile, {
    body: profileData
  });
}
