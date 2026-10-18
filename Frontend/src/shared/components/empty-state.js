/**
 * UniStudy CMC - Empty State Shared Component
 */
export function renderEmptyState({ icon = "i-folder", title, description, actionText = "", actionDataAttr = "", foxImage = "" }) {
  return `
    <div class="empty-state-box">
      ${
        foxImage
          ? `<div style="max-width:140px;margin-bottom:14px;"><img src="${foxImage}" alt="Minh họa rỗng" /></div>`
          : `<div class="empty-state-icon"><svg><use href="#${icon}"></use></svg></div>`
      }
      <h3>${title}</h3>
      <p>${description}</p>
      ${
        actionText
          ? `<button type="button" class="button primary" ${actionDataAttr}>${actionText}</button>`
          : ""
      }
    </div>
  `;
}
