import { escapeHtml as e } from "../../shared/utils/validation.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { aiRequest, studyData, readDraft, writeDraft } from "./ai-study.service.js";

export async function mountQuiz(container) {
  const seed = readDraft('ai-quiz-seed', {});
  writeDraft('ai-quiz-seed', {});
  let current = null, busy = false;
  container.innerHTML = `<div class="ai-study-page">
    <header><span class="eyebrow">Kiểm tra kiến thức bằng AI</span><h1>Quiz AI</h1><p class="muted">Tạo đề theo môn và chủ đề, nhận giải thích sau khi nộp bài và theo dõi nội dung cần ôn.</p></header>
    <div class="ai-study-grid"><main class="ai-study-stack">
      <section class="ai-study-card"><h2>Tạo bài kiểm tra</h2>
        <form id="quizGenerateForm"><fieldset class="ai-study-fields">
          <div class="ai-study-row"><label>Môn học<input name="subject" maxlength="120" value="${e(seed.subject || '')}" placeholder="Ví dụ: Cơ sở dữ liệu" required></label>
          <label>Chủ đề<input name="topic" maxlength="180" value="${e(seed.topic || '')}" placeholder="Ví dụ: Phép JOIN" required></label></div>
          <div class="ai-study-row"><label>Số câu<input name="count" type="number" min="3" max="15" value="5" required></label>
          <label>Độ khó<select name="difficulty"><option value="easy">Cơ bản</option><option value="medium" selected>Trung bình</option><option value="hard">Nâng cao</option></select></label></div>
          <label>Nội dung ôn tập (tùy chọn)<textarea name="sourceText" rows="4" maxlength="15000" placeholder="Dán nội dung bài học để giới hạn phạm vi câu hỏi"></textarea></label>
          <button class="button primary" type="submit">Tạo đề bằng AI</button>
        </fieldset></form>
      </section><p id="quizStatus" class="ai-study-status" role="status" aria-live="polite"></p>
      <section id="quizCurrent" class="ai-study-card" hidden></section>
    </main><aside class="ai-study-card"><h2>Lịch sử kiểm tra</h2><div id="quizHistory" class="ai-study-history">Đang tải…</div>
      <button id="quizWeaknessBtn" class="button secondary" style="margin-top:16px">Xem điểm yếu</button></aside></div></div>`;
  const status = (text, error = false) => { const el = container.querySelector('#quizStatus'); if (el) { el.textContent = text; el.dataset.error = String(error); } };
  const renderCurrent = () => {
    const host = container.querySelector('#quizCurrent'); if (!host || !current) return;
    host.hidden = false;
    const submitted = current.status === 'submitted';
    const answers = submitted ? current.answers : readDraft(`ai-quiz-${current.id}`, {});
    host.innerHTML = `<h2>${e(current.subject)} · ${e(current.topic)}</h2>
      ${submitted ? `<p class="ai-study-score">${current.result.score}/100</p><p>Đúng ${current.result.correctCount}/${current.result.total} câu. Kết quả đã lưu.</p>` : '<p class="muted">Chọn một đáp án cho mỗi câu. Lựa chọn đang làm được giữ trên thiết bị này.</p>'}
      <form id="quizAnswerForm">${current.questions.map((q, i) => `<fieldset class="ai-study-question"><legend>${i + 1}. ${e(q.question)}</legend>
        <small class="muted">${e(q.topic)}</small>${q.options.map((option, j) => `<label><input type="radio" name="${e(q.id)}" value="${j}" ${answers[q.id] === j ? 'checked' : ''} ${submitted ? 'disabled' : 'required'}>${e(option)}</label>`).join('')}
        ${submitted ? `<p class="ai-study-explanation">${answers[q.id] === q.correctIndex ? '✓ Chính xác' : 'Cần ôn lại'} · Đáp án: ${e(q.options[q.correctIndex])}\n${e(q.explanation)}</p>` : ''}</fieldset>`).join('')}
        ${submitted ? '<button type="button" id="quizResultWeakness" class="button secondary">Phân tích điểm yếu</button>' : '<button type="submit" class="button primary">Nộp bài và xem kết quả</button>'}</form>`;
    const form = host.querySelector('form');
    form.addEventListener('change', () => writeDraft(`ai-quiz-${current.id}`, Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)]))));
    host.querySelector('#quizResultWeakness')?.addEventListener('click', () => changeCurrentTabRoute('weaknesses'));
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (submitted || busy) return;
      const button = form.querySelector('button[type=submit]'); button.disabled = true;
      const answers = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)]));
      busy = true; form.querySelectorAll('fieldset').forEach(el => { el.disabled = true; });
      status('Đang chấm và lưu kết quả…');
      try { current = await aiRequest('POST', `/quizzes/${encodeURIComponent(current.id)}/submit`, { answers }); renderCurrent(); await history(); status('Đã lưu kết quả kiểm tra.'); }
      catch (error) { status(error.message, true); button.disabled = false; form.querySelectorAll('fieldset').forEach(el => { el.disabled = false; }); }
      finally { busy = false; }
    });
  };
  async function history() {
    const items = await aiRequest('GET', '/quizzes');
    const host = container.querySelector('#quizHistory'); if (!host) return;
    host.innerHTML = items.length ? items.map(item => `<button type="button" class="button ghost" data-quiz-id="${e(item.id)}">${e(item.subject)} · ${e(item.topic)}<br>${item.score === null ? 'Chưa nộp' : `${item.score}/100`} · ${item.questionCount} câu</button>`).join('') : '<p class="muted">Chưa có bài kiểm tra. Hãy tạo đề đầu tiên.</p>';
    host.querySelectorAll('[data-quiz-id]').forEach(button => button.addEventListener('click', async () => {
      if (busy) return; busy = true; button.disabled = true;
      try { current = await aiRequest('GET', `/quizzes/${encodeURIComponent(button.dataset.quizId)}`); renderCurrent(); status(''); }
      catch (error) { status(error.message, true); } finally { busy = false; button.disabled = false; }
    }));
  }
  container.querySelector('#quizWeaknessBtn').addEventListener('click', () => changeCurrentTabRoute('weaknesses'));
  container.querySelector('#quizGenerateForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; const form = event.currentTarget, fieldset = form.querySelector('fieldset');
    const body = Object.fromEntries(new FormData(form)); body.count = Number(body.count); body.studyData = studyData();
    busy = true; fieldset.disabled = true; status('AI đang tạo đề, có thể mất một chút thời gian…');
    try { current = await aiRequest('POST', '/quizzes', body); renderCurrent(); await history(); status('Đề đã được lưu. Bạn có thể bắt đầu làm bài.'); }
    catch (error) { status(error.message, true); } finally { busy = false; fieldset.disabled = false; }
  });
  try { await history(); const openId = readDraft('ai-quiz-open', null); writeDraft('ai-quiz-open', null);
    if (openId) { current = await aiRequest('GET', `/quizzes/${encodeURIComponent(openId)}`); renderCurrent(); }
  } catch (error) { status(error.message, true); const host = container.querySelector('#quizHistory'); if (host) host.textContent = 'Chưa tải được lịch sử. Mở lại trang để thử lại.'; }
}
