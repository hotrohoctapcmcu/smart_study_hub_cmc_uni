/**
 * UniStudy CMC - Tests for Study Planner Feature
 */
import {
  validatePlannerInput,
  generateAIStudySchedule,
  confirmStudyPlan,
  getStudyPlans,
  getStudyPlanById,
  updateStudyPlan,
  deleteStudyPlan
} from "../src/features/study-planner/study-planner.service.js";
import { state, resetSessionState } from "../src/app/state.js";
import { renderPlansListOrEmpty } from "../src/features/study-planner/study-planner.view.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runStudyPlannerTests() {
  console.log("\n=== KIỂM THỬ TÍNH NĂNG KẾ HOẠCH HỌC TẬP (AI PLANNER) ===");
  resetSessionState();
  const previousFetch = globalThis.fetch;
  const requests = [];
  let failRequest = false;
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, body });
    const data = url.endsWith("/plan/confirm") ? { persisted: true, sessions: [{ schedule_id: 1 }] }
      : url.endsWith("/schedules/study") ? []
      : { preview: true, persisted: false, sessions: [{ date: "2028-01-01", start: "08:00", end: "10:00", title: "Ôn <script>alert(1)</script>", subject: "CSDL", durationMinutes: 120 }] };
    return { ok: !failRequest, status: failRequest ? 503 : 200,
      json: async () => failRequest ? { success: false, message: "AI chưa cấu hình" } : { success: true, data } };
  };
  try {

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

  // 3. Bản xem trước từ backend AI
  const res = await generateAIStudySchedule({
    subject: "Hệ quản trị CSDL",
    freeSlot: "morning",
    targetHours: 8
  });
  assert(res.success === true, "Tạo kế hoạch học tập thành công");
  assert(res.data.statusLabel === "Kế hoạch học tập đề xuất", "Mang nhãn 'Kế hoạch học tập đề xuất'");
  assert(res.data.preview === true && res.data.persisted === false, "Chưa xác nhận thì chưa lưu lịch");
  assert(requests[0].url.endsWith("/ai/plan"), "Gọi API lập kế hoạch thật");
  assert(requests[0].body.freeStartTime === "07:30", "Gửi đúng khung giờ ưu tiên");
  assert(!requests.some(item => item.url.endsWith("/confirm")), "Tạo đề xuất không tự xác nhận");

  const plans = getStudyPlans();
  assert(plans.length === 1, "Kế hoạch được lưu vào state phiên");
  assert(plans[0].subject === "Hệ quản trị CSDL", "Tên môn học trong state chính xác");
  const html = renderPlansListOrEmpty(plans);
  assert(html.includes("data-confirm-plan-id"), "Có nút xác nhận trên bản xem trước");
  assert(!html.includes("<script>"), "Escape HTML trả về từ AI");
  const confirmed = await confirmStudyPlan(plans[0].id);
  assert(confirmed.success && confirmed.data.persisted, "Xác nhận mới lưu lịch");
  assert(requests.find(item => item.url.endsWith("/plan/confirm")).body.confirmed === true, "Gửi xác nhận rõ ràng");
  const countAfterConfirm = requests.length;
  await confirmStudyPlan(plans[0].id);
  assert(requests.length === countAfterConfirm, "Không gửi lại khi kế hoạch đã lưu");

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

  failRequest = true;
  const failed = await generateAIStudySchedule({ subject: "CSDL", targetHours: 4 });
  assert(!failed.success && failed.message.includes("chưa cấu hình"), "Hiện lỗi AI thật, không tạo lịch mô phỏng thay thế");
  assert(getStudyPlans().length === 0, "Lỗi backend không tạo kế hoạch giả");
  } finally { globalThis.fetch = previousFetch; }

  console.log("--> Toàn bộ test Study Planner PASS!\n");
}
