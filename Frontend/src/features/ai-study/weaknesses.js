import { escapeHtml as e } from "../../shared/utils/validation.js";
import { changeCurrentTabRoute } from "../../app/workspace.js";
import { aiRequest, writeDraft } from "./ai-study.service.js";

export async function mountWeaknesses(container) {
  let data = null;
  container.innerHTML = `<div class="ai-study-page"><header><span class="eyebrow">Học từ kết quả thực tế</span><h1>Điểm yếu & nội dung cần ôn</h1>
    <p class="muted">Thống kê theo chủ đề từ các bài Quiz AI đã nộp. Mức cải thiện so sánh hai lần kiểm tra gần nhất của cùng chủ đề.</p></header>
    <div class="ai-study-row"><button id="weaknessAnalyze" class="button primary">AI đề xuất nội dung học</button><button id="weaknessQuiz" class="button secondary">Làm bài kiểm tra</button><button id="weaknessRefresh" class="button ghost">Tải lại kết quả</button></div>
    <p id="weaknessStatus" class="ai-study-status" role="status" aria-live="polite">Đang tải kết quả…</p><div id="weaknessContent" class="ai-study-stack"></div></div>`;
  const status = (text, error = false) => { const el = container.querySelector('#weaknessStatus'); if (el) { el.textContent = text; el.dataset.error = String(error); } };
  const render = () => {
    const host = container.querySelector('#weaknessContent'); if (!host || !data) return;
    container.querySelector('#weaknessAnalyze').disabled = !data.topics.length;
    if (!data.topics.length) { host.innerHTML = '<section class="ai-study-card"><h2>Chưa có kết quả để phân tích</h2><p>Hoàn thành một bài Quiz AI để ghi nhận chủ đề cần ôn. Điểm và mức cải thiện sẽ xuất hiện từ bài làm của bạn.</p></section>'; return; }
    host.innerHTML = `<section class="ai-study-card"><h2>Đã ghi nhận ${data.quizCount} bài kiểm tra</h2><div class="ai-study-table"><table><thead><tr><th>Chủ đề</th><th>Toàn bộ</th><th>Lần gần nhất</th><th>Cải thiện</th><th>Ưu tiên ôn</th></tr></thead><tbody>${data.topics.map(t => `<tr><td>${e(t.subject)}<br><strong>${e(t.topic)}</strong></td><td>${t.correct}/${t.total} câu · ${t.accuracy}%</td><td>${t.latestScore}%</td><td>${t.improvement === null ? 'Cần thêm một lần kiểm tra' : `${t.improvement > 0 ? '+' : ''}${t.improvement} điểm %`}</td><td>${({ high: 'Cao', medium: 'Vừa', low: 'Duy trì' })[t.priority]}</td></tr>`).join('')}</tbody></table></div></section>
      ${data.topics.map((t, i) => { const advice = data.advice.find(a => a.key === t.key); return `<section class="ai-study-card"><h2>${e(t.subject)} · ${e(t.topic)}</h2>
        ${advice ? `<p>${e(advice.recommendation)}</p>${advice.exercise ? `<p class="ai-study-explanation">Bài luyện tập: ${e(advice.exercise)}</p>` : ''}` : '<p class="muted">Bấm “AI đề xuất nội dung học” để nhận hướng dẫn ôn dựa trên kết quả này.</p>'}
        <p class="small muted">${t.attempts.length} lần kiểm tra gần đây · Điểm từng lần: ${t.attempts.map(a => a.score + '%').join(' → ')}</p>
        <button class="button secondary" data-practice="${i}">Luyện lại chủ đề</button>
        ${t.wrong.length ? `<details><summary>Xem các lỗi đã ghi nhận</summary>${t.wrong.map(w => `<p><button class="button ghost small" data-review="${e(w.quizId)}">Xem câu ${e(w.questionId.slice(1))} trong bài đã nộp</button></p>`).join('')}</details>` : ''}</section>`; }).join('')}`;
    host.querySelectorAll('[data-practice]').forEach(button => button.addEventListener('click', () => {
      const topic = data.topics[Number(button.dataset.practice)]; writeDraft('ai-quiz-seed', { subject: topic.subject, topic: topic.topic }); changeCurrentTabRoute('quiz');
    }));
    host.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => { writeDraft('ai-quiz-open', button.dataset.review); changeCurrentTabRoute('quiz'); }));
  };
  const load = async () => { try { data = await aiRequest('GET', '/weaknesses'); render(); status(''); } catch (error) { status(error.message, true); } };
  container.querySelector('#weaknessQuiz').addEventListener('click', () => changeCurrentTabRoute('quiz'));
  container.querySelector('#weaknessRefresh').addEventListener('click', load);
  container.querySelector('#weaknessAnalyze').addEventListener('click', async event => {
    event.currentTarget.disabled = true; status('AI đang phân tích nội dung cần ôn…');
    try { data = await aiRequest('POST', '/weaknesses/analyze', {}); render(); status('Đã lưu đề xuất học tập.'); }
    catch (error) { status(error.message, true); } finally { const button = container.querySelector('#weaknessAnalyze'); if (button) button.disabled = !data?.topics.length; }
  });
  await load();
}
