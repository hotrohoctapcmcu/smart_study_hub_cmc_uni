import { useMemo, useState } from 'react';
import { Plus, Search, LayoutGrid, List, BookOpen, Files, WholeWord, GraduationCap, ArrowRight, Check } from 'lucide-react';
import { useCurrentCourses } from '../../hooks/useCurrentCourses';
import CurrentCourseHint from '../../components/common/CurrentCourseHint';
import { Button, Modal, Field, EmptyState, ErrorState, LoadingSkeleton, useAction } from '../../components/common/ui';
import { saveBlob } from '../../utils/files';
import { pageText, countWords, NOTEBOOK_TEMPLATES, COLORS } from './notebookModel';
import NotebookCard, { compactNumber } from './NotebookCard';
import ContinueWriting from './ContinueWriting';
import RecentNotes from './RecentNotes';
import './NotebookDashboard.css';

function markdown(node) {
  if (!node) return '';
  if (node.type === 'text') { let value = node.text || ''; for (const mark of node.marks || []) { if (mark.type === 'bold') value = `**${value}**`; if (mark.type === 'italic') value = `*${value}*`; if (mark.type === 'code') value = `\`${value}\``; if (mark.type === 'link' && /^https?:/i.test(mark.attrs?.href || '')) value = `[${value}](${mark.attrs.href})`; } return value; }
  const children = (node.content || []).map(markdown).join('');
  switch (node.type) {
    case 'heading': return `${'#'.repeat(node.attrs?.level || 1)} ${children.trim()}\n\n`;
    case 'paragraph': return children + '\n\n';
    case 'hardBreak': return '\n';
    case 'horizontalRule': return '\n---\n\n';
    case 'codeBlock': return `\`\`\`${node.attrs?.language || ''}\n${children}\n\`\`\`\n\n`;
    case 'blockquote': return children.trim().split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
    case 'orderedList': return (node.content || []).map((item, index) => `${(Number(node.attrs?.start) || 1) + index}. ${(item.content || []).map(markdown).join('').trim().replace(/\n/g, '\n   ')}\n`).join('') + '\n';
    case 'listItem': return `- ${children.trim().replace(/\n/g, '\n  ')}\n`;
    case 'taskItem': return `- [${node.attrs?.checked ? 'x' : ' '}] ${children.trim()}\n`;
    case 'image': return `![${node.attrs?.alt || node.attrs?.caption || 'Ảnh'}](${node.attrs?.src || ''})\n\n${node.attrs?.caption || ''}\n\n`;
    case 'formula': return `$$\n${node.attrs?.latex || node.attrs?.source || ''}\n$$\n\n`;
    case 'flashcard': return `**${node.attrs?.question || 'Câu hỏi'}**\n\n${node.attrs?.answer || ''}\n\n`;
    case 'cornell': return `### Từ khóa / Câu hỏi\n\n${node.attrs?.cues || ''}\n\n### Ghi chú\n\n${node.attrs?.notes || ''}\n\n### Tóm tắt\n\n${node.attrs?.summary || ''}\n\n`;
    case 'studyCallout': return `> **${({ remember: 'Ghi nhớ', important: 'Quan trọng', example: 'Ví dụ', question: 'Câu hỏi', definition: 'Định nghĩa' })[node.attrs?.kind] || 'Ghi chú'}**\n> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
    case 'attachment': return `[${node.attrs?.name || 'Tệp đính kèm'}](${node.attrs?.href || node.attrs?.url || ''})\n\n`;
    case 'tableRow': return `| ${(node.content || []).map(cell => markdown(cell).trim().replace(/\n/g, ' ').replace(/\|/g, '\\|')).join(' | ')} |\n`;
    case 'table': return (node.content || []).map((row, index) => markdown(row) + (index === 0 ? `| ${(row.content || []).map(() => '---').join(' | ')} |\n` : '')).join('') + '\n';
    default: return children;
  }
}

function exportNotebook(notebook, pages) {
  const output = `# ${notebook.title}\n\nMôn học: ${notebook.subject}\n\n` + pages.map(page => `## ${page.title}\n\n${markdown(page.content || page.doc) || pageText(page)}\n`).join('\n---\n\n');
  saveBlob({ data: new Blob([output], { type: 'text/markdown;charset=utf-8' }) }, `${notebook.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'So-tay'}.md`);
}

function ColorPicker({ value, onChange }) {
  return <div className="nw-color-picker" role="group" aria-label="Màu sổ tay">{COLORS.map(color => <button type="button" key={color} aria-label={`Màu ${color}`} aria-pressed={value === color} style={{ background: color }} onClick={() => onChange(color)}>{value === color && <Check size={17} />}</button>)}</div>;
}

export default function NotebookDashboard({ store, onOpen }) {
  const { notebooks = [], pages = [], loading, error, storageError } = store;
  const subjectsState = useCurrentCourses();
  const currentNames = subjectsState.subjects.map(item => item.subject_name);
  const subjects = [...new Set([...currentNames, ...notebooks.map(book => book.subject)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const [query, setQuery] = useState(''), [subject, setSubject] = useState(''), [sort, setSort] = useState('recent'), [view, setView] = useState('grid'), [dialog, setDialog] = useState(null);
  const [name, setName] = useState(''), [formSubject, setFormSubject] = useState(''), [template, setTemplate] = useState('blank'), [color, setColor] = useState(COLORS[0]), [formError, setFormError] = useState('');
  const { run, busy } = useAction();
  const recent = useMemo(() => pages.map(page => ({ page, notebook: notebooks.find(book => String(book.id) === String(page.notebookId)) })).filter(item => item.notebook).sort((a, b) => (b.page.updatedAt || '').localeCompare(a.page.updatedAt || '')), [pages, notebooks]);
  const filtered = useMemo(() => notebooks.filter(book => (!subject || book.subject === subject) && `${book.title} ${book.subject}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).sort((a, b) => Number(!!b.bookmarked) - Number(!!a.bookmarked) || (sort === 'name' ? a.title.localeCompare(b.title, 'vi') : sort === 'pages' ? pages.filter(page => String(page.notebookId) === String(b.id)).length - pages.filter(page => String(page.notebookId) === String(a.id)).length : (b.updatedAt || '').localeCompare(a.updatedAt || ''))), [notebooks, pages, query, subject, sort]);
  const words = pages.reduce((sum, page) => sum + countWords(page), 0);
  function openDialog(action, notebook) { setDialog({ action, notebook }); setName(notebook?.title || ''); setFormSubject(notebook?.subject || ''); setTemplate('blank'); setColor(notebook?.color || COLORS[0]); setFormError(''); }
  async function action(type, notebook) {
    if (type === 'bookmark') await run(() => store.updateNotebook(notebook.id, { bookmarked: !notebook.bookmarked }), notebook.bookmarked ? 'Đã bỏ ghim sổ tay' : 'Đã ghim sổ tay');
    else if (type === 'duplicate') await run(() => store.duplicateNotebook(notebook.id), 'Đã nhân bản sổ tay');
    else if (type === 'export') exportNotebook(notebook, pages.filter(page => String(page.notebookId) === String(notebook.id)));
    else openDialog(type, notebook);
  }
  async function submit(event) {
    event.preventDefault(); setFormError('');
    const type = dialog.action;
    if (['create', 'rename'].includes(type) && !name.trim()) { setFormError('Vui lòng nhập tên sổ tay.'); return; }
    if (['create', 'move'].includes(type) && !formSubject.trim()) { setFormError('Vui lòng chọn hoặc nhập môn học.'); return; }
    const ok = await run(async () => {
      if (type === 'create') { const created = await store.createNotebook({ title: name.trim(), subject: formSubject.trim(), template, color }); setDialog(null); if (created) onOpen(created.id); }
      else if (type === 'delete') await store.deleteNotebook(dialog.notebook.id);
      else await store.updateNotebook(dialog.notebook.id, type === 'rename' ? { title: name.trim() } : type === 'move' ? { subject: formSubject.trim() } : { color });
    }, type === 'delete' ? 'Đã xóa sổ tay' : 'Đã lưu sổ tay');
    if (ok) setDialog(null);
  }
  const modalTitles = { create: 'Tạo sổ tay', rename: 'Đổi tên sổ tay', color: 'Đổi màu sổ tay', move: 'Di chuyển sang môn học', delete: 'Xóa sổ tay' };
  return <div className="nw-dashboard">
    <header className="nw-dashboard-header"><div><span className="nw-section-eyebrow"><span className="nw-eyebrow-dot" />KHÔNG GIAN KIẾN THỨC</span><h1>Sổ tay của tôi</h1><p>Ghi lại kiến thức theo cách của bạn.</p></div><Button onClick={() => openDialog('create')}><Plus size={18} />Tạo sổ tay</Button></header>
    {storageError && <ErrorState title="Chưa lưu được bản nháp trên thiết bị" error={storageError instanceof Error ? storageError : new Error(String(storageError))} />}
    {error && <ErrorState title="Chưa đồng bộ được sổ tay" error={error instanceof Error ? error : new Error(String(error))} onRetry={store.refetch} />}
    {loading && !notebooks.length ? <div className="nw-statistics">{[1, 2, 3, 4].map(n => <LoadingSkeleton key={n} />)}</div> : <>
      <section className="nw-statistics" aria-label="Thống kê sổ tay">{[[BookOpen, notebooks.length, 'Sổ tay'], [Files, pages.length, 'Trang ghi chú'], [WholeWord, compactNumber(words), 'Tổng số từ'], [GraduationCap, new Set(notebooks.map(book => book.subject).filter(Boolean)).size, 'Môn đang ghi chú']].map(([Icon, value, label], index) => <div key={label} className={`nw-stat nw-stat-${index}`}><span className="nw-stat-icon"><Icon size={21} strokeWidth={1.7} /></span><div><strong>{value}</strong><span>{label}</span></div></div>)}</section>
      <div className="nw-writing-row"><ContinueWriting page={recent[0]?.page} notebook={recent[0]?.notebook} onOpen={onOpen} onCreate={() => openDialog('create')} /><RecentNotes items={recent} onOpen={onOpen} /></div>
      <section className="nw-collection" aria-label="Danh sách sổ tay"><div className="nw-collection-heading"><div><h2>Tất cả sổ tay <span>{notebooks.length}</span></h2><p>Kiến thức được sắp xếp, ý tưởng được kết nối.</p></div><span className="nw-collection-note"><BookOpen size={15} />Viết hôm nay, hiểu sâu ngày mai</span></div>
        <div className="nw-filters"><label className="nw-search"><Search size={17} /><input aria-label="Tìm sổ tay" placeholder="Tìm sổ tay..." value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Lọc theo môn học" value={subject} onChange={event => setSubject(event.target.value)}><option value="">Tất cả môn học</option>{subjects.map(item => <option key={item}>{item}</option>)}</select><select aria-label="Sắp xếp sổ tay" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Mới nhất</option><option value="name">Tên A → Z</option><option value="pages">Nhiều trang nhất</option></select><div className="nw-view-toggle" role="group" aria-label="Kiểu hiển thị"><button aria-label="Lưới" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={17} /></button><button aria-label="Danh sách" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></button></div></div>
        {filtered.length ? <div className={`nw-book-grid ${view === 'list' ? 'nw-list-view' : ''}`}>{filtered.map(notebook => <NotebookCard key={notebook.id} notebook={notebook} pages={pages.filter(page => String(page.notebookId) === String(notebook.id))} onOpen={onOpen} onAction={action} />)}{view === 'grid' && !query && !subject && <button className="nw-new-book" onClick={() => openDialog('create')}><span><Plus size={24} /></span><strong>Thêm một sổ tay mới</strong><small>Dành chỗ cho kiến thức tiếp theo</small><ArrowRight size={17} /></button>}</div> : <EmptyState icon={<BookOpen size={44} strokeWidth={1.3} />} title={notebooks.length ? 'Không tìm thấy sổ tay' : 'Bắt đầu hành trình ghi chép'} description={notebooks.length ? 'Thử từ khóa hoặc môn học khác.' : 'Chọn môn học và một template yêu thích để bắt đầu.'} action={notebooks.length ? <Button variant="outline" onClick={() => { setQuery(''); setSubject(''); }}>Xóa bộ lọc</Button> : <Button onClick={() => openDialog('create')}><Plus size={16} />Tạo sổ tay đầu tiên</Button>} />}
      </section>
    </>}
    <Modal isOpen={!!dialog} title={modalTitles[dialog?.action] || ''} onClose={() => { if (!busy) setDialog(null); }} size={dialog?.action === 'create' ? 'lg' : 'md'}><form className="nw-book-form" onSubmit={submit}>
      {dialog?.action === 'delete' ? <p>Xóa “<strong>{dialog.notebook.title}</strong>” và tất cả {pages.filter(page => String(page.notebookId) === String(dialog.notebook.id)).length} trang bên trong? Thao tác này không thể hoàn tác.</p> : <>
        {['create', 'rename'].includes(dialog?.action) && <Field label="Tên sổ tay"><input data-autofocus required maxLength={200} value={name} placeholder="Ví dụ: Database Notes" onChange={event => setName(event.target.value)} /></Field>}
        {['create', 'move'].includes(dialog?.action) && <><Field label="Môn học"><select required value={formSubject} onChange={event => setFormSubject(event.target.value)}><option value="">Chọn môn kỳ hiện tại</option>{[...new Set([...currentNames, dialog?.notebook?.subject].filter(Boolean))].map(item => <option key={item}>{item}</option>)}</select></Field><CurrentCourseHint state={subjectsState} /><p className="hint">Sổ tay các kỳ trước vẫn có trong danh sách và bộ lọc môn học.</p></>}
        {['create', 'color'].includes(dialog?.action) && <div><span className="nw-form-label">Màu bìa</span><ColorPicker value={color} onChange={setColor} /></div>}
        {dialog?.action === 'create' && <fieldset className="nw-template-fieldset"><legend>Chọn template</legend><div className="nw-template-grid">{NOTEBOOK_TEMPLATES.map(item => <label key={item.id} className={template === item.id ? 'selected' : ''}><input type="radio" name="notebook-template" value={item.id} checked={template === item.id} onChange={() => setTemplate(item.id)} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div></fieldset>}
      </>}
      {formError && <p role="alert" className="nw-form-error">{formError}</p>}<div className="form-actions"><Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>Hủy</Button><Button type="submit" variant={dialog?.action === 'delete' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Đang lưu…' : dialog?.action === 'create' ? 'Tạo sổ tay' : dialog?.action === 'delete' ? 'Xóa sổ tay' : 'Lưu thay đổi'}</Button></div>
    </form></Modal>
  </div>;
}
