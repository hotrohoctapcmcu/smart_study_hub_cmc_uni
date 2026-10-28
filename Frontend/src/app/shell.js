/**
 * UniStudy CMC - Application Shell & Workspace Router
 */
import { state } from "./state.js";
import { getActiveTab, saveActiveTabScroll } from "./workspace.js";
import { getRouteById } from "./routes.js";
import { renderSidebar, attachSidebarEvents } from "../shared/components/sidebar.js";
import { renderWorkspaceTabs, attachWorkspaceTabsEvents } from "../shared/components/workspace-tabs.js?v=2";
import { renderFloatingActions, attachFloatingActionsEvents } from "../shared/components/floating-actions.js";
import { renderTabPickerModal, attachTabPickerEvents } from "../shared/components/tab-picker.js";

// Feature Mounts
import { mountDashboard } from "../features/dashboard/dashboard.js";
import { mountSchedule } from "../features/schedule/schedule.js";
import { mountTasks } from "../features/tasks/tasks.js";
import { mountStudyPlanner } from "../features/study-planner/study-planner.js";
import { mountExams } from "../features/exams/exams.js";
import { mountNotifications } from "../features/notifications/notifications.js";
import { mountSync } from "../features/sync/sync.js";
import { mountProfile } from "../features/profile/profile.js";
import { mountPomodoro } from "../features/pomodoro/pomodoro.js?v=4";
import { mountDocuments } from "../features/documents/documents.js";
import { mountProgress } from "../features/progress/progress.js";
import { mountAiTutor } from "../features/ai-tutor/ai-tutor.js";
import { mountQuiz } from "../features/ai-study/quiz.js";
import { mountWeaknesses } from "../features/ai-study/weaknesses.js";
import { mountExamPlan } from "../features/ai-study/exam-plan.js";
import { mountLeaveLetter } from "../features/ai-study/leave-letter.js";
import { renderEmptyState } from "../shared/components/empty-state.js";
import { renderTopbar, attachTopbarEvents } from "../shared/components/topbar.js";
import { mountSchoolEmail } from "../features/school-email/school-email.js";

export function renderShell(appEl) {
  // Không gian làm việc Workspace (vào thẳng trang chủ)
  const activeTab = getActiveTab();
  const currentRouteId = activeTab?.routeId || "dashboard";

  // Lưu vị trí cuộn của tab hiện tại vào tabState
  const oldContentPane = appEl.querySelector("#workspaceContentPane");
  const preserveEditor = ['documents', 'quiz', 'weaknesses', 'exam-plan-ai', 'leave-letter'].includes(currentRouteId) && oldContentPane?.dataset.route === currentRouteId &&
    oldContentPane.dataset.workspaceTab === String(activeTab?.id) && !activeTab?.tabState?.searchTarget;
  if (oldContentPane) {
    saveActiveTabScroll(oldContentPane.scrollTop, oldContentPane.scrollLeft);
  }

  appEl.innerHTML = `
    <div class="app-shell ${state.sidebarCollapsed ? "sidebar-collapsed" : ""}">
      <!-- Sidebar -->
      ${renderSidebar()}

      <!-- Workspace Container -->
      <main class="workspace-main">
        <!-- Thanh Tab nối liền phía trên -->
        ${renderWorkspaceTabs()}
        ${renderTopbar()}

        <!-- Vùng chèn nội dung tính năng ngay dưới thanh Tab -->
        <div class="workspace-content-pane" id="workspaceContentPane" role="region" aria-label="Nội dung trang"></div>
      </main>

      <!-- Cụm nút thao tác nổi góc dưới phải (Chuông thông báo & Trợ lý AI) -->
      ${renderFloatingActions()}
    </div>

    <!-- Modal Root chung nằm ngoài app-shell để overlay phủ 100% viewport -->
    <div id="tabPickerModalHost">
      ${state.tabPickerOpen ? renderTabPickerModal() : ""}
    </div>
  `;

  // Gắn sự kiện các thành phần dùng chung
  attachSidebarEvents(appEl);
  attachTopbarEvents(appEl);
  attachWorkspaceTabsEvents(appEl);
  attachFloatingActionsEvents(appEl);

  if (state.tabPickerOpen) {
    const pickerHost = appEl.querySelector("#tabPickerModalHost");
    attachTabPickerEvents(pickerHost);
  }

  // Mount Feature View vào Content Pane và khôi phục vị trí cuộn
  let contentPane = appEl.querySelector("#workspaceContentPane");
  if (preserveEditor) { contentPane.replaceWith(oldContentPane); contentPane = oldContentPane; }
  if (contentPane) {
    contentPane.dataset.route = currentRouteId;
    contentPane.dataset.workspaceTab = String(activeTab?.id);
    if (!preserveEditor) mountCurrentFeature(currentRouteId, contentPane);
    const targetScrollTop = activeTab?.tabState?.scrollTop || 0;
    const targetScrollLeft = activeTab?.tabState?.scrollLeft || 0;
    if (targetScrollTop || targetScrollLeft) {
      contentPane.scrollTop = targetScrollTop;
      contentPane.scrollLeft = targetScrollLeft;
    }
  }
}

