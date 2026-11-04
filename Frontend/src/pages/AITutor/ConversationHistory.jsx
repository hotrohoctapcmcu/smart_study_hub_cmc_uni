import { useEffect, useRef, useState } from 'react';
import { History, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { aiApi } from '../../api';
import { responseList, unwrapResponse } from '../../api/apiClient';
import { useApi } from '../../hooks/useApi';
import { Button, ErrorState, Modal } from '../../components/common/ui';
import { formatDateTime } from '../../utils/date';

export default function ConversationHistory({ open, onClose, onSelect, conversationId, busy }) {
  const list = useApi(aiApi.conversations, { immediate: open });
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState('');
  const request = useRef(null);
  useEffect(() => {
    setQuery(''); setOpening(null); setError('');
    return () => { request.current?.abort(); request.current = null; };
  }, [open]);

  async function select(id) {
    if (busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setOpening(id); setError('');
    try {
      const data = unwrapResponse(await aiApi.conversation(id, { signal: controller.signal }));
      if (controller.signal.aborted) return;
      if (!data?.id || !Array.isArray(data.messages)) throw new Error('Không đọc được nội dung hội thoại. Hãy thử lại.');
      onSelect(data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error.response?.data?.message || error.message || 'Không mở được hội thoại.');
    } finally {
      if (!controller.signal.aborted) { setOpening(null); request.current = null; }
    }
  }
  const rows = responseList(list.data, 'conversations');
  const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');
  const filtered = rows.filter(row => normalized(row.title).includes(normalized(query.trim())));

  return <div className="ai-history-modal">
    <Modal isOpen={open} onClose={onClose} title="Lịch sử trò chuyện">
      <p className="ai-history-description">Mở lại cuộc trò chuyện đã lưu và tiếp tục từ nội dung trước đó.</p>
      <label className="ai-history-search">
        <Search size={16} aria-hidden="true" />
        <input aria-label="Tìm cuộc trò chuyện" placeholder="Tìm theo nội dung cuộc trò chuyện…" value={query} onChange={event => setQuery(event.target.value)} data-autofocus />
      </label>
      <div className="ai-history-summary">
        <span>{rows.length ? `${filtered.length} cuộc trò chuyện` : 'Lịch sử đã lưu'}</span>
        <Button size="sm" variant="ghost" aria-label="Làm mới lịch sử" disabled={list.loading} onClick={list.refetch}><RefreshCw size={14} /> Làm mới</Button>
      </div>
      {list.loading ? <p className="ai-history-notice" role="status">Đang tải lịch sử…</p>
        : list.error ? <ErrorState error={list.error} onRetry={list.refetch} title="Không tải được lịch sử" />
          : !rows.length ? <div className="ai-history-empty"><History size={30} /><strong>Chưa có cuộc trò chuyện đã lưu</strong><p>Các cuộc trò chuyện được lưu sau khi AI trả lời thành công.</p></div>
            : !filtered.length ? <p className="ai-history-notice">Không tìm thấy cuộc trò chuyện phù hợp.</p>
              : <ul className="ai-history-list" aria-label="Các cuộc trò chuyện đã lưu">
                {filtered.map(row => <li key={row.id}>
                  <button type="button" className="ai-history-item" aria-current={row.id === conversationId ? 'true' : undefined} disabled={busy || opening === row.id} onClick={() => select(row.id)}>
                    <MessageCircle size={18} aria-hidden="true" />
                    <span><strong>{row.title || 'Cuộc trò chuyện'}</strong><small>{formatDateTime(row.updatedAt || row.createdAt)}</small></span>
                    {opening === row.id ? <small>Đang mở…</small> : row.id === conversationId ? <small>Đang mở</small> : null}
                  </button>
                </li>)}
              </ul>}
      {error && <div className="ai-history-error" role="alert">{error}</div>}
    </Modal>
  </div>;
}
