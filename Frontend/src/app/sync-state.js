/**
 * UniStudy CMC - Sync State Management
 * Quản lý trạng thái kết nối và đồng bộ từng cổng (IU, EduX độc lập).
 */
import { SYNC_SOURCES } from "../shared/config/sync-sources.js";
import { notifyStateChange } from "./state.js";

/**
 * Trạng thái mặc định của một nguồn:
 *   "unconnected"  — chưa kết nối / chưa đăng nhập
 *   "portal_opened"— đã mở cổng (web thuần, chưa xác thực được)
 *   "syncing"      — đang đăng nhập / đang kéo dữ liệu
 *   "synced"       — đã đồng bộ xong
 *   "error"        — lỗi (đăng nhập sai, hết phiên, mạng...)
 */
export const SOURCE_STATUS_DEFAULT = "unconnected";

function trangThaiMacDinh() {
  const statuses = {};
  SYNC_SOURCES.forEach((source) => {
    statuses[source.id] = SOURCE_STATUS_DEFAULT;
  });
  return statuses;
}

function thongDiepMacDinh() {
  const messages = {};
  SYNC_SOURCES.forEach((source) => {
    messages[source.id] = "";
  });
  return messages;
}

export const syncState = {
  // Danh sách ID nguồn được chọn (Mặc định chọn tất cả nguồn)
  selectedSources: SYNC_SOURCES.map((s) => s.id),

  // Trạng thái từng nguồn (key theo id nguồn: iu | edux)
  sourceStatuses: trangThaiMacDinh(),

  // Thông báo riêng của từng nguồn — IU và EduX không ghi đè lên nhau
  sourceMessages: thongDiepMacDinh(),

  // Email EDUX của phiên hiện tại (chỉ để hiển thị, không phải mật khẩu)
  eduxEmail: null,

  // Email đang gõ trong form (giữ lại khi view render lại sau lỗi đăng nhập)
  eduxEmailDraft: "",

  // Trạng thái tổng thể
  isSyncing: false,
  lastSyncTimestamp: null,
  lastSyncTimestamps: {},
  popupBlockedNotice: null,
  statusMessage: ""
};

/**
 * Chọn / bỏ chọn một nguồn
 */
export function toggleSourceSelection(sourceId) {
  if (syncState.selectedSources.includes(sourceId)) {
    syncState.selectedSources = syncState.selectedSources.filter((id) => id !== sourceId);
  } else {
    syncState.selectedSources.push(sourceId);
  }
  notifyStateChange();
}

/**
 * Chọn tất cả nguồn
 */
export function selectAllSources() {
  syncState.selectedSources = SYNC_SOURCES.map((s) => s.id);
  notifyStateChange();
}

/**
 * Bỏ chọn tất cả nguồn
 */
export function deselectAllSources() {
  syncState.selectedSources = [];
  notifyStateChange();
}

/**
 * Cập nhật trạng thái một nguồn
 */
export function setSourceStatus(sourceId, status) {
  if (syncState.sourceStatuses[sourceId] !== undefined) {
    syncState.sourceStatuses[sourceId] = status;
    notifyStateChange();
  }
}

/**
 * Cập nhật thông báo riêng của một nguồn (không ảnh hưởng nguồn khác).
 */
export function setSourceMessage(sourceId, message) {
  if (syncState.sourceMessages[sourceId] === undefined) {
    syncState.sourceMessages[sourceId] = "";
  }
  syncState.sourceMessages[sourceId] = message || "";
  notifyStateChange();
}

/**
 * Ghi mốc đồng bộ thành công cho một nguồn.
 */
export function markSourceSynced(sourceId) {
  const now = new Date().toISOString();
  syncState.lastSyncTimestamps[sourceId] = now;
  syncState.lastSyncTimestamp = now;
  syncState.sourceStatuses[sourceId] = "synced";
  notifyStateChange();
}

/**
 * Reset sync state khi đăng xuất
 */
export function resetSyncState() {
  syncState.selectedSources = SYNC_SOURCES.map((s) => s.id);
  syncState.sourceStatuses = trangThaiMacDinh();
  syncState.sourceMessages = thongDiepMacDinh();
  syncState.eduxEmail = null;
  syncState.eduxEmailDraft = "";
  syncState.isSyncing = false;
  syncState.lastSyncTimestamp = null;
  syncState.lastSyncTimestamps = {};
  syncState.popupBlockedNotice = null;
  syncState.statusMessage = "";
  notifyStateChange();
}