function mountCurrentFeature(routeId, contentPane) {
  // Bọc mọi mount để một feature lỗi không làm trắng cả pane:
  // lỗi sync thì hiện khung fallback, lỗi async (promise) cũng bắt được.
  const fallback = (err) => {
    console.error(`[Shell] Lỗi mount "${routeId}":`, err);
    if (!contentPane.isConnected) return;
    contentPane.innerHTML = `
      <div style="max-width:800px;margin:40px auto;background:white;padding:48px 32px;border-radius:var(--radius-xl);border:1px solid var(--ink-200);text-align:center;">
        <h3 style="margin:0 0 8px;">Không tải được nội dung</h3>
        <p class="muted" style="margin:0 0 16px;">${String(err?.message || err || "Lỗi không xác định")}</p>
        <button type="button" class="button primary" id="shellFallbackSyncBtn">Đi tới Đồng bộ dữ liệu</button>
      </div>
    `;
    contentPane.querySelector("#shellFallbackSyncBtn")?.addEventListener("click", () => {
      import("./workspace.js").then(({ changeCurrentTabRoute }) => {
        changeCurrentTabRoute("sync");
      });
    });
  };
  const safe = (fn) => {
    try {
      const r = fn(contentPane);
      if (r && typeof r.catch === "function") r.catch(fallback);
    } catch (err) {
      fallback(err);
    }
  };
  switch (routeId) {
    case "dashboard":
      safe(mountDashboard);
      break;
    case "schedule":
      safe(mountSchedule);
      break;
    case "tasks":
      safe(mountTasks);
      break;
    case "study-planner":
      safe(mountStudyPlanner);
      break;
    case "exams":
      safe(mountExams);
      break;
    case "notifications":
      safe(mountNotifications);
      break;
    case "sync":
      safe(mountSync);
      break;
    case "profile":
      safe(mountProfile);
      break;
    case "pomodoro":
      safe(mountPomodoro);
      break;
    case "documents":
      safe(mountDocuments);
      break;
    case "progress":
      safe(mountProgress);
      break;
    case "ai-tutor":
      safe(mountAiTutor);
      break;
    case "quiz": safe(mountQuiz); break;
    case "weaknesses": safe(mountWeaknesses); break;
    case "exam-plan-ai": safe(mountExamPlan); break;
    case "leave-letter": safe(mountLeaveLetter); break;
    case "school-email":
      safe(mountSchoolEmail);
      break;
    default: {
      const routeDef = getRouteById(routeId);
      contentPane.innerHTML = `
        <div style="max-width:800px;margin:40px auto;background:white;padding:48px 32px;border-radius:var(--radius-xl);border:1px solid var(--ink-200);text-align:center;">
          ${renderEmptyState({
            icon: routeDef.icon || "i-folder",
            title: `${routeDef.title} — Đang phát triển`,
            description: `Chức năng "${routeDef.title}" đang trong lộ trình phát triển tiếp theo. Hiện tại, vui lòng sử dụng Thời khóa biểu, Quản lý công việc, Lịch thi, Thông báo và Đồng bộ dữ liệu.`,
            actionText: "Quay về Tổng quan",
            actionDataAttr: 'id="fallbackGotoDashboardBtn"'
          })}
        </div>
      `;
      const fallbackBtn = contentPane.querySelector("#fallbackGotoDashboardBtn");
      if (fallbackBtn) {
        fallbackBtn.addEventListener("click", () => {
          import("./workspace.js").then(({ changeCurrentTabRoute }) => {
            changeCurrentTabRoute("dashboard");
          });
        });
      }
      break;
    }
  }
}
