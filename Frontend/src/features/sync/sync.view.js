/**
 * UniStudy CMC - Sync View (Theo Ảnh 03)
 * Hiển thị 2 nhánh độc lập: IU (SSO tự động) và EduX (email + mật khẩu).
 */
import { renderSourceSelector, getSourceStatusInfo } from "../../shared/components/source-selector.js";
import { syncState } from "../../app/sync-state.js";
import { state } from "../../app/state.js";
import { ASSETS } from "../../shared/config/assets.js";
import { escapeHtml } from "../../shared/utils/validation.js";

function renderThoiGianDongBo(sourceId, nhan) {
  const moc = syncState.lastSyncTimestamps?.[sourceId];
  if (!moc) return "";
  return `<p class="muted small" style="margin:10px 0 0;">Lần đồng bộ ${nhan} gần nhất: ${new Date(moc).toLocaleString("vi-VN")}</p>`;
}

/**
 * Khối đăng nhập EduX: chỉ hiện khi EduX đang được chọn.
 * Mật khẩu KHÔNG bao giờ được render lại từ state (không có trong state).
 */
function renderEduxLoginBlock() {
  const status = getSourceStatusInfo("edux");
  const dangNhap = status.key === "portal_opened" || status.key === "synced";
  const dangChay = status.key === "syncing";
  // Nội dung từ EDUX/người dùng -> luôn escape trước khi chèn vào HTML.
  const message = escapeHtml(syncState.sourceMessages?.edux || "");
  const email = escapeHtml(syncState.eduxEmail || "");
  const emailDraft = escapeHtml(syncState.eduxEmailDraft || "");

  return `
    <div class="edux-login-card" id="eduxLoginCard">
      <div class="edux-login-head">
        <div>
          <strong style="display:block;color:var(--ink-950);font-size:0.95rem;">Đăng nhập EduX</strong>
          <span class="tiny muted">Dùng chính tài khoản EduX của bạn (email trường + mật khẩu).</span>
        </div>
        <span class="source-status-badge" data-source-status="edux" style="color:${status.color};font-size:0.78rem;">● ${status.label}</span>
      </div>

      ${
        dangNhap
          ? `<div class="edux-login-session">
               <span class="small" style="color:var(--ink-800);">
                 Đang dùng phiên EduX${email ? ` của <strong>${email}</strong>` : ""}.
               </span>
               <span style="display:flex;gap:8px;flex-wrap:wrap;">
                 <button type="button" class="button primary small" id="eduxSyncBtn" ${dangChay ? "disabled" : ""}>
                   <svg><use href="#i-refresh"></use></svg>
                   <span>${dangChay ? "Đang đồng bộ..." : "Đồng bộ EduX"}</span>
                 </button>
                 <button type="button" class="button ghost small" id="eduxLogoutBtn">Ngắt kết nối EduX</button>
               </span>
             </div>`
          : `<form id="eduxLoginForm" class="edux-login-form" autocomplete="off">
               <label>
                 <span class="tiny" style="font-weight:700;color:var(--ink-800);">Email EduX</span>
                 <input type="email" name="eduxEmail" id="eduxEmailInput" required
                        placeholder="vidu@st.cmcu.edu.vn" autocomplete="username"
                        value="${emailDraft}" ${dangChay ? "disabled" : ""} />
               </label>
               <label>
                 <span class="tiny" style="font-weight:700;color:var(--ink-800);">Mật khẩu EduX</span>
                 <input type="password" name="eduxPassword" id="eduxPasswordInput" required
                        placeholder="••••••••" autocomplete="current-password"
                        ${dangChay ? "disabled" : ""} />
               </label>
               <button type="submit" class="button primary small" id="eduxLoginSubmitBtn" ${dangChay ? "disabled" : ""}>
                 <svg><use href="#i-refresh"></use></svg>
                 <span>${dangChay ? "Đang đăng nhập..." : "Đăng nhập & đồng bộ EduX"}</span>
               </button>
               <p class="tiny muted" style="margin:0;line-height:1.4;">
                 UniStudy không lưu mật khẩu EduX. Mật khẩu chỉ được gửi một lần để tạo phiên,
                 phiên được giữ trên máy chủ của ứng dụng.
               </p>
             </form>`
      }

      ${message ? `<p class="edux-login-message small" data-edux-message>${message}</p>` : ""}
      ${renderThoiGianDongBo("edux", "EduX")}
    </div>
  `;
}

