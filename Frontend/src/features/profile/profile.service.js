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

export async function getStudentGrades(hocKy = null) {
  return await apiRequest(ENDPOINTS.student.getGrades, {
    params: hocKy ? { hocKy } : {}
  });
}

export async function getStudentSubjects() {
  return await apiRequest(ENDPOINTS.student.getSubjects);
}

/**
 * Xếp loại dựa trên GPA hệ 4.0 theo chuẩn quy định:
 * - Xuất sắc: Từ 3,6 đến 4,0
 * - Giỏi: Từ 3,2 đến cận 3,6
 * - Khá: Từ 2,5 đến cận 3,2
 * - Trung bình: Từ 2,0 đến cận 2,5
 * - Yếu: Từ 1,0 đến cận 2,0
 * - Kém: Dưới 1,0
 */
export function getGpaClassification(gpa) {
  const score = Number(gpa);
  if (isNaN(score) || score < 0) {
    return { rank: "Chưa xếp loại", badgeClass: "neutral", desc: "Chưa có dữ liệu điểm", color: "#6b7280" };
  }
  if (score >= 3.6 && score <= 4.0) {
    return { rank: "Xuất sắc", badgeClass: "success", desc: "Thành tích học tập xuất sắc", color: "#059669" };
  }
  if (score >= 3.2 && score < 3.6) {
    return { rank: "Giỏi", badgeClass: "info", desc: "Thành tích học tập giỏi", color: "#2563eb" };
  }
  if (score >= 2.5 && score < 3.2) {
    return { rank: "Khá", badgeClass: "violet", desc: "Thành tích học tập khá", color: "#7c3aed" };
  }
  if (score >= 2.0 && score < 2.5) {
    return { rank: "Trung bình", badgeClass: "warning", desc: "Thành tích học tập trung bình", color: "#d97706" };
  }
  if (score >= 1.0 && score < 2.0) {
    return { rank: "Yếu", badgeClass: "orange", desc: "Cần cải thiện kết quả học tập", color: "#ea580c" };
  }
  if (score < 1.0) {
    return { rank: "Kém", badgeClass: "danger", desc: "Kết quả học tập kém", color: "#dc2626" };
  }
  return { rank: "Chưa xếp loại", badgeClass: "neutral", desc: "Chưa có dữ liệu điểm", color: "#6b7280" };
}

/**
 * Tải hồ sơ sinh viên, bảng điểm và tổng tín chỉ từ backend và cập nhật state.studentProfile
 */
export async function fetchProfileFromApi() {
  const [profileRes, gradesRes, subjectsRes] = await Promise.allSettled([
    getStudentProfile(),
    getStudentGrades(),
    getStudentSubjects()
  ]);

  let grades = [];
  if (gradesRes.status === "fulfilled" && gradesRes.value.success) {
    grades = gradesRes.value.data?.data ?? gradesRes.value.data ?? [];
    if (!Array.isArray(grades)) grades = [];
  }

  let totalRequiredCredits = 135; // Chuẩn cử nhân đào tạo CMC

  let p = null;
  if (profileRes.status === "fulfilled" && profileRes.value.success && profileRes.value.data) {
    p = profileRes.value.data?.data ?? profileRes.value.data;
  }

  const existing = state.studentProfile || {};

  const newProfile = {
    name: p?.full_name || p?.fullName || existing.name || "Chưa có dữ liệu",
    studentId: p?.student_code || p?.studentCode || existing.studentId || "Chưa có dữ liệu",
    major: p?.major || existing.major || "Công nghệ thông tin",
    email: p?.email || existing.email || "",
    gpa: Number(p?.gpa_4_scale ?? p?.gpa4Scale ?? existing.gpa ?? 0),
    gpa10: Number(p?.gpa_10_scale ?? p?.gpa10Scale ?? existing.gpa10 ?? 0),
    credits: Number(p?.total_passed_credits ?? p?.totalPassedCredits ?? existing.credits ?? 0),
    totalRequiredCredits,
    grades: Array.isArray(grades) ? grades : (existing.grades || [])
  };

  // Tính toán bổ sung nếu backend chưa có GPA 4.0 tổng hợp nhưng đã có danh sách điểm
  if ((!newProfile.gpa || newProfile.gpa === 0) && Array.isArray(newProfile.grades) && newProfile.grades.length > 0) {
    let earnedPoints = 0;
    let earnedCredits = 0;
    newProfile.grades.forEach((g) => {
      const cr = Number(g.credits || 0);
      const letter = String(g.letter_grade || g.letterGrade || "").toUpperCase();
      let scale4 = 0;
      if (letter === "A+") scale4 = 4.0;
      else if (letter === "A") scale4 = 3.8;
      else if (letter === "B+") scale4 = 3.5;
      else if (letter === "B") scale4 = 3.0;
      else if (letter === "C+") scale4 = 2.5;
      else if (letter === "C") scale4 = 2.0;
      else if (letter === "D+") scale4 = 1.5;
      else if (letter === "D") scale4 = 1.0;
      else scale4 = 0.0;

      if (g.is_passed === 1 || g.isPassed) {
        earnedPoints += scale4 * cr;
        earnedCredits += cr;
      }
    });

    if (earnedCredits > 0) {
      newProfile.gpa = Number((earnedPoints / earnedCredits).toFixed(2));
      if (!newProfile.credits || newProfile.credits === 0) {
        newProfile.credits = earnedCredits;
      }
    }
  }

  // So sánh dữ liệu trước và sau để tránh notifyStateChange không cần thiết
  const prevData = JSON.stringify(state.studentProfile);
  const nextData = JSON.stringify(newProfile);

  if (prevData !== nextData) {
    state.studentProfile = newProfile;
    notifyStateChange();
  }

  return state.studentProfile;
}


