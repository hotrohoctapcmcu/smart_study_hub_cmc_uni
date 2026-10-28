/**
 * UniStudy CMC - Bootstrap Module
 * Khởi tạo ứng dụng và lắng nghe vòng đời state
 */
import { subscribe, state, notifyStateChange } from "./state.js";
import { renderShell } from "./shell.js?v=6";
import { changeCurrentTabRoute } from "./workspace.js";
import { logger } from "../shared/utils/logger.js";

export function bootstrap() {
  const appEl = document.querySelector("#app");
  if (!appEl) {
    logger.error("Không tìm thấy phần tử #app trong DOM.");
    return;
  }

  // Hỗ trợ kiểm thử và deep link qua query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const route = urlParams.get("route");
  if (route) {
    changeCurrentTabRoute(route);
  }
  if (urlParams.get("testProfile") === "1") {
    state.studentProfile = {
      name: "Nguyễn Hoàng Minh Châu Long Vương Triều",
      studentId: "CMC220011",
      email: "chaunm.cmc220011@student.cmc.edu.vn"
    };
  }
  if (urlParams.get("drawer") === "open") {
    state.mobileDrawerOpen = true;
  }
  if (urlParams.get("compact") === "1") {
    state.sidebarCollapsed = true;
  }
  if (urlParams.get("testPlan") === "1") {
    import("../features/study-planner/study-planner.service.js").then(({ generateAIStudySchedule }) => {
      generateAIStudySchedule({
        subject: "Phân tích và Thiết kế Thuật toán Nâng cao Hướng đối tượng & Cấu trúc dữ liệu phân tán CMC",
        freeSlot: "evening",
        targetHours: 12,
        note: "Kế hoạch tự học chuyên sâu chuẩn bị cho bài tập lớn và đồ án kết thúc học phần."
      });
    });
  }

  // Subscribe state changes
  subscribe(() => {
    renderShell(appEl);
  });

  // Khởi tạo render lần đầu
  renderShell(appEl);

  import("../features/pomodoro/pomodoro.sync.js").then(({ enablePomodoroSync }) => enablePomodoroSync());
  window.addEventListener("online", () => {
    import("../features/pomodoro/pomodoro.sync.js").then(({ syncPomodoroHistory }) => syncPomodoroHistory());
  });

  // Tự động nạp dữ liệu ban đầu từ Backend API trong chế độ nền (Non-blocking)
  (async () => {
    try {
      const [
        { fetchProfileFromApi },
        { fetchSchoolSchedules, checkAndRefreshSourceStatuses },
        { fetchStudySchedules },
        { fetchTasksFromApi },
        { fetchExamsFromApi },
        { fetchNotificationsFromApi }
      ] = await Promise.all([
        import("../features/profile/profile.service.js"),
        import("../features/sync/sync.service.js"),
        import("../features/schedule/schedule.service.js"),
        import("../features/tasks/tasks.service.js"),
        import("../features/exams/exams.service.js"),
        import("../features/notifications/notifications.service.js")
      ]);

      await Promise.allSettled([
        fetchProfileFromApi(),
        fetchSchoolSchedules().then((schedules) => {
          if (Array.isArray(schedules) && schedules.length > 0) {
            state.schoolEvents = schedules.map((t) => ({ ...t, source: "Trường" }));
            notifyStateChange();
          }
        }),
        fetchStudySchedules(),
        fetchTasksFromApi(),
        fetchExamsFromApi(),
        fetchNotificationsFromApi()
      ]);

      // Sau khi tải dữ liệu xong, đồng bộ trạng thái kết nối nguồn
      await checkAndRefreshSourceStatuses();
    } catch (err) {
      logger.warn("Không thể tải toàn bộ dữ liệu khởi tạo từ backend:", err);
    }
  })();

  // Đồng bộ breakpoint khi thay đổi kích thước cửa sổ
  let lastCategory = window.innerWidth <= 768 ? "mobile" : window.innerWidth <= 1024 ? "tablet" : "desktop";
  window.addEventListener("resize", () => {
    const currentCategory = window.innerWidth <= 768 ? "mobile" : window.innerWidth <= 1024 ? "tablet" : "desktop";
    if (currentCategory !== lastCategory) {
      if (currentCategory === "mobile") {
        state.mobileDrawerOpen = false;
        state.sidebarCollapsed = false; // Mobile không dùng rail thu gọn, dùng drawer
      } else if (currentCategory === "tablet") {
        state.mobileDrawerOpen = false;
        state.sidebarCollapsed = true; // Tablet mặc định gọn theo AGENTS.md
      } else if (currentCategory === "desktop") {
        state.mobileDrawerOpen = false;
        state.sidebarCollapsed = false; // Desktop đầy đủ biểu tượng và nhãn
      }
      lastCategory = currentCategory;
      notifyStateChange();
    }
  });

  logger.info("UniStudy CMC đã khởi động thành công.");
}

