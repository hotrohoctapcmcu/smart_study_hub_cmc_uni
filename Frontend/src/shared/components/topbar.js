/**
 * UniStudy CMC - Topbar / Toolbar Component
 * Dải công cụ trắng: Tìm kiếm đồng bộ, nút Tiến độ, chuông Thông báo
 */
import { state, getUnreadNotificationCount, notifyStateChange } from "../../app/state.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";

export function renderTopbar() {
  const unreadCount = getUnreadNotificationCount();

  return `
    <header class="workspace-toolbar" role="banner">
      <button type="button" class="icon-button mobile-only-btn" id="mobileMenuTriggerBtn" aria-label="Mở danh mục điều hướng" title="Mở danh mục điều hướng (≡)">
        <svg><use href="#i-menu"></use></svg>
      </button>

      <div class="search-bar-wrap">
        <div class="search-input-box">
          <svg><use href="#i-search"></use></svg>
          <input 
            type="search" 
            id="globalSearchInput" 
            placeholder="Tìm kiếm môn học, lịch, công việc..." 
            value="${state.searchQuery || ""}"
            aria-label="Tìm kiếm toàn hệ thống"
          />
          <span class="search-shortcut-badge">Ctrl K</span>
        </div>
      </div>

      <div class="toolbar-actions">
        <button type="button" class="icon-button notif-bell-btn" id="notifBellBtn" aria-label="Xem thông báo" title="Xem thông báo" style="position:relative;">
          <svg><use href="#i-bell"></use></svg>
          ${
            unreadCount > 0
              ? `<span style="position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:var(--red-600);"></span>`
              : ""
          }
        </button>
      </div>
    </header>
  `;
}

export function attachTopbarEvents(containerEl) {
  // Global search input
  const searchInput = containerEl.querySelector("#globalSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      notifyStateChange();
    });
  }

  // Ctrl+K shortcut focus search
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const input = document.querySelector("#globalSearchInput");
      if (input) input.focus();
    }
  });

  // Mobile menu button
  const mobileBtn = containerEl.querySelector("#mobileMenuTriggerBtn");
  if (mobileBtn) {
    mobileBtn.addEventListener("click", () => {
      state.mobileDrawerOpen = true;
      notifyStateChange();
    });
  }

  // Chuông thông báo: chuyển tab hiện tại sang notifications
  const bellBtn = containerEl.querySelector("#notifBellBtn");
  if (bellBtn) {
    bellBtn.addEventListener("click", () => {
      changeCurrentTabRoute("notifications");
    });
  }
}
