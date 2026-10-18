/**
 * UniStudy CMC - Tab Picker Modal Component (Tham chiếu Ảnh 05 & Yêu cầu mới)
 * Nhấn "+" mở hộp chọn chức năng trên nền mờ toàn màn hình.
 * Dùng chung NAVIGATION_SECTIONS từ routes.js để đồng bộ hoàn toàn với sidebar.
 */
import { ROUTES, NAVIGATION_SECTIONS } from "../../app/routes.js";
import { createNewTab } from "../../app/workspace.js";
import { state, notifyStateChange } from "../../app/state.js";
import { renderModal, attachModalEvents } from "./modal.js";

export function renderTabPickerModal() {
  const groupsHtml = NAVIGATION_SECTIONS.map((sec) => {
    // Tiêu đề hiển thị cho từng nhóm
    let groupTitle = sec.title;
    if (sec.id === "overview") groupTitle = "Tổng quan";
    if (sec.id === "bottom") groupTitle = sec.modalTitle || "Tiến độ & Thông báo";
    if (sec.id === "account") groupTitle = "Tài khoản";

    const cardsHtml = sec.routeIds
      .map((routeId) => {
        const r = ROUTES[routeId];
        if (!r) return "";

        const sprintBadge = !r.isImplemented
          ? `<span class="badge-sprint-preview">Xem trước</span>`
          : "";

        return `
          <button 
            type="button" 
            class="tab-picker-card" 
            data-pick-route="${r.id}" 
            aria-label="Mở tab ${r.title}" 
            title="Mở tab ${r.title}"
          >
            <div class="tab-picker-icon">
              <svg><use href="#${r.icon}"></use></svg>
            </div>
            <div class="tab-picker-info">
              <div class="tab-picker-info-head">
                <strong>${r.title}</strong>
                ${sprintBadge}
              </div>
              <p>${r.description || ""}</p>
            </div>
          </button>
        `;
      })
      .join("");

    return `
      <div class="tab-picker-group">
        <div class="tab-picker-group-title">
          <svg style="width:16px;height:16px;"><use href="#${sec.icon}"></use></svg>
          <span>${groupTitle}</span>
        </div>
        <div class="tab-picker-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join("");

  const bodyHtml = `
    <p class="muted small" style="margin-top:0;margin-bottom:16px;">
      Chọn một chức năng bên dưới để mở trong một tab không gian làm việc mới:
    </p>
    <div class="tab-picker-groups-wrap">
      ${groupsHtml}
    </div>
  `;

  return renderModal({
    id: "tabPickerModal",
    title: "Mở không gian làm việc mới",
    bodyHtml,
    customClass: "tab-picker-dialog"
  });
}

export function attachTabPickerEvents(containerEl) {
  const modalEl = containerEl.querySelector("#tabPickerModal");
  if (!modalEl) return;

  const close = () => {
    state.tabPickerOpen = false;
    notifyStateChange();
    setTimeout(() => {
      const addBtn = document.querySelector("#openTabPickerBtn");
      if (addBtn) addBtn.focus();
    }, 50);
  };

  attachModalEvents(modalEl, close);

  const cards = modalEl.querySelectorAll("[data-pick-route]");
  cards.forEach((btn) => {
    btn.addEventListener("click", () => {
      const routeId = btn.getAttribute("data-pick-route");
      createNewTab(routeId);
      close();
    });
  });
}
