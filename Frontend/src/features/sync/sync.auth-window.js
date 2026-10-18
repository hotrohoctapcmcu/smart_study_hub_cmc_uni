/**
 * UniStudy CMC - Sync Auth Window Manager
 * Quản lý mở cửa sổ đăng nhập cổng trường thật, fallback link khi bị chặn popup,
 * điều phối tuần tự (ưu tiên IU), không mở nhiều popup đồng loạt.
 */
import { SYNC_SOURCES } from "../../shared/config/sync-sources.js";
import { syncState, setSourceStatus } from "../../app/sync-state.js";
import { logger } from "../../shared/utils/logger.js";

let openedWindows = {};

/**
 * Mở cổng trường cho danh sách nguồn đã chọn
 * @param {string[]} selectedSourceIds
 * @returns {{success: boolean, openedCount: number, blockedSource?: object, message: string}}
 */
export function openSchoolPortals(selectedSourceIds) {
  if (!selectedSourceIds || selectedSourceIds.length === 0) {
    return {
      success: false,
      openedCount: 0,
      message: "Vui lòng chọn ít nhất một nguồn dữ liệu trường để tiếp tục."
    };
  }

  // Sắp xếp theo độ ưu tiên (IU luôn đứng đầu)
  const sortedSources = SYNC_SOURCES.filter((s) => selectedSourceIds.includes(s.id)).sort(
    (a, b) => a.priority - b.priority
  );

  // Quy tắc AGENTS.md: Điều phối từng nguồn, IU trước nếu được chọn, không mở nhiều popup đồng loạt
  const primarySource = sortedSources[0];

  try {
    const win = window.open(primarySource.portalUrl, `_cmc_${primarySource.id}`);
    if (!win || win.closed || typeof win.closed === "undefined") {
      logger.warn(`Popup bị trình duyệt chặn cho nguồn: ${primarySource.name}`);
      syncState.popupBlockedNotice = {
        source: primarySource,
        url: primarySource.portalUrl
      };
      setSourceStatus(primarySource.id, "unconnected");
      return {
        success: false,
        openedCount: 0,
        blockedSource: primarySource,
        message: `Trình duyệt đã chặn popup mở cổng ${primarySource.code}. Vui lòng bấm vào liên kết trực tiếp bên dưới.`
      };
    } else {
      openedWindows[primarySource.id] = win;
      setSourceStatus(primarySource.id, "portal_opened");
      syncState.popupBlockedNotice = null;
      syncState.statusMessage = `Đã mở trang đăng nhập ${primarySource.name}. Chưa có kết nối API để xác nhận đăng nhập và đồng bộ dữ liệu. Hồ sơ/lịch trường vẫn trống.`;
      return {
        success: true,
        openedCount: 1,
        message: syncState.statusMessage
      };
    }
  } catch (err) {
    logger.error("Lỗi khi mở cửa sổ cổng trường:", err);
    return {
      success: false,
      openedCount: 0,
      message: `Không thể mở cổng đăng nhập: ${err.message}`
    };
  }
}
