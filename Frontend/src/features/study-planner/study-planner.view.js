/**
 * UniStudy CMC - Study Planner View
 * Giao diện Kế hoạch học tập thông minh (Mã 2)
 */
import { ASSETS } from "../../shared/config/assets.js";
import { getStudyPlans } from "./study-planner.service.js";
import { escapeHtml } from "../../shared/utils/validation.js";

function safePlan(plan) {
  const escaped = Object.fromEntries(Object.entries(plan).map(([key, value]) => [key, typeof value === "string" ? escapeHtml(value) : value]));
  escaped.sessions = (plan.sessions || []).map(session => Object.fromEntries(Object.entries(session)
    .map(([key, value]) => [key, typeof value === "string" ? escapeHtml(value) : value])));
  return escaped;
}

export function renderStudyPlannerView() {
  const plans = getStudyPlans();

  return `
    <div class="planner-container">
      <div class="planner-header">
        <span class="eyebrow"><svg><use href="#i-plan"></use></svg> Tính năng AI hỗ trợ</span>
        <h1 class="planner-title">Kế hoạch học tập thông minh</h1>
        <p class="muted" style="margin:4px 0 0;">Thiết lập mục tiêu và thời gian rảnh để tối ưu hóa thời gian tự học.</p>
      </div>

      <div class="planner-form-card">
        <form id="studyPlannerForm" class="planner-form" novalidate>
          <!-- Thông báo lỗi validation nếu có -->
          <div id="plannerAlertBox" class="planner-alert-box" style="display:none;" role="alert"></div>

          <label class="form-field">
            <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Môn học ưu tiên cần ôn tập <span style="color:var(--rose-600);">*</span></span>
            <input 
              type="text" 
              name="subject" 
              id="plannerSubjectInput"
              placeholder="Ví dụ: Cấu trúc dữ liệu & GT" 
              class="planner-input"
              required
            />
          </label>

          <div class="planner-form-grid">
            <label class="form-field">
              <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Thời gian rảnh ưu tiên</span>
              <select name="freeSlot" id="plannerFreeSlotSelect" class="planner-input planner-select">
                <option value="evening" selected>Buổi tối (19:00 – 22:00)</option>
                <option value="morning">Buổi sáng (07:30 – 11:30)</option>
                <option value="afternoon">Buổi chiều (13:30 – 17:30)</option>
                <option value="weekend">Cuối tuần (Thứ 7, CN)</option>
              </select>
            </label>

            <label class="form-field">
              <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Mục tiêu số giờ học / tuần</span>
              <input 
                type="number" 
                name="targetHours" 
                id="plannerTargetHoursInput"
                min="1" 
                max="50" 
                value="10" 
                class="planner-input"
                required
              />
            </label>
          </div>

          <div class="planner-btn-row">
            <button type="submit" class="button primary planner-submit-btn" id="generatePlanBtn">
              <svg><use href="#i-spark"></use></svg>
              <span id="generatePlanBtnText">Phân tích & Đề xuất kế hoạch AI</span>
            </button>
          </div>
        </form>

        <div class="planner-results-wrapper">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
            <h3 style="margin:0;font-size:1.15rem;color:var(--ink-950);">Kế hoạch đề xuất từ AI</h3>
            <span class="status-pill emerald" style="font-size:0.75rem;">Xem trước rồi xác nhận</span>
          </div>

          <div id="aiResultBox" class="planner-results-box-container">
            ${renderPlansListOrEmpty(plans)}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render danh sách kế hoạch đã tạo hoặc khung kết quả rỗng ban đầu
 */
export function renderPlansListOrEmpty(plans = []) {
  if (!plans || plans.length === 0) {
    return `
      <div class="planner-ai-result-box">
        <div class="planner-fox-sticker">
          <img src="${ASSETS.fox.aiTutor}" alt="Linh vật cáo AI UniStudy" />
        </div>
        <strong style="color:var(--violet-900);display:block;margin-bottom:6px;font-size:1rem;">Lập kế hoạch từ lịch học thực tế</strong>
        <p style="margin:0 0 16px;font-size:0.86rem;line-height:1.5;max-width:540px;margin-left:auto;margin-right:auto;">
          Nhập môn học và khung giờ rảnh, sau đó bấm <strong>Phân tích & Đề xuất kế hoạch AI</strong> để xem các buổi học trong 7 ngày tới. Lịch chỉ được lưu khi bạn xác nhận.
          Bạn cũng có thể tự xếp lịch học thủ công trên Thời khóa biểu.
        </p>
        <button type="button" class="button secondary small planner-cta-btn" id="gotoManualScheduleBtn">
          <svg><use href="#i-calendar"></use></svg>
          <span>Chuyển sang Xếp lịch tự học thủ công</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="planner-plans-list">
      ${plans.map((plan) => renderPlanCard(plan)).join("")}
      
      <div style="margin-top:16px;text-align:center;">
        <button type="button" class="button secondary small planner-cta-btn" id="gotoManualScheduleBtn">
          <svg><use href="#i-calendar"></use></svg>
          <span>Chuyển sang Xếp lịch tự học thủ công</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render từng thẻ kế hoạch học tập
 */
function renderPlanCard(plan) {
  plan = safePlan(plan);
  const sessions = plan.sessions || [];

  return `
    <div class="plan-item-card" data-plan-card-id="${plan.id}">
      <div class="plan-card-header">
        <div class="plan-card-title-group">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong class="plan-card-title">${plan.title}</strong>
            <span class="status-pill emerald" style="font-size:0.72rem;">${plan.persisted ? "✓ Đã lưu lịch" : "Bản xem trước"}</span>
          </div>
          <div class="plan-card-meta">
            <span><strong>Môn:</strong> ${plan.subject}</span>
            <span>•</span>
            <span><strong>Thời gian:</strong> ${plan.freeSlotLabel}</span>
            <span>•</span>
            <span><strong>Mục tiêu:</strong> ${plan.targetHours}h / tuần</span>
          </div>
        </div>

        <div class="plan-card-actions">
          ${!plan.persisted && !plan.isMock ? `<button type="button" class="button primary small" data-confirm-plan-id="${plan.id}">Xác nhận & lưu lịch</button>` : ""}
          <button type="button" class="button ghost small" data-view-plan-id="${plan.id}" title="Xem chi tiết">
            <svg><use href="#i-tasks"></use></svg>
            <span>Chi tiết</span>
          </button>
          <button type="button" class="button ghost small" data-edit-plan-id="${plan.id}" title="Chỉnh sửa">
            <svg><use href="#i-edit"></use></svg>
            <span>Sửa</span>
          </button>
          <button type="button" class="button ghost small text-danger" data-delete-plan-id="${plan.id}" title="Xóa">
            <svg><use href="#i-trash"></use></svg>
            <span>Xóa</span>
          </button>
        </div>
      </div>

      <!-- Danh sách các buổi học đề xuất -->
      <div class="plan-sessions-grid">
        ${sessions
          .map(
            (sess) => `
          <div class="plan-session-chip">
            <div class="session-chip-head">
              <span class="session-chip-day">${sess.day}</span>
              <span class="session-chip-tag">${sess.tag}</span>
            </div>
            <div class="session-chip-time"><svg><use href="#i-clock"></use></svg> ${sess.time} (${sess.duration})</div>
            <div class="session-chip-topic">${sess.topic}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Modal Xem chi tiết kế hoạch
 */
export function renderPlanDetailModal(plan) {
  plan = safePlan(plan);
  const sessions = plan.sessions || [];

  return `
    <div class="modal-backdrop" id="planDetailModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="planDetailTitle">
      <div class="modal-dialog" style="max-width:580px;">
        <div class="modal-header">
          <div>
            <span class="eyebrow"><svg><use href="#i-plan"></use></svg> Chi tiết kế hoạch</span>
            <h3 id="planDetailTitle" style="margin:4px 0 0;font-size:1.25rem;color:var(--ink-950);">${plan.title}</h3>
          </div>
          <button type="button" class="icon-button modal-close-btn" id="closePlanDetailBtn" aria-label="Đóng"><svg><use href="#i-close"></use></svg></button>
        </div>

        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
          <div style="padding:14px;background:var(--ink-100);border-radius:10px;display:flex;flex-direction:column;gap:6px;font-size:0.9rem;">
            <div><strong>Môn học:</strong> ${plan.subject}</div>
            <div><strong>Khung giờ ưu tiên:</strong> ${plan.freeSlotLabel}</div>
            <div><strong>Mục tiêu:</strong> ${plan.targetHours} giờ / tuần (${sessions.length} buổi học)</div>
            <div><strong>Trạng thái:</strong> <span class="status-pill violet" style="display:inline-block;padding:2px 8px;font-size:0.75rem;">${plan.persisted ? "Đã lưu vào lịch tự học" : "Bản xem trước — chưa lưu lịch"}</span></div>
            ${plan.note ? `<div style="margin-top:4px;"><strong>Ghi chú:</strong> ${plan.note}</div>` : ""}
          </div>

          <div>
            <h4 style="margin:0 0 10px;font-size:0.95rem;color:var(--ink-950);">Lộ trình buổi học chi tiết trong tuần:</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${sessions
                .map(
                  (s, idx) => `
                <div style="padding:10px 14px;border:1px solid var(--ink-200);border-radius:8px;background:white;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <strong>Buổi ${idx + 1}: ${s.day}</strong>
                    <span style="font-size:0.8rem;color:var(--violet-700);font-weight:600;">${s.time}</span>
                  </div>
                  <div style="font-size:0.85rem;color:var(--ink-700);">${s.topic}</div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>

        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="button ghost" id="closePlanDetailBtn2">Đóng</button>
          <button type="button" class="button primary" id="editPlanFromDetailBtn" data-plan-id="${plan.id}">
            <svg><use href="#i-edit"></use></svg> Chỉnh sửa kế hoạch
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Modal Chỉnh sửa kế hoạch
 */
export function renderPlanEditModal(plan) {
  plan = safePlan(plan);
  return `
    <div class="modal-backdrop" id="planEditModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="planEditTitle">
      <div class="modal-dialog" style="max-width:540px;">
        <div class="modal-header">
          <div>
            <span class="eyebrow"><svg><use href="#i-edit"></use></svg> Cập nhật kế hoạch</span>
            <h3 id="planEditTitle" style="margin:4px 0 0;font-size:1.25rem;color:var(--ink-950);">Chỉnh sửa kế hoạch học tập</h3>
          </div>
          <button type="button" class="icon-button modal-close-btn" id="closePlanEditBtn" aria-label="Đóng"><svg><use href="#i-close"></use></svg></button>
        </div>

        <form id="editPlanForm">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" name="planId" value="${plan.id}" />

            <label>
              <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Tên môn học</span>
              <input 
                type="text" 
                name="subject" 
                value="${plan.subject}" 
                class="planner-input"
                required 
              />
            </label>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <label>
                <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Khung giờ ưu tiên</span>
                <select name="freeSlot" class="planner-input planner-select">
                  <option value="evening" ${plan.freeSlot === "evening" ? "selected" : ""}>Buổi tối (19:00 – 22:00)</option>
                  <option value="morning" ${plan.freeSlot === "morning" ? "selected" : ""}>Buổi sáng (07:30 – 11:30)</option>
                  <option value="afternoon" ${plan.freeSlot === "afternoon" ? "selected" : ""}>Buổi chiều (13:30 – 17:30)</option>
                  <option value="weekend" ${plan.freeSlot === "weekend" ? "selected" : ""}>Cuối tuần (Thứ 7, CN)</option>
                </select>
              </label>

              <label>
                <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Mục tiêu (giờ / tuần)</span>
                <input 
                  type="number" 
                  name="targetHours" 
                  value="${plan.targetHours}" 
                  min="1" 
                  max="50" 
                  class="planner-input"
                  required 
                />
              </label>
            </div>

            <label>
              <span class="small" style="font-weight:600;display:block;margin-bottom:6px;">Ghi chú ôn tập</span>
              <textarea name="note" rows="3" class="planner-input" style="height:auto;resize:vertical;">${plan.note || ""}</textarea>
            </label>
          </div>

          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="button ghost" id="cancelPlanEditBtn">Hủy</button>
            <button type="submit" class="button primary">
              <svg><use href="#i-check"></use></svg> Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
