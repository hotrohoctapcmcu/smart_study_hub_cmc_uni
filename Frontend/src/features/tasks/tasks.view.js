/**
 * UniStudy CMC - Tasks View (Theo Ảnh 09)
 */
import { state } from "../../app/state.js";
import { getActiveTab } from "../../app/workspace.js";
import { calculateRemainingTime, formatDateTimeVN } from "../../shared/utils/date.js";
import { renderEmptyState } from "../../shared/components/empty-state.js";
import { renderModal } from "../../shared/components/modal.js";
import { APP_CONFIG } from "../../shared/config/app.config.js";

export function renderTasksView() {
  const activeTab = getActiveTab();
  const currentTabFilter = activeTab.tabState.taskFilter || "all";
  const allTasks = state.tasks;

  // Tính số lượng theo từng tab
  const totalCount = allTasks.length;
  const inProgressCount = allTasks.filter((t) => t.status === "Đang làm").length;
  const completedCount = allTasks.filter((t) => t.status === "Hoàn thành").length;

  // Tab Sắp đến hạn (deadline filter trong vòng 48h hoặc cấu hình)
  const dueSoonCount = allTasks.filter((t) => {
    if (t.status === "Hoàn thành" || !t.due) return false;
    const remain = calculateRemainingTime(t.due);
    return !remain.isOverdue && remain.hoursLeft > 0 && remain.hoursLeft <= APP_CONFIG.dueSoonThresholdHours;
  }).length;

  // Lọc theo tab hiện tại
  let filteredTasks = allTasks;
  if (currentTabFilter === "in-progress") {
    filteredTasks = allTasks.filter((t) => t.status === "Đang làm");
  } else if (currentTabFilter === "completed") {
    filteredTasks = allTasks.filter((t) => t.status === "Hoàn thành");
  } else if (currentTabFilter === "due-soon") {
    filteredTasks = allTasks.filter((t) => {
      if (t.status === "Hoàn thành" || !t.due) return false;
      const remain = calculateRemainingTime(t.due);
      return !remain.isOverdue && remain.hoursLeft > 0 && remain.hoursLeft <= APP_CONFIG.dueSoonThresholdHours;
    });
  }

  // Lọc theo search keyword nếu có
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
  }

  return `
    <div class="tasks-container">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
        <div>
          <span class="eyebrow"><svg><use href="#i-tasks"></use></svg> Quản lý học tập</span>
          <h1 style="margin:4px 0 0;font-size:1.8rem;color:var(--ink-950);">Công việc & Deadline</h1>
        </div>
        <div>
          <button type="button" class="button primary" id="openCreateTaskBtn">
            <svg><use href="#i-plus"></use></svg>
            <span>Thêm công việc</span>
          </button>
        </div>
      </div>

      <!-- Dải Tab lọc chính theo Ảnh 09 -->
      <div class="tasks-tabs-header" role="tablist">
        <button type="button" class="tasks-tab-btn ${currentTabFilter === "all" ? "active" : ""}" data-task-tab="all">
          <span>Tất cả</span>
          <span class="tasks-tab-badge">${totalCount}</span>
        </button>
        <button type="button" class="tasks-tab-btn ${currentTabFilter === "in-progress" ? "active" : ""}" data-task-tab="in-progress">
          <span>Đang làm</span>
          <span class="tasks-tab-badge">${inProgressCount}</span>
        </button>
        <button type="button" class="tasks-tab-btn ${currentTabFilter === "due-soon" ? "active" : ""}" data-task-tab="due-soon" title="Ngưỡng sắp đến hạn: 48 giờ (Chờ hợp đồng backend xác nhận)">
          <span>Sắp đến hạn</span>
          <span class="tasks-tab-badge">${dueSoonCount}</span>
        </button>
        <button type="button" class="tasks-tab-btn ${currentTabFilter === "completed" ? "active" : ""}" data-task-tab="completed">
          <span>Hoàn thành</span>
          <span class="tasks-tab-badge">${completedCount}</span>
        </button>
      </div>

      <!-- Bảng Công việc (Bố cục Bảng chuẩn Ảnh 09) -->
      <div class="tasks-table-card">
        ${
          filteredTasks.length > 0
            ? `
          <table class="tasks-table">
            <thead>
              <tr>
                <th style="width:44px;"><input type="checkbox" id="selectAllTasksCheckbox" aria-label="Chọn tất cả công việc" /></th>
                <th>Công việc & Môn học</th>
                <th>Hạn nộp & Thời gian còn lại</th>
                <th>Trạng thái</th>
                <th>Mức độ ưu tiên</th>
                <th>Checklist</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks
                .map((task) => {
                  const remain = calculateRemainingTime(task.due);
                  const isCompleted = task.status === "Hoàn thành";
                  const checklistTotal = task.checklist ? task.checklist.length : 0;
                  const checklistDone = task.checklist ? task.checklist.filter((i) => i.done).length : 0;
                  const checklistPercent = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

                  const statusClass =
                    task.status === "Hoàn thành"
                      ? "completed"
                      : task.status === "Đang làm"
                      ? "in-progress"
                      : "not-started";

                  const priorityClass =
                    task.priority === "Cao" ? "high" : task.priority === "Trung bình" ? "medium" : "low";

                  return `
                    <tr class="${isCompleted ? "completed-row" : ""}" data-task-id="${task.id}">
                      <td>
                        <input type="checkbox" class="task-row-checkbox" data-task-checkbox="${task.id}" />
                      </td>
                      <td class="task-title-cell">
                        <strong>${task.title}</strong>
                        <span>${task.subject}</span>
                      </td>
                      <td>
                        <div style="font-weight:600;font-size:0.86rem;">
                          ${task.due ? formatDateTimeVN(task.due) : "Chưa đặt hạn"}
                        </div>
                        <div style="font-size:0.75rem;margin-top:2px;color:${remain.isOverdue ? "var(--red-600)" : "var(--ink-600)"};font-weight:${remain.isOverdue ? "700" : "500"};">
                          ${remain.text}
                        </div>
                      </td>
                      <td>
                        <select class="task-status-select" data-change-status-id="${task.id}" style="border:1px solid var(--ink-200);border-radius:6px;padding:4px 8px;font-size:0.82rem;font-weight:600;background:white;">
                          <option value="Chưa làm" ${task.status === "Chưa làm" ? "selected" : ""}>Chưa làm</option>
                          <option value="Đang làm" ${task.status === "Đang làm" ? "selected" : ""}>Đang làm</option>
                          <option value="Hoàn thành" ${task.status === "Hoàn thành" ? "selected" : ""}>Hoàn thành</option>
                        </select>
                      </td>
                      <td>
                        <span class="priority-tag ${priorityClass}">● ${task.priority}</span>
                      </td>
                      <td>
                        ${
                          checklistTotal > 0
                            ? `<span class="small muted">${checklistDone}/${checklistTotal} (${checklistPercent}%)</span>`
                            : `<span class="tiny muted">Chưa có mục</span>`
                        }
                      </td>
                      <td style="text-align:right;">
                        <button type="button" class="icon-button" data-edit-task-id="${task.id}" aria-label="Sửa công việc" style="display:inline-grid;width:32px;height:32px;">
                          <svg style="width:14px;height:14px;"><use href="#i-edit"></use></svg>
                        </button>
                        <button type="button" class="icon-button" data-delete-task-id="${task.id}" aria-label="Xóa công việc" style="display:inline-grid;width:32px;height:32px;color:var(--red-600);">
                          <svg style="width:14px;height:14px;"><use href="#i-trash"></use></svg>
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        `
            : renderEmptyState({
                icon: "i-tasks",
                title: "Chưa có công việc nào trong mục này",
                description: "Nhấn 'Thêm công việc' để tạo công việc và theo dõi hạn nộp bài tập của bạn.",
                actionText: "Thêm công việc mới",
                actionDataAttr: 'id="emptyStateCreateTaskBtn"'
              })
        }
      </div>

      <!-- Container Host Modal Form -->
      <div id="taskModalHost"></div>
    </div>
  `;
}

/**
 * Render Modal Thêm / Chỉnh sửa công việc kèm Checklist
 */
export function renderTaskModal(taskData = null) {
  const isEdit = Boolean(taskData && taskData.id);
  const checklist = taskData?.checklist || [];

  const bodyHtml = `
    <form id="taskModalForm" style="display:flex;flex-direction:column;gap:14px;">
      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Tên công việc *</span>
        <input 
          type="text" 
          name="title" 
          required 
          placeholder="Ví dụ: Hoàn thành báo cáo Lab 4" 
          value="${taskData?.title || ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Môn học</span>
        <input 
          type="text" 
          name="subject" 
          placeholder="Ví dụ: Cấu trúc dữ liệu & GT" 
          value="${taskData?.subject || ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
        />
      </label>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Hạn nộp (Deadline) *</span>
          <input 
            type="datetime-local" 
            name="due" 
            required 
            value="${taskData?.due || ""}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;"
          />
        </label>

        <label>
          <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Mức độ ưu tiên</span>
          <select name="priority" style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;background:white;">
            <option value="Cao" ${taskData?.priority === "Cao" ? "selected" : ""}>Cao</option>
            <option value="Trung bình" ${!taskData || taskData?.priority === "Trung bình" ? "selected" : ""}>Trung bình</option>
            <option value="Thấp" ${taskData?.priority === "Thấp" ? "selected" : ""}>Thấp</option>
          </select>
        </label>
      </div>

      <label>
        <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Trạng thái</span>
        <select name="status" style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;background:white;">
          <option value="Chưa làm" ${!taskData || taskData?.status === "Chưa làm" ? "selected" : ""}>Chưa làm</option>
          <option value="Đang làm" ${taskData?.status === "Đang làm" ? "selected" : ""}>Đang làm</option>
          <option value="Hoàn thành" ${taskData?.status === "Hoàn thành" ? "selected" : ""}>Hoàn thành</option>
        </select>
      </label>

      <!-- Vùng Checklist Items -->
      <div style="margin-top:6px;border-top:1px solid var(--ink-100);padding-top:12px;">
        <span class="small" style="font-weight:700;display:block;margin-bottom:8px;">Danh sách việc nhỏ (Checklist)</span>
        
        <div id="modalChecklistItemsHost">
          ${checklist
            .map(
              (item, idx) => `
            <div class="checklist-item-row ${item.done ? "done" : ""}" data-checklist-idx="${idx}">
              <input type="checkbox" class="checklist-toggle-box" ${item.done ? "checked" : ""} />
              <span style="flex:1;font-size:0.86rem;">${item.text}</span>
              <button type="button" class="checklist-remove-btn" style="color:var(--red-600);font-size:0.75rem;">Xóa</button>
            </div>
          `
            )
            .join("")}
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <input 
            type="text" 
            id="newChecklistItemInput" 
            placeholder="Thêm mục việc nhỏ cần làm..." 
            style="flex:1;border:1px solid var(--ink-200);border-radius:6px;padding:6px 10px;font-size:0.84rem;" 
          />
          <button type="button" class="button secondary small" id="addChecklistItemBtn">Thêm mục</button>
        </div>
      </div>

      <div class="badge-draft" style="width:fit-content;margin-top:8px;">
        📌 Bản nháp cục bộ — Chưa lưu server
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="button ghost" data-close-modal="taskDetailModal">Hủy</button>
    <button type="submit" form="taskModalForm" class="button primary">
      ${isEdit ? "Cập nhật công việc" : "Lưu công việc"}
    </button>
  `;

  return renderModal({
    id: "taskDetailModal",
    title: isEdit ? "Chỉnh sửa công việc" : "Thêm công việc học tập",
    bodyHtml,
    footerHtml
  });
}
