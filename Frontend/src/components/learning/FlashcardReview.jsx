import { useEffect, useState } from 'react';
import { courseApi } from '../../api';
import { responseList, unwrapResponse } from '../../api/apiClient';
import { useApi } from '../../hooks/useApi';
import { reviewCards } from '../../utils/learningFlow';
import AIContent from '../common/AIContent';
import { ApiContent, Button, Card, EmptyState, useAction } from '../common/ui';

export default function FlashcardReview({ courses, subject = '', topic = '' }) {
  const [deckId, setDeckId] = useState(''), [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false);
  const [until, setUntil] = useState(null), [remaining, setRemaining] = useState(300), [ended, setEnded] = useState(false);
  const { run, busy } = useAction();
  const state = useApi(async () => {
    const available = courses.filter(c => !c.pending);
    const results = await Promise.allSettled(available.map(c => courseApi.detail(c.id)));
    if (results.length && results.every(r => r.status === 'rejected')) throw results[0].reason;
    return { failures: results.filter(r => r.status === 'rejected').length,
      cards: results.flatMap((r, i) => r.status === 'fulfilled' ? responseList(unwrapResponse(r.value)?.cards).map(card => ({ ...card,
        deckId: String(available[i].id), deckTitle: available[i].subject || available[i].subject_name || 'Môn học' })) : []) };
  });
  const allCards = reviewCards(state.data?.cards || [], { subject, topic });
  const cards = allCards.filter(card => !deckId || card.deckId === deckId), card = cards[index % Math.max(cards.length, 1)];
  useEffect(() => {
    if (!until) return;
    const tick = () => { const left = Math.max(0, Math.ceil((until - Date.now()) / 1000)); setRemaining(left); if (!left) { setUntil(null); setEnded(true); } };
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [until]);
  function next() { setIndex(i => (i + 1) % Math.max(cards.length, 1)); setFlipped(false); }
  return <ApiContent state={state}><Card title="Ôn tập flashcard" region="C">
    {state.data?.failures > 0 && <p role="status">Chưa tải được {state.data.failures} bộ thẻ. <button onClick={state.refetch}>Thử lại</button></p>}
    <div className="filter-bar"><div><strong>Chọn bộ thẻ của bạn</strong><p className="hint">{allCards.length} thẻ · Ưu tiên thẻ đến hạn, sau đó thẻ từng quên.</p></div>
      <select aria-label="Bộ flashcard" disabled={busy} value={deckId} onChange={e => { setDeckId(e.target.value); setIndex(0); setFlipped(false); setUntil(null); setEnded(false); }}><option value="">Tất cả môn học</option>{[...new Map(allCards.map(c => [c.deckId, c.deckTitle]))].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
    </div>
    {card ? <div className="stack">
      <div className="actions"><Button variant="outline" disabled={busy || !!until} onClick={() => { setUntil(Date.now() + 300000); setRemaining(300); setEnded(false); }}>Ôn 5 phút</Button>{until && <><span role="timer">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span><Button variant="ghost" onClick={() => { setUntil(null); setEnded(true); }}>Dừng ôn</Button></>}</div>
      {ended ? <div role="status"><p>Đã kết thúc lượt ôn 5 phút. Chỉ các lượt bạn chọn mức ghi nhớ mới được lưu.</p><Button onClick={() => setEnded(false)}>Tiếp tục ôn tự do</Button></div> : <>
        <p className="hint">Thẻ {(index % cards.length) + 1}/{cards.length} · {card.chapter || card.topic || 'Chưa có chương'} · {Date.parse(card.dueAt) <= Date.now() ? 'Đến hạn ôn' : 'Chưa đến hạn'}{card.forgottenCount > 0 ? ` · Từng quên ${card.forgottenCount} lần` : ''}</p>
        <button className="flashcard" disabled={busy} onClick={() => setFlipped(v => !v)}><small>{flipped ? 'ĐÁP ÁN' : 'CÂU HỎI'}</small><AIContent text={flipped ? card.back || card.answer : card.front || card.question} /><small>Chạm để lật thẻ</small></button>
        <div className="actions"><Button variant="outline" disabled={busy} onClick={next}>Bỏ qua</Button>{flipped && [['again', 'Học lại'], ['good', 'Đã nhớ'], ['easy', 'Rất dễ']].map(([rating, label]) => <Button key={rating} disabled={busy} onClick={() => run(async () => {
          await courseApi.review(card.id, { rating, requestId: crypto.randomUUID() }); setIndex(0); setFlipped(false); await state.refetch();
        }, 'Đã lưu kết quả ôn tập')}>{label}</Button>)}</div>
      </>}
    </div> : <EmptyState title="Chưa có flashcard phù hợp" description={subject || topic ? `Không có thẻ khớp ${[subject, topic].filter(Boolean).join(' · ')}. Hãy tạo hoặc cập nhật bộ thẻ cho chương/chủ đề này.` : 'Flashcard sẽ xuất hiện khi học liệu được xử lý.'} mascot="fox-flashcard.png" />}
  </Card></ApiContent>;
}
