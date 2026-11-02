import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search, Grid2X2, List, MoreHorizontal, Bookmark, Clock3, ArrowUpRight, PenLine, Copy, Palette, FileDown, Trash2, HardDrive, Sparkles, Download, Upload } from 'lucide-react';
import { Button, PageHeader, Modal, Field, ConfirmModal, EmptyState, ErrorState, useAction } from '../../components/common/ui';
import { courseApi } from '../../api';
import { responseList } from '../../api/apiClient';
import { useApi } from '../../hooks/useApi';
import { formatDateTime } from '../../utils/date';
import { listBooks, createBook, saveBook, duplicateBook, deleteBook, coverColors, subscribeTextbooks, searchableBookText, parseTextbookBackup, importTextbookBackup } from '../../utils/textbookStore';
import './Textbook.css';

const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
function timeLabel(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  return minutes < 1 ? 'Vừa cập nhật' : minutes < 60 ? `${minutes} phút trước` : minutes < 1440 ? `${Math.floor(minutes / 60)} giờ trước` : formatDateTime(value);
}
export default function Textbook() {
  const navigate = useNavigate(), { run, busy, notify } = useAction();
  const [books, setBooks] = useState([]), [error, setError] = useState(null);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [subject, setSubject] = useState(''), [view, setView] = useState('grid');
  const [menu, setMenu] = useState(null), [editing, setEditing] = useState(null), [deleting, setDeleting] = useState(null);
  const [title, setTitle] = useState(''), [subjectId, setSubjectId] = useState(''), [color, setColor] = useState(coverColors[0]);
  const fileInput = useRef(null), mounted = useRef(true);
  const [pendingImport, setPendingImport] = useState(null);
  const courses = useApi(courseApi.list);
  const subjects = responseList(courses.data, 'courses').map(course => ({ id: String(course.subject_id ?? course.id ?? course.course_id), name: course.subject || course.subject_name || course.title || course.name || course.course_name || 'Môn học' }));
  const reload = () => { try { setBooks(listBooks()); setError(null); } catch (cause) { setError(cause); } };
  useEffect(() => { mounted.current = true; reload(); const unsubscribe = subscribeTextbooks(reload); return () => { mounted.current = false; unsubscribe(); }; }, []);
  useEffect(() => {
    if (!menu) return;
    const close = event => { if (!event.target.closest('.textbook-card-menu')) setMenu(null); };
    const escape = event => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('click', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', escape); };
  }, [menu]);
  const recent = useMemo(() => books.flatMap(book => book.pages.map(page => ({ ...page, book }))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6), [books]);
  const filtered = books.filter(book => (!query || searchableBookText(book).includes(normalized(query)))
    && (filter !== 'bookmarked' || book.bookmarked || book.pages.some(page => page.bookmarked))
    && (filter !== 'recent' || Date.now() - Date.parse(book.updatedAt) < 7 * 86400000)
    && (!subject || String(book.subjectId) === subject));
  const totalPages = books.reduce((total, book) => total + book.pages.length, 0);
  const marked = books.reduce((total, book) => total + book.pages.filter(page => page.bookmarked).length, 0);
  function openEditor(book = null) {
    setMenu(null); setEditing(book || {}); setTitle(book?.title || ''); setSubjectId(String(book?.subjectId || '')); setColor(book?.coverColor || coverColors[0]);
  }
  async function submit(event) {
    event.preventDefault();
    await run(() => {
      const selectedSubject = subjects.find(row => row.id === subjectId);
      const values = { title, subjectId, subjectName: selectedSubject?.name || (subjectId && String(editing?.subjectId) === subjectId ? editing.subjectName || '' : ''), coverColor: color };
      if (editing?.id) { saveBook({ ...editing, ...values }); setEditing(null); }
      else { const created = createBook(values); setEditing(null); navigate(`/textbook/${created.id}`); }
    }, '');
  }
  function exportPdf(book) {
    setMenu(null);
    run(async () => { const { exportPages } = await import('../../utils/textbookCanvas.jsx'); await exportPages(book, book.pages, 'pdf'); }, 'Đã xuất vở ghi');
  }
  function backup() {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), books }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `smart-study-vo-ghi-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify?.('Đã tải bản sao dữ liệu vở ghi');
  }
  function prepareImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    run(async () => {
      if (file.size > 10 * 1024 * 1024) throw new Error('Tệp sao lưu vượt quá 10 MB. Hãy nhập từng vở nhỏ hơn.');
      const raw = await file.text(), imported = parseTextbookBackup(raw);
      if (mounted.current) setPendingImport({ raw, books: imported, filename: file.name });
    }, '');
  }
  return <div className="page textbook-library">
    <section aria-label="A. Tiêu đề vở ghi">
      <PageHeader title="Vở ghi" description="Ghi lại kiến thức theo cách của bạn" eyebrow="WRITE YOUR OWN STORY">
        <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Tệp sao lưu vở ghi" onChange={prepareImport} />
        <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy || !!error}><Upload size={15} />Nhập sao lưu</Button>
        <Button variant="outline" onClick={backup} disabled={!books.length || !!error}><Download size={15} />Sao lưu</Button>
        <Button onClick={() => openEditor()} disabled={!!error}><Plus size={17} />Tạo vở mới</Button>
      </PageHeader>
    </section>
    <section className="textbook-welcome" aria-label="B. Không gian viết">
      <div><span className="textbook-eyebrow"><Sparkles size={13} /> MỘT Ý TƯỞNG NHỎ, MỘT KHỞI ĐẦU LỚN</span><h2>Mọi ý tưởng đều<br />xứng đáng có một trang riêng.</h2><p>Viết tay, phác thảo, đánh dấu và kết nối những điều bạn học.</p><span className="textbook-local-status"><HardDrive size={13} />Lưu trên trình duyệt này · Sử dụng được khi ngoại tuyến</span></div>
      <div className="textbook-hero-art" aria-hidden="true"><div className="textbook-art-sheet back" /><div className="textbook-art-sheet front"><span>MY LITTLE<br /><strong>BIG IDEAS</strong></span><PenLine size={42} /><small>learn • write • grow</small></div><span className="textbook-art-star">✦</span></div>
    </section>
    <section className="textbook-overview" aria-label="C. Tổng quan thư viện">
      <div><span><BookOpen size={18} /></span><strong>{books.length}</strong><small>Vở ghi của bạn</small></div>
      <div><span><PenLine size={18} /></span><strong>{totalPages}</strong><small>Trang kiến thức</small></div>
      <div><span><Bookmark size={18} /></span><strong>{marked}</strong><small>Trang đã đánh dấu</small></div>
    </section>
    {error && <ErrorState title="Không thể tải vở ghi" error={error} onRetry={reload} />}
    <section className="textbook-shelf" aria-label="D. Thư viện vở ghi">
      <div className="textbook-shelf-heading"><div><h2>Thư viện của bạn <span>{books.length}</span></h2><p>Một góc nhỏ dành cho những điều bạn muốn nhớ.</p></div><div className="textbook-view-switch" role="group" aria-label="Kiểu hiển thị"><button className={view === 'grid' ? 'active' : ''} aria-label="Hiển thị lưới" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} aria-label="Hiển thị danh sách" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></button></div></div>
      <div className="textbook-filter-row"><div className="textbook-filters" role="group" aria-label="Lọc vở ghi">{[['all', 'Tất cả'], ['recent', 'Gần đây'], ['subject', 'Theo môn học'], ['bookmarked', 'Đã đánh dấu']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => { setFilter(id); if (id !== 'subject') setSubject(''); }}>{label}</button>)}</div><label className="textbook-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm trong vở ghi..." aria-label="Tìm kiếm trong vở ghi" /></label></div>
      {filter === 'subject' && <label className="textbook-subject-filter">Môn học<select aria-label="Lọc theo môn học" value={subject} onChange={event => setSubject(event.target.value)}><option value="">Tất cả môn học</option>{[...new Map(books.filter(book => book.subjectId).map(book => [String(book.subjectId), { id: book.subjectId, name: book.subjectName }])).values()].map(row => <option key={row.id} value={row.id}>{row.name || row.id}</option>)}</select></label>}
      {!error && (!books.length ? <EmptyState title="Bạn chưa có vở ghi nào 📖" description="Tạo vở đầu tiên để bắt đầu học. Những ý tưởng hay đang chờ bạn!" action={<Button onClick={() => openEditor()}><Plus size={16} />Tạo vở mới</Button>} /> : !filtered.length ? <EmptyState title="Chưa tìm thấy vở phù hợp" description="Thử từ khóa hoặc bộ lọc khác để tìm lại ghi chép của bạn." action={<Button variant="outline" onClick={() => { setQuery(''); setSubject(''); setFilter('all'); }}>Xóa bộ lọc</Button>} /> : <div className={`textbook-books ${view}`}>{filtered.map(book => <article key={book.id} className="textbook-book" style={{ '--cover': book.coverColor || coverColors[0] }}>
        <Link className="textbook-cover" to={`/textbook/${book.id}`} aria-label={`Mở vở ${book.title}`}><span className="textbook-cover-top">SMART STUDY / NOTES</span><span className="textbook-cover-title">{book.title}</span><BookOpen size={34} strokeWidth={1.2} /><span className="textbook-cover-bottom">{book.pages.length} trang <ArrowUpRight size={16} /></span></Link>
        <div className="textbook-book-info"><Link to={`/textbook/${book.id}`}><h3>{book.title}</h3></Link><small>{book.subjectName || 'Vở ghi cá nhân'}</small><p><Clock3 size={12} />{timeLabel(book.updatedAt)}</p></div>
        <button className={`textbook-bookmark ${book.bookmarked ? 'active' : ''}`} aria-label={`${book.bookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu'} vở ${book.title}`} onClick={() => run(() => saveBook({ ...book, bookmarked: !book.bookmarked }), '')}><Bookmark size={16} fill={book.bookmarked ? 'currentColor' : 'none'} /></button>
        <div className="textbook-card-menu"><button className="textbook-menu-trigger" aria-label={`Tùy chọn vở ${book.title}`} aria-expanded={menu === book.id} onClick={() => setMenu(menu === book.id ? null : book.id)}><MoreHorizontal size={20} /></button>{menu === book.id && <div className="textbook-menu" role="group" aria-label={`Thao tác với ${book.title}`}><Link to={`/textbook/${book.id}`}><BookOpen size={14} />Mở</Link><button onClick={() => openEditor(book)}><PenLine size={14} />Đổi tên</button><button onClick={() => openEditor(book)}><Palette size={14} />Đổi màu</button><button disabled={busy} onClick={() => { setMenu(null); run(() => duplicateBook(book.id), 'Đã nhân bản vở ghi'); }}><Copy size={14} />Nhân bản</button><button disabled={busy} onClick={() => exportPdf(book)}><FileDown size={14} />Xuất PDF</button><button className="danger" onClick={() => { setDeleting(book); setMenu(null); }}><Trash2 size={14} />Xóa</button></div>}</div>
      </article>)}</div>)}
    </section>
    <section className="textbook-recent" aria-label="E. Các trang gần đây"><div className="textbook-shelf-heading"><div><h2>Tiếp nối dòng suy nghĩ</h2><p>Các trang bạn chỉnh sửa gần đây.</p></div><Clock3 size={19} /></div>{recent.length ? <div className="textbook-recent-grid">{recent.map(page => <Link to={`/textbook/${page.book.id}?page=${page.id}`} key={page.id} className="textbook-recent-page"><span className="textbook-recent-icon" style={{ background: `color-mix(in srgb, ${page.book.coverColor} 14%, var(--surface))`, color: page.book.coverColor }}><PenLine size={22} /></span><div><strong>{page.title}</strong><small>{page.book.title}</small><span>{timeLabel(page.updatedAt || page.book.updatedAt)}</span></div><ArrowUpRight size={15} /></Link>)}</div> : <div className="textbook-recent-empty"><PenLine size={20} /><p>Những trang vừa viết sẽ xuất hiện ở đây. Bắt đầu từ một ý tưởng nhỏ nhé.</p></div>}</section>
    <div className="textbook-storage-note"><HardDrive size={16} /><p>Vở ghi canvas hiện được lưu cục bộ trên trình duyệt, tách biệt với Sổ tay trong Tài liệu. Hãy sao lưu hoặc xuất PDF để giữ thêm một bản; xóa dữ liệu trình duyệt sẽ xóa các vở trên thiết bị này.</p></div>
    <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Chỉnh sửa vở ghi' : 'Một vở mới, một khởi đầu mới'}><form onSubmit={submit} className="textbook-create-form"><Field label="Tên vở ghi"><input data-autofocus required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Đặt tên cho kiến thức của bạn..." /></Field><Field label="Môn học"><select value={subjectId} onChange={event => setSubjectId(event.target.value)}><option value="">Vở ghi cá nhân</option>{subjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}{editing?.subjectId && !subjects.some(row => row.id === String(editing.subjectId)) && <option value={editing.subjectId}>{editing.subjectName || editing.subjectId}</option>}</select></Field>{courses.error && <small className="textbook-subject-hint">Chưa tải được môn học từ máy chủ. Bạn vẫn có thể tạo vở cá nhân.</small>}<fieldset className="textbook-colors"><legend>Màu bìa</legend>{coverColors.map((value, index) => <button type="button" key={value} className={color === value ? 'selected' : ''} aria-label={['Tím', 'Xanh dương', 'Xanh lá', 'Vàng', 'Hồng'][index]} aria-pressed={color === value} style={{ background: value }} onClick={() => setColor(value)} />)}<label title="Màu tùy chỉnh"><Palette size={17} /><input aria-label="Màu bìa tùy chỉnh" type="color" value={color} onChange={event => setColor(event.target.value)} /></label></fieldset><div className="form-actions"><Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button type="submit" disabled={busy || !title.trim()}><Plus size={16} />{editing?.id ? 'Lưu thay đổi' : 'Tạo vở & bắt đầu viết'}</Button></div></form></Modal>
    <ConfirmModal item={deleting} onClose={() => setDeleting(null)} busy={busy} onConfirm={() => run(() => { deleteBook(deleting.id); setDeleting(null); }, 'Đã xóa vở ghi')} />
    <Modal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} title="Khôi phục từ bản sao lưu"><p className="textbook-import-info">Nhập {pendingImport?.books.length} vở từ “{pendingImport?.filename}” thành các bản mới. Những vở hiện có được giữ nguyên.</p><ul className="textbook-import-preview">{pendingImport?.books.map((book, index) => <li key={index}><BookOpen size={15} /><span>{book.title}</span><small>{book.pages.length} trang</small></li>)}</ul><div className="form-actions"><Button variant="outline" onClick={() => setPendingImport(null)}>Hủy</Button><Button disabled={busy} onClick={() => run(() => { const restored = importTextbookBackup(pendingImport.raw); setPendingImport(null); notify?.(`Đã khôi phục ${restored.length} vở ghi`); }, '')}><Upload size={15} />Khôi phục vở ghi</Button></div></Modal>
  </div>;
}
