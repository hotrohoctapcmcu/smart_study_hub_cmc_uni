/**
 * UniStudy CMC - Profile Events
 */
import { state, resetSessionState, notifyStateChange } from "../../app/state.js";
import { resetWorkspaceTabs } from "../../app/workspace.js";
import { syncState, resetSyncState } from "../../app/sync-state.js";
import { attachSourceSelectorEvents } from "../../shared/components/source-selector.js";
import { openSchoolPortals } from "../sync/sync.auth-window.js";
import { getIuBridge, syncIuAuto, logoutIu, logoutEdux } from "../sync/sync.service.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { renderProfileEditModal } from "./profile.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";
import { saveStudentProfileApi } from "./profile.service.js";

export function attachProfileEvents(containerEl) {
  attachSourceSelectorEvents(containerEl);

  // Nút Đồng bộ ngay (luồng tự động trong Electron, fallback popup ở web thuần)
  const syncNowBtn = containerEl.querySelector("#profileSyncNowBtn");
  if (syncNowBtn) {
    syncNowBtn.addEventListener("click", async () => {
      const canIuAuto = getIuBridge() && syncState.selectedSources.includes("iu");

      // EduX cần email + mật khẩu nên không thể chạy tự động từ trang Hồ sơ:
      // chuyển sang trang Đồng bộ nơi có form đăng nhập EduX.
      if (syncState.selectedSources.includes("edux") && !canIuAuto) {
        changeCurrentTabRoute("sync");
        notifyStateChange();
        return;
      }

      if (canIuAuto) {
        syncNowBtn.disabled = true;
        try {
          await syncIuAuto();
        } catch { /* message đã set trong service */ } finally {
          syncNowBtn.disabled = false;
        }
        return;
      }
      openSchoolPortals(syncState.selectedSources);
      notifyStateChange();
    });
  }

  // Mở modal chỉnh sửa hồ sơ
  const editBtn = containerEl.querySelector("#openEditProfileBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const modalHost = containerEl.querySelector("#profileEditModalHost");
      if (!modalHost) return;

      modalHost.innerHTML = renderProfileEditModal(state.studentProfile);
      const modalEl = modalHost.querySelector("#profileEditModal");

      const close = () => {
        modalHost.innerHTML = "";
      };

      attachModalEvents(modalEl, close);

      const form = modalEl.querySelector("#profileEditForm");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const newProfile = {
            ...(state.studentProfile || {}),
            name: fd.get("name")?.trim() || "Chưa có dữ liệu",
            studentId: fd.get("studentId")?.trim() || "Chưa có dữ liệu",
            email: fd.get("email")?.trim() || "Chưa có dữ liệu"
          };
          state.studentProfile = newProfile;
          close();
          notifyStateChange();

          // Ghi lên server để lần mở sau (và các tab khác) đọc lại được.
          saveStudentProfileApi(newProfile).catch((err) =>
            console.warn("[Profile] Lỗi lưu hồ sơ lên server:", err)
          );
        });
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
