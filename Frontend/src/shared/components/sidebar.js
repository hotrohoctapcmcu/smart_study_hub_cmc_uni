/**
 * UniStudy CMC - Sidebar Component (YouTube-style)
 * Desktop: Mở rộng (270px) / Thu gọn (72px) chuyển đổi bằng nút ≡
 * Mobile: Drawer trượt ra có backdrop mờ và nút đóng (chiều cao 100dvh, chiều rộng phù hợp)
 * Thao tác bấm sidebar: Thay đổi chức năng TRONG TAB HIỆN TẠI
 */
import { ROUTES, NAVIGATION_SECTIONS } from "../../app/routes.js";
import { state, getUnreadNotificationCount, notifyStateChange } from "../../app/state.js";
import { getActiveTab, changeCurrentTabRoute } from "../../app/workspace.js";
import { ASSETS } from "../config/assets.js";

// Floating Tooltip Singleton cho trạng thái thu gọn (gắn trực tiếp vào body để không bao giờ bị cắt)
let floatingTooltipEl = null;

function getOrCreateFloatingTooltip() {
  if (!floatingTooltipEl) {
    floatingTooltipEl = document.getElementById("sidebarFloatingTooltip");
    if (!floatingTooltipEl) {
      floatingTooltipEl = document.createElement("div");
      floatingTooltipEl.id = "sidebarFloatingTooltip";
      floatingTooltipEl.className = "sidebar-floating-tooltip";
      floatingTooltipEl.setAttribute("role", "tooltip");
      document.body.appendChild(floatingTooltipEl);
    }
  }
  return floatingTooltipEl;
}