export function renderSyncView() {
  const hasSelected = syncState.selectedSources.length > 0;
  const statusMsg = escapeHtml(syncState.statusMessage || "");
  const blockedNotice = syncState.popupBlockedNotice;
  const isSyncing = syncState.isSyncing === true;
  const iuStatus = syncState.sourceStatuses?.iu || "unconnected";
  const eduxStatus = syncState.sourceStatuses?.edux || "unconnected";
  const eduxSelected = syncState.selectedSources.includes("edux");
  const iuMessage = escapeHtml(syncState.sourceMessages?.iu || "");
  const lastSync = syncState.lastSyncTimestamp
    ? new Date(syncState.lastSyncTimestamp).toLocaleString("vi-VN")
    : "";

  return `
    <div class="sync-container">
      <div style="margin-bottom:24px;">
        <span class="eyebrow"><svg><use href="#i-refresh"></use></svg> Cổng thông tin CMC</span>
        <h1 style="margin:6px 0 8px;font-size:1.8rem;color:var(--ink-950);">Đồng bộ dữ liệu học tập</h1>
        <p class="muted" style="margin:0;max-width:680px;">
          Kết nối cổng IU để cập nhật thời khóa biểu, lịch thi và kết nối EduX để lấy bài giảng,
          bài tập AI theo từng học phần. Hai nguồn hoạt động độc lập.
        </p>
      </div>

      <div class="sync-layout-grid">
        <!-- Cột trái: Chọn nguồn -->
        <div class="sync-card">
          <h2 style="font-size:1.15rem;margin:0 0 16px;color:var(--ink-950);">Nguồn dữ liệu trường</h2>
          ${renderSourceSelector()}

          ${
            statusMsg
              ? `<div class="sync-status-banner">
                   <strong>Thông báo:</strong> ${statusMsg}
                 </div>`
              : ""
          }

          ${
            iuMessage
              ? `<div class="sync-status-banner" data-iu-message style="background:var(--violet-50,#f5f3ff);border-color:var(--violet-200,#ddd6fe);color:var(--violet-900,#4c1d95);">
                   <strong>IU:</strong> ${iuMessage}
                 </div>`
              : ""
          }

          ${
            eduxSelected
              ? renderEduxLoginBlock()
              : ""
          }

          ${
            blockedNotice
              ? `<div style="margin-top:16px;padding:14px;border-radius:10px;background:#fee2e2;border:1px solid #dc2626;color:#991b1b;font-size:0.88rem;">
                   Trình duyệt đã chặn cửa sổ tự động. Bấm vào đây để mở:
                   <a href="${blockedNotice.url}" target="_blank" rel="noopener noreferrer" style="font-weight:700;text-decoration:underline;">
                     Mở cổng ${blockedNotice.source.name}
                   </a>
                 </div>`
              : ""
          }

          <div class="sync-actions-row">
            <button
              type="button"
              class="button primary"
              id="confirmSyncBtn"
              ${(!hasSelected || isSyncing) ? "disabled style='opacity:0.6;cursor:not-allowed;'" : ""}
            >
              <svg><use href="#i-refresh"></use></svg>
              <span>${isSyncing ? "Đang đồng bộ..." : "Xác nhận đồng bộ"}</span>
            </button>
            ${(iuStatus === "synced" && !isSyncing) ? `<button type="button" class="button ghost" id="iuLogoutBtn">Ngắt kết nối IU</button>` : ""}
            <button type="button" class="button ghost" id="skipSyncBtn">Để sau</button>
            <button type="button" class="button ghost" id="viewEmptyAppBtn">Xem app rỗng</button>
          </div>
          ${lastSync ? `<p class="muted small" style="margin:12px 0 0;">Lần đồng bộ gần nhất: ${lastSync}</p>` : ""}
        </div>

        <!-- Cột phải: Minh họa và trạng thái từng nguồn -->
        <div class="sync-visual-card">
          <div class="sync-fox-wrap">
            <img src="${ASSETS.fox.loginLock}" alt="Linh vật cáo CMC" />
          </div>
          <h2 style="font-size:1.3rem;margin:0 0 10px;color:white;">Trạng thái kết nối</h2>
          <p style="margin:0 0 20px;font-size:0.9rem;opacity:0.85;line-height:1.5;">
            IU đăng nhập qua cổng trường; EduX đăng nhập bằng tài khoản EduX của bạn.
            UniStudy không lưu mật khẩu cổng trường.
          </p>

          <div style="width:100%;background:rgba(255,255,255,0.12);border-radius:14px;padding:16px;text-align:left;">
            <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.75;margin-bottom:8px;">
              Nguồn dữ liệu
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);font-size:0.88rem;">
              <span>IU (Đào tạo):</span>
              <strong style="opacity:0.85;">${getSourceStatusInfo("iu").label}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.88rem;">
              <span>EduX (Bài tập AI):</span>
              <strong style="opacity:0.85;">${getSourceStatusInfo("edux").label}</strong>
            </div>
            ${
              eduxStatus === "synced"
                ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.82rem;opacity:0.75;">
                     <span>Bài tập EduX đã tải:</span>
                     <strong>${(state.tasks || []).filter((t) => t.source === "EDUX").length}</strong>
                   </div>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>
  `;
}
