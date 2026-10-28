import { getSchoolEmails, syncSchoolEmails, readSchoolEmailOnServer, processSchoolEmailOnServer, refreshSchoolEmail } from "./school-email.service.js";
import { renderEmailDetailModal } from "./school-email.view.js";
import { attachModalEvents } from "../../shared/components/modal.js";

export function attachSchoolEmailEvents(containerEl, uiState, render) {
  const safe = fn => async (...args) => { try { await fn(...args); } catch (error) { alert(error.message); } };
  containerEl.querySelectorAll('[data-email-filter]').forEach(button => button.addEventListener('click', () => {
    uiState.filter = button.getAttribute('data-email-filter'); render();
  }));
  let timer;
  containerEl.querySelector('#emailSearchInput')?.addEventListener('input', event => {
    const value = event.target.value; clearTimeout(timer);
    timer = setTimeout(() => { uiState.searchQuery = value; render(); }, 250);
  });
  for (const [selector, connect] of [['#connectOutlookBtn', true], ['#syncEmailNowBtn', false], ['#emptyCheckEmailBtn', true]]) {
    containerEl.querySelector(selector)?.addEventListener('click', safe(async () => {
      const pending = syncSchoolEmails(connect); render();
      try { await pending; } finally { render(); }
    }));
  }
  for (const [attribute, kind] of [['data-add-deadline-task', 'task'], ['data-add-exam-plan', 'exam']]) {
    containerEl.querySelectorAll(`[${attribute}]`).forEach(button => button.addEventListener('click', safe(async () => {
      button.disabled = true;
      try { await processSchoolEmailOnServer(button.getAttribute(attribute), kind); render(); }
      finally { button.disabled = false; }
    })));
  }
  containerEl.querySelectorAll('[data-read-mail-detail]').forEach(button => button.addEventListener('click', safe(async () => {
    const id = button.getAttribute('data-read-mail-detail');
    await readSchoolEmailOnServer(id);
    const mail = getSchoolEmails().find(item => item.id === id);
    const host = containerEl.querySelector('#schoolEmailModalContainer');
    if (!mail || !host) return;
    host.innerHTML = renderEmailDetailModal(mail);
    const modal = host.querySelector('#emailDetailModal');
    const close = () => { host.innerHTML = ''; render(); };
    attachModalEvents(modal, close);
    modal.querySelector('[data-refresh-mail]')?.addEventListener('click', safe(async () => { await refreshSchoolEmail(id); close(); }));
  })));
}
