/**
 * UniStudy CMC - Topbar / Toolbar Component
 * Dải công cụ trắng: Tìm kiếm đồng bộ, nút Tiến độ, chuông Thông báo
 */
import { state, getUnreadNotificationCount, notifyStateChange } from "../../app/state.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { getActiveTab } from "../../app/workspace.js";
import { workspaceRequest } from "../services/workspace-api.js";
import { escapeHtml } from "../utils/validation.js";

let shortcutAttached = false;

export function renderTopbar() {
  const unreadCount = getUnreadNotificationCount();

  return `
    <header class="workspace-toolbar" role="banner">
      <button type="button" class="icon-button mobile-only-btn" id="mobileMenuTriggerBtn" aria-label="Mở danh mục điều hướng" title="Mở danh mục điều hướng (≡)">
        <svg><use href="#i-menu"></use></svg>
      </button>

      <div class="search-bar-wrap" style="position:relative;">
        <div class="search-input-box">
          <svg><use href="#i-search"></use></svg>
          <input 
            type="search" 
            id="globalSearchInput" 
            placeholder="Tìm kiếm môn học, lịch, công việc..." 
            value="${escapeHtml(state.searchQuery || "")}"
            aria-label="Tìm kiếm toàn hệ thống"
          />
          <span class="search-shortcut-badge">Ctrl K</span>
        </div>
        <div id="globalSearchResults" role="region" aria-label="Kết quả tìm kiếm" hidden style="position:absolute;top:100%;left:0;right:0;z-index:1000;background:white;border:1px solid #ddd;border-radius:10px;padding:12px;max-height:420px;overflow:auto;box-shadow:0 8px 24px #0002;"></div>
      </div>

      <div class="toolbar-actions">
        <button type="button" class="icon-button notif-bell-btn" id="topbarNotifBellBtn" aria-label="Xem thông báo" title="Xem thông báo" style="position:relative;">
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
    let timer, version = 0;
    const results = containerEl.querySelector("#globalSearchResults");
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      const query = e.target.value.trim();
      clearTimeout(timer);
      const requestVersion = ++version;
      if (!query) { if (results) results.hidden = true; return; }
      timer = setTimeout(async () => {
        if (!results || results.isConnected === false) return;
        results.hidden = false; results.textContent = "Đang tìm kiếm...";
        try {
          const items = await workspaceRequest("GET", "/search", { queryParams: query.startsWith('#') ? { tag: query.slice(1) } : { q: query }, silent: true });
          if (version !== requestVersion || results.isConnected === false) return;
          const labels = { document: 'Tài liệu', note: 'Ghi chú', task: 'Công việc', schedule: 'Lịch tự học', exam: 'Lịch thi', email: 'Email' };
          results.innerHTML = items.length ? items.map((item, index) => `<button type="button" class="button ghost" data-search-result="${index}" style="display:block;width:100%;text-align:left;margin-bottom:8px;"><strong>${escapeHtml(item.title)}</strong><br><span class="small muted">${labels[item.type] || ''} · ${escapeHtml(item.preview)} ${escapeHtml(item.tags.map(tag => '#'+tag).join(' '))}</span></button>`).join('') : 'Không có kết quả phù hợp.';
          results.querySelectorAll('[data-search-result]').forEach(button => button.addEventListener('click', () => {
            const item = items[Number(button.getAttribute('data-search-result'))];
            const tab = getActiveTab();
            if (tab) {
              tab.tabState ||= {};
              if (item.route === 'documents') tab.tabState.searchTarget = item;
              else delete tab.tabState.searchTarget;
              if (item.selectedDate) tab.tabState.selectedDate = item.selectedDate;
              if (item.type === 'task') tab.tabState.taskFilter = 'all';
              if (item.type === 'email') tab.tabState.notificationFilter = 'emails';
            }
            state.searchQuery = item.type === 'task' ? item.title : '';
            changeCurrentTabRoute(item.route);
          }));
        } catch (error) { if (version === requestVersion) results.textContent = error.message; }
      }, 250);
    });
    searchInput.addEventListener("keydown", event => { if (event.key === 'Escape' && results) results.hidden = true; });
  }

  // Ctrl+K shortcut focus search
  if (!shortcutAttached) window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const input = document.querySelector("#globalSearchInput");
      if (input) input.focus();
    }
  });
  shortcutAttached = true;

  // Mobile menu button
  const mobileBtn = containerEl.querySelector("#mobileMenuTriggerBtn");
  if (mobileBtn) {
    mobileBtn.addEventListener("click", () => {
      state.mobileDrawerOpen = true;
      notifyStateChange();
    });
  }

  // Chuông thông báo: chuyển tab hiện tại sang notifications
  const bellBtn = containerEl.querySelector("#topbarNotifBellBtn");
  if (bellBtn) {
    bellBtn.addEventListener("click", () => {
      changeCurrentTabRoute("notifications");
    });
  }
}
