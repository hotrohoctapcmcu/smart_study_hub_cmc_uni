import { useState } from 'react';
import { Plus, Search, FileText, ChevronRight, ChevronDown, MoreHorizontal, Pin, X, BookOpen, ArrowUp, ArrowDown, Copy, Trash2, Pencil, CornerDownRight, Check } from 'lucide-react';
import { Button, Modal, Field, useAction } from '../../../components/common/ui';

export default function PageSidebar({ notebook, pages, selectedId, onSelect, store, open, onClose }) {
  const [query, setQuery] = useState(''), [collapsed, setCollapsed] = useState({}), [menu, setMenu] = useState(null), [dialog, setDialog] = useState(null), [title, setTitle] = useState('');
  const { run, busy } = useAction();
  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const byId = new Map(pages.map(page => [page.id, page]));
  const roots = sorted.filter(page => !page.parentId || !byId.has(page.parentId));
  const descendants = id => { const result = new Set([id]); let count; do { count = result.size; pages.forEach(page => { if (result.has(page.parentId)) result.add(page.id); }); } while (count !== result.size); return result; };
  const add = parentId => run(async () => { const page = await store.createPage(notebook.id, { parentId }); setCollapsed(value => ({ ...value, [parentId]: false })); onSelect(page.id); onClose(); }, '');
  function reorder(page, direction) {
    const siblings = sorted.filter(item => item.parentId === page.parentId), index = siblings.findIndex(item => item.id === page.id), target = siblings[index + direction];
    if (!target) return;
    const reordered = [...siblings];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    reordered.forEach((item, order) => store.updatePage(item.id, { order }));
  }
  function drop(event, target) {
    event.preventDefault(); const id = event.dataTransfer.getData('application/x-notebook-page');
    const source = byId.get(id);
    if (!source || id === target.id || descendants(id).has(target.id)) return;
    const siblings = sorted.filter(item => item.parentId === target.parentId && item.id !== id);
    const index = siblings.findIndex(item => item.id === target.id); siblings.splice(index, 0, source);
    siblings.forEach((item, order) => store.updatePage(item.id, { order, ...(item.id === id ? { parentId: target.parentId } : {}) }));
  }
  function row(page, depth = 0, pinnedReference = false, seen = new Set()) {
    if (seen.has(page.id)) return null;
    const visited = new Set(seen).add(page.id), children = sorted.filter(item => item.parentId === page.id), active = selectedId === page.id;
    const menuKey = `${pinnedReference ? 'reference' : 'tree'}:${page.id}`;
    return <div key={page.id} className="nw-page-branch"><div className={`nw-page-row ${active ? 'is-active' : ''}`} style={{ '--depth': Math.min(depth, 5) }} draggable={!pinnedReference} onDragStart={event => event.dataTransfer.setData('application/x-notebook-page', page.id)} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, page)}>
      {!pinnedReference && children.length > 0 ? <button className="nw-tree-toggle" aria-label={`${collapsed[page.id] ? 'Mở rộng' : 'Thu gọn'} ${page.title}`} aria-expanded={!collapsed[page.id]} onClick={() => setCollapsed(value => ({ ...value, [page.id]: !value[page.id] }))}>{collapsed[page.id] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button> : <FileText size={14} className="nw-page-file" />}
      <button className="nw-page-select" aria-current={active ? 'page' : undefined} onClick={() => { onSelect(page.id); onClose(); }}><span>{page.title || 'Trang chưa đặt tên'}</span>{page.completed && <Check size={11} />}</button>
      <button className="nw-page-more" aria-label={`Thao tác trang ${page.title}`} onClick={() => setMenu(menu === menuKey ? null : menuKey)}><MoreHorizontal size={15} /></button>
    </div>{menu === menuKey && <div className="nw-page-menu"><button onClick={() => { setMenu(null); add(page.id); }}><Plus size={13} />Trang con</button><button onClick={() => { setMenu(null); setTitle(page.title); setDialog({ kind: 'rename', page }); }}><Pencil size={13} />Đổi tên</button><button onClick={() => { store.updatePage(page.id, { pinned: !page.pinned }); setMenu(null); }}><Pin size={13} />{page.pinned ? 'Bỏ ghim' : 'Ghim trang'}</button><button onClick={() => run(async () => { const copy = await store.duplicatePage(page.id); onSelect(copy.id); setMenu(null); }, 'Đã nhân bản trang')}><Copy size={13} />Nhân bản</button><button onClick={() => reorder(page, -1)}><ArrowUp size={13} />Lên trên</button><button onClick={() => reorder(page, 1)}><ArrowDown size={13} />Xuống dưới</button><button onClick={() => { setTitle(page.parentId || ''); setDialog({ kind: 'move', page }); setMenu(null); }}><CornerDownRight size={13} />Di chuyển trang</button><button className="nw-danger" onClick={() => { setDialog({ kind: 'delete', page }); setMenu(null); }}><Trash2 size={13} />Xóa trang</button></div>}{!pinnedReference && !collapsed[page.id] && children.map(child => row(child, depth + 1, false, visited))}</div>;
  }
  return <><aside className={`nw-page-sidebar ${open ? 'is-open' : ''}`} aria-label="Danh sách trang"><div className="nw-sidebar-book"><span style={{ color: notebook.color }}><BookOpen size={24} /></span><div><strong>{notebook.title}</strong><small>{notebook.subject || 'Ghi chép tự học'}</small></div><button className="nw-mobile-close nw-icon" aria-label="Đóng danh sách trang" onClick={onClose}><X size={17} /></button></div><Button variant="outline" className="nw-new-page" onClick={() => add(null)} disabled={busy}><Plus size={15} />Trang mới</Button><label className="nw-page-search"><Search size={14} /><input placeholder="Tìm trang…" aria-label="Tìm trang" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="nw-page-tree">{!query && pages.some(page => page.pinned) && <div className="nw-pinned-pages"><h4><Pin size={12} /> ĐÃ GHIM</h4>{sorted.filter(page => page.pinned).map(page => row(page, 0, true))}</div>}<h4>TẤT CẢ TRANG <span>{pages.length}</span></h4>{query ? sorted.filter(page => page.title.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).map(page => row(page, 0, true)) : roots.map(page => row(page))}{!pages.length && <p className="nw-sidebar-empty">Mỗi ý tưởng bắt đầu từ một trang. Tạo trang đầu tiên của bạn.</p>}</div><div className="nw-sidebar-footer"><span className="nw-tiny-dot" />Không gian ghi chép của bạn</div></aside>{open && <button className="nw-sidebar-overlay" aria-label="Đóng danh sách trang" onClick={onClose} />}
    <Modal isOpen={!!dialog} title={dialog?.kind === 'delete' ? 'Xóa trang' : dialog?.kind === 'move' ? 'Di chuyển trang' : 'Đổi tên trang'} onClose={() => setDialog(null)}>{dialog?.kind === 'delete' ? <p>Xóa “{dialog.page.title}” và các trang con? Nội dung đã xóa không thể khôi phục.</p> : dialog?.kind === 'move' ? <Field label="Trang cha"><select value={title} onChange={event => setTitle(event.target.value)}><option value="">Cấp cao nhất</option>{pages.filter(page => !descendants(dialog.page.id).has(page.id)).map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select></Field> : <Field label="Tên trang"><input autoFocus value={title} onChange={event => setTitle(event.target.value)} /></Field>}<div className="form-actions"><Button variant="outline" onClick={() => setDialog(null)}>Hủy</Button><Button variant={dialog?.kind === 'delete' ? 'danger' : 'primary'} disabled={busy || (dialog?.kind === 'rename' && !title.trim())} onClick={() => run(async () => { if (dialog.kind === 'delete') await store.deletePage(dialog.page.id); else store.updatePage(dialog.page.id, dialog.kind === 'move' ? { parentId: title || null, order: Date.now() } : { title: title.trim() }); setDialog(null); }, 'Đã cập nhật trang')}>{dialog?.kind === 'delete' ? 'Xóa trang' : 'Lưu'}</Button></div></Modal></>;
}
