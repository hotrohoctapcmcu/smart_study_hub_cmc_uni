import { escapeHtml as e } from "../../shared/utils/validation.js";
import { workspaceFileUrl } from "../../shared/services/workspace-api.js";
import { aiRequest, todayVN, readDraft, writeDraft, downloadText } from "./ai-study.service.js";

export async function mountLeaveLetter(container) {
  let activeId = null, matched = null, busy = false;
  const cached = readDraft('ai-leave-editor', {});
  container.innerHTML = `<div class="ai-study-page"><header><span class="eyebrow">Hỗ trợ viết đơn</span><h1>Đơn xin phép nghỉ học</h1>
    <p class="muted">AI đối chiếu lịch học theo ngày nghỉ và soạn đơn từ hồ sơ, lý do bạn cung cấp. Kiểm tra và chỉnh sửa nội dung trước khi sử dụng.</p></header>
    <div class="ai-study-grid"><main class="ai-study-stack"><section class="ai-study-card"><h2>Thông tin xin nghỉ</h2>
      <form id="leaveGenerateForm"><fieldset class="ai-study-fields">
        <div class="ai-study-row"><label>Ngày nghỉ<input type="date" name="date" value="${e(cached.fields?.date || todayVN())}" required></label><label>Môn học (tùy chọn)<input name="subject" maxlength="120" value="${e(cached.fields?.subject || '')}"></label></div>
        <div class="ai-study-row"><label>Buổi / tiết (tùy chọn)<input name="session" maxlength="120" value="${e(cached.fields?.session || '')}"></label><label>Người nhận (tùy chọn)<input name="recipient" maxlength="180" value="${e(cached.fields?.recipient || '')}" placeholder="Giảng viên hoặc phòng đào tạo"></label></div>
        <label>Lý do xin nghỉ<textarea name="reason" rows="3" maxlength="1000" required>${e(cached.fields?.reason || '')}</textarea></label>
        <button class="button primary" type="submit">AI soạn đơn</button>
      </fieldset></form></section><p id="leaveStatus" class="ai-study-status" role="status" aria-live="polite"></p>
      <section class="ai-study-card"><h2>Xem và chỉnh sửa bản nháp</h2><p id="leaveMatch" class="muted small"></p>
        <label>Nội dung đơn<textarea id="leaveContent" rows="20" maxlength="20000" placeholder="Nội dung sẽ xuất hiện sau khi soạn; bạn cũng có thể tự nhập đơn.">${e(cached.content || '')}</textarea></label>
        <div class="ai-study-row" style="margin-top:16px"><button id="leaveSave" class="button primary">Lưu bản nháp</button><button id="leaveCopy" class="button secondary">Sao chép</button>
        <button id="leaveTxt" class="button secondary">Tải TXT</button><button id="leaveDocx" class="button secondary">Tải Word</button></div>
      </section></main><aside class="ai-study-card"><h2>Bản nháp đã lưu</h2><div id="leaveHistory" class="ai-study-history">Đang tải…</div><button id="leaveNew" class="button ghost" style="margin-top:12px">Tạo bản nháp mới</button></aside></div></div>`;
  activeId = cached.id || null;
  const form = container.querySelector('#leaveGenerateForm'), content = container.querySelector('#leaveContent');
  const fields = () => Object.fromEntries(new FormData(form));
  const status = (text, error = false) => { const el = container.querySelector('#leaveStatus'); if (el) { el.textContent = text; el.dataset.error = String(error); } };
  const cache = () => writeDraft('ai-leave-editor', { id: activeId, fields: fields(), content: content.value });
  const requireContent = () => { if (!content.value.trim()) throw new Error('Hãy soạn hoặc nhập nội dung đơn trước.'); return content.value; };
  const save = async () => {
    requireContent(); if (!form.reportValidity()) throw new Error('Hãy nhập ngày nghỉ và lý do hợp lệ.');
    const result = await aiRequest(activeId ? 'PUT' : 'POST', `/leave-drafts${activeId ? `/${encodeURIComponent(activeId)}` : ''}`, { fields: fields(), content: content.value });
    activeId = result.id; cache(); await history(); return result;
  };
  async function history() {
    const drafts = await aiRequest('GET', '/leave-drafts'); const host = container.querySelector('#leaveHistory'); if (!host) return;
    host.innerHTML = drafts.length ? drafts.map((d, i) => `<button class="button ghost" data-draft="${i}">${e(d.fields.date)} · ${e(d.fields.subject || 'Đơn nghỉ học')}<br>${e(d.fields.reason.slice(0, 70))}</button>`).join('') : '<p class="muted">Chưa lưu bản nháp nào.</p>';
    host.querySelectorAll('[data-draft]').forEach(button => button.addEventListener('click', () => {
      if (busy) return;
      if (content.value.trim() && !window.confirm('Mở bản nháp đã lưu? Các chỉnh sửa hiện tại chưa lưu sẽ được thay bằng bản đã chọn.')) return;
      const draft = drafts[Number(button.dataset.draft)]; activeId = draft.id;
      Object.entries(draft.fields).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value || ''; });
      content.value = draft.content; container.querySelector('#leaveMatch').textContent = ''; cache(); status('Đã mở bản nháp.');
    }));
  }
  const action = (selector, fn) => container.querySelector(selector).addEventListener('click', async event => {
    if (busy) return; busy = true; const button = event.currentTarget; button.disabled = true;
    try { await fn(); } catch (error) { status(error.message, true); } finally { busy = false; button.disabled = false; }
  });
  form.addEventListener('input', cache); content.addEventListener('input', cache);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (content.value.trim() && !window.confirm('Soạn lại nội dung đơn bằng AI? Nội dung đang chỉnh sẽ được thay bằng bản mới.')) return;
    const body = fields(), fieldset = form.querySelector('fieldset'); busy = true; fieldset.disabled = true; content.disabled = true; status('AI đang soạn đơn…');
    try { const result = await aiRequest('POST', '/draft-leave', body); activeId = null; content.value = result.draft; matched = result.matchedClasses;
      container.querySelector('#leaveMatch').textContent = matched ? `Có ${matched} lớp khớp ngày và môn đã chọn.` : 'Không tìm thấy lớp khớp lịch. Hãy kiểm tra môn, ngày và bổ sung thông tin còn trống.';
      fieldset.disabled = false; cache(); status('Đã soạn xong. Bạn có thể sửa nội dung rồi lưu bản nháp.'); }
    catch (error) { status(error.message, true); } finally { busy = false; fieldset.disabled = false; content.disabled = false; }
  });
  action('#leaveSave', async () => { await save(); status('Đã lưu bản nháp.'); });
  action('#leaveCopy', async () => { await navigator.clipboard.writeText(requireContent()); status('Đã sao chép nội dung đơn.'); });
  action('#leaveTxt', () => { downloadText(requireContent(), 'don-xin-nghi-hoc.txt'); status('Đã tạo tệp TXT.'); });
  action('#leaveDocx', async () => { const saved = await save(); const link = document.createElement('a');
    link.href = workspaceFileUrl(`/ai/leave-drafts/${encodeURIComponent(saved.id)}/docx`); link.download = 'don-xin-nghi-hoc.docx'; link.click(); status('Đã lưu và tạo tệp Word.'); });
  action('#leaveNew', () => { if (content.value.trim() && !window.confirm('Tạo bản nháp mới? Hãy lưu các chỉnh sửa cần giữ trước khi tiếp tục.')) return;
    activeId = null; content.value = ''; form.reset(); container.querySelector('#leaveMatch').textContent = ''; cache(); status('Bản nháp mới.'); });
  try { await history(); } catch (error) { status(error.message, true); container.querySelector('#leaveHistory').textContent = 'Chưa tải được bản nháp.'; }
}
