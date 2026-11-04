import { useEffect, useRef, useState } from 'react';
import { aiApi, taskApi } from '../../api';
import { unwrapResponse } from '../../api/apiClient';
import { Button, Field, ErrorState } from '../common/ui';

export default function TaskAISteps({ task, onSaved }) {
  const [steps, setSteps] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const version = useRef(0), controller = useRef(null);
  useEffect(() => { version.current++; setSteps([]); setError(null); setBusy(false); return () => { version.current++; controller.current?.abort(); }; }, [task.id, task.title, task.description, task.deadline]);
  const change = (index, key, value) => setSteps(rows => rows.map((step, i) => i === index ? { ...step, [key]: value } : step));
  async function suggest() {
    const request = ++version.current; setBusy(true); setError(null); setSteps([]);
    controller.current = new AbortController();
    try {
      const data = unwrapResponse(await aiApi.pomodoroGoals({ kind: 'task', goal: task.title.slice(0, 300), taskId: String(task.id), taskSource: 'PERSONAL', durationMinutes: 240 }, { signal: controller.current.signal }));
      if (!Array.isArray(data?.steps) || !data.steps.length || data.steps.length > 5 || data.steps.some(step =>
        typeof step?.title !== 'string' || !step.title.trim() || step.title.length > 180 || typeof step.doneWhen !== 'string' || !step.doneWhen.trim() || step.doneWhen.length > 250 || !Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > 480)) throw new Error('AI chưa trả các bước hợp lệ. Bạn vẫn có thể thêm checklist thủ công.');
      if (request === version.current) setSteps(data.steps);
    } catch (err) { if (request === version.current) setError(err); }
    finally { if (request === version.current) setBusy(false); }
  }
  return <section className="stack" aria-label="AI chia nhỏ công việc"><Button variant="outline" disabled={busy} onClick={suggest}>{busy ? 'Đang chia nhỏ…' : 'AI chia nhỏ công việc'}</Button>
    {error && <ErrorState error={error} title="Chưa lấy được gợi ý. Có thể thêm bước thủ công bên dưới." />}
    {steps.length > 0 && <fieldset className="stack" disabled={busy} style={{ border: 0, padding: 0 }}><p className="hint">Bản nháp từ tên, mô tả và deadline. Sửa từng bước rồi xác nhận để thêm vào checklist.</p>{steps.map((step, index) => <div className="stack schedule-note" key={index}>
      <Field label={`Bước ${index + 1}`} value={step.title} maxLength={180} onChange={e => change(index, 'title', e.target.value)} />
      <Field label={`Đầu ra bước ${index + 1}`} value={step.doneWhen} maxLength={250} onChange={e => change(index, 'doneWhen', e.target.value)} />
      <Field label={`Thời lượng bước ${index + 1} (phút)`} type="number" min="1" max="480" value={step.minutes} onChange={e => change(index, 'minutes', Number(e.target.value))} />
      <Button variant="ghost" onClick={() => setSteps(rows => rows.filter((_, i) => i !== index))}>Bỏ bước {index + 1}</Button>
    </div>)}<div className="actions"><Button disabled={busy} onClick={async () => {
      if (steps.some(s => !s.title.trim() || !s.doneWhen.trim() || !Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 480)) { setError(new Error('Mỗi bước cần tên, đầu ra và thời lượng 1–480 phút.')); return; }
      setBusy(true); setError(null);
      try { await taskApi.createChecklist(task.id, { steps }); setSteps([]); await onSaved(); }
      catch (err) { setError(err); } finally { setBusy(false); }
    }}>Xác nhận thêm các bước</Button><Button variant="outline" disabled={busy} onClick={() => setSteps([])}>Bỏ gợi ý</Button></div></fieldset>}
  </section>;
}
