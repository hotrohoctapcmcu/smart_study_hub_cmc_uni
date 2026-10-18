/**
 * UniStudy CMC - Sync State Management
 * Quản lý trạng thái kết nối và đồng bộ cổng IU (EduX bổ sung sau)
 */
import { SYNC_SOURCES } from "../shared/config/sync-sources.js";
import { notifyStateChange } from "./state.js";

export const syncState = {
  // Danh sách ID nguồn được chọn (Mặc định chọn tất cả nguồn)
  selectedSources: SYNC_SOURCES.map((s) => s.id),

  // Trạng thái từng nguồn: "unconnected" | "portal_opened" | "syncing" | "synced" | "error"
  sourceStatuses: {
    iu: "unconnected"
  },

  // Trạng thái tổng thể
  isSyncing: false,
  lastSyncTimestamp: null,
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
 * Reset sync state khi đăng xuất
 */
export function resetSyncState() {
  syncState.selectedSources = SYNC_SOURCES.map((s) => s.id);
  syncState.sourceStatuses = {
    iu: "unconnected"
  };
  syncState.isSyncing = false;
  syncState.lastSyncTimestamp = null;
  syncState.popupBlockedNotice = null;
  syncState.statusMessage = "";
  notifyStateChange();
}
