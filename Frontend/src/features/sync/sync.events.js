/**
 * UniStudy CMC - Sync Events
 * IU và EduX là hai nhánh độc lập: lỗi/trạng thái của nguồn này không chặn nguồn kia.
 */
import { syncState, setSourceStatus, setSourceMessage, markSourceSynced } from "../../app/sync-state.js";
import { openSchoolPortals } from "./sync.auth-window.js";
import { attachSourceSelectorEvents } from "../../shared/components/source-selector.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { notifyStateChange } from "../../app/state.js";
import {
  getIuBridge,
  syncIuAuto,
  logoutIu,
  syncEduxAuto,
  logoutEdux,
  fetchEduxStatus,
  pullEduxData,
  mergeEduxTasks,
  checkAndRefreshSourceStatuses
} from "./sync.service.js";

/**
 * Ghi nhận kết quả đồng bộ EduX (dùng chung cho đăng nhập mới và đồng bộ lại).
 */
function markSyncedEdux(soBai, thatBai) {
  markSourceSynced("edux");
  let message = `Đồng bộ EduX xong: ${soBai} bài tập AI.`;
  if (!soBai) message += " Tài khoản chưa có chương nào kèm bài tập AI.";
  if (Array.isArray(thatBai) && thatBai.length) {
    message += ` Một số chương lỗi: ${thatBai.join("; ")}`;
  }
  setSourceMessage("edux", message);
}

export function attachSyncEvents(containerEl) {
  attachSourceSelectorEvents(containerEl);

  // ─── Form đăng nhập EduX ───────────────────────────────────────────────
  const eduxForm = containerEl.querySelector("#eduxLoginForm");
  if (eduxForm) {
    eduxForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (eduxForm.querySelector("#eduxEmailInput")?.value || "").trim();
      const password = eduxForm.querySelector("#eduxPasswordInput")?.value || "";
      if (!email || !password) return;

      // Xoá mật khẩu khỏi DOM ngay sau khi đọc — không giữ lại trong trang.
      const passInput = eduxForm.querySelector("#eduxPasswordInput");
      if (passInput) passInput.value = "";
      // Giữ email để điền lại form nếu đăng nhập thất bại.
      syncState.eduxEmailDraft = email;

      const submitBtn = eduxForm.querySelector("#eduxLoginSubmitBtn");
      if (submitBtn) submitBtn.disabled = true;

      syncState.isSyncing = true;
      notifyStateChange();
      try {
        await syncEduxAuto({ email, password });
      } catch { /* message đã set trong service */ } finally {
        syncState.isSyncing = false;
        notifyStateChange();
      }
    });
  }

  // Đồng bộ lại EduX bằng phiên đã có (không cần nhập lại mật khẩu).
  const eduxSyncBtn = containerEl.querySelector("#eduxSyncBtn");
  if (eduxSyncBtn) {
    eduxSyncBtn.addEventListener("click", async () => {
      eduxSyncBtn.disabled = true;
      syncState.isSyncing = true;
      setSourceStatus("edux", "syncing");
      setSourceMessage("edux", "Đang kéo bài tập EduX...");
      notifyStateChange();
      try {
        const pulled = await pullEduxData();
        const soBai = mergeEduxTasks(pulled.assignments);
        markSyncedEdux(soBai, pulled.thatBai);
      } catch (err) {
        setSourceStatus("edux", "error");
        setSourceMessage("edux", `Đồng bộ EduX thất bại: ${err.message}`);
      } finally {
        syncState.isSyncing = false;
        notifyStateChange();
      }
    });
  }

  const eduxLogoutBtn = containerEl.querySelector("#eduxLogoutBtn");
  if (eduxLogoutBtn) {
    eduxLogoutBtn.addEventListener("click", async () => {
      eduxLogoutBtn.disabled = true;
      try {
        await logoutEdux();
      } finally {
        notifyStateChange();
      }
    });
  }

  // ─── Nút xác nhận đồng bộ (IU) ─────────────────────────────────────────
  const confirmBtn = containerEl.querySelector("#confirmSyncBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (syncState.selectedSources.length === 0) return;

      // Trong app Electron: luồng tự động IU (SSO riêng -> pull -> hiển thị).
      if (getIuBridge() && syncState.selectedSources.includes("iu")) {
        confirmBtn.disabled = true;
        syncState.isSyncing = true;
        notifyStateChange();
        try {
          await syncIuAuto();
        } catch { /* message đã set trong service */ } finally {
          syncState.isSyncing = false;
          confirmBtn.disabled = false;
          notifyStateChange();
        }
        return;
      }

      // Web thuần: giữ hành vi cũ (mở popup cổng IU ngoài).
      openSchoolPortals(syncState.selectedSources);
      notifyStateChange();
    });
  }

  const skipBtn = containerEl.querySelector("#skipSyncBtn");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      changeCurrentTabRoute("dashboard");
    });
  }

  const iuLogoutBtn = containerEl.querySelector("#iuLogoutBtn");
  if (iuLogoutBtn) {
    iuLogoutBtn.addEventListener("click", async () => {
      await logoutIu();
      notifyStateChange();
    });
  }

  const emptyBtn = containerEl.querySelector("#viewEmptyAppBtn");
  if (emptyBtn) {
    emptyBtn.addEventListener("click", () => {
      changeCurrentTabRoute("dashboard");
    });
  }

  // ─── Khôi phục trạng thái kết nối các cổng từ API server nếu chưa xác định ───
  if (syncState.sourceStatuses.iu === "unconnected" && syncState.sourceStatuses.edux === "unconnected") {
    checkAndRefreshSourceStatuses();
  }
}


