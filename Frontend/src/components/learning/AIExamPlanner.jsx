import { useEffect, useRef, useState } from 'react';
import { aiApi } from '../../api';
import { unwrapResponse } from '../../api/apiClient';
import { nextPlanningMinute, assertFutureDateTime } from '../../utils/planning';
import { minutes } from '../../utils/date';
import { Button, Field, ErrorState } from '../common/ui';

export default function AIExamPlanner({ exam, onSaved }) {
  const [content, setContent] = useState(''), [draft, setDraft] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const version = useRef(0), requestId = useRef(crypto.randomUUID());
  useEffect(() => { version.current++; setDraft(null); setError(null); setBusy(false); return () => { version.current++; }; }, [exam.id, exam.examDate, exam.startTime]);
  function invalidate() { version.current++; setDraft(null); setBusy(false); setError(null); }
  async function generate() {
    const request = ++version.current; setBusy(true); setError(null); setDraft(null);
    try {
      const data = unwrapResponse(await aiApi.examPlan({ examId: exam.id, content }));
      if (!Array.isArray(data?.sessions) || !Array.isArray(data?.phases)) throw new Error('AI chưa trả kế hoạch hợp lệ. Có thể lập kế hoạch thủ công bên dưới.');
      if (request === version.current) { requestId.current = crypto.randomUUID(); setDraft(data); }
    } catch (err) { if (request === version.current) setError(err); }
    finally { if (request === version.current) setBusy(false); }
  }
  function change(i, key, value) { requestId.current = crypto.randomUUID(); setDraft(d => ({ ...d, sessions: d.sessions.map((s, index) => index === i ? { ...s, [key]: value } : s) })); }
  return <section className="stack" aria-label="AI chia buổi ôn thi">
    <Field label="Nội dung cần chia buổi"><textarea disabled={busy} maxLength={8000} value={content} onChange={e => { invalidate(); setContent(e.target.value); }} placeholder="Chương, chủ đề, bài tập cần ôn…" /></Field>
    <Button variant="outline" disabled={busy || !content.trim()} onClick={generate}>{busy ? 'Đang chia buổi ôn…' : 'AI chia buổi ôn thi'}</Button>
    {error && <ErrorState title="Chưa lập được lịch AI. Bạn vẫn có thể lập kế hoạch thủ công." error={error} />}
    {draft && <fieldset className="stack" disabled={busy} style={{ border: 0, padding: 0 }}><p className="hint">Bản nháp chưa lưu. Kiểm tra mục tiêu, thời lượng và bài tự kiểm tra trước khi xác nhận.</p>
      {draft.rejected?.length > 0 && <p role="status">Đã loại {draft.rejected.length} buổi không hợp lệ.</p>}
      {draft.phases.map((p, i) => <div key={i} className="schedule-note"><Field label={`Giai đoạn ${i + 1}`} value={p.title} maxLength={180} onChange={e => { requestId.current = crypto.randomUUID(); setDraft(d => ({ ...d, phases: d.phases.map((phase, index) => index === i ? { ...phase, title: e.target.value } : phase) })); }} /><p>{p.startDate} → {p.endDate} · {p.target}</p></div>)}
      {draft.sessions.map((s, i) => <div className="stack schedule-note" key={i}>
        <Field label={`Buổi ${i + 1}`} value={s.title} maxLength={180} onChange={e => change(i, 'title', e.target.value)} />
        <Field label={`Mục tiêu buổi ${i + 1}`} value={s.objective || ''} maxLength={500} onChange={e => change(i, 'objective', e.target.value)} />
        <div className="form-grid"><Field label={`Ngày buổi ${i + 1}`} type="date" min={nextPlanningMinute().slice(0, 10)} max={exam.examDate.slice(0, 10)} value={s.date} onChange={e => change(i, 'date', e.target.value)} /><Field label={`Bắt đầu buổi ${i + 1}`} type="time" value={s.start} onChange={e => change(i, 'start', e.target.value)} /><Field label={`Kết thúc buổi ${i + 1}`} type="time" value={s.end} onChange={e => change(i, 'end', e.target.value)} /></div>
        <p className="hint">Thời lượng: {minutes(s.end) - minutes(s.start)} phút</p>
        <Field label={`Tự kiểm tra buổi ${i + 1}`}><textarea value={s.selfTest || ''} maxLength={1000} onChange={e => change(i, 'selfTest', e.target.value)} /></Field>
        <Button variant="ghost" onClick={() => { requestId.current = crypto.randomUUID(); setDraft(d => ({ ...d, sessions: d.sessions.filter((_, index) => index !== i) })); }}>Bỏ buổi {i + 1}</Button>
      </div>)}
      {!draft.sessions.length && <p role="status">Chưa có buổi ôn hợp lệ trong giờ trống trước kỳ thi. Có thể bổ sung lịch thủ công hoặc điều chỉnh nội dung để thử lại.</p>}
      <Button disabled={busy || !draft.sessions.length || !draft.phases.length} onClick={async () => {
        setBusy(true); setError(null);
        try {
          for (const s of draft.sessions) {
            assertFutureDateTime(`${s.date}T${s.start}`, 'Giờ bắt đầu ôn');
            if (!s.title.trim() || !s.objective?.trim() || !s.selfTest?.trim()) throw new Error('Mỗi buổi cần tên, mục tiêu và bài tự kiểm tra.');
            if (s.date > exam.examDate.slice(0, 10) || s.date === exam.examDate.slice(0, 10) && s.end > exam.startTime.slice(0, 5)) throw new Error('Buổi ôn phải kết thúc trước giờ thi.');
            if (minutes(s.end) - minutes(s.start) < 30 || minutes(s.end) - minutes(s.start) > 240) throw new Error('Mỗi buổi cần dài 30–240 phút.');
          }
          const result = unwrapResponse(await aiApi.confirmExamPlan({ confirmed: true, requestId: requestId.current, phases: draft.phases, sessions: draft.sessions }));
          if (result?.persisted !== true) throw new Error('Máy chủ chưa xác nhận đã lưu lịch. Hãy kiểm tra lại.');
          await onSaved(); window.dispatchEvent(new Event('workspace-updated'));
        } catch (err) { setError(err); } finally { setBusy(false); }
      }}>Xác nhận lưu các buổi ôn</Button>
    </fieldset>}
    <p className="hint">Hoặc nhập kế hoạch thủ công bên dưới.</p>
  </section>;
}
