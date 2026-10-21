/**
 * UniStudy CMC - Profile Feature Entry
 */
import { renderProfileView } from "./profile.view.js?v=5";
import { attachProfileEvents } from "./profile.events.js?v=5";
import { fetchProfileFromApi } from "./profile.service.js";
import { state } from "../../app/state.js";

export async function mountProfile(containerEl) {
  if (!state.studentProfile || !state.studentProfile.name || state.studentProfile.name === "Chưa có dữ liệu") {
    try {
      await fetchProfileFromApi();
    } catch (e) {
      console.warn("[Profile] Không thể lấy hồ sơ từ backend:", e.message);
    }
  }

  containerEl.innerHTML = renderProfileView();
  attachProfileEvents(containerEl);
}

