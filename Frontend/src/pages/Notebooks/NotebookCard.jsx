import { Bookmark, BookOpen, MoreHorizontal, Pencil, Palette, Pin, Copy, FolderInput, Download, Trash2, ArrowUpRight } from 'lucide-react';
import { countWords } from './notebookModel';
import { relativeDate } from './ContinueWriting';

export const compactNumber = number => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(number);

export default function NotebookCard({ notebook, pages, onOpen, onAction }) {
  const words = pages.reduce((sum, page) => sum + countWords(page), 0);
  const completed = pages.filter(page => page.completed).length;
  const percent = pages.length ? Math.round(completed / pages.length * 100) : 0;
  const actions = [['rename', Pencil, 'Đổi tên'], ['color', Palette, 'Đổi màu'], ['bookmark', Pin, notebook.bookmarked ? 'Bỏ ghim' : 'Ghim'], ['duplicate', Copy, 'Nhân bản'], ['move', FolderInput, 'Di chuyển'], ['export', Download, 'Xuất file'], ['delete', Trash2, 'Xóa']];
  return <article className="nw-notebook-card" style={{ '--nw-book-color': notebook.color }}>
    <div className="nw-book-cover"><BookOpen size={29} strokeWidth={1.5} /><span className="nw-cover-lines" aria-hidden="true"><i /><i /><i /></span><div className="nw-card-controls"><button aria-label={`${notebook.bookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu'} ${notebook.title}`} title="Đánh dấu sổ tay" aria-pressed={!!notebook.bookmarked} onClick={() => onAction('bookmark', notebook)}><Bookmark size={17} fill={notebook.bookmarked ? 'currentColor' : 'none'} /></button><details className="nw-card-menu"><summary aria-label={`Tùy chọn ${notebook.title}`} title="Tùy chọn sổ tay"><MoreHorizontal size={19} /></summary><div className="nw-menu-popover">{actions.map(([action, Icon, title]) => <button key={action} className={action === 'delete' ? 'nw-danger' : ''} onClick={event => { event.currentTarget.closest('details').removeAttribute('open'); onAction(action, notebook); }}><Icon size={15} />{title}</button>)}</div></details></div></div>
    <button className="nw-book-open" onClick={() => onOpen(notebook.id)}><span className="nw-book-title">{notebook.title}</span><span className="nw-book-subject">{notebook.subject || 'Ghi chép tự học'}</span><ArrowUpRight size={17} /></button>
    <div className="nw-book-counts"><span>{pages.length} trang</span><span aria-hidden="true">·</span><span>{compactNumber(words)} từ</span></div>
    <div className="nw-book-progress"><div><span>Trang đã hoàn thành</span><strong>{percent}%</strong></div><progress aria-label={`Tiến độ ${notebook.title}: ${completed}/${pages.length} trang hoàn thành`} value={percent} max="100" /></div>
    <div className="nw-card-footer"><span>Sửa {relativeDate(notebook.updatedAt).toLowerCase()}</span>{notebook.bookmarked && <span className="nw-pinned"><Pin size={12} />Đã ghim</span>}</div>
  </article>;
}
