/**
 * UniStudy CMC - Study Planner Events
 * Xử lý sự kiện: phân tích & đề xuất kế hoạch, xem chi tiết, sửa, xóa và điều hướng
 */
import { changeCurrentTabRoute } from "../../app/workspace.js";
import {
  generateAIStudySchedule,
  confirmStudyPlan,
  getStudyPlans,
  getStudyPlanById,
  updateStudyPlan,
  deleteStudyPlan,
  FREE_SLOT_OPTIONS
} from "./study-planner.service.js";
import {
  renderPlansListOrEmpty,
  renderPlanDetailModal,
  renderPlanEditModal
} from "./study-planner.view.js";

export function attachStudyPlannerEvents(containerEl) {
  const form = containerEl.querySelector("#studyPlannerForm");
  const alertBox = containerEl.querySelector("#plannerAlertBox");
  const submitBtn = containerEl.querySelector("#generatePlanBtn");
  const btnText = containerEl.querySelector("#generatePlanBtnText");
  const resultBoxContainer = containerEl.querySelector("#aiResultBox");

  // 1. Submit biểu mẫu Phân tích & Đề xuất kế hoạch AI
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const subject = (formData.get("subject") || "").trim();
      const freeSlot = formData.get("freeSlot") || "evening";
      const targetHours = formData.get("targetHours") || "10";

      // Ẩn thông báo lỗi cũ
      if (alertBox) {
        alertBox.style.display = "none";
        alertBox.textContent = "";
      }

      // Trạng thái Loading
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      if (btnText) {
        btnText.textContent = "Đang phân tích & lập kế hoạch...";
      }

      try {
        const result = await generateAIStudySchedule({
          subject,
          freeSlot,
          targetHours
        });

        if (!result.success) {
          // Báo lỗi validation hoặc kết nối
          if (alertBox) {
            alertBox.textContent = result.message || "Vui lòng kiểm tra lại thông tin đã nhập.";
            alertBox.style.display = "block";
          }
        } else {
          // Thành công: cập nhật danh sách kế hoạch
          refreshPlansList(containerEl);
        }
      } catch (err) {
        if (alertBox) {
          alertBox.textContent = "Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.";
          alertBox.style.display = "block";
        }
      } finally {
        // Khôi phục trạng thái nút bấm
        if (submitBtn) {
          submitBtn.disabled = false;
        }
        if (btnText) {
          btnText.textContent = "Phân tích & Đề xuất kế hoạch AI";
        }
      }
    });
  }

  // 2. Gắn sự kiện cho các thành phần động trong danh sách và modal
  attachDynamicPlanEvents(containerEl);
}

/**
 * Cập nhật lại vùng hiển thị danh sách kế hoạch và gắn lại listener
 */
function refreshPlansList(containerEl) {
  const resultBoxContainer = containerEl.querySelector("#aiResultBox");
  if (resultBoxContainer) {
    const plans = getStudyPlans();
    resultBoxContainer.innerHTML = renderPlansListOrEmpty(plans);
    attachDynamicPlanEvents(containerEl);
  }
}

/**
 * Gắn sự kiện cho các nút trong danh sách kế hoạch: xem, sửa, xóa, chuyển sang lịch tự học
 */
