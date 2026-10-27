import { state, addLocalTask, updateLocalTask, deleteLocalTask, notifyStateChange } from "../../app/state.js";
import { getActiveTab, updateActiveTabLocalState } from "../../app/workspace.js";
import { validateTask } from "./tasks.validation.js";
import { renderTaskModal, renderTaskDetailModal } from "./tasks.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";
import {
  createTaskApi,
  updateTaskApi,
  deleteTaskApi,
  toggleChecklistItemApi
} from "./tasks.service.js";

export function attachTasksEvents(containerEl) {
  const modalHost = containerEl.querySelector("#taskModalHost");
  const removeTask = async (taskId) => {
    const task = state.tasks.find(item => item.id === taskId);
    try {
      if (task?.isLocalDraft) deleteLocalTask(taskId);
      else await deleteTaskApi(taskId);
      return true;
    } catch (error) {
      window.alert(error.message || "Không thể xóa công việc.");
      return false;
    }
  };

  // 1. Chuyển tab lọc (Tất cả / Đang làm / Sắp đến hạn / Hoàn thành)
  const tabBtns = containerEl.querySelectorAll("[data-task-tab]");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filterKey = btn.getAttribute("data-task-tab");
      updateActiveTabLocalState({ taskFilter: filterKey });
    });
  });

  // Helper mở Modal Khung chi tiết công việc
  const openDetailModal = (task) => {
    if (!modalHost || !task) return;

    const activeTab = getActiveTab();
    if (activeTab.tabState) {
      activeTab.tabState.openDetailTaskId = task.id;
    }

    modalHost.innerHTML = renderTaskDetailModal(task);
    const modalEl = modalHost.querySelector("#taskDetailViewModal");

    const close = () => {
      const curTab = getActiveTab();
      if (curTab.tabState) {
        curTab.tabState.openDetailTaskId = null;
      }
      modalHost.innerHTML = "";
    };

    attachModalEvents(modalEl, close);

    // Tích checklist trực tiếp trong khung chi tiết
    const chkBoxes = modalEl.querySelectorAll(".interactive-chk-box");
    chkBoxes.forEach((box) => {
      box.addEventListener("change", (e) => {
        const itemId = box.getAttribute("data-interactive-chk-id");
        const isChecked = e.target.checked;

        // Cập nhật mảng checklist
        const updatedChecklist = (task.checklist || []).map((item) => {
          if (item.id === itemId) {
            return { ...item, done: isChecked };
          }
          return item;
        });

        // Tính toán chuyển trạng thái tự động theo checklist
        let newStatus = "Chưa làm";
        let completedAt = null;

        if (updatedChecklist.length > 0) {
          const allDone = updatedChecklist.every((i) => i.done);
          const anyDone = updatedChecklist.some((i) => i.done);

          if (allDone) {
            newStatus = "Hoàn thành";
            completedAt = task.completedAt || new Date().toISOString();
          } else if (anyDone) {
            newStatus = "Đang làm";
            completedAt = null;
          } else {
            newStatus = "Chưa làm";
            completedAt = null;
          }
        } else {
          newStatus = task.status;
          completedAt = task.completedAt || null;
        }

        task.checklist = updatedChecklist;
        task.status = newStatus;
        task.completedAt = completedAt;

        // Lưu vào store cục bộ
        updateLocalTask(task.id, {
          checklist: updatedChecklist,
          status: newStatus,
          completedAt
        });

        // Đồng bộ lên API Backend
        const curItem = updatedChecklist.find((i) => i.id === itemId);
        if (curItem && curItem.backendId) {
          toggleChecklistItemApi(curItem.backendId, isChecked).catch((e) =>
            console.warn("[Tasks] Lỗi đồng bộ checklist lên backend:", e)
          );
        }
        updateTaskApi(task.id, { status: newStatus }).catch((e) =>
          console.warn("[Tasks] Lỗi cập nhật trạng thái lên backend:", e)
        );

        // Cập nhật giao diện trong modal trực tiếp
        const badge = modalEl.querySelector("#taskDetailStatusBadge");
        if (badge) {
          badge.className = `status-tag ${newStatus === "Hoàn thành" ? "completed" : newStatus === "Đang làm" ? "in-progress" : "not-started"}`;
          badge.textContent = newStatus === "Hoàn thành" ? "✓ Hoàn thành" : newStatus === "Đang làm" ? "⏳ Đang làm" : "○ Chưa làm";
        }

        const progressEl = modalEl.querySelector("#taskDetailChecklistProgress");
        if (progressEl) {
          if (updatedChecklist.length > 0) {
            const doneCount = updatedChecklist.filter((i) => i.done).length;
            progressEl.textContent = `${Math.round((doneCount / updatedChecklist.length) * 100)}%`;
          } else {
            progressEl.textContent = "Không có checklist";
          }
        }

        const row = box.closest(".checklist-interactive-row");
        if (row) {
          if (isChecked) {
            row.classList.add("done");
            row.style.background = "var(--page)";
            const textSpan = row.querySelector("span");
            if (textSpan) {
              textSpan.style.textDecoration = "line-through";
              textSpan.style.color = "var(--ink-400)";
            }
          } else {
            row.classList.remove("done");
            row.style.background = "white";
            const textSpan = row.querySelector("span");
            if (textSpan) {
              textSpan.style.textDecoration = "none";
              textSpan.style.color = "var(--ink-900)";
            }
          }
        }
      });
    });

    // Nút Sửa trong khung chi tiết
    const editBtn = modalEl.querySelector("#taskDetailEditBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        close();
        openModal(task);
      });
    }

    // Nút Xóa trong khung chi tiết
    const deleteBtn = modalEl.querySelector("#taskDetailDeleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const ok = window.confirm(`Bạn có chắc chắn muốn xóa công việc "${task.title}" không?`);
        if (ok) {
          if (await removeTask(task.id)) close();
        }
      });
    }
  };

  // Helper mở modal Thêm / Sửa task
  const openModal = (initialData = null) => {
    if (!modalHost) return;

    // Clone checklist để sửa cục bộ trong form
    let localChecklist = initialData?.checklist
      ? initialData.checklist.map((c) => ({
          id: c.id || `chk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          backendId: c.backendId,
          text: c.text,
          done: Boolean(c.done)
        }))
      : [];

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
      if (!checklistHost) return;
      checklistHost.innerHTML = localChecklist
        .map(
          (item) => `
        <div class="checklist-item-row ${item.done ? "done" : ""}" data-item-id="${item.id}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--ink-200);border-radius:6px;background:${item.done ? "var(--page)" : "white"};">
          <input type="checkbox" class="checklist-toggle-box" ${item.done ? "checked" : ""} style="cursor:pointer;" />
          <input type="text" class="checklist-text-input" value="${item.text}" style="flex:1;border:none;background:transparent;font-size:0.88rem;outline:none;" />
          <button type="button" class="checklist-remove-btn" style="color:var(--red-600);font-size:0.75rem;border:none;background:transparent;cursor:pointer;padding:2px 6px;">Xóa</button>
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

      // Gắn sự kiện sửa text (giữ ID ổn định)
      checklistHost.querySelectorAll(".checklist-text-input").forEach((input, i) => {
        input.addEventListener("input", (e) => {
          localChecklist[i].text = e.target.value;
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

    const addCheckItem = () => {
      if (!newItemInput) return;
      const text = newItemInput.value.trim();
      if (text) {
        localChecklist.push({
          id: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          text,
          done: false
        });
        newItemInput.value = "";
        renderLocalChecklist();
      }
    };

    if (addItemBtn) addItemBtn.addEventListener("click", addCheckItem);
    if (newItemInput) {
      newItemInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addCheckItem();
        }
      });
    }

    renderLocalChecklist();

    // Submit form task
    const form = modalEl.querySelector("#taskModalForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        // Lọc bỏ các mục checklist chỉ chứa khoảng trắng
        const cleanChecklist = localChecklist
          .map((i) => ({ ...i, text: i.text.trim() }))
          .filter((i) => i.text.length > 0);

        // Tự động xác định trạng thái theo checklist
        let status = "Chưa làm";
        let completedAt = initialData?.completedAt || null;

        if (cleanChecklist.length > 0) {
          const allDone = cleanChecklist.every((i) => i.done);
          const anyDone = cleanChecklist.some((i) => i.done);

          if (allDone) {
            status = "Hoàn thành";
            completedAt = completedAt || new Date().toISOString();
          } else if (anyDone) {
            status = "Đang làm";
            completedAt = null;
          } else {
            status = "Chưa làm";
            completedAt = null;
          }
        } else if (initialData?.status === "Hoàn thành") {
          status = "Hoàn thành";
        }

        const data = {
          title: fd.get("title")?.trim(),
          startTime: fd.get("startTime") || null,
          due: fd.get("due"),
          note: fd.get("note")?.trim() || "",
          description: fd.get("note")?.trim() || "",
          subject: fd.get("subject")?.trim() || "Học tập cá nhân",
          priority: fd.get("priority") || "Trung bình",
          status,
          completedAt,
          checklist: cleanChecklist
        };

        const check = validateTask(data);
        if (!check.isValid) {
          const firstErr = Object.values(check.errors)[0];
          alert(firstErr);
          return;
        }

        if (initialData?.id) {
          if (initialData.isLocalDraft) updateLocalTask(initialData.id, data);
          else {
            const remainingIds = new Set(cleanChecklist.map(item => item.backendId).filter(Boolean));
            data.removedChecklistIds = (initialData.checklist || [])
              .map(item => item.backendId).filter(id => id && !remainingIds.has(id));
            try { await updateTaskApi(initialData.id, data); }
            catch (error) { window.alert(error.message); return; }
          }
        } else {
          addLocalTask(data);
          createTaskApi(data).catch((err) =>
            console.warn("[Tasks] Lỗi tạo task lên backend:", err)
          );
        }
        close();
      });
    }
  };

  const createBtn = containerEl.querySelector("#openCreateTaskBtn");
  const emptyCreateBtn = containerEl.querySelector("#emptyStateCreateTaskBtn");
  if (createBtn) createBtn.addEventListener("click", () => openModal());
  if (emptyCreateBtn) emptyCreateBtn.addEventListener("click", () => openModal());

  // 2. Mở khung chi tiết khi nhấn vào ô nội dung công việc (trừ nút thao tác)
  const detailTriggers = containerEl.querySelectorAll("[data-open-task-detail]");
  detailTriggers.forEach((el) => {
    el.addEventListener("click", (e) => {
      // Bỏ qua nếu click trực tiếp vào nút hoặc checkbox
      if (e.target.closest("button, input, select")) return;
      const taskId = el.getAttribute("data-open-task-detail");
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        openDetailModal(task);
      }
    });
  });

  // 3. Checkbox hoàn thành nhanh trên bảng danh sách
  const quickCompleteBoxes = containerEl.querySelectorAll(".task-quick-complete-box");
  quickCompleteBoxes.forEach((box) => {
    box.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    box.addEventListener("change", (e) => {
      e.stopPropagation();
      const taskId = box.getAttribute("data-quick-complete-id");
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;

      const isChecking = e.target.checked;

      if (isChecking) {
        // Đánh dấu hoàn thành ngay: đồng thời đánh dấu toàn bộ checklist hoàn thành
        const updatedChecklist = (task.checklist || []).map((i) => ({ ...i, done: true }));
        updateLocalTask(task.id, {
          status: "Hoàn thành",
          checklist: updatedChecklist,
          completedAt: new Date().toISOString()
        });
        updateTaskApi(task.id, { status: "Hoàn thành" }).catch((err) =>
          console.warn("[Tasks] Lỗi hoàn thành task trên backend:", err)
        );
      } else {
        // Bỏ tích công việc sẽ về "Chưa làm"
        const hasProgress = task.checklist && task.checklist.some((i) => i.done);
        if (hasProgress) {
          const ok = window.confirm("Công việc này đã có tiến độ trong checklist. Bạn có chắc chắn muốn bỏ hoàn thành và đặt lại toàn bộ checklist về Chưa làm không?");
          if (ok) {
            const resetChecklist = task.checklist.map((i) => ({ ...i, done: false }));
            updateLocalTask(task.id, {
              status: "Chưa làm",
              checklist: resetChecklist,
              completedAt: null
            });
            updateTaskApi(task.id, { status: "Chưa làm" }).catch((err) =>
              console.warn("[Tasks] Lỗi cập nhật task trên backend:", err)
            );
          } else {
            e.target.checked = true; // Hủy xác nhận thì giữ nguyên công việc
          }
        } else {
          const resetChecklist = (task.checklist || []).map((i) => ({ ...i, done: false }));
          updateLocalTask(task.id, {
            status: "Chưa làm",
            checklist: resetChecklist,
            completedAt: null
          });
          updateTaskApi(task.id, { status: "Chưa làm" }).catch((err) =>
            console.warn("[Tasks] Lỗi cập nhật task trên backend:", err)
          );
        }
      }
    });
  });

  // Khôi phục mở modal chi tiết nếu đang được xem
  const activeTab = getActiveTab();
  if (activeTab?.tabState?.openDetailTaskId) {
    const task = state.tasks.find((t) => t.id === activeTab.tabState.openDetailTaskId);
    if (task) {
      openDetailModal(task);
    } else {
      activeTab.tabState.openDetailTaskId = null;
    }
  }

  // 4. Nút Sửa trên bảng
  const editBtns = containerEl.querySelectorAll("[data-edit-task-id]");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-edit-task-id");
      const task = state.tasks.find((t) => t.id === id);
      if (task) {
        openModal(task);
      }
    });
  });

  // 5. Nút Xóa trên bảng
  const deleteBtns = containerEl.querySelectorAll("[data-delete-task-id]");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-delete-task-id");
      const ok = window.confirm("Bạn có chắc chắn muốn xóa công việc này?");
      if (ok) {
        await removeTask(id);
      }
    });
  });
}
