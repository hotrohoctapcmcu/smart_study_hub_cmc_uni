/**
 * UniStudy CMC - Profile Events
 */
import { resetSessionState } from "../../app/state.js";
import { resetWorkspaceTabs } from "../../app/workspace.js";
import { resetSyncState } from "../../app/sync-state.js";
import { logoutIu, logoutEdux } from "../sync/sync.service.js";
import { fetchProfileFromApi } from "./profile.service.js";

export function attachProfileEvents(containerEl) {
  // Nút Cập nhật bảng điểm
  const refreshGradesBtn = containerEl.querySelector("#refreshGradesBtn");
  if (refreshGradesBtn) {
    refreshGradesBtn.addEventListener("click", async () => {
      refreshGradesBtn.disabled = true;
      const originalText = refreshGradesBtn.innerHTML;
      refreshGradesBtn.innerHTML = `
        <svg style="animation:spin 1s linear infinite;"><use href="#i-refresh"></use></svg>
        <span>Đang cập nhật...</span>
      `;
      try {
        await fetchProfileFromApi();
      } catch (err) {
        console.warn("[Profile] Lỗi cập nhật bảng điểm từ backend:", err);
      } finally {
        if (refreshGradesBtn.isConnected) {
          refreshGradesBtn.disabled = false;
          refreshGradesBtn.innerHTML = originalText;
        }
      }
    });
  }

  // Đăng xuất / Thoát phiên làm việc (Logout)
  const logoutBtn = containerEl.querySelector("#profileLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const ok = window.confirm("Bạn có chắc chắn muốn thoát phiên làm việc? Toàn bộ bản nháp và dữ liệu cục bộ trong phiên này sẽ được dọn sạch.");
      if (ok) {
        // Xoá cả phiên phía server để người dùng sau không dùng lại cookie IU/EduX.
        logoutIu().catch(() => { /* chưa có phiên / backend tắt */ });
        logoutEdux().catch(() => { /* chưa có phiên / backend tắt */ });
        resetSessionState();
        resetWorkspaceTabs();
        resetSyncState();
      }
    });
  }
}
