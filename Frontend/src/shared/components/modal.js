/**
 * UniStudy CMC - Modal Component
 * Quản lý dialog nền mờ, ESC key, click backdrop để đóng, focus trap
 */

let activeModals = [];

/**
 * Đăng ký sự kiện phím ESC toàn cục cho modal
 */
function handleGlobalKeydown(e) {
  if (e.key === "Escape" && activeModals.length > 0) {
    const topModal = activeModals[activeModals.length - 1];
    if (typeof topModal.onClose === "function") {
      topModal.onClose();
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", handleGlobalKeydown);
}

/**
 * Render modal wrapper HTML
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.title
 * @param {string} props.bodyHtml
 * @param {string} [props.footerHtml]
 * @param {string} [props.customClass]
 * @returns {string}
 */
export function renderModal({ id, title, bodyHtml, footerHtml = "", customClass = "" }) {
  return `
    <div class="modal-backdrop ${customClass}" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="${id}-title">${title}</h3>
          <button class="icon-button modal-close-btn" type="button" data-close-modal="${id}" aria-label="Đóng cửa sổ">
            <svg><use href="#i-close"></use></svg>
          </button>
        </div>
        <div class="modal-body">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
      </div>
    </div>
  `;
}

/**
 * Gắn listener cho modal
 */
export function attachModalEvents(modalEl, onClose) {
  if (!modalEl) return;

  // Khóa cuộn trang
  document.body.style.overflow = "hidden";

  const safeClose = () => {
    document.body.style.overflow = "";
    activeModals = activeModals.filter((m) => m !== modalEntry);
    onClose();
  };

  const modalEntry = { el: modalEl, onClose: safeClose };
  activeModals.push(modalEntry);

  const closeBtns = modalEl.querySelectorAll("[data-close-modal]");
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      safeClose();
    });
  });

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      safeClose();
    }
  });

  // Tự động focus vào nút đóng để bẫy focus
  const closeBtn = modalEl.querySelector(".modal-close-btn");
  if (closeBtn) {
    setTimeout(() => closeBtn.focus(), 50);
  }

  return () => {
    document.body.style.overflow = "";
    activeModals = activeModals.filter((m) => m !== modalEntry);
  };
}
