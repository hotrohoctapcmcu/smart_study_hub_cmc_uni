/**
 * UniStudy CMC - Schedule Feature Entry
 */
import { renderScheduleView } from "./schedule.view.js";
import { attachScheduleEvents } from "./schedule.events.js";
import { state } from "../../app/state.js";
import { fetchSchoolSchedules } from "../sync/sync.service.js";
import { fetchStudySchedules } from "./schedule.service.js";

// Đảm bảo chỉ gọi API lấy lịch một lần cho cả phiên làm việc.
let schedulesLoadPromise = null;

/**
 * Mount Schedule tab: nạp lịch học thật và lịch tự học từ backend (SQLite) trước khi render.
 */
export async function mountSchedule(containerEl) {
  if (!schedulesLoadPromise) {
    schedulesLoadPromise = (async () => {
      try {
        const [fetchedSchool] = await Promise.all([
          fetchSchoolSchedules(),
          fetchStudySchedules().catch((e) => {
            console.warn("[SCHEDULE] Không lấy được lịch tự học:", e.message);
            return [];
          })
        ]);
        state.schoolEvents = Array.isArray(fetchedSchool)
          ? fetchedSchool.map((t) => ({ ...t, source: "Trường" }))
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

