/**
 * UniStudy CMC - Dashboard View (Sprint 1 & Sprint 2)
 * Tổng hợp dữ liệu thật từ in-memory state, Pomodoro service và Tiến độ học tập
 */
import { state } from "../../app/state.js";
import { ASSETS } from "../../shared/config/assets.js";
import { formatDateISO, calculateRemainingTime } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { getState as getPomoState } from "../pomodoro/pomodoro.service.js";
import { getProgressAnalytics } from "../progress/progress.service.js";

export function renderDashboardView() {
  const hasProfile = Boolean(state.studentProfile && state.studentProfile.name);
  const todayStr = formatDateISO(new Date());

  // Lịch hôm nay (gồm cả lịch trường và lịch tự học)
  const todayEvents = [
    ...state.schoolEvents.filter((e) => e.date === todayStr),
    ...state.studyEvents.filter((e) => e.date === todayStr)
  ].sort((a, b) => (a.start > b.start ? 1 : -1));

  // Deadline sắp tới từ tasks (chưa hoàn thành)
  const upcomingTasks = state.tasks
    .filter((t) => t.status !== "Hoàn thành")
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
    .slice(0, 3);

  // Kỳ thi sắp tới
  const upcomingExams = state.exams
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 2);

  // Thống kê Pomodoro & Tiến độ dùng chung
  const pomoState = getPomoState();
  const progressData = getProgressAnalytics("week");

  return `
    <div class="dashboard-grid">
      <!-- Hero Banner -->
      <div class="dashboard-hero-banner">
        <div class="dashboard-hero-content">
          <span class="eyebrow" style="color:var(--violet-200);margin-bottom:8px;">
            🎓 ${hasProfile ? `Xin chào, ${state.studentProfile.name}` : "UniStudy CMC Dashboard"}
          </span>
          <h1 style="margin:4px 0 10px;font-size:1.8rem;color:white;">
            ${hasProfile ? "Hôm nay bạn muốn học gì?" : "Chào mừng đến với Không gian học tập"}
          </h1>
          <p style="margin:0 0 18px;font-size:0.95rem;color:rgba(255,255,255,0.85);line-height:1.5;">
            ${
              hasProfile
                ? "Dữ liệu học tập đã sẵn sàng. Theo dõi lịch học, tài liệu và các deadline sắp tới của bạn."
                : "Kết nối hệ thống trường CMC để hiển thị lịch học, thời khóa biểu và hạn nộp bài tập chính xác."
            }
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="button soft-white" id="dashSyncActionBtn">
              <svg><use href="#i-refresh"></use></svg>
              <span>${hasProfile ? "Cập nhật dữ liệu trường" : "Đồng bộ dữ liệu CMC"}</span>
            </button>
            <button type="button" class="button ghost" style="color:white;border-color:rgba(255,255,255,0.4);" data-dash-goto="progress">
              <svg><use href="#i-chart"></use></svg>
              <span>Xem tiến độ học tập</span>
            </button>
          </div>
        </div>
        <div class="dashboard-hero-fox">
          <img src="${ASSETS.fox.wave}" alt="Linh vật cáo vẫy chào" />
        </div>
      </div>

      <!-- Khối tóm tắt nhanh: Pomodoro & Tiến độ (Sprint 2 - Balanced Layout) -->
      <div class="dashboard-quick-row">
        <!-- Card Pomodoro Live -->
        <div class="dash-card dash-quick-card">
          <div class="dash-quick-body">
            <div class="dash-quick-icon pomo-icon">
              <svg><use href="#i-clock"></use></svg>
            </div>
            <div class="dash-quick-info">
              <div class="dash-quick-label">Bộ đếm Pomodoro</div>
              <div class="dash-quick-value">${pomoState.displayTime}</div>
              <div class="dash-quick-sub">${
                pomoState.state === "running"
                  ? "🔥 Đang tập trung học"
                  : pomoState.state === "paused"
                  ? "⏸️ Đang tạm dừng"
                  : pomoState.state === "study_completed"
                  ? "🎉 Hoàn thành phiên học"
                  : pomoState.state === "break_running"
                  ? "☕ Đang trong giờ nghỉ"
                  : pomoState.state === "break_paused"
                  ? "⏸️ Tạm dừng giờ nghỉ"
                  : pomoState.state === "break_completed"
                  ? "✨ Hết giờ nghỉ ngơi"
                  : `Đã xong ${pomoState.history.length} phiên`
              }</div>
            </div>
          </div>
          <button type="button" class="button primary small dash-quick-action" data-dash-goto="pomodoro">
            ${
              pomoState.state === "running"
                ? "Mở đồng hồ"
                : pomoState.state === "paused"
                ? "Tiếp tục học"
                : pomoState.state === "study_completed"
                ? "Bắt đầu nghỉ"
                : pomoState.state === "break_running" || pomoState.state === "break_paused"
                ? "Xem giờ nghỉ"
                : pomoState.state === "break_completed"
                ? "Phiên mới"
                : "Bắt đầu học"
            }
          </button>
        </div>

        <!-- Card Tổng thời gian học -->
        <div class="dash-card dash-quick-card">
          <div class="dash-quick-body">
            <div class="dash-quick-icon study-icon">
              <svg><use href="#i-chart"></use></svg>
            </div>
            <div class="dash-quick-info">
              <div class="dash-quick-label">Thời gian tự học tuần</div>
              <div class="dash-quick-value">${progressData.totalStudyHours} giờ</div>
              <div class="dash-quick-sub">Streak: ${progressData.habits.streakDays} ngày liên tiếp</div>
            </div>
          </div>
          <button type="button" class="button secondary small dash-quick-action" data-dash-goto="progress">
            Bản đồ thời gian
          </button>
        </div>
      </div>

      <!-- Lưới 3 Card chức năng chính -->
      <div class="dashboard-cards-grid">
        <!-- Card 1: Lịch học hôm nay -->
        <div class="dash-card">
          <div class="dash-card-header">
            <h3><svg><use href="#i-calendar"></use></svg> Lịch hôm nay</h3>
            <button type="button" class="button ghost small" data-dash-goto="schedule">Xem lịch</button>
          </div>
          <div>
            ${
              todayEvents.length > 0
                ? todayEvents
                    .map(
                      (e) => `
                  <div class="dash-item-row">
                    <div>
                      <div class="dash-item-title">${e.subject} - ${e.title || "Buổi học"}</div>
                      <div class="dash-item-subtitle">${e.start} – ${e.end} ${e.room ? `· Phòng ${e.room}` : ""}</div>
                    </div>
                    <span class="eyebrow" style="font-size:0.72rem;">${e.source || "CMC"}</span>
                  </div>
                `
                    )
                    .join("")
                : renderEmptyState({
                    icon: "i-calendar",
                    title: "Chưa có lịch hôm nay",
                    description: "Bạn không có tiết học hoặc buổi tự học nào trong ngày hôm nay.",
                    actionText: "Xếp lịch tự học",
                    actionDataAttr: 'data-dash-goto="schedule"'
                  })
            }
          </div>
        </div>

        <!-- Card 2: Deadline sắp đến -->
        <div class="dash-card">
          <div class="dash-card-header">
            <h3><svg><use href="#i-tasks"></use></svg> Deadline sắp tới</h3>
            <button type="button" class="button ghost small" data-dash-goto="tasks">Xem tất cả</button>
          </div>
          <div>
            ${
              upcomingTasks.length > 0
                ? upcomingTasks
                    .map((t) => {
                      const remain = calculateRemainingTime(t.due);
                      return `
                    <div class="dash-item-row">
                      <div>
                        <div class="dash-item-title">${t.title}</div>
                        <div class="dash-item-subtitle">${t.subject} · ${remain.text}</div>
                      </div>
                      <span class="badge-draft" style="font-size:0.72rem;">${t.priority}</span>
                    </div>
                  `;
                    })
                    .join("")
                : renderEmptyState({
                    icon: "i-tasks",
                    title: "Chưa có deadline",
                    description: "Tuyệt vời! Hiện tại bạn không có bài tập hoặc công việc nào cần nộp gấp.",
                    actionText: "Thêm công việc",
                    actionDataAttr: 'data-dash-goto="tasks"'
                  })
            }
          </div>
        </div>

        <!-- Card 3: Kỳ thi sắp diễn ra -->
        <div class="dash-card">
          <div class="dash-card-header">
            <h3><svg><use href="#i-exam"></use></svg> Kỳ thi sắp tới</h3>
            <button type="button" class="button ghost small" data-dash-goto="exams">Kế hoạch thi</button>
          </div>
          <div>
            ${
              upcomingExams.length > 0
                ? upcomingExams
                    .map(
                      (ex) => `
                  <div class="dash-item-row">
                    <div>
                      <div class="dash-item-title">${ex.subject} (${ex.code || "Môn thi"})</div>
                      <div class="dash-item-subtitle">Ngày ${ex.date} · ${ex.start} (${ex.duration} phút)</div>
                    </div>
                    <span class="eyebrow" style="font-size:0.72rem;">${ex.room}</span>
                  </div>
                `
                    )
                    .join("")
                : renderEmptyState({
                    icon: "i-exam",
                    title: "Chưa có lịch thi",
                    description: "Chưa có thông tin kỳ thi nào được ghi nhận.",
                    actionText: "Tạo kế hoạch thi",
                    actionDataAttr: 'data-dash-goto="exams"'
                  })
            }
          </div>
        </div>
      </div>
    </div>
  `;
}
