/**
 * UniStudy CMC - Tasks Events
 */
import { state, addLocalTask, updateLocalTask, deleteLocalTask, notifyStateChange } from "../../app/state.js";
import { updateActiveTabLocalState } from "../../app/workspace.js";
import { validateTask } from "./tasks.validation.js";
import { renderTaskModal } from "./tasks.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";

export function attachTasksEvents(containerEl) {
  // 1. Chuyển tab lọc (Tất cả / Đang làm / Sắp đến hạn / Hoàn thành)
  const tabBtns = containerEl.querySelectorAll("[data-task-tab]");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filterKey = btn.getAttribute("data-task-tab");
      updateActiveTabLocalState({ taskFilter: filterKey });
    });
  });

  // 2. Mở modal thêm / sửa task
  const openModal = (initialData = null) => {
    const modalHost = containerEl.querySelector("#taskModalHost");
    if (!modalHost) return;

    // Clone checklist để sửa cục bộ trong form
    let localChecklist = initialData?.checklist ? [...initialData.checklist] : [];

    modalHost.innerHTML = renderTaskModal(initialData ? { ...initialData, checklist: localChecklist } : null);
    const modalEl = modalHost.querySelector("#taskDetailModal");

    const close = () => {
      modalHost.innerHTML = "";
    };

    attachModalEvents(modalEl, close);

    // Xử lý Checklist con
    const checklistHost = modalEl.querySelector("#modalChecklistItemsHost");
    const newItemInput = modalEl.querySelector("#newChecklistItemInput");
    const addItemBtn = modalEl.querySelector("#addChecklistItemBtn");

    const renderLocalChecklist = () => {
      checklistHost.innerHTML = localChecklist
        .map(
          (item, idx) => `
        <div class="checklist-item-row ${item.done ? "done" : ""}" data-checklist-idx="${idx}">
          <input type="checkbox" class="checklist-toggle-box" ${item.done ? "checked" : ""} />
          <span style="flex:1;font-size:0.86rem;">${item.text}</span>
          <button type="button" class="checklist-remove-btn" style="color:var(--red-600);font-size:0.75rem;">Xóa</button>
        </div>
      `
        )
        .join("");

      // Gắn sự kiện toggle
      checklistHost.querySelectorAll(".checklist-toggle-box").forEach((box, i) => {
        box.addEventListener("change", (e) => {
          localChecklist[i].done = e.target.checked;
          renderLocalChecklist();
        });
      });

      // Gắn sự kiện xóa
      checklistHost.querySelectorAll(".checklist-remove-btn").forEach((btn, i) => {
        btn.addEventListener("click", () => {
          localChecklist.splice(i, 1);
          renderLocalChecklist();
        });
      });
    };

    if (addItemBtn && newItemInput) {
      addItemBtn.addEventListener("click", () => {
        const text = newItemInput.value.trim();
        if (text) {
          localChecklist.push({ text, done: false });
          newItemInput.value = "";
          renderLocalChecklist();
        }
      });
    }

    renderLocalChecklist();

    // Submit form task
    const form = modalEl.querySelector("#taskModalForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = {
          title: fd.get("title"),
          subject: fd.get("subject"),
          due: fd.get("due"),
          priority: fd.get("priority"),
          status: fd.get("status"),
          checklist: localChecklist
        };

        const check = validateTask(data);
        if (!check.isValid) {
          const firstErr = Object.values(check.errors)[0];
          alert(firstErr);
          return;
        }

        if (initialData?.id) {
          updateLocalTask(initialData.id, data);
        } else {
          addLocalTask(data);
        }
        close();
      });
    }
  };

  const createBtn = containerEl.querySelector("#openCreateTaskBtn");
  const emptyCreateBtn = containerEl.querySelector("#emptyStateCreateTaskBtn");
  if (createBtn) createBtn.addEventListener("click", () => openModal());
  if (emptyCreateBtn) emptyCreateBtn.addEventListener("click", () => openModal());

  // 3. Nút Sửa trên bảng
  const editBtns = containerEl.querySelectorAll("[data-edit-task-id]");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-task-id");
      const task = state.tasks.find((t) => t.id === id);
      if (task) {
        openModal(task);
      }
    });
  });

  // 4. Nút Xóa trên bảng
  const deleteBtns = containerEl.querySelectorAll("[data-delete-task-id]");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete-task-id");
      const ok = window.confirm("Bạn có chắc chắn muốn xóa công việc này?");
      if (ok) {
        deleteLocalTask(id);
      }
    });
  });

  // 5. Thay đổi trực tiếp Trạng thái trên dropdown bảng
  const statusSelects = containerEl.querySelectorAll("[data-change-status-id]");
  statusSelects.forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const id = sel.getAttribute("data-change-status-id");
      updateLocalTask(id, { status: e.target.value });
    });
  });

  // 6. Checkbox chọn tất cả
  const selectAllBox = containerEl.querySelector("#selectAllTasksCheckbox");
  if (selectAllBox) {
    selectAllBox.addEventListener("change", (e) => {
      const rowBoxes = containerEl.querySelectorAll(".task-row-checkbox");
      rowBoxes.forEach((b) => {
        b.checked = e.target.checked;
      });
    });
  }
}
