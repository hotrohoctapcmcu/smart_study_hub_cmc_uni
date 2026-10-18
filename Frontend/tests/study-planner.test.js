/**
 * UniStudy CMC - Tests for Study Planner Feature
 */
import {
  validatePlannerInput,
  generateMockSessions,
  generateAIStudySchedule,
  getStudyPlans,
  getStudyPlanById,
  updateStudyPlan,
  deleteStudyPlan
} from "../src/features/study-planner/study-planner.service.js";
import { state, resetSessionState } from "../src/app/state.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runStudyPlannerTests() {
  console.log("\n=== KIỂM THỬ TÍNH NĂNG KẾ HOẠCH HỌC TẬP (AI PLANNER) ===");
  resetSessionState();

  // 1. Validation input
  const val1 = validatePlannerInput({});
  assert(!val1.isValid && val1.errors.length > 0, "Bắt lỗi khi để trống môn học");

  const val2 = validatePlannerInput({ subject: "A", targetHours: 10 });
  assert(!val2.isValid, "Bắt lỗi khi tên môn dưới 2 ký tự");

  const val3 = validatePlannerInput({ subject: "Cơ sở dữ liệu", targetHours: -5 });
  assert(!val3.isValid, "Bắt lỗi khi số giờ học âm");

  const val4 = validatePlannerInput({ subject: "Cơ sở dữ liệu", targetHours: 60 });
  assert(!val4.isValid, "Bắt lỗi khi số giờ học vượt quá 50");

  const val5 = validatePlannerInput({ subject: "Cấu trúc dữ liệu & GT", targetHours: 12 });
  assert(val5.isValid && val5.errors.length === 0, "Dữ liệu hợp lệ vượt qua validation");

  // 2. Mock sessions generation
  const sessions = generateMockSessions("Lập trình Web", "evening", 10);
  assert(Array.isArray(sessions) && sessions.length > 0, "Sinh danh sách ca học mô phỏng theo ca tối");
  assert(sessions[0].day.includes("Thứ"), "Ca học có ngày học cụ thể trong tuần");
  assert(sessions[0].time === "19:30 – 21:30", "Khung giờ khớp với cấu hình ca tối");

  // 3. Phân tích & Tạo kế hoạch mô phỏng (Mock mode)
  const res = await generateAIStudySchedule({
    subject: "Hệ quản trị CSDL",
    freeSlot: "morning",
    targetHours: 8
  });
  assert(res.success === true, "Tạo kế hoạch học tập mô phỏng thành công");
  assert(res.isMock === true, "Được đánh dấu là mô phỏng (isMock)");
  assert(res.data.statusLabel === "Kế hoạch mô phỏng — chưa kết nối AI", "Mang nhãn 'Kế hoạch mô phỏng — chưa kết nối AI'");

  const plans = getStudyPlans();
  assert(plans.length === 1, "Kế hoạch được lưu vào state phiên");
  assert(plans[0].subject === "Hệ quản trị CSDL", "Tên môn học trong state chính xác");

  // 4. Xem chi tiết
  const fetched = getStudyPlanById(plans[0].id);
  assert(fetched !== null && fetched.id === plans[0].id, "Lấy chi tiết kế hoạch theo ID thành công");

  // 5. Chỉnh sửa kế hoạch
  const updated = updateStudyPlan(plans[0].id, {
    subject: "Hệ quản trị CSDL Nâng cao",
    targetHours: 14
  });
  assert(updated.subject === "Hệ quản trị CSDL Nâng cao", "Cập nhật tên môn thành công");
  assert(updated.targetHours === 14, "Cập nhật số giờ học thành công");

  // 6. Xóa kế hoạch
  deleteStudyPlan(plans[0].id);
  assert(getStudyPlans().length === 0, "Xóa kế hoạch thành công, danh sách trở về rỗng");

  // 7. Reset session dọn dẹp kế hoạch
  await generateAIStudySchedule({ subject: "Toán rời rạc", targetHours: 6 });
  assert(getStudyPlans().length === 1, "Tạo kế hoạch thứ 2");
  resetSessionState();
  assert(getStudyPlans().length === 0, "Reset session dọn sạch kế hoạch học tập");

  console.log("--> Toàn bộ test Study Planner PASS!\n");
}
