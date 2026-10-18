/**
 * UniStudy CMC - Sync View (Theo Ảnh 03)
 */
import { renderSourceSelector } from "../../shared/components/source-selector.js";
import { syncState } from "../../app/sync-state.js";
import { ASSETS } from "../../shared/config/assets.js";

export function renderSyncView() {
  const hasSelected = syncState.selectedSources.length > 0;
  const statusMsg = syncState.statusMessage;
  const blockedNotice = syncState.popupBlockedNotice;
  const isSyncing = syncState.isSyncing === true;
  const iuStatus = syncState.sourceStatuses?.iu || "unconnected";
  const lastSync = syncState.lastSyncTimestamp
    ? new Date(syncState.lastSyncTimestamp).toLocaleString("vi-VN")
    : "";

  return `
    <div class="sync-container">
      <div style="margin-bottom:24px;">
        <span class="eyebrow"><svg><use href="#i-refresh"></use></svg> Cổng thông tin CMC</span>
        <h1 style="margin:6px 0 8px;font-size:1.8rem;color:var(--ink-950);">Đồng bộ dữ liệu học tập</h1>
        <p class="muted" style="margin:0;max-width:680px;">
          Kết nối trực tiếp tới cổng IU của trường CMC để cập nhật thời khóa biểu, lịch thi và bài tập cá nhân.
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
          ${lastSync ? `<p class="muted small" style="margin:12px 0 0;">Lần đồng bộ IU gần nhất: ${lastSync}</p>` : ""}
        </div>

        <!-- Cột phải: Minh họa và thông tin sinh viên trống -->
        <div class="sync-visual-card">
          <div class="sync-fox-wrap">
            <img src="${ASSETS.fox.loginLock}" alt="Linh vật cáo CMC" />
          </div>
          <h2 style="font-size:1.3rem;margin:0 0 10px;color:white;">Chưa đồng bộ tài khoản</h2>
          <p style="margin:0 0 20px;font-size:0.9rem;opacity:0.85;line-height:1.5;">
            Khi bấm "Xác nhận đồng bộ", hệ thống sẽ chuyển hướng bạn tới trang đăng nhập chính thức của trường.
            UniStudy không lưu trữ mật khẩu cổng trường của bạn.
          </p>

          <div style="width:100%;background:rgba(255,255,255,0.12);border-radius:14px;padding:16px;text-align:left;">
            <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.75;margin-bottom:8px;">
              Trạng thái hồ sơ
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);font-size:0.88rem;">
              <span>Họ và tên:</span>
              <strong style="opacity:0.7;">Chưa có dữ liệu</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.88rem;">
              <span>Mã sinh viên:</span>
              <strong style="opacity:0.7;">Chưa có dữ liệu</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
