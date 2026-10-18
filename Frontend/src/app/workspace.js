/**
 * UniStudy CMC - Workspace Tabs Management
 * Tuân thủ quy tắc AGENTS.md và yêu cầu mới:
 * - Sidebar bấm chỉ đổi route trên tab hiện tại
 * - Dấu + mở Tab Picker modal, chọn xong mới tạo tab mới
 * - Mỗi tab giữ route, bộ lọc, ngày chọn, vị trí cuộn và bản nháp riêng
 * - Có nút đóng trên từng tab; đóng tab cuối cùng thì trở về tab Tổng quan
 */
import { getRouteById } from "./routes.js";
import { notifyStateChange } from "./state.js";

let nextTabId = 2;

export const workspaceState = {
  activeTabId: "tab-1",
  tabs: [
    {
      id: "tab-1",
      routeId: "dashboard",
      title: "Tổng quan",
      icon: "i-grid",
      // State cục bộ riêng của tab này
      tabState: {
        selectedDate: new Date().toISOString().split("T")[0],
        scheduleMode: "week", // "day" | "week" | "month"
        taskFilter: "all",
        notificationFilter: "all",
        searchKeyword: "",
        hasDraft: false,
        scrollTop: 0,
        scrollLeft: 0
      }
    }
  ]
};

export function getActiveTab() {
  return workspaceState.tabs.find((t) => t.id === workspaceState.activeTabId) || workspaceState.tabs[0];
}

export function getOpenTabs() {
  return workspaceState.tabs;
}

export function setActiveTab(tabId) {
  const exists = workspaceState.tabs.some((t) => t.id === tabId);
  if (exists) {
    workspaceState.activeTabId = tabId;
    notifyStateChange();
  }
}

/**
 * Lưu vị trí cuộn của tab hiện tại trước khi chuyển tab
 */
export function saveActiveTabScroll(scrollTop, scrollLeft = 0) {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.tabState) {
    activeTab.tabState.scrollTop = scrollTop;
    activeTab.tabState.scrollLeft = scrollLeft;
  }
}

/**
 * Sidebar đổi chức năng TRONG TAB HIỆN TẠI (Không tạo tab mới)
 */
export function changeCurrentTabRoute(routeId) {
  const activeTab = getActiveTab();
  if (activeTab) {
    const routeDef = getRouteById(routeId);
    activeTab.routeId = routeDef.id;
    activeTab.title = routeDef.title;
    activeTab.icon = routeDef.icon;
    // Reset scroll khi chuyển sang route khác trong cùng tab
    if (activeTab.tabState) {
      activeTab.tabState.scrollTop = 0;
      activeTab.tabState.scrollLeft = 0;
    }
    notifyStateChange();
  }
}

/**
 * Tạo tab mới từ Tab Picker (Dấu +)
 */
export function createNewTab(routeId) {
  const routeDef = getRouteById(routeId);
  const newTab = {
    id: `tab-${nextTabId++}`,
    routeId: routeDef.id,
    title: routeDef.title,
    icon: routeDef.icon,
    tabState: {
      selectedDate: new Date().toISOString().split("T")[0],
      scheduleMode: "week",
      taskFilter: "all",
      notificationFilter: "all",
      searchKeyword: "",
      hasDraft: false,
      scrollTop: 0,
      scrollLeft: 0
    }
  };
  workspaceState.tabs.push(newTab);
  workspaceState.activeTabId = newTab.id;
  notifyStateChange();
  return newTab;
}

/**
 * Đóng tab:
 * - Có nút đóng trên từng tab.
 * - Đóng tab hiện tại chuyển sang tab liền kề.
 * - Nếu đóng tab cuối cùng, trở về tab Tổng quan (dashboard).
 */
export function closeTab(tabId) {
  const tabToClose = workspaceState.tabs.find((t) => t.id === tabId);
  if (!tabToClose) return false;

  if (tabToClose.tabState?.hasDraft) {
    const confirmDiscard = window.confirm("Tab này có bản nháp chưa lưu. Bạn có chắc chắn muốn đóng?");
    if (!confirmDiscard) return false;
  }

  // Trường hợp đóng tab cuối cùng: Trở về tab Tổng quan
  if (workspaceState.tabs.length <= 1) {
    const dashRoute = getRouteById("dashboard");
    tabToClose.routeId = dashRoute.id;
    tabToClose.title = dashRoute.title;
    tabToClose.icon = dashRoute.icon;
    tabToClose.tabState = {
      selectedDate: new Date().toISOString().split("T")[0],
      scheduleMode: "week",
      taskFilter: "all",
      notificationFilter: "all",
      searchKeyword: "",
      hasDraft: false,
      scrollTop: 0,
      scrollLeft: 0
    };
    notifyStateChange();
    return true;
  }

  const index = workspaceState.tabs.findIndex((t) => t.id === tabId);
  workspaceState.tabs = workspaceState.tabs.filter((t) => t.id !== tabId);

  // Nếu tab đang active bị đóng, kích hoạt tab liền kề
  if (workspaceState.activeTabId === tabId) {
    const newActiveIndex = Math.max(0, index - 1);
    workspaceState.activeTabId = workspaceState.tabs[newActiveIndex].id;
  }

  notifyStateChange();
  return true;
}

/**
 * Cập nhật state riêng cho tab hiện tại (ví dụ ngày chọn, bộ lọc)
 */
export function updateActiveTabLocalState(partialState) {
  const activeTab = getActiveTab();
  if (activeTab) {
    activeTab.tabState = {
      ...activeTab.tabState,
      ...partialState
    };
    notifyStateChange();
  }
}

/**
 * Reset workspace tabs khi Logout
 */
export function resetWorkspaceTabs() {
  nextTabId = 2;
  workspaceState.activeTabId = "tab-1";
  workspaceState.tabs = [
    {
      id: "tab-1",
      routeId: "dashboard",
      title: "Tổng quan",
      icon: "i-grid",
      tabState: {
        selectedDate: new Date().toISOString().split("T")[0],
        scheduleMode: "week",
        taskFilter: "all",
        notificationFilter: "all",
        searchKeyword: "",
        hasDraft: false,
        scrollTop: 0,
        scrollLeft: 0
      }
    }
  ];
  notifyStateChange();
}
