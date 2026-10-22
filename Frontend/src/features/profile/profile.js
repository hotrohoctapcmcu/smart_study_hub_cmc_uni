/**
 * UniStudy CMC - Profile Feature Entry
 */
import { renderProfileView } from "./profile.view.js?v=5";
import { attachProfileEvents } from "./profile.events.js?v=5";
import { fetchProfileFromApi } from "./profile.service.js";
import { state } from "../../app/state.js";

export async function mountProfile(containerEl) {
  // Render trước bằng state cache để pane không bao giờ trắng
  // trong lúc chờ fetch.
  containerEl.innerHTML = renderProfileView();
  attachProfileEvents(containerEl);
  if (!state.studentProfile || !state.studentProfile.name || state.studentProfile.name === "Chưa có dữ liệu") {
    try {
      const before = state.studentProfile;
      await fetchProfileFromApi();
      if (!containerEl.isConnected) return;
      // Chỉ render lại khi có hồ sơ thật sự thay đổi.
      if (state.studentProfile !== before && state.studentProfile?.name) {
        containerEl.innerHTML = renderProfileView();
        attachProfileEvents(containerEl);
      }
    } catch (e) {
      console.warn("[Profile] Không thể lấy hồ sơ từ backend:", e.message);
    }
  }
}