function showFloatingTooltip(targetBtn, text) {
  if (!text) return;
  const tip = getOrCreateFloatingTooltip();
  tip.textContent = text;
  tip.classList.add("visible");

  const rect = targetBtn.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();

  // Đặt bên phải nút, căn giữa theo chiều cao nút
  const left = rect.right + 10;
  const top = rect.top + (rect.height - tipRect.height) / 2;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function hideFloatingTooltip() {
  if (floatingTooltipEl) {
    floatingTooltipEl.classList.remove("visible");
  }
}

export function renderSidebar() {
  const activeTab = getActiveTab();
  const currentRouteId = activeTab?.routeId || "dashboard";
  const unreadCount = getUnreadNotificationCount();
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const isCompact = !isMobile && Boolean(state.sidebarCollapsed);
  const isMobileOpen = isMobile && Boolean(state.mobileDrawerOpen);

  // Render các section trong nav (bỏ qua section footer "account")
  const mainSections = NAVIGATION_SECTIONS.filter((sec) => !sec.isFooter);

  const navHtml = mainSections
    .map((sec) => {
      const isTopOverview = sec.id === "overview";
      const isBottomList = sec.id === "bottom";

      let sectionHeaderHtml = "";
      if (sec.title && !isCompact) {
        sectionHeaderHtml = `<div class="sidebar-group-label">${sec.title}</div>`;
      } else if (isBottomList && !isCompact) {
        // Phân tách nhẹ trước cụm Tiến độ & Thông báo
        sectionHeaderHtml = `<div class="sidebar-group-separator" aria-hidden="true"></div>`;
      }

      const itemsHtml = sec.routeIds
        .map((routeId) => {
          const r = ROUTES[routeId];
          if (!r) return "";
          const isActive = r.id === currentRouteId;
          const badgeHtml =
            r.id === "notifications" && unreadCount > 0 ? `<span class="nav-badge">${unreadCount}</span>` : "";

          return `
            <button 
              type="button" 
              class="nav-item ${isActive ? "active" : ""}" 
              data-route="${r.id}" 
              data-tooltip="${r.title}"
              title="${r.title}"
              aria-label="${r.title}"
            >
              <span class="nav-icon"><svg><use href="#${r.icon}"></use></svg></span>
              <span class="nav-label">${r.title}</span>
              ${badgeHtml}
            </button>
          `;
        })
        .join("");

      return `
        <div class="sidebar-nav-group ${isTopOverview ? "group-overview" : ""}">
          ${sectionHeaderHtml}
          ${itemsHtml}
        </div>
      `;
    })
    .join("");

  // Footer cố định: Đồng bộ dữ liệu & Hồ sơ cá nhân
  const isSyncActive = currentRouteId === "sync";
  const isProfileActive = currentRouteId === "profile";
  const studentName = state.studentProfile?.name;

  const footerHtml = `
    <button 
      type="button" 
      class="nav-item nav-item-sync ${isSyncActive ? "active" : ""}" 
      data-route="sync" 
      data-tooltip="Đồng bộ dữ liệu"
      title="Đồng bộ dữ liệu"
      aria-label="Đồng bộ dữ liệu"
    >
      <span class="nav-icon"><svg><use href="#i-refresh"></use></svg></span>
      <span class="nav-label">Đồng bộ dữ liệu</span>
    </button>
    <button 
      type="button" 
      class="nav-item nav-item-profile ${isProfileActive ? "active" : ""}" 
      data-route="profile" 
      data-tooltip="${studentName ? `Hồ sơ cá nhân: ${studentName}` : "Hồ sơ cá nhân"}"
      title="Hồ sơ cá nhân${studentName ? `: ${studentName}` : ""}"
      aria-label="Hồ sơ cá nhân"
    >
      ${
        studentName
          ? `<span class="sidebar-avatar-frame"><img src="${ASSETS.fox.studentAvatar}" alt="Avatar" class="sidebar-avatar-img" /></span>`
          : `<span class="nav-icon"><svg><use href="#i-user"></use></svg></span>`
      }
      <span class="nav-label user-name-label">${studentName || "Hồ sơ cá nhân"}</span>
    </button>
  `;

  // Header Sidebar:
  // - Desktop Compact: Chỉ nút ≡ căn giữa
  // - Desktop Mở rộng: Nút ≡ bên trái + Logo chữ UniStudy CMC
  // - Mobile Drawer: Nút đóng bên trái/phải + Logo chữ UniStudy CMC
  const headerHtml = isCompact
    ? `
      <div class="sidebar-header compact-header">
        <button 
          type="button" 
          class="sidebar-toggle-btn" 
          id="sidebarToggleBtn" 
          data-tooltip="Mở rộng thanh điều hướng (≡)"
          aria-label="Mở rộng thanh điều hướng (≡)" 
          title="Mở rộng thanh điều hướng (≡)"
        >
          <svg><use href="#i-menu"></use></svg>
        </button>
      </div>
    `
    : `
      <div class="sidebar-header">
        <button 
          type="button" 
          class="sidebar-toggle-btn" 
          id="sidebarToggleBtn" 
          aria-label="${isMobileOpen ? "Đóng thanh điều hướng" : "Thu gọn thanh điều hướng (≡)"}" 
          title="${isMobileOpen ? "Đóng thanh điều hướng" : "Thu gọn thanh điều hướng (≡)"}"
        >
          <svg><use href="${isMobileOpen ? "#i-close" : "#i-menu"}"></use></svg>
        </button>
        <div class="sidebar-brand">
          <div class="brand-title">
            <span>UniStudy</span>
            <small>CMC UNIVERSITY</small>
          </div>
        </div>
      </div>
    `;

  return `
    <aside 
      class="app-sidebar ${isCompact ? "compact collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}" 
      id="appSidebar" 
      role="navigation" 
      aria-label="Điều hướng chính"
    >
      ${headerHtml}

      <nav class="sidebar-nav" aria-label="Danh sách phân hệ">
        ${navHtml}
      </nav>

      <div class="sidebar-footer">
        ${footerHtml}
      </div>
    </aside>

    ${isMobileOpen ? `<div class="sidebar-backdrop" id="sidebarBackdrop"></div>` : ""}
  `;
}

export function attachSidebarEvents(containerEl) {
  const sidebar = containerEl.querySelector("#appSidebar");
  if (!sidebar) return;

  // Dọn dẹp tooltip cũ nếu có
  hideFloatingTooltip();

  // Nút thu gọn / mở rộng sidebar kiểu YouTube
  const toggleBtn = containerEl.querySelector("#sidebarToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      hideFloatingTooltip();
      if (window.innerWidth <= 768) {
        state.mobileDrawerOpen = !state.mobileDrawerOpen;
      } else {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      }
      notifyStateChange();
    });
  }

  // Backdrop đóng mobile drawer
  const backdrop = containerEl.querySelector("#sidebarBackdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      hideFloatingTooltip();
      state.mobileDrawerOpen = false;
      notifyStateChange();
    });
  }

  // Chuyển route khi bấm item trong sidebar (chỉ đổi route TRONG TAB HIỆN TẠI)
  const navBtns = sidebar.querySelectorAll("[data-route]");
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      hideFloatingTooltip();
      const routeId = btn.getAttribute("data-route");
      changeCurrentTabRoute(routeId);
      if (state.mobileDrawerOpen) {
        state.mobileDrawerOpen = false;
        notifyStateChange();
      }
    });
  });

  // Hỗ trợ Tooltip khi Hover hoặc Focus bằng bàn phím (Tab) ở chế độ thu gọn
  const tooltipTargets = sidebar.querySelectorAll("[data-tooltip]");
  tooltipTargets.forEach((btn) => {
    const handleEnter = () => {
      if (state.sidebarCollapsed && window.innerWidth > 768) {
        const text = btn.getAttribute("data-tooltip");
        if (text) showFloatingTooltip(btn, text);
      }
    };
    const handleLeave = () => {
      hideFloatingTooltip();
    };

    btn.addEventListener("mouseenter", handleEnter);
    btn.addEventListener("mouseleave", handleLeave);
    btn.addEventListener("focusin", handleEnter);
    btn.addEventListener("focusout", handleLeave);
  });

  // Đóng mobile drawer khi nhấn Escape
  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      hideFloatingTooltip();
      if (state.mobileDrawerOpen) {
        state.mobileDrawerOpen = false;
        notifyStateChange();
      }
    }
  };
  window.addEventListener("keydown", handleKeydown, { once: true });
}
