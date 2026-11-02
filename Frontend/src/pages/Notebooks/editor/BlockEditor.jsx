import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { InputRule } from '@tiptap/core';
import { Attachment, Cornell, Flashcard, FontSize, Formula, NotebookCode, NotebookComment, NotebookImage, StudyCallout, imageFileToDataURL } from './blockExtensions';
import SlashMenu, { filterCommands } from './SlashMenu';
import './BlockEditor.css';

const NotebookTaskItem = TaskItem.extend({
  addInputRules() { return [...(this.parent?.() || []), new InputRule({ find: /^\[\]\s$/, handler: ({ state, range, chain }) => { chain().deleteRange(range).toggleTaskList().run(); } })]; },
}).configure({ nested: true });
const NotebookCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), backgroundColor: { default: null, parseHTML: element => element.style.backgroundColor || null, renderHTML: attributes => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {} }, textAlign: { default: null, parseHTML: element => element.style.textAlign || null, renderHTML: attributes => attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {} } }; } });
const NotebookHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), backgroundColor: { default: null, parseHTML: element => element.style.backgroundColor || null, renderHTML: attributes => attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {} }, textAlign: { default: null, parseHTML: element => element.style.textAlign || null, renderHTML: attributes => attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {} } }; } });
const extensions = [StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['http', 'https', 'mailto'] } }), TextStyle, Color, FontFamily, FontSize, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TaskList, NotebookTaskItem, Table.configure({ resizable: true }), TableRow, NotebookCell, NotebookHeader, NotebookCode, NotebookImage, Formula, Flashcard, StudyCallout, Cornell, Attachment, NotebookComment];

export function runBlockCommand(editor, id, callbacks = {}) {
  if (!editor || editor.isDestroyed) return;
  const chain = editor.chain().focus();
  if (id === 'text') return chain.setParagraph().run();
  if (/^h[123]$/.test(id)) return chain.setHeading({ level: Number(id.slice(1)) }).run();
  if (id === 'bullet') return chain.toggleBulletList().run();
  if (id === 'number') return chain.toggleOrderedList().run();
  if (id === 'checklist') return chain.toggleTaskList().run();
  if (id === 'quote') return chain.toggleBlockquote().run();
  if (id === 'table') return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  if (id === 'code') return chain.toggleCodeBlock({ language: 'javascript' }).run();
  if (id === 'divider') return chain.setHorizontalRule().run();
  if (id === 'formula') return chain.insertContent([{ type: 'formula', attrs: { latex: '' } }, { type: 'paragraph' }]).run();
  if (id === 'flashcard') return chain.insertContent([{ type: 'flashcard', attrs: { question: '', answer: '' } }, { type: 'paragraph' }]).run();
  if (id === 'cornell') return chain.insertContent([{ type: 'cornell', attrs: { cues: '', notes: '', summary: '' } }, { type: 'paragraph' }]).run();
  if (['remember', 'important', 'example', 'question', 'definition', 'callout'].includes(id)) return chain.insertContent({ type: 'studyCallout', attrs: { kind: id === 'callout' ? 'remember' : id }, content: [{ type: 'paragraph' }] }).run();
  callbacks[id]?.(editor);
}

