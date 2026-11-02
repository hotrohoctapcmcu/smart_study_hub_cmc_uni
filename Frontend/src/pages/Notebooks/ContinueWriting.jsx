import { ArrowRight, FileText, PenLine } from 'lucide-react';
import { Button } from '../../components/common/ui';
import { pageText } from './notebookModel';

export function relativeDate(value) {
  if (!value) return 'Chưa chỉnh sửa';
  const date = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (!Number.isFinite(minutes)) return 'Vừa cập nhật';
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  if (minutes < 2880) return 'Hôm qua';
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} ngày trước`;
  return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function thumbnail(node) {
  if (node?.type === 'image' && /^(https?:|data:image\/(?:png|jpe?g|webp|gif);)/i.test(node.attrs?.src || '')) return node.attrs.src;
  for (const child of node?.content || []) { const source = thumbnail(child); if (source) return source; }
  return '';
}

export default function ContinueWriting({ page, notebook, onOpen, onCreate }) {
  const source = thumbnail(page?.content || page?.doc);
  return <section className="nw-continue" aria-label="Tiếp tục ghi">
    <div className="nw-section-eyebrow"><PenLine size={14} />TIẾP TỤC GHI</div>
    {page && notebook ? <>
      <div className="nw-continue-body">
        <div className={`nw-continue-preview ${source ? 'has-image' : ''}`}>{source ? <img src={source} alt="Ảnh trong trang ghi chú gần nhất" /> : <FileText size={30} strokeWidth={1.4} />}</div>
        <div className="nw-continue-copy"><span className="nw-subject-label">{notebook.subject}</span><p className="nw-continue-book">{notebook.title}</p><h2>{page.title}</h2><p className="nw-excerpt">{pageText(page) || 'Trang giấy đang chờ ý tưởng tiếp theo của bạn.'}</p></div>
      </div>
      <div className="nw-continue-footer"><span>Sửa {relativeDate(page.updatedAt).toLowerCase()}</span><Button onClick={() => onOpen(notebook.id, page.id)}>Tiếp tục viết <ArrowRight size={16} /></Button></div>
    </> : <div className="nw-continue-empty"><h2>Một nơi cho mọi ý tưởng của bạn</h2><p>Tạo sổ tay theo môn, ghi chép bằng bàn phím và biến kiến thức thành của riêng mình.</p><Button onClick={onCreate}>Bắt đầu ghi chép <ArrowRight size={16} /></Button></div>}
  </section>;
}
