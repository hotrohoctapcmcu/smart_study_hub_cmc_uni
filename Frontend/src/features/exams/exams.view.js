/**
 * UniStudy CMC - Exams View (Theo Ảnh 10 và 11)
 */
import { state } from "../../app/state.js";
import { formatDateVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { renderModal } from "../../shared/components/modal.js";
import { APP_CONFIG } from "../../shared/config/app.config.js";
import { escapeHtml as e } from "../../shared/utils/validation.js";

export function renderExamsView() {
  const exams = state.exams;
  const from = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + APP_CONFIG.examLookaheadDays * 86400000).toISOString().slice(0, 10);

  return `
    <div class="exams-container">
      <div class="exams-header">
        <div>
          <span class="eyebrow"><svg><use href="#i-exam"></use></svg> ${APP_CONFIG.examLookaheadDays} ngày tới</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Lịch thi & Kế hoạch ôn thi</h1>
          <p class="muted" style="margin:6px 0 0;">Đồng bộ lịch thi từ ${formatDateVN(from)} đến ${formatDateVN(to)}.</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="button primary" id="examAiPlanBtn">AI tạo kế hoạch ôn thi</button>
          <button type="button" class="button ghost" id="examSyncBtn">
            <svg><use href="#i-refresh"></use></svg>
            <span>Đồng bộ lịch thi trường</span>
          </button>
          <button type="button" class="button primary" id="openCreateExamBtn">
            <svg><use href="#i-plus"></use></svg>
            <span>Tạo kế hoạch ôn thi</span>
          </button>
        </div>
      </div>

      <!-- Panel Mức độ sẵn sàng ôn thi theo Ảnh 10 (Không tạo % giả) -->
      <div class="readiness-box">
        <svg style="color:var(--ink-500);width:22px;height:22px;"><use href="#i-spark"></use></svg>
        <div>
          <strong>Mức độ sẵn sàng ôn thi:</strong>
          <span>Xem kết quả kiểm tra theo từng chủ đề để biết nội dung cần ưu tiên.</span>
          <button class="button ghost small" id="examWeaknessBtn">Xem điểm yếu</button>
        </div>
      </div>

      <!-- Danh sách kỳ thi & Lộ trình -->
      <div>
        ${
          exams.length > 0
            ? exams
                .map((ex) => {
                  const milestones = ex.studyMilestones || [];
                  return `
              <div class="exam-card-item" data-exam-id="${ex.id}">
                <div class="exam-card-top">
                  <div>
                    <h2 class="exam-subject-title">${e(ex.subject)} ${ex.code ? `(${e(ex.code)})` : ""}</h2>
                    <div class="exam-meta-pills">
                      <span class="exam-meta-pill">
                        <svg><use href="#i-calendar"></use></svg>
                        ${formatDateVN(ex.date)} · ${ex.start} (${ex.duration} phút)
                      </span>
                      <span class="exam-meta-pill">
                        Phòng thi: <strong>${e(ex.room || "Chưa xếp")}</strong>
                      </span>
                      <span class="badge-draft" style="font-size:0.75rem;">
                        ${e(ex.source || "Tự thêm")}
                      </span>
                    </div>
                  </div>

                  <div style="display:flex;gap:8px;">
                    ${ex.examId ? `<button type="button" class="button primary small" data-ai-plan-exam="${e(ex.examId)}">AI ôn thi</button>` : ''}
                    <button type="button" class="button secondary small" data-goto-schedule-exam="${ex.date}">
                      Lên kế hoạch học
                    </button>
                    <button type="button" class="icon-button" data-edit-exam-id="${ex.id}" aria-label="Sửa kỳ thi" style="width:34px;height:34px;">
                      <svg style="width:14px;height:14px;"><use href="#i-edit"></use></svg>
                    </button>
                    <button type="button" class="icon-button" data-delete-exam-id="${ex.id}" aria-label="Xóa kỳ thi" style="width:34px;height:34px;color:var(--red-600);">
                      <svg style="width:14px;height:14px;"><use href="#i-trash"></use></svg>
                    </button>
                  </div>
                </div>

                ${
                  ex.scope
                    ? `<div style="font-size:0.86rem;color:var(--ink-600);">
                         <strong>Phạm vi kiến thức:</strong> ${e(ex.scope)}
                       </div>`
                    : ""
                }

                <!-- Lộ trình ôn tập riêng của kỳ thi -->
                <div class="roadmap-container">
                  <span class="small" style="font-weight:700;color:var(--violet-800);display:block;margin-bottom:8px;">
                    📍 Lộ trình các mốc ôn tập:
                  </span>
                  ${
                    milestones.length > 0
                      ? `<div class="roadmap-timeline">
                           ${milestones
                             .map(
                               (m, i) => `
                             <div class="roadmap-milestone-card">
                               <strong>Mốc ${i + 1}: ${e(m.title)}</strong>
                               <p>${m.targetDate ? `Mục tiêu: ${formatDateVN(m.targetDate)}` : "Tự do"}</p>
                               ${m.target ? `<p>${e(m.target)}</p>` : ''}
                               ${m.id ? `<p>${m.status === 'COMPLETED' ? 'Đã hoàn thành' : m.status === 'CANCELLED' ? 'Đã hủy' : 'Đang ôn tập'}</p><button class="button ghost small" data-phase-status="${e(m.id)}" data-status="${m.status === 'COMPLETED' ? 'PLANNED' : 'COMPLETED'}">${m.status === 'COMPLETED' ? 'Mở lại' : 'Hoàn thành'}</button><button class="button ghost small" data-phase-delete="${e(m.id)}">Xóa mốc</button>` : ''}
                             </div>
                           `
                             )
                             .join("")}
                         </div>`
                      : `<p class="tiny muted" style="margin:0;">Chưa thiết lập mốc lộ trình ôn tập cụ thể cho môn này.</p>`
                  }
                </div>
              </div>
            `;
                })
                .join("")
            : renderEmptyState({
                icon: "i-exam",
                title: "Chưa có kỳ thi nào trong danh sách",
                description: "Tạo kế hoạch thi thủ công hoặc bấm đồng bộ để kết nối lịch thi từ cổng trường CMC.",
                actionText: "Tạo kỳ thi mới",
                actionDataAttr: 'id="emptyCreateExamBtn"'
              })
        }
      </div>

      <!-- Container Host Modal Exam Form -->
      <div id="examModalHost"></div>
    </div>
  `;
}