export default function BlockEditor({ page, onChange, onReady, onAI, onLecture, onDrawing, onLink, onFile, onImage }) {
  const callbacks = useRef({}), slashRef = useRef(null), editorRef = useRef(null), rootRef = useRef(null), dragIndex = useRef(null);
  callbacks.current = { onChange, onReady, ai: onAI, lecture: onLecture, drawing: onDrawing, link: onLink, file: onFile, image: onImage };
  const [slash, setSlashState] = useState(null), [selection, setSelection] = useState(null), [block, setBlock] = useState(null), [blockMenu, setBlockMenu] = useState(false), [comment, setComment] = useState(null), [error, setError] = useState('');
  const setSlash = value => { slashRef.current = typeof value === 'function' ? value(slashRef.current) : value; setSlashState(slashRef.current); };
  function choose(id) {
    const instance = editorRef.current, state = slashRef.current;
    if (!instance || instance.isDestroyed) return;
    if (state) instance.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
    setSlash(null);
    runBlockCommand(instance, id, callbacks.current);
  }
  function updateUI(instance, docChanged = false) {
    if (!instance || instance.isDestroyed) return;
    const { $from, from, to, empty } = instance.state.selection;
    const root = rootRef.current?.getBoundingClientRect();
    if (!root) return;
    const prefix = $from.parent.isTextblock ? $from.parent.textBetween(0, $from.parentOffset, '\n') : '';
    const match = prefix.match(/^\/([^\s]*)$/);
    if (empty && match && !$from.parent.type.spec.code) {
      try { const coords = instance.view.coordsAtPos(from); setSlash({ from: from - match[0].length, to: from, query: match[1], index: slashRef.current?.query === match[1] ? slashRef.current.index : 0, left: Math.max(6, Math.min(coords.left - root.left, root.width - 285)), top: coords.bottom - root.top + 8 }); } catch { /* UI coordinates unavailable in detached editor */ }
    } else if (docChanged || !empty) setSlash(null);
    if (!empty && instance.isFocused) {
      try { const coords = instance.view.coordsAtPos(from); setSelection({ left: Math.max(0, Math.min(coords.left - root.left, root.width - 280)), top: Math.max(0, coords.top - root.top - 46) }); } catch { setSelection(null); }
    } else setSelection(null);
    if ($from.depth > 0) {
      const pos = $from.before(1), node = instance.view.nodeDOM(pos);
      if (node instanceof HTMLElement) setBlock({ pos, index: $from.index(0), top: node.getBoundingClientRect().top - root.top });
    }
  }
  async function addImages(files, instance, position) {
    for (const file of files) {
      try {
        const src = await imageFileToDataURL(file);
        if (instance.isDestroyed) return;
        if (JSON.stringify(instance.getJSON()).length + src.length > 950000) throw new Error('Trang gần đạt giới hạn lưu trữ. Hãy tạo trang mới trước khi thêm ảnh.');
        const chain = instance.chain().focus();
        if (position != null) chain.setTextSelection(Math.min(position, instance.state.doc.content.size));
        chain.setImage({ src, alt: file.name, caption: file.name }).run();
      } catch (cause) { setError(cause.message); }
    }
  }
  const editor = useEditor({
    extensions,
    content: page.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'nw-prosemirror', role: 'textbox', 'aria-label': 'Nội dung trang ghi chú', 'aria-multiline': 'true', spellcheck: 'true' },
      handlePaste(view, event) {
        const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault(); addImages(files, editorRef.current); return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault(); addImages(files, editorRef.current, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos); return true;
      },
      handleKeyDown(view, event) {
        if (event.isComposing) return false;
        const instance = editorRef.current, state = slashRef.current;
        if (!instance) return false;
        if ((event.ctrlKey || event.metaKey) && event.key === '/') {
          event.preventDefault(); event.stopPropagation();
          if (state) setSlash(null); else {
            const root = rootRef.current.getBoundingClientRect();
            let coords; try { coords = view.coordsAtPos(view.state.selection.from); } catch { coords = { left: root.left, bottom: root.top + 40 }; }
            setSlash({ from: view.state.selection.from, to: view.state.selection.to, query: '', index: 0, left: Math.max(0, Math.min(coords.left - root.left, root.width - 285)), top: coords.bottom - root.top + 8 });
          }
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopPropagation(); callbacks.current.link?.(instance); return true; }
        if (state && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); const items = filterCommands(state.query);
          if (event.key === 'Escape') setSlash(null);
          else if (event.key === 'Enter' && items.length) choose(items[Math.min(state.index, items.length - 1)].id);
          else if (event.key !== 'Enter' && items.length) setSlash({ ...state, index: (state.index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length });
          return true;
        }
        if (event.key === 'Tab' && !instance.isActive('table')) {
          event.preventDefault();
          if (instance.isActive('taskItem')) instance.chain().focus()[event.shiftKey ? 'liftListItem' : 'sinkListItem']('taskItem').run();
          else if (instance.isActive('listItem')) instance.chain().focus()[event.shiftKey ? 'liftListItem' : 'sinkListItem']('listItem').run();
          else if (!event.shiftKey) instance.commands.insertContent('    ');
          else {
            const { $from } = view.state.selection, text = $from.parent.textBetween(0, $from.parentOffset);
            const spaces = text.match(/ {1,4}$/)?.[0]?.length || 0;
            if (spaces) instance.commands.deleteRange({ from: $from.pos - spaces, to: $from.pos });
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => { callbacks.current.onChange?.(instance.getJSON()); updateUI(instance, true); },
    onSelectionUpdate: ({ editor: instance }) => updateUI(instance),
    onFocus: ({ editor: instance }) => updateUI(instance),
    onBlur: () => setTimeout(() => { if (!rootRef.current?.contains(document.activeElement)) setSelection(null); }, 150),
  }, [page.id]);
  editorRef.current = editor;
  useEffect(() => {
    setSlash(null); setSelection(null); setBlock(null); setBlockMenu(false); setError('');
    if (editor) callbacks.current.onReady?.(editor);
    return () => callbacks.current.onReady?.(null);
  }, [editor]);
  function moveBlock(fromIndex, targetIndex) {
    if (!editor || fromIndex === targetIndex || targetIndex < 0 || targetIndex >= editor.state.doc.childCount) return;
    const nodes = []; editor.state.doc.forEach(node => nodes.push(node.toJSON()));
    const [moving] = nodes.splice(fromIndex, 1); nodes.splice(targetIndex, 0, moving);
    // One transaction preserves native undo history while moving complete blocks.
    const replacement = editor.schema.nodeFromJSON({ type: 'doc', content: nodes });
    editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, replacement.content));
    setBlockMenu(false); setBlock(null);
  }
  return <div ref={rootRef} className="nw-block-editor" onMouseMove={event => {
    if (!editor || blockMenu || slashRef.current || dragIndex.current != null || !(event.target instanceof Element) || !event.target.closest('.nw-prosemirror')) return;
    const root = rootRef.current.getBoundingClientRect();
    editor.state.doc.forEach((node, pos, index) => {
      const element = editor.view.nodeDOM(pos);
      if (element instanceof HTMLElement && element.contains(event.target)) {
        const top = element.getBoundingClientRect().top - root.top;
        setBlock(previous => previous?.pos === pos && previous?.top === top ? previous : { pos, index, top });
      }
    });
  }} onDragOver={event => { if (dragIndex.current != null) event.preventDefault(); }} onDrop={event => {
    if (dragIndex.current == null || !editor) return;
    event.preventDefault();
    const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (position) moveBlock(dragIndex.current, editor.state.doc.resolve(position.pos).index(0));
    dragIndex.current = null;
  }}>
    {error && <div role="alert" className="nw-editor-error">{error}<button onClick={() => setError('')} aria-label="Đóng thông báo">×</button></div>}
    <EditorContent editor={editor} />
    {editor && block && <div className="nw-block-handles" style={{ top: block.top }} onMouseDown={event => event.preventDefault()}>
      <button aria-label="Thêm block" title="Thêm block" onClick={() => {
        const node = editor.state.doc.nodeAt(block.pos), position = block.pos + node.nodeSize;
        editor.chain().focus().insertContentAt(position, { type: 'paragraph' }).setTextSelection(position + 1).run();
        setSlash({ from: position + 1, to: position + 1, query: '', index: 0, left: 0, top: block.top + 34 });
      }}>+</button>
      <button aria-label="Di chuyển hoặc sửa block" title="Kéo để đổi thứ tự hoặc mở menu block" draggable onDragStart={event => { dragIndex.current = block.index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/x-notebook-block', String(block.index)); }} onDragEnd={() => { dragIndex.current = null; }} onClick={() => setBlockMenu(!blockMenu)}>⠿</button>
      {blockMenu && <div className="nw-block-menu"><button disabled={block.index === 0} onClick={() => moveBlock(block.index, block.index - 1)}>↑ Di chuyển lên</button><button disabled={block.index === editor.state.doc.childCount - 1} onClick={() => moveBlock(block.index, block.index + 1)}>↓ Di chuyển xuống</button><button onClick={() => { const node = editor.state.doc.nodeAt(block.pos); editor.chain().focus().insertContentAt(block.pos + node.nodeSize, node.toJSON()).run(); setBlockMenu(false); }}>Nhân bản block</button><button onClick={() => { const node = editor.state.doc.nodeAt(block.pos); editor.chain().focus().deleteRange({ from: block.pos, to: block.pos + node.nodeSize }).run(); setBlockMenu(false); setBlock(null); }}>Xóa block</button></div>}
    </div>}
    {selection && editor && <div className="nw-selection-menu" role="toolbar" aria-label="Định dạng văn bản đã chọn" style={selection} onMouseDown={event => event.preventDefault()}><button onClick={() => callbacks.current.ai?.(editor)}>✧ AI</button><button aria-label="In đậm" className={editor.isActive('bold') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button><button aria-label="Tô sáng" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}>Highlight</button><button onClick={() => callbacks.current.link?.(editor)}>Link</button><button onClick={() => setComment({ from: editor.state.selection.from, to: editor.state.selection.to, text: editor.getAttributes('notebookComment').text || '' })}>Comment</button></div>}
    {comment && <form className="nw-comment-form" onSubmit={event => { event.preventDefault(); editor.chain().focus().setTextSelection({ from: comment.from, to: comment.to }).setMark('notebookComment', { text: comment.text }).run(); setComment(null); }}><label>Bình luận<input autoFocus aria-label="Bình luận" required value={comment.text} onChange={event => setComment({ ...comment, text: event.target.value })} /></label><button type="submit">Lưu</button><button type="button" onClick={() => setComment(null)}>Hủy</button></form>}
    <SlashMenu state={slash} items={slash ? filterCommands(slash.query) : []} onChoose={choose} onClose={() => setSlash(null)} />
    <p className="nw-editor-hint">Gõ / để chèn nội dung · Ctrl + / mở lệnh · Kéo ⠿ để sắp xếp block</p>
  </div>;
}
