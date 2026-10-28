import { state } from "../../app/state.js";
import { escapeHtml as e } from "../../shared/utils/validation.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { fetchExamsFromApi } from "../exams/exams.service.js";
import { aiRequest, studyData, todayVN, readDraft, writeDraft } from "./ai-study.service.js";

export async function mountExamPlan(container) {
  let preview = null, busy = false;
  const seed = readDraft('ai-exam-seed', null); writeDraft('ai-exam-seed', null);
  container.innerHTML = `<div class="ai-study-page"><header><span class="eyebrow">Kế hoạch ôn thi</span><h1>AI lập lộ trình ôn thi</h1><p class="muted">Dựa trên lịch thi, ghi chú khó và kết quả kiểm tra. Xem và chỉnh đề xuất, sau đó xác nhận để lưu giai đoạn ôn tập và các buổi học vào lịch.</p></header>
    <section class="ai-study-card"><form id="examAiGenerate"><label>Kỳ thi<select name="examId" id="examAiSelect" required><option value="">Đang tải lịch thi…</option></select></label>
      <div class="ai-study-row"><button class="button primary" type="submit">AI tạo kế hoạch</button><button class="button secondary" id="examAiBack" type="button">Về lịch thi</button></div></form></section>
    <p id="examAiStatus" class="ai-study-status" role="status" aria-live="polite"></p><section id="examAiPreview" class="ai-study-card" hidden></section></div>`;
  const status = (text, error = false) => { const el = container.querySelector('#examAiStatus'); if (el) { el.textContent = text; el.dataset.error = String(error); } };
  const render = () => {
    const host = container.querySelector('#examAiPreview'); if (!host || !preview) return;
    host.hidden = false;
    host.innerHTML = `<h2>Kiểm tra đề xuất trước khi lưu</h2><p class="muted">Sửa tiêu đề, mục tiêu, ngày hoặc giờ; bỏ chọn buổi học không muốn thêm.</p>
      <form id="examAiConfirm"><div class="ai-study-stack">${preview.phases.map((p, i) => `<fieldset class="ai-study-phase" data-phase="${i}"><legend>Giai đoạn ${i + 1} · ${e(p.subject)}</legend>
        <label>Tên giai đoạn<input name="phaseTitle${i}" value="${e(p.title)}" maxlength="180" required></label><label>Mục tiêu<textarea name="phaseTarget${i}" rows="2" maxlength="1000">${e(p.target || '')}</textarea></label>
        <div class="ai-study-row"><label>Từ ngày<input type="date" name="phaseStart${i}" value="${e(p.startDate)}" min="${todayVN()}" required></label><label>Đến ngày<input type="date" name="phaseEnd${i}" value="${e(p.endDate)}" min="${todayVN()}" required></label></div></fieldset>`).join('')}
        <h3>Buổi ôn tập thêm vào lịch</h3>${preview.sessions.length ? preview.sessions.map((s, i) => `<fieldset class="ai-study-phase" data-session="${i}">
          <label><span><input type="checkbox" name="sessionUse${i}" checked> Thêm buổi ôn ${i + 1}</span></label><label>Nội dung<input name="sessionTitle${i}" value="${e(s.title)}" maxlength="180" required></label>
          <div class="ai-study-row"><label>Ngày<input type="date" name="sessionDate${i}" value="${e(s.date)}" min="${todayVN()}" required></label><label>Bắt đầu<input type="time" name="sessionStart${i}" value="${e(s.start)}" required></label><label>Kết thúc<input type="time" name="sessionEnd${i}" value="${e(s.end)}" required></label></div></fieldset>`).join('') : '<p class="muted">AI chưa đề xuất buổi học phù hợp trong 31 ngày tới. Bạn vẫn có thể lưu các giai đoạn và xếp buổi học tại Lịch học.</p>'}
        <label><span><input type="checkbox" name="confirmed" required> Tôi đã kiểm tra và đồng ý lưu kế hoạch này.</span></label>
        <button type="submit" class="button primary">Xác nhận và lưu kế hoạch</button></div></form>`;
    host.querySelector('#examAiConfirm').addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      const form = event.currentTarget, fd = new FormData(form);
      const body = { requestId: preview.requestId, confirmed: fd.has('confirmed'),
        phases: preview.phases.map((p, i) => ({ ...p, title: fd.get(`phaseTitle${i}`), target: fd.get(`phaseTarget${i}`), startDate: fd.get(`phaseStart${i}`), endDate: fd.get(`phaseEnd${i}`) })),
        sessions: preview.sessions.flatMap((s, i) => fd.has(`sessionUse${i}`) ? [{ ...s, title: fd.get(`sessionTitle${i}`), date: fd.get(`sessionDate${i}`), start: fd.get(`sessionStart${i}`), end: fd.get(`sessionEnd${i}`) }] : []) };
      // Keep the same id and payload after a network failure, making a retry safe.
      const payload = JSON.stringify({ phases: body.phases, sessions: body.sessions });
      if (preview.lastPayload && preview.lastPayload !== payload) body.requestId = preview.requestId = crypto.randomUUID();
      preview.lastPayload = payload;
      busy = true; form.querySelectorAll('fieldset,button').forEach(el => { el.disabled = true; }); status('Đang kiểm tra xung đột và lưu kế hoạch…');
      try { await aiRequest('POST', '/exam-plan/confirm', body); status('Đã lưu giai đoạn ôn tập và các buổi học. Mở Lịch thi hoặc Lịch học để xem.');
        host.innerHTML = '<h2>Kế hoạch đã được lưu</h2><p>Các giai đoạn và buổi học đã được lưu trong cơ sở dữ liệu.</p><button id="examAiSavedBack" class="button secondary">Xem lịch thi và lộ trình</button>';
        host.querySelector('#examAiSavedBack').addEventListener('click', () => changeCurrentTabRoute('exams'));
      } catch (error) { status(error.message, true); form.querySelectorAll('fieldset,button').forEach(el => { el.disabled = false; }); }
      finally { busy = false; }
    });
  };
  container.querySelector('#examAiBack').addEventListener('click', () => changeCurrentTabRoute('exams'));
  container.querySelector('#examAiGenerate').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (preview && !window.confirm('Tạo đề xuất mới? Các chỉnh sửa trong đề xuất hiện tại sẽ được thay thế.')) return;
    const form = event.currentTarget; busy = true; form.querySelector('button[type=submit]').disabled = true; status('AI đang tạo lộ trình ôn thi…');
    try { const result = await aiRequest('POST', '/exam-plan', { examId: form.elements.examId.value, studyData: studyData() });
      if (!result.phases.length) throw new Error('AI chưa đề xuất giai đoạn hợp lệ. Hãy thử tạo lại.');
      preview = { ...result, sessions: result.sessions || [], requestId: crypto.randomUUID() }; render(); status('Đây là bản xem trước. Kế hoạch sẽ được lưu khi bạn xác nhận.'); }
    catch (error) { status(error.message, true); } finally { busy = false; form.querySelector('button[type=submit]').disabled = false; }
  });
  try {
    await fetchExamsFromApi(); if (!container.isConnected) return;
    const exams = state.exams.filter(exam => exam.date >= todayVN() && exam.examId);
    const select = container.querySelector('#examAiSelect');
    select.innerHTML = exams.length ? exams.map(exam => `<option value="${e(exam.examId)}">${e(exam.subject)} · ${e(exam.date)}</option>`).join('') : '<option value="">Chưa có kỳ thi sắp tới. Hãy thêm hoặc đồng bộ lịch thi.</option>';
    if (seed && exams.some(exam => String(exam.examId) === String(seed))) select.value = String(seed);
    container.querySelector('#examAiGenerate button[type=submit]').disabled = !exams.length;
  } catch (error) { status(error.message, true); }
}