/**
 * Render Modal Thêm / Chỉnh sửa kỳ thi thủ công (Theo Ảnh 11)
 */
export function renderExamModal(examData = null) {
  const isEdit = Boolean(examData && examData.id);

  const bodyHtml = `
    <form id="examModalForm" style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Tên môn thi *</span>
          <input 
            type="text" 
            name="subject" 
            required 
            placeholder="Ví dụ: Cơ sở dữ liệu" 
            value="${e(examData?.subject || "")}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Mã môn học</span>
          <input 
            type="text" 
            name="code" 
            placeholder="Ví dụ: DBI202" 
            value="${e(examData?.code || "")}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
      </div>

      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Ngày thi *</span>
          <input 
            type="date" 
            name="date" 
            required 
            value="${e(examData?.date || "")}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Giờ bắt đầu *</span>
          <input 
            type="time" 
            name="start" 
            required 
            value="${e(examData?.start || "08:00")}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Thời lượng (phút) *</span>
          <input 
            type="number" 
            name="duration" 
            required 
            min="15" 
            value="${e(examData?.duration || 90)}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Phòng thi</span>
          <input 
            type="text" 
            name="room" 
            placeholder="Ví dụ: A205" 
            value="${e(examData?.room || "")}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Nguồn dữ liệu</span>
          <input 
            type="text" 
            disabled 
            value="${e(examData?.source || "Sinh viên thêm")}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;background:var(--page);color:var(--ink-600);"
          />
        </label>
      </div>

      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Phạm vi kiến thức & Ghi chú ôn thi</span>
        <textarea 
          name="scope" 
          rows="3" 
          placeholder="Ví dụ: Ôn tập Chương 1–6, các dạng bài tập thực hành..." 
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;font-family:inherit;"
        >${e(examData?.scope || "")}</textarea>
      </label>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="examDetailModal">Hủy</button>
    <button type="submit" form="examModalForm" class="button primary">
      ${isEdit ? "Cập nhật kỳ thi" : "Lưu kỳ thi"}
    </button>
  `;

  return renderModal({
    id: "examDetailModal",
    title: isEdit ? "Chỉnh sửa kỳ thi" : "Tạo kế hoạch ôn thi mới",
    bodyHtml,
    footerHtml
  });
}
