/**
 * UniStudy CMC - Source Selector Component
 * Dùng chung trên trang Sync và trang Profile theo quy tắc AGENTS.md
 *
 * Mỗi nguồn hiển thị trạng thái riêng (IU và EduX độc lập):
 * chưa kết nối / đã mở cổng / đang đồng bộ / đã đồng bộ / lỗi.
 */
import { SYNC_SOURCES } from "../config/sync-sources.js";
import { syncState, toggleSourceSelection, selectAllSources, deselectAllSources } from "../../app/sync-state.js";

const NHAN_TRANG_THAI = {
  unconnected: "Chưa kết nối",
  portal_opened: "Đã đăng nhập",
  syncing: "Đang đồng bộ...",
  synced: "Đã đồng bộ",
  error: "Lỗi kết nối"
};

const MAU_TRANG_THAI = {
  unconnected: "var(--ink-500)",
  portal_opened: "var(--violet-700)",
  syncing: "var(--amber-600)",
  synced: "var(--emerald-600)",
  error: "var(--red-600)"
};

/**
 * Nhãn + màu trạng thái của một nguồn, dùng chung cho mọi view.
 * @param {string} sourceId
 * @returns {{key: string, label: string, color: string}}
 */
export function getSourceStatusInfo(sourceId) {
  const key = syncState.sourceStatuses?.[sourceId] || "unconnected";
  return {
    key,
    label: NHAN_TRANG_THAI[key] || NHAN_TRANG_THAI.unconnected,
    color: MAU_TRANG_THAI[key] || MAU_TRANG_THAI.unconnected
  };
}

export function renderSourceSelector() {
  const selected = syncState.selectedSources;
  const allCount = SYNC_SOURCES.length;
  const isAllSelected = selected.length === allCount;
  const isPartiallySelected = selected.length > 0 && selected.length < allCount;

  const itemsHtml = SYNC_SOURCES.map((source) => {
    const isChecked = selected.includes(source.id);
    const status = getSourceStatusInfo(source.id);
    return `
      <div class="source-item-card ${isChecked ? "selected" : ""}" data-source-id="${source.id}">
        <div class="source-checkbox-custom">
          ${isChecked ? `<svg style="width:14px;height:14px;"><use href="#i-check"></use></svg>` : ""}
        </div>
        <div class="source-item-info">
          <strong>${source.name}</strong>
          <p>${source.description}</p>
          <span class="source-status-badge" data-source-status="${source.id}" style="color:${status.color};">
            ● ${status.label}
          </span>
        </div>
        <span class="eyebrow" style="margin-left:auto;font-size:0.75rem;">${source.code}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="source-selector-box" id="sourceSelectorWidget">
      <!-- Nút chọn tất cả -->
      <div class="source-item-card ${isAllSelected ? "selected" : ""} ${isPartiallySelected ? "indeterminate" : ""}" id="selectAllSourcesCard">
        <div class="source-checkbox-custom" id="allSourcesCheckbox">
          ${
            isAllSelected
              ? `<svg style="width:14px;height:14px;"><use href="#i-check"></use></svg>`
              : isPartiallySelected
              ? `<span style="font-weight:900;line-height:1;font-size:16px;">—</span>`
              : ""
          }
        </div>
        <div class="source-item-info">
          <strong>Tất cả nguồn dữ liệu CMC</strong>
          <p>Đồng bộ song song IU (lịch học, lịch thi, điểm) và EduX (bài giảng, bài tập AI)</p>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${itemsHtml}
      </div>
    </div>
  `;
}

export function attachSourceSelectorEvents(containerEl) {
  const root = containerEl.querySelector("#sourceSelectorWidget");
  if (!root) return;

  // Toggle Tất cả
  const selectAllCard = root.querySelector("#selectAllSourcesCard");
  if (selectAllCard) {
    selectAllCard.addEventListener("click", () => {
      if (syncState.selectedSources.length === SYNC_SOURCES.length) {
        deselectAllSources();
      } else {
        selectAllSources();
      }
    });
  }

  // Toggle từng nguồn
  const itemCards = root.querySelectorAll("[data-source-id]");
  itemCards.forEach((card) => {
    card.addEventListener("click", () => {
      const sourceId = card.getAttribute("data-source-id");
      toggleSourceSelection(sourceId);
    });
  });
}
