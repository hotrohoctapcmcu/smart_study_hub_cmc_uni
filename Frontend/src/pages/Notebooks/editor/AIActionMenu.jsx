import { useRef, useState, useEffect } from 'react';
import { Sparkles, ArrowDownToLine, Copy } from 'lucide-react';
import { aiApi } from '../../../api';
import { unwrapResponse } from '../../../api/apiClient';
import { formatAIResult } from '../../../utils/aiAdapter';
import AIContent from '../../../components/common/AIContent';
import { Button, Modal, ErrorState } from '../../../components/common/ui';
import { aiResultBlocks } from './aiResultBlocks';

const actions = ['Tóm tắt', 'Giải thích dễ hiểu', 'Viết lại', 'Viết ngắn hơn', 'Viết chi tiết hơn', 'Cho ví dụ', 'Tạo câu hỏi', 'Tạo flashcard', 'Giải thích code', 'Giải thích công thức'];
export default function AIActionMenu({ context, onClose, onInsert }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState(''), [error, setError] = useState(null), [action, setAction] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function ask(label) {
    if (busy || !context.text.trim()) return;
    const id = ++request.current; setBusy(true); setError(null); setAction(label); setResult('');
    try {
      const response = await aiApi.ask({ conversationId: null, question: `Bạn là trợ giảng học tập. Yêu cầu: ${label}. Trả lời bằng tiếng Việt. ${label === 'Tạo flashcard' ? 'Chỉ trả về JSON theo cấu trúc {"cards":[{"question":"Câu hỏi","answer":"Đáp án"}]}, tối đa 12 thẻ.' : 'Định dạng kết quả bằng Markdown.'}\nMôn học: ${context.subject}\nTrang: ${context.title}\nDưới đây là nội dung học tập cần xử lý:\n${context.text.slice(0, 26000)}` });
      if (request.current === id) setResult(formatAIResult(unwrapResponse(response)));
    } catch (cause) { if (request.current === id) setError(cause); }
    finally { if (request.current === id) setBusy(false); }
  }
  const cards = action === 'Tạo flashcard' && result ? aiResultBlocks(result, action).filter(node => node.type === 'flashcard') : [];
  return <Modal isOpen title="AI Tutor · Cùng bạn hiểu sâu hơn" onClose={onClose} size="lg"><div className="nw-ai-context"><Sparkles size={17} /><div><strong>{context.selected ? 'Đoạn đang chọn' : context.title || 'Nội dung trang'}</strong><p>{context.text.slice(0, 240) || 'Hãy viết nội dung trước khi sử dụng AI.'}</p></div></div><div className="nw-ai-actions">{actions.map(label => <button key={label} disabled={busy || !context.text.trim()} className={action === label ? 'active' : ''} onClick={() => ask(label)}>{label}</button>)}</div>{busy && <p role="status" className="nw-ai-loading"><Sparkles size={16} />AI đang đọc ghi chú của bạn…</p>}{error && <ErrorState error={error} onRetry={() => ask(action)} />}{result && <><div className="nw-ai-result"><>{cards.length ? cards.map((card, index) => <div className="nw-ai-card-preview" key={index}><strong>{index + 1}. {card.attrs.question}</strong><p>{card.attrs.answer}</p></div>) : <AIContent text={result} />}</></div><div className="form-actions"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(result); } catch (cause) { setError(cause); } }}><Copy size={14} />Sao chép</Button><Button onClick={() => onInsert(result, action)}><ArrowDownToLine size={15} />{cards.length ? `Chèn ${cards.length} flashcard` : "Chèn vào trang"}</Button></div></>}<small className="nw-modal-hint">AI có thể mắc lỗi. Kiểm tra kiến thức quan trọng với bài giảng gốc.</small></Modal>;
}
