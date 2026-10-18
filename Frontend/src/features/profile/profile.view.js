/**
 * UniStudy CMC - Profile View (Theo Ảnh 12)
 */
import { state } from "../../app/state.js";
import { ASSETS } from "../../shared/config/assets.js";
import { renderSourceSelector } from "../../shared/components/source-selector.js";
import { renderModal } from "../../shared/components/modal.js";

export function renderProfileView() {
  const profile = state.studentProfile || {
    name: "Chưa có dữ liệu",
    studentId: "Chưa có dữ liệu",
    email: "Chưa có dữ liệu"
  };

  const isCustomized = Boolean(state.studentProfile && state.studentProfile.name);

  return `
    <div class="profile-container">
      <div>
        <span class="eyebrow"><svg><use href="#i-user"></use></svg> Thông tin sinh viên</span>
        <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Hồ sơ học tập cá nhân</h1>
      </div>

      <!-- Thẻ chính Hồ sơ Sinh viên -->
      <div class="profile-main-card">
        <div style="text-align:center;">
          <div class="profile-avatar-wrap">
            <img src="${ASSETS.fox.studentAvatar}" alt="Linh vật sinh viên CMC" />
          </div>
          <div style="margin-top:14px;">
            <button type="button" class="button ghost small" id="openEditProfileBtn">
              <svg><use href="#i-edit"></use></svg>
              <span>Chỉnh sửa thông tin</span>
            </button>
          </div>
        </div>

        <div>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 style="margin:0;font-size:1.5rem;color:var(--ink-950);">${profile.name}</h2>
              <span class="eyebrow" style="margin-top:4px;">MSSV: ${profile.studentId}</span>
            </div>
            <button type="button" class="button danger small" id="profileLogoutBtn">
              <svg><use href="#i-logout"></use></svg>
              <span>Thoát phiên làm việc</span>
            </button>
          </div>

          <div class="profile-info-grid">
            <div class="profile-field-box">
              <span>Email sinh viên</span>
              <strong>${profile.email || "Chưa có dữ liệu"}</strong>
            </div>
          </div>

          <div style="margin-top:16px;">
            ${
              isCustomized
                ? `<span class="badge-draft">📌 Bản nháp cục bộ — Chưa xác thực máy chủ CMC</span>`
                : `<span class="muted small">Dữ liệu hồ sơ sẽ được cập nhật khi kết nối thành công với cổng IU.</span>`
            }
          </div>
        </div>
      </div>

      <!-- Tùy chọn nguồn đồng bộ (Dùng chung Source Selector) -->
      <div class="profile-sync-settings-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0 0 4px;font-size:1.15rem;color:var(--ink-950);">Cấu hình nguồn đồng bộ dữ liệu</h3>
            <p class="muted small" style="margin:0;">Chọn các cổng thông tin CMC để lấy dữ liệu thời khóa biểu và điểm số.</p>
          </div>
          <div>
            <button type="button" class="button primary small" id="profileSyncNowBtn">
              <svg><use href="#i-refresh"></use></svg>
              <span>Đồng bộ ngay</span>
            </button>
          </div>
        </div>

        ${renderSourceSelector()}
      </div>

      <!-- Modal Chỉnh sửa hồ sơ -->
      <div id="profileEditModalHost"></div>
    </div>
  `;
}

/**
 * Modal chỉnh sửa thông tin sinh viên cục bộ
 */
export function renderProfileEditModal(currentData) {
  const bodyHtml = `
    <form id="profileEditForm" style="display:flex;flex-direction:column;gap:14px;">
      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Họ và tên sinh viên *</span>
        <input 
          type="text" 
          name="name" 
          required 
          placeholder="Ví dụ: Nguyễn Văn A" 
          value="${currentData?.name && currentData.name !== "Chưa có dữ liệu" ? currentData.name : ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Mã sinh viên</span>
          <input 
            type="text" 
            name="studentId" 
            placeholder="Ví dụ: 24IT001" 
            value="${currentData?.studentId && currentData.studentId !== "Chưa có dữ liệu" ? currentData.studentId : ""}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Email sinh viên</span>
          <input 
            type="email" 
            name="email" 
            placeholder="Ví dụ: sv@cmcu.edu.vn" 
            value="${currentData?.email && currentData.email !== "Chưa có dữ liệu" ? currentData.email : ""}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>
      </div>

      <div class="badge-draft" style="width:fit-content;">
        📌 Lưu ý: Thông tin nhập tay chỉ lưu tạm trong bộ nhớ phiên, không ghi đè dữ liệu xác thực trường.
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="profileEditModal">Hủy</button>
    <button type="submit" form="profileEditForm" class="button primary">Lưu thông tin</button>
  `;

  return renderModal({
    id: "profileEditModal",
    title: "Chỉnh sửa thông tin cá nhân",
    bodyHtml,
    footerHtml
  });
}
