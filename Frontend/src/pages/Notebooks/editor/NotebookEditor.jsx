import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, PanelLeft, Focus, Minimize, ChevronRight, FileText, CheckCircle2, Download, Search, X, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { Button, ErrorState, useAction } from '../../../components/common/ui';
import { saveBlob } from '../../../utils/files';
import { pageText, countWords } from '../notebookModel';
import PageSidebar from './PageSidebar';
import BlockEditor from './BlockEditor';
import EditorToolbar from './EditorToolbar';
import TableOfContents from './TableOfContents';
import AutoSaveStatus from './AutoSaveStatus';
import AIActionMenu from './AIActionMenu';
import LecturePicker from './LecturePicker';
import AssetDialog from './AssetDialog';
import DrawingDialog from './DrawingDialog';
import { aiResultBlocks } from './aiResultBlocks';
import './NotebookEditor.css';

const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export default function NotebookEditor({ notebook, store, pageId, onSelectPage, onBack }) {
  const pages = store.pages.filter(page => page.notebookId === notebook.id).sort((a, b) => a.order - b.order);
  const page = pages.find(item => item.id === pageId) || pages[0];
  const [editor, setEditor] = useState(null), [revision, setRevision] = useState(0), [sidebar, setSidebar] = useState(false), [focus, setFocus] = useState(false), [hidePages, setHidePages] = useState(false), [dialog, setDialog] = useState(null), [find, setFind] = useState(false), [query, setQuery] = useState(''), [matchIndex, setMatchIndex] = useState(-1);
  const findRef = useRef(), selection = useRef(null), { run, busy, notify } = useAction();
  const ready = useCallback(instance => setEditor(instance), []);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const update = () => setRevision(value => value + 1);
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  }, [editor]);
  useEffect(() => { document.body.classList.add('nw-editor-active'); return () => { document.body.classList.remove('nw-editor-active', 'nw-focus-active'); }; }, []);
  useEffect(() => { document.body.classList.toggle('nw-focus-active', focus); return () => document.body.classList.remove('nw-focus-active'); }, [focus]);
  useEffect(() => { if (find) findRef.current?.focus(); }, [find]);
  useEffect(() => { setQuery(''); setMatchIndex(-1); setDialog(null); }, [page?.id]);
  const current = useRef({ editor, page, notebook }); current.current = { editor, page, notebook };
  const action = useCallback(kind => {
    const { editor: instance, page: target, notebook: book } = current.current;
    if (!instance || instance.isDestroyed || !target) return;
    selection.current = { from: instance.state.selection.from, to: instance.state.selection.to, pageId: target.id };
    if (kind === 'ai') {
      const { from, to } = selection.current, selected = from !== to;
      setDialog({ kind, context: { title: target.title, subject: book.subject, selected, text: selected ? instance.state.doc.textBetween(from, to, '\n') : pageText(target) } });
    } else setDialog({ kind, initial: kind === 'link' ? instance.getAttributes('link') : null });
  }, []);
  useEffect(() => {
    const keys = event => {
      if (event.key === 'Escape' && !dialog) { if (find) setFind(false); else if (focus) setFocus(false); else setSidebar(false); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !dialog) { event.preventDefault(); setFind(true); findRef.current?.focus(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); store.flush(); }
    };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [dialog, find, focus, store.flush]);
  const matches = [];
  if (query.trim() && editor && !editor.isDestroyed) editor.state.doc.descendants((node, pos) => { if (node.isTextblock) { const text = node.textContent.toLocaleLowerCase('vi'), term = query.toLocaleLowerCase('vi'); let start = 0, at; while ((at = text.indexOf(term, start)) !== -1) { matches.push({ from: pos + at + 1, to: pos + at + term.length + 1 }); start = at + term.length; } return false; } });
  function goMatch(direction) {
    if (!matches.length) return;
    const index = matchIndex < 0 ? (direction < 0 ? matches.length - 1 : 0) : (matchIndex + direction + matches.length) % matches.length; setMatchIndex(index);
    editor.chain().focus().setTextSelection(matches[index]).scrollIntoView().run();
  }
  function restoreSelection() {
    if (!editor || editor.isDestroyed) return false;
    const range = selection.current;
    if (range?.pageId === page?.id) editor.commands.setTextSelection({ from: Math.min(range.from, editor.state.doc.content.size), to: Math.min(range.to, editor.state.doc.content.size) });
    return true;
  }
  function insertNode(node) {
    if (!restoreSelection()) return;
    if (JSON.stringify(editor.getJSON()).length + JSON.stringify(node).length > 950000) { notify?.('Trang gần đạt giới hạn lưu trữ. Hãy tạo trang mới trước khi chèn.', 'error'); return; }
    editor.chain().focus().insertContent([node, { type: 'paragraph' }]).run(); setDialog(null);
  }
  function insertAsset(asset) {
    if (!restoreSelection()) return;
    if (dialog.kind === 'link') {
      const chain = editor.chain().focus();
      if (asset.label) chain.insertContent({ type: 'text', text: asset.label, marks: [{ type: 'link', attrs: { href: asset.href, target: '_blank', rel: 'noopener noreferrer' } }] }).run();
      else if (editor.state.selection.empty) chain.insertContent({ type: 'text', text: asset.href, marks: [{ type: 'link', attrs: { href: asset.href } }] }).run();
      else chain.extendMarkRange('link').setLink({ href: asset.href }).run();
      setDialog(null);
    } else insertNode(asset);
  }
  function insertAI(text, actionName) {
    if (!restoreSelection()) return;
    const nodes = aiResultBlocks(text, actionName);
    const end = editor.state.doc.resolve(selection.current?.to ?? editor.state.doc.content.size);
    const position = end.depth ? end.after(1) : editor.state.doc.content.size;
    if (JSON.stringify(editor.getJSON()).length + JSON.stringify(nodes).length > 950000) { notify?.('Kết quả quá dài cho trang. Hãy sao chép sang trang mới.', 'error'); return; }
    editor.chain().focus().insertContentAt(position, nodes).run(); setDialog(null);
  }
  function exportPage() {
    if (!editor) return;
    const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>${escapeHTML(page.title)}</title><style>body{max-width:820px;margin:48px auto;padding:24px;font:16px/1.8 Arial;color:#28232f}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:9px}img{max-width:100%}pre{background:#f5f3fa;padding:20px;white-space:pre-wrap}blockquote{border-left:3px solid #b59acb;padding-left:16px}h1,h2,h3{line-height:1.4}</style><body><p>${escapeHTML(notebook.subject)} · ${escapeHTML(notebook.title)}</p><h1>${escapeHTML(page.title)}</h1>${editor.getHTML()}</body></html>`;
    saveBlob({ data: new Blob([html], { type: 'text/html;charset=utf-8' }) }, `${page.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'Ghi-chu'}.html`);
  }
  return <section className={`nw-editor ${focus ? 'nw-focus' : ''} ${hidePages ? 'nw-pages-hidden' : ''}`} aria-label={`Sổ tay ${notebook.title}`}><header className="nw-editor-header"><button className="nw-back nw-icon" aria-label="Về sổ tay của tôi" onClick={() => { store.flush(); onBack(); }}><ArrowLeft size={18} /></button><div className="nw-editor-book-title"><strong>{notebook.title}</strong><AutoSaveStatus state={store.saveState} storageError={store.storageError} error={store.error} onRetry={store.retry} /></div><div className="nw-header-actions"><button className="nw-icon nw-toggle-pages" title="Danh sách trang" aria-label="Mở danh sách trang" aria-expanded={sidebar} onClick={() => { setSidebar(!sidebar); if (hidePages) setHidePages(false); }}><PanelLeft size={17} /></button><button className="nw-icon nw-desktop-pages" title={hidePages ? 'Hiện danh sách trang' : 'Ẩn danh sách trang'} aria-label={hidePages ? 'Hiện danh sách trang' : 'Ẩn danh sách trang'} onClick={() => setHidePages(!hidePages)}><PanelLeft size={17} /></button><button className="nw-icon" aria-label="Tìm trong trang (Ctrl+F)" title="Tìm trong trang (Ctrl+F)" disabled={!page} onClick={() => setFind(!find)}><Search size={17} /></button><Button variant="ghost" disabled={!page} onClick={exportPage} title="Xuất trang HTML"><Download size={15} /><span>Xuất trang</span></Button><Button variant={focus ? 'primary' : 'outline'} onClick={() => setFocus(!focus)}>{focus ? <Minimize size={15} /> : <Focus size={15} />}<span>{focus ? 'Thoát Focus' : 'Focus'}</span></Button></div></header>
    <div className="nw-editor-layout"><PageSidebar notebook={notebook} pages={pages} selectedId={page?.id} onSelect={onSelectPage} store={store} open={sidebar} onClose={() => setSidebar(false)} /><div className="nw-writing-pane">{page ? <><div className="nw-breadcrumb"><span>{notebook.subject || 'Ghi chép tự học'}</span><ChevronRight size={12} /><span>{notebook.title}</span><ChevronRight size={12} /><strong>{page.title}</strong></div><EditorToolbar editor={editor} revision={revision} onAction={action} />{find && <div className="nw-find-bar"><Search size={15} /><input ref={findRef} aria-label="Tìm trong nội dung trang" placeholder="Tìm trong trang…" value={query} onChange={event => { setQuery(event.target.value); setMatchIndex(-1); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); goMatch(event.shiftKey ? -1 : 1); } }} /><span>{matches.length ? `${Math.min(matchIndex + 1, matches.length)}/${matches.length}` : '0 kết quả'}</span><button aria-label="Kết quả trước" disabled={!matches.length} onClick={() => goMatch(-1)}><ChevronUp size={15} /></button><button aria-label="Kết quả tiếp" disabled={!matches.length} onClick={() => goMatch(1)}><ChevronDown size={15} /></button><button aria-label="Đóng tìm kiếm" onClick={() => setFind(false)}><X size={15} /></button></div>}
      {store.storageError && <div className="nw-storage-alert" role="alert">Không thể ghi bản nháp trên thiết bị. Giữ trang mở và xuất bản sao trước khi thoát.</div>}
      {store.error && !store.storageError && <div className="nw-storage-alert" role="alert">Chưa đồng bộ: {store.error.response?.data?.message || store.error.message} Bản nháp trên thiết bị được giữ để thử lại.</div>}
      <div className="nw-document-scroll"><article className="nw-document"><div className="nw-document-icon"><FileText size={31} strokeWidth={1.35} /></div><input className="nw-page-title" aria-label="Tiêu đề trang" placeholder="Trang chưa đặt tên" value={page.title} onChange={event => store.updatePage(page.id, { title: event.target.value })} /><div className="nw-document-meta"><span>Cập nhật {page.updatedAt ? new Date(/Z$|[+]\d\d:\d\d$/.test(page.updatedAt) ? page.updatedAt : page.updatedAt.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'hôm nay'}</span><span>·</span><span>{countWords(page).toLocaleString('vi-VN')} từ</span><button aria-pressed={!!page.completed} className={page.completed ? 'is-completed' : ''} onClick={() => store.updatePage(page.id, { completed: !page.completed })}><CheckCircle2 size={13} />{page.completed ? 'Đã ôn xong' : 'Đánh dấu đã ôn'}</button></div><BlockEditor key={page.id} page={page} onReady={ready} onChange={content => store.updatePage(page.id, { content })} onAI={() => action('ai')} onLecture={() => action('lecture')} onDrawing={() => action('drawing')} onLink={() => action('link')} onFile={() => action('file')} onImage={() => action('image')} /><p className="nw-document-hint">Gõ / để mở lệnh · Mọi ý tưởng đều bắt đầu từ đây.</p></article></div><footer className="nw-editor-footer"><span><span className="nw-tiny-dot" />{notebook.subject || 'Ghi chép tự học'}</span><span>{pages.length} trang · {pages.reduce((total, item) => total + countWords(item), 0).toLocaleString('vi-VN')} từ</span><span className="nw-footer-shortcut">Ctrl + / để mở lệnh</span></footer></> : <div className="nw-empty-page"><FileText size={52} strokeWidth={1} /><h2>Một trang mới, một ý tưởng mới.</h2><p>Tạo trang đầu tiên để bắt đầu ghi chép bằng bàn phím.</p><Button disabled={busy} onClick={() => run(async () => { const created = await store.createPage(notebook.id); onSelectPage(created.id); }, '')}><Plus size={16} />Tạo trang mới</Button>{store.error && <ErrorState error={store.error} />}</div>}</div><TableOfContents editor={editor} revision={revision} /></div>
    {dialog?.kind === 'ai' && <AIActionMenu context={dialog.context} onClose={() => setDialog(null)} onInsert={insertAI} />}{dialog?.kind === 'lecture' && <LecturePicker subject={notebook.subject} onClose={() => setDialog(null)} onInsert={attrs => insertNode({ type: 'image', attrs })} />}{['image', 'file', 'link'].includes(dialog?.kind) && <AssetDialog kind={dialog.kind} initial={dialog.initial} subject={notebook.subject} onClose={() => setDialog(null)} onInsert={insertAsset} />}{dialog?.kind === 'drawing' && <DrawingDialog onClose={() => setDialog(null)} onInsert={attrs => insertNode({ type: 'image', attrs })} />}</section>;
}
