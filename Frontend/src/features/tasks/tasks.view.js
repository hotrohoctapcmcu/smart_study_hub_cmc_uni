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
                <th style="width:44px;text-align:center;">Xong</th>
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
                  // Bài tập EduX không có hạn nộp -> không tính "quá hạn" theo mốc epoch.
                  const remain = task.due
                    ? calculateRemainingTime(task.due)
                    : { isOverdue: false, hoursLeft: 0, text: "Chưa đặt hạn" };
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
                    <tr class="task-row ${isCompleted ? "completed-row" : ""}" data-task-id="${task.id}">
                      <td style="width:40px;text-align:center;">
                        <input 
                          type="checkbox" 
                          class="task-quick-complete-box" 
                          data-quick-complete-id="${task.id}" 
                          ${isCompleted ? "checked" : ""} 
                          aria-label="Đánh dấu hoàn thành" 
                          title="${isCompleted ? "Đã hoàn thành (nhấn để hoàn tác về Chưa làm)" : "Đánh dấu hoàn thành nhanh"}" 
                        />
                      </td>
                      <td class="task-title-cell task-clickable-cell" data-open-task-detail="${task.id}" style="cursor:pointer;" title="Nhấn xem chi tiết công việc">
                        <strong>${task.title}</strong>
                        <span>
                          ${task.subject || "Học tập cá nhân"}
                          ${task.source === "EDUX" ? `<em class="task-source-tag" title="Bài tập AI lấy từ EduX">· EduX</em>` : ""}
                        </span>
                      </td>
                      <td class="task-clickable-cell" data-open-task-detail="${task.id}" style="cursor:pointer;" title="Nhấn xem chi tiết công việc">
                        <div style="font-weight:600;font-size:0.86rem;">
                          ${task.due ? formatDateTimeVN(task.due) : "Chưa đặt hạn"}
                        </div>
                        <div style="font-size:0.75rem;margin-top:2px;color:${isCompleted ? "var(--emerald-600)" : remain.isOverdue ? "var(--red-600)" : "var(--ink-600)"};font-weight:${remain.isOverdue && !isCompleted ? "700" : "500"};">
                          ${isCompleted ? "✓ Đã hoàn thành" : remain.text}
                        </div>
                        ${task.source === "EDUX" && task.progress && task.progress.tongSo
                          ? `<div class="tiny muted" style="margin-top:2px;">Tiến độ tài liệu: ${task.progress.daHoc}/${task.progress.tongSo}</div>`
                          : ""}
                      </td>
                      <td class="task-clickable-cell" data-open-task-detail="${task.id}" style="cursor:pointer;">
                        <span class="status-tag ${statusClass}">
                          ${task.status === "Hoàn thành" ? "✓ Hoàn thành" : task.status === "Đang làm" ? "⏳ Đang làm" : "○ Chưa làm"}
                        </span>
                      </td>
                      <td class="task-clickable-cell" data-open-task-detail="${task.id}" style="cursor:pointer;">
                        <span class="priority-tag ${priorityClass}">● ${task.priority || "Trung bình"}</span>
                      </td>
                      <td class="task-clickable-cell" data-open-task-detail="${task.id}" style="cursor:pointer;">
                        ${
                          checklistTotal > 0
                            ? `<span class="small muted">${checklistDone}/${checklistTotal} (${checklistPercent}%)</span>`
                            : `<span class="tiny muted" style="color:var(--ink-400);">Không có checklist</span>`
                        }
                      </td>
                      <td style="text-align:right;">
                        <button type="button" class="icon-button" data-edit-task-id="${task.id}" aria-label="Sửa công việc" style="display:inline-grid;width:32px;height:32px;" title="Chỉnh sửa công việc">
                          <svg style="width:14px;height:14px;"><use href="#i-edit"></use></svg>
                        </button>
                        <button type="button" class="icon-button" data-delete-task-id="${task.id}" aria-label="Xóa công việc" style="display:inline-grid;width:32px;height:32px;color:var(--red-600);" title="Xóa công việc">
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

      <!-- Container Host Modal Form & Detail -->
      <div id="taskModalHost"></div>
    </div>
  `;
}

/**
 * Render Modal Thêm / Chỉnh sửa công việc theo đúng thứ tự:
 * 1. Tên công việc.
 * 2. Thời hạn: ngày và giờ.
 * 3. Checklist.
 * 4. Ghi chú thêm.
 * Tùy chọn phụ: Môn học và Mức độ ưu tiên.
 */
export function renderTaskModal(taskData = null) {
  const isEdit = Boolean(taskData && taskData.id);
  const checklist = taskData?.checklist || [];

  const bodyHtml = `
    <form id="taskModalForm" style="display:flex;flex-direction:column;gap:14px;">
      <!-- 1. Tên công việc -->
      <label>
        <span class="small" style="font-weight:700;display:block;margin-bottom:4px;color:var(--ink-950);">1. Tên công việc *</span>
        <input 
          type="text" 
          name="title" 
          required 
          placeholder="Ví dụ: Hoàn thành bài tập lớn môn Lập trình Web" 
          value="${taskData?.title || ""}"
          style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:10px 12px;font-size:0.92rem;"
        />
      </label>

      <!-- 2. Thời gian thực hiện (Thời hạn: ngày và giờ) -->
      <div>
        <label>
          <span class="small" style="font-weight:700;display:block;margin-bottom:6px;color:var(--ink-950);">2. Thời gian thực hiện (Thời hạn: ngày và giờ) *</span>
          <input 
            type="datetime-local" 
            name="due" 
            required 
            value="${taskData?.due || ""}"
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:9px 12px;font-size:0.9rem;"
          />
        </label>
      </div>

      <!-- 3. Checklist -->
      <div style="border-top:1px solid var(--ink-100);padding-top:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span class="small" style="font-weight:700;color:var(--ink-950);">3. Danh sách mục cần làm (Checklist)</span>
          <span class="tiny muted">Tùy chọn — có thể để trống</span>
        </div>
        
        <div id="modalChecklistItemsHost" style="display:flex;flex-direction:column;gap:6px;">
          ${checklist
            .map(
              (item) => `
            <div class="checklist-item-row ${item.done ? "done" : ""}" data-item-id="${item.id}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--ink-200);border-radius:6px;background:${item.done ? "var(--page)" : "white"};">
              <input type="checkbox" class="checklist-toggle-box" ${item.done ? "checked" : ""} style="cursor:pointer;" />
              <input type="text" class="checklist-text-input" value="${item.text}" style="flex:1;border:none;background:transparent;font-size:0.88rem;outline:none;" />
              <button type="button" class="checklist-remove-btn" style="color:var(--red-600);font-size:0.75rem;border:none;background:transparent;cursor:pointer;padding:2px 6px;">Xóa</button>
            </div>
          `
            )
            .join("")}
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <input 
            type="text" 
            id="newChecklistItemInput" 
            placeholder="Thêm mục việc nhỏ (nhấn Enter hoặc Thêm mục)..." 
            style="flex:1;border:1px solid var(--ink-200);border-radius:6px;padding:7px 10px;font-size:0.85rem;" 
          />
          <button type="button" class="button secondary small" id="addChecklistItemBtn">Thêm mục</button>
        </div>
      </div>

      <!-- 4. Ghi chú thêm / Mô tả chi tiết -->
      <div>
        <label>
          <span class="small" style="font-weight:700;display:block;margin-bottom:4px;color:var(--ink-950);">4. Mô tả chi tiết (Ghi chú thêm)</span>
          <textarea 
            name="note" 
            rows="3" 
            placeholder="Ghi chú thêm về yêu cầu đề bài, tài liệu cần nộp, hướng dẫn của giảng viên..." 
            style="width:100%;border:1px solid var(--ink-200);border-radius:8px;padding:8px 12px;font-size:0.88rem;font-family:inherit;resize:vertical;"
          >${taskData?.note || taskData?.description || ""}</textarea>
        </label>
      </div>

      <!-- Tùy chọn phụ (Môn học, Mức độ ưu tiên & Thời gian bắt đầu) -->
      <details style="background:#fbfaff;border:1px solid var(--ink-200);border-radius:8px;padding:8px 12px;">
        <summary style="font-size:0.82rem;font-weight:700;color:var(--ink-700);cursor:pointer;">
          ⚙️ Tùy chọn phụ (Môn học, Mức độ ưu tiên & Thời gian bắt đầu)
        </summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
          <label>
            <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Môn học</span>
            <input 
              type="text" 
              name="subject" 
              placeholder="Ví dụ: Cấu trúc dữ liệu & GT" 
              value="${taskData?.subject || ""}"
              style="width:100%;border:1px solid var(--ink-200);border-radius:6px;padding:6px 10px;font-size:0.84rem;"
            />
          </label>

          <label>
            <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Mức độ ưu tiên</span>
            <select name="priority" style="width:100%;border:1px solid var(--ink-200);border-radius:6px;padding:6px 10px;background:white;font-size:0.84rem;">
              <option value="Cao" ${taskData?.priority === "Cao" ? "selected" : ""}>Cao</option>
              <option value="Trung bình" ${!taskData || taskData?.priority === "Trung bình" ? "selected" : ""}>Trung bình</option>
              <option value="Thấp" ${taskData?.priority === "Thấp" ? "selected" : ""}>Thấp</option>
            </select>
          </label>

          <label style="grid-column: span 2;">
            <span class="small" style="font-weight:600;display:block;margin-bottom:4px;">Thời gian bắt đầu (tùy chọn)</span>
            <input 
              type="datetime-local" 
              name="startTime" 
              value="${taskData?.startTime || ""}"
              style="width:100%;border:1px solid var(--ink-200);border-radius:6px;padding:6px 10px;font-size:0.84rem;"
            />
          </label>
        </div>
      </details>

      <div class="badge-draft" style="width:fit-content;margin-top:4px;">
        📌 Trạng thái công việc tự động cập nhật theo tiến độ checklist
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
    footerHtml,
    customClass: "task-modal-dialog"
  });
}

