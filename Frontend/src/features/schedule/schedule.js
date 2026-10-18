/**
 * UniStudy CMC - Schedule Feature Entry
 */
import { renderScheduleView } from "./schedule.view.js";
import { attachScheduleEvents } from "./schedule.events.js";
import { state } from "../../app/state.js";
import { fetchSchoolSchedules } from "../sync/sync.service.js";

// Đảm bảo chỉ gọi API lấy lịch một lần cho cả phiên làm việc.
let schedulesLoadPromise = null;

/**
 * Mount Schedule tab: nạp lịch học thật từ backend (SQLite) trước khi render.
 * Nếu server chưa sẵn sàng, hiển thị trống để người dùng tự nhập / đồng bộ sau.
 */
export async function mountSchedule(containerEl) {
  if (!schedulesLoadPromise) {
    schedulesLoadPromise = (async () => {
      try {
        const fetched = await fetchSchoolSchedules();
        state.schoolEvents = Array.isArray(fetched)
          ? fetched.map((t) => ({ ...t, source: "Trường" }))
          : [];
      } catch (e) {
        console.warn("[SCHEDULE] Không lấy được lịch từ server:", e.message);
        state.schoolEvents = [];
      }
    })();
  }
  await schedulesLoadPromise;

  containerEl.innerHTML = renderScheduleView();
  attachScheduleEvents(containerEl);
}
