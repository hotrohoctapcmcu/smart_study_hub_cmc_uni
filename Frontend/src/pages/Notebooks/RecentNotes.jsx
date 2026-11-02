import { ArrowUpRight, Clock3, FileText } from 'lucide-react';
import { relativeDate } from './ContinueWriting';

export default function RecentNotes({ items, onOpen }) {
  return <section className="nw-recent" aria-label="Ghi chú gần đây"><h2><Clock3 size={18} />Ghi chú gần đây</h2>
    {items.length ? <div className="nw-recent-list">{items.slice(0, 3).map(({ page, notebook }) => <button key={page.id} className="nw-recent-item" onClick={() => onOpen(notebook.id, page.id)}><span className="nw-page-symbol" style={{ color: notebook.color }}><FileText size={18} /></span><span><strong>{page.title}</strong><small>{notebook.subject} · {relativeDate(page.updatedAt)}</small></span><ArrowUpRight size={15} /></button>)}</div> : <div className="nw-recent-empty"><FileText size={28} strokeWidth={1.3} /><p>Các trang bạn chỉnh sửa sẽ xuất hiện ở đây.</p></div>}
    <span className="nw-recent-hint">Mỗi ghi chú, một bước hiểu sâu hơn.</span>
  </section>;
}
