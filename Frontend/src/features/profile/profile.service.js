/**
 * UniStudy CMC - Profile Service
 * Theo API Backend Sprint 1
 */
import { ENDPOINTS } from "../../shared/config/endpoints.js";
import { apiRequest } from "../../shared/services/api-client.js";
import { state, notifyStateChange } from "../../app/state.js";

export async function getStudentProfile() {
  return await apiRequest(ENDPOINTS.student.getProfile);
}

export async function updateStudentProfile(profileData) {
  return await apiRequest(ENDPOINTS.student.updateProfile, {
    body: profileData
  });
}

/**
 * Tải hồ sơ sinh viên từ backend và cập nhật state.studentProfile
 */
export async function fetchProfileFromApi() {
  const res = await getStudentProfile();
  if (res.success && res.data) {
    const p = res.data?.data ?? res.data;
    if (p && (p.full_name || p.fullName || p.student_code || p.studentCode)) {
      state.studentProfile = {
        name: p.full_name || p.fullName || "Chưa có dữ liệu",
        studentId: p.student_code || p.studentCode || "Chưa có dữ liệu",
        email: p.email || "Chưa có dữ liệu",
        major: p.major || "",
        gpa: p.gpa_4_scale ?? 0,
        credits: p.total_passed_credits ?? 0
      };
      notifyStateChange();
      return state.studentProfile;
    }
  }
  return state.studentProfile;
}

/**
 * Lưu hồ sơ sinh viên lên Backend API
 */
export async function saveStudentProfileApi(profileData) {
  const payload = {
    fullName: profileData.name || profileData.fullName,
    studentCode: profileData.studentId || profileData.studentCode,
    email: profileData.email || "",
    major: profileData.major || state.studentProfile?.major || "Công nghệ thông tin"
  };

  const res = await updateStudentProfile(payload);
  if (!res.success) {
    throw new Error(res.error || "Lỗi cập nhật hồ sơ trên máy chủ.");
  }

  await fetchProfileFromApi();
  return state.studentProfile;
}

