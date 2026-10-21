/**
 * UniStudy CMC - Dashboard Service
 * Theo API Backend Sprint 1
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { state, notifyStateChange } from "../../app/state.js";

export async function getDashboard() {
  return await apiRequest(ENDPOINTS.dashboard.get);
}

/**
 * Tải dữ liệu dashboard tổng hợp từ backend và đồng bộ vào state
 */
export async function fetchDashboardData() {
  const res = await getDashboard();
  if (res.success && res.data) {
    const d = res.data?.data ?? res.data;
    if (d.profile && (d.profile.full_name || d.profile.student_code)) {
      state.studentProfile = {
        name: d.profile.full_name || "Chưa có dữ liệu",
        studentId: d.profile.student_code || "Chưa có dữ liệu",
        email: d.profile.email || "Chưa có dữ liệu",
        major: d.profile.major || "",
        gpa: d.profile.gpa_4_scale ?? 0,
        credits: d.profile.total_passed_credits ?? 0
      };
    }
    notifyStateChange();
    return d;
  }
  return null;
}