/**
 * Render Khung chi tiết công việc (Task Detail Modal)
 * - Cho phép tích checklist trực tiếp trong khung này
 * - Tích hết checklist tự chuyển sang "Hoàn thành"
 * - Tích một phần chuyển sang "Đang làm"
 * - Bỏ tích mục của công việc hoàn thành thì mở lại công việc
 */
export function renderTaskDetailModal(task) {
  const checklist = task.checklist || [];
  const checklistTotal = checklist.length;
  const checklistDone = checklist.filter((i) => i.done).length;
  const isCompleted = task.status === "Hoàn thành";

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- Tiêu đề & Trạng thái -->
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span id="taskDetailStatusBadge" class="status-tag ${isCompleted ? "completed" : task.status === "Đang làm" ? "in-progress" : "not-started"}">
            ${isCompleted ? "✓ Hoàn thành" : task.status === "Đang làm" ? "⏳ Đang làm" : "○ Chưa làm"}
          </span>
          <span class="priority-tag ${task.priority === "Cao" ? "high" : task.priority === "Trung bình" ? "medium" : "low"}">
            ● ${task.priority || "Trung bình"}
          </span>
          ${task.subject ? `<span class="eyebrow" style="font-size:0.75rem;">${task.subject}</span>` : ""}
        </div>
        <h3 style="margin:0;font-size:1.35rem;color:var(--ink-950);">${task.title}</h3>
      </div>

      <!-- Thời gian: Bắt đầu & Hạn hoàn thành -->
      <div style="background:#f8fafc;border:1px solid var(--ink-200);border-radius:10px;padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <span class="tiny muted" style="font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px;">Bắt đầu:</span>
          <span style="font-size:0.9rem;font-weight:600;color:var(--ink-800);">
            ${task.startTime ? formatDateTimeVN(task.startTime) : "Chưa đặt mốc bắt đầu"}
          </span>
        </div>
        <div>
          <span class="tiny muted" style="font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px;">Hạn hoàn thành:</span>
          <span style="font-size:0.9rem;font-weight:700;color:${task.due ? "var(--violet-700)" : "var(--ink-800)"};">
            ${task.due ? formatDateTimeVN(task.due) : "Chưa đặt hạn"}
          </span>
          ${task.source === "EDUX"
            ? `<span class="tiny muted" style="display:block;margin-top:4px;">
                 Nguồn: EduX${task.chapter ? ` · ${task.chapter}` : ""}${task.highestScore !== null && task.highestScore !== undefined ? ` · Điểm cao nhất: ${task.highestScore}` : ""}
               </span>`
            : ""}
        </div>
      </div>

      <!-- Checklist trực tiếp -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-weight:700;font-size:0.92rem;color:var(--ink-950);">Danh sách checklist (${checklistDone}/${checklistTotal})</span>
          <span id="taskDetailChecklistProgress" class="tiny muted">${checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) + "%" : "Không có checklist"}</span>
        </div>

        <div id="taskDetailChecklistHost" style="display:flex;flex-direction:column;gap:6px;">
          ${
            checklistTotal > 0
              ? checklist
                  .map(
                    (item) => `
                <label class="checklist-interactive-row ${item.done ? "done" : ""}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--ink-200);border-radius:8px;background:${item.done ? "var(--page)" : "white"};cursor:pointer;">
                  <input type="checkbox" class="interactive-chk-box" data-interactive-chk-id="${item.id}" ${item.done ? "checked" : ""} style="width:18px;height:18px;cursor:pointer;" />
                  <span style="flex:1;font-size:0.9rem;${item.done ? "text-decoration:line-through;color:var(--ink-400);" : "color:var(--ink-900);"}">${item.text}</span>
                </label>
              `
                  )
                  .join("")
              : `<div class="muted small" style="font-style:italic;color:var(--ink-400);">Không có checklist</div>`
          }
        </div>
      </div>

      <!-- Mô tả -->
      <div>
        <span style="font-weight:700;font-size:0.92rem;color:var(--ink-950);display:block;margin-bottom:6px;">Mô tả & Hướng dẫn</span>
        <div style="background:white;border:1px solid var(--ink-200);border-radius:8px;padding:12px;font-size:0.9rem;line-height:1.5;color:var(--ink-800);min-height:50px;">
          ${task.note || task.description || '<span class="muted small" style="font-style:italic;">Chưa có mô tả chi tiết.</span>'}
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="button danger ghost" id="taskDetailDeleteBtn" data-task-id="${task.id}">Xóa công việc</button>
    <button type="button" class="button primary" id="taskDetailEditBtn" data-task-id="${task.id}">Chỉnh sửa</button>
    <button type="button" class="button ghost" data-close-modal="taskDetailViewModal">Đóng</button>
  `;

  return renderModal({
    id: "taskDetailViewModal",
    title: "Chi tiết công việc",
    bodyHtml,
    footerHtml,
    customClass: "task-detail-dialog"
  });
}
