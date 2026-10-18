/**
 * UniStudy CMC - Dashboard Service
 * Theo API_FUNCTION_MAP.md & API_CONTRACT.md
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";

export async function getDashboard() {
  return await apiRequest(ENDPOINTS.dashboard.get);
}