function attachDynamicPlanEvents(containerEl) {
  containerEl.querySelectorAll("[data-confirm-plan-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const result = await confirmStudyPlan(btn.getAttribute("data-confirm-plan-id"));
        if (!result.success) {
          const alertBox = containerEl.querySelector("#plannerAlertBox");
          if (alertBox) { alertBox.textContent = result.message; alertBox.style.display = "block"; }
        }
        refreshPlansList(containerEl);
      } finally { btn.disabled = false; }
    });
  });
  // Nút Chuyển sang Xếp lịch tự học thủ công
  const manualScheduleBtns = containerEl.querySelectorAll("#gotoManualScheduleBtn");
  manualScheduleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      changeCurrentTabRoute("schedule");
    });
  });

  // Nút Xem chi tiết kế hoạch
  const viewBtns = containerEl.querySelectorAll("[data-view-plan-id]");
  viewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const planId = btn.getAttribute("data-view-plan-id");
      const plan = getStudyPlanById(planId);
      if (plan) {
        openPlanDetailModal(containerEl, plan);
      }
    });
  });

  // Nút Chỉnh sửa kế hoạch
  const editBtns = containerEl.querySelectorAll("[data-edit-plan-id]");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const planId = btn.getAttribute("data-edit-plan-id");
      const plan = getStudyPlanById(planId);
      if (plan) {
        openPlanEditModal(containerEl, plan);
      }
    });
  });

  // Nút Xóa kế hoạch
  const deleteBtns = containerEl.querySelectorAll("[data-delete-plan-id]");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const planId = btn.getAttribute("data-delete-plan-id");
      const plan = getStudyPlanById(planId);
      if (!plan) return;

      if (confirm(`Bạn có chắc chắn muốn xóa kế hoạch "${plan.title}"?`)) {
        deleteStudyPlan(planId);
        refreshPlansList(containerEl);
      }
    });
  });
}

/**
 * Mở modal Xem chi tiết
 */
function openPlanDetailModal(containerEl, plan) {
  // Đóng modal cũ nếu có
  closeAnyPlanModal();

  const modalWrapper = document.createElement("div");
  modalWrapper.id = "planModalHost";
  modalWrapper.innerHTML = renderPlanDetailModal(plan);
  document.body.appendChild(modalWrapper);

  const closeBtn1 = modalWrapper.querySelector("#closePlanDetailBtn");
  const closeBtn2 = modalWrapper.querySelector("#closePlanDetailBtn2");
  const editBtn = modalWrapper.querySelector("#editPlanFromDetailBtn");
  const backdrop = modalWrapper.querySelector("#planDetailModalBackdrop");

  const closeModal = () => {
    if (modalWrapper.parentNode) {
      modalWrapper.parentNode.removeChild(modalWrapper);
    }
  };

  if (closeBtn1) closeBtn1.addEventListener("click", closeModal);
  if (closeBtn2) closeBtn2.addEventListener("click", closeModal);
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      closeModal();
      openPlanEditModal(containerEl, plan);
    });
  }
}

/**
 * Mở modal Chỉnh sửa kế hoạch
 */
function openPlanEditModal(containerEl, plan) {
  closeAnyPlanModal();

  const modalWrapper = document.createElement("div");
  modalWrapper.id = "planModalHost";
  modalWrapper.innerHTML = renderPlanEditModal(plan);
  document.body.appendChild(modalWrapper);

  const closeBtn = modalWrapper.querySelector("#closePlanEditBtn");
  const cancelBtn = modalWrapper.querySelector("#cancelPlanEditBtn");
  const form = modalWrapper.querySelector("#editPlanForm");
  const backdrop = modalWrapper.querySelector("#planEditModalBackdrop");

  const closeModal = () => {
    if (modalWrapper.parentNode) {
      modalWrapper.parentNode.removeChild(modalWrapper);
    }
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const planId = formData.get("planId");
      const subject = (formData.get("subject") || "").trim();
      const freeSlot = formData.get("freeSlot");
      const targetHours = Number(formData.get("targetHours")) || 10;
      const note = (formData.get("note") || "").trim();

      if (!subject) {
        alert("Vui lòng nhập tên môn học.");
        return;
      }

      const slotDef = FREE_SLOT_OPTIONS[freeSlot] || FREE_SLOT_OPTIONS.evening;

      updateStudyPlan(planId, {
        subject,
        freeSlot,
        freeSlotLabel: slotDef.label,
        targetHours,
        note,
        title: `Lộ trình ôn tập: ${subject}`
      });

      closeModal();
      refreshPlansList(containerEl);
    });
  }
}

function closeAnyPlanModal() {
  const existing = document.getElementById("planModalHost");
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}
