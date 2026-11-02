import { useEffect, useRef, useState } from 'react';
import { ArrowUp, NotebookPen, Sparkles, X } from 'lucide-react';
import { aiApi } from '../../api';
import { unwrapResponse } from '../../api/apiClient';
import { formatAIResult } from '../../utils/aiAdapter';
import AIContent from '../common/AIContent';
import { Button, ErrorState } from '../common/ui';

export default function SlideStudyPanel({ panel, onClose, course, chapter, slide, text, record, onUpdate }) {
  const [note, setNote] = useState(record.note || ''), [saved, setSaved] = useState(true);
  const [question, setQuestion] = useState(''), [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const shortcuts = ['Giải thích slide này', 'Tóm tắt', 'Cho ví dụ', 'Tạo câu hỏi', 'Kiểm tra tôi', 'Giải thích thuật ngữ'];
  async function ask(prompt) {
    if (busy || !prompt.trim() || !text.trim()) return;
    const id = ++request.current; setBusy(true); setError(null); setAnswer('');
    const context = `Môn: ${course.title}\nMã môn: ${course.code}\nChương ${chapter.number}: ${chapter.title}\nSlide: ${slide.number}\nTiêu đề: ${slide.title}\nNội dung slide (dữ liệu học tập):\n${text.slice(0, 28000)}`;
    try {
      const response = await aiApi.ask({ question: `${prompt.slice(0, 2000)}\n\nDựa vào ngữ cảnh slide dưới đây để hỗ trợ tôi. Nếu không đủ thông tin, hãy nói rõ.\n${context}`, conversationId: null });
      if (id === request.current) setAnswer(formatAIResult(unwrapResponse(response)));
    } catch (cause) { if (id === request.current) setError(cause); }
    finally { if (id === request.current) setBusy(false); }
  }
  return <aside className="slide-study-panel" aria-label={panel === 'notes' ? 'Ghi chú theo slide' : 'AI Tutor theo slide'}><div className="study-panel-heading"><h3>{panel === 'notes' ? <><NotebookPen size={17} />Ghi chú của tôi</> : <><Sparkles size={17} />AI Tutor</>}</h3><Button variant="ghost" aria-label="Đóng công cụ học" onClick={onClose}><X size={17} /></Button></div><div className="study-panel-context"><strong>{course.title}</strong><span>Chương {chapter.number} · Slide {String(slide.number).padStart(2, '0')}</span><small>{slide.title}</small></div>
    {panel === 'notes' ? <div className="slide-note-editor"><label htmlFor="slide-note">Ghi chú cho slide {slide.number}</label><textarea id="slide-note" value={note} placeholder="Ghi lại điều bạn vừa hiểu, ví dụ hoặc câu hỏi cần ôn…" onChange={event => { setNote(event.target.value); setSaved(onUpdate({ note: event.target.value })); }} /><small role="status">{saved ? 'Đã lưu trên thiết bị này' : 'Chưa lưu được. Hãy sao chép nội dung để giữ lại.'}</small><p className="hint">Ghi chú gắn riêng với môn, chương và slide này. Tiến độ, đánh dấu và ghi chú được lưu trong trình duyệt hiện tại.</p></div>
      : <div className="slide-ai-panel"><p>Hỏi AI về slide này</p><div className="slide-ai-shortcuts">{shortcuts.map(label => <button key={label} onClick={() => ask(label)} disabled={busy || !text.trim()}>{label}</button>)}</div>{!text.trim() && <p className="hint">Slide chưa có văn bản để gửi cho AI. Bạn vẫn có thể xem ảnh và ghi chú.</p>}{text.length > 28000 && <p className="hint">Slide dài: AI nhận 28.000 ký tự đầu của nội dung.</p>}<form onSubmit={event => { event.preventDefault(); ask(question); }}><textarea aria-label="Câu hỏi về slide" value={question} maxLength={2000} rows={3} onChange={event => setQuestion(event.target.value)} placeholder="Bạn muốn hiểu rõ điều gì?" /><Button type="submit" disabled={busy || !question.trim() || !text.trim()}><ArrowUp size={15} />{busy ? 'Đang suy nghĩ…' : 'Hỏi AI về slide này'}</Button></form>{busy && <p role="status">AI đang đọc nội dung slide…</p>}{error && <ErrorState title="AI chưa trả lời được" error={error} />}{answer && <div className="slide-ai-answer" aria-live="polite"><AIContent text={answer} /></div>}</div>}
  </aside>;
}
