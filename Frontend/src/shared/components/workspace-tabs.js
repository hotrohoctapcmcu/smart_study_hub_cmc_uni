/**
 * UniStudy CMC - Workspace Tabs Bar Component
 * Dải tab trên cùng tối màu nối liền khu vực nội dung
 * - Mỗi tab đều có nút đóng; đóng tab cuối cùng trở về Tổng quan
 * - Vùng danh sách tab cuộn ngang riêng, nút "+" cố định bên phải dễ bấm
 */
import { getOpenTabs, getActiveTab, setActiveTab, closeTab, saveActiveTabScroll } from "../../app/workspace.js";
import { state, notifyStateChange } from "../../app/state.js";

export function renderWorkspaceTabs() {
  const tabs = getOpenTabs();
  const activeTab = getActiveTab();

  const tabsHtml = tabs
    .map((tab) => {
      const isActive = tab.id === activeTab.id;
      return `
        <div class="tab-pill ${isActive ? "active" : ""}" data-tab-id="${tab.id}" role="tab" aria-selected="${isActive}">
          <svg style="width:16px;height:16px;"><use href="#${tab.icon}"></use></svg>
          <span class="tab-title-text">${tab.title}</span>
          <button 
            type="button" 
            class="tab-close-btn" 
            data-close-tab="${tab.id}" 
            aria-label="Đóng tab ${tab.title}"
            title="Đóng tab ${tab.title}"
          >
            <svg><use href="#i-close"></use></svg>
          </button>
        </div>
      `;
    })
    .join("");

  return `
    <div class="workspace-tabs-bar" role="tablist" aria-label="Danh sách tab không gian làm việc">
      <!-- Nút toggle menu Sidebar trên mobile (Vùng tím đồng bộ chiều cao và căn thẳng hàng với thanh tab) -->
      <button 
        type="button" 
        class="mobile-sidebar-toggle-btn" 
        id="mobileSidebarToggleBtn" 
        aria-label="Mở danh mục điều hướng (≡)" 
        title="Mở danh mục điều hướng"
      >
        <svg style="width:24px;height:24px;"><use href="#i-menu"></use></svg>
      </button>

      <!-- Vùng cuộn ngang chứa danh sách tab và nút "+" ngay bên cạnh -->
      <div class="tabs-scroll-area" id="tabsScrollArea">
        ${tabsHtml}

        <!-- Dấu "+" thêm tab mới đặt ngay cạnh tab để dễ điều khiển -->
        <button 
          type="button" 
          class="tab-add-btn" 
          id="openTabPickerBtn" 
          title="Mở không gian làm việc mới (+)" 
          aria-label="Thêm tab mới"
        >
          <svg style="width:18px;height:18px;"><use href="#i-plus"></use></svg>
        </button>
      </div>
    </div>
  `;
}

export function attachWorkspaceTabsEvents(containerEl) {
  // Mobile sidebar menu toggle button
  const mobileToggle = containerEl.querySelector("#mobileSidebarToggleBtn");
  if (mobileToggle) {
    mobileToggle.addEventListener("click", () => {
      state.mobileDrawerOpen = true;
      notifyStateChange();
    });
  }

  // Chuyển tab
  const tabPills = containerEl.querySelectorAll(".tab-pill[data-tab-id]");
  tabPills.forEach((pill) => {
    pill.addEventListener("click", (e) => {
      // Nếu click vào nút đóng thì không chuyển tab
      if (e.target.closest("[data-close-tab]")) return;
      const tabId = pill.getAttribute("data-tab-id");

      // Lưu scroll trước khi chuyển
      const contentPane = document.querySelector("#workspaceContentPane");
      if (contentPane) {
        saveActiveTabScroll(contentPane.scrollTop, contentPane.scrollLeft);
      }

      setActiveTab(tabId);
    });
  });

  // Đóng tab
  const closeBtns = containerEl.querySelectorAll("[data-close-tab]");
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tabId = btn.getAttribute("data-close-tab");
      closeTab(tabId);
    });
  });

  // Mở bộ chọn tab mới (Dấu +)
  const addBtn = containerEl.querySelector("#openTabPickerBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      state.tabPickerOpen = true;
      notifyStateChange();
    });
  }
}
