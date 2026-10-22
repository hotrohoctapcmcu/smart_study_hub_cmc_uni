/**
 * UniStudy CMC - Profile Feature Entry
 */
import { renderProfileView } from "./profile.view.js";
import { attachProfileEvents } from "./profile.events.js";
import { fetchProfileFromApi } from "./profile.service.js";
import { state } from "../../app/state.js";

let isFetchingProfile = false;

export async function mountProfile(containerEl) {
  // Render trước bằng state cache để pane không bao giờ trắng trong lúc chờ fetch
  containerEl.innerHTML = renderProfileView();
  attachProfileEvents(containerEl);

  const hasRealProfile = state.studentProfile && state.studentProfile.name && state.studentProfile.name !== "Chưa có dữ liệu";
  const hasGrades = Array.isArray(state.studentProfile?.grades) && state.studentProfile.grades.length > 0;

  if (!hasRealProfile || !hasGrades) {
    if (isFetchingProfile) return;
    isFetchingProfile = true;
    try {
      await fetchProfileFromApi();
    } catch (e) {
      console.warn("[Profile] Không thể lấy hồ sơ từ backend:", e.message);
    } finally {
      isFetchingProfile = false;
    }
  }
}
