import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useState } from 'react';

export const CODE_LANGUAGES = ['javascript', 'c', 'cpp', 'csharp', 'java', 'python', 'sql', 'html', 'css', 'json'];
export const safeHref = value => /^(https?:|mailto:|tel:|data:(?:image\/(?:png|jpeg|webp|gif);base64,|application\/pdf;base64,|text\/plain;base64,))/i.test(String(value || '')) ? value : '';
export function imageFileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) return reject(new Error('Chọn ảnh PNG, JPG, WebP hoặc GIF.'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('Ảnh tối đa 12 MB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.onload = () => {
      if (String(reader.result).length < 420000) return resolve(reader.result);
      const image = new window.Image();
      image.onerror = () => reject(new Error('Không đọc được ảnh.'));
      image.onload = () => {
        const canvas = document.createElement('canvas'), scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let result = canvas.toDataURL('image/jpeg', .75);
        if (result.length > 500000) result = canvas.toDataURL('image/jpeg', .4);
        canvas.width = canvas.height = 0;
        if (result.length > 600000) reject(new Error('Ảnh còn quá lớn. Hãy chọn ảnh nhỏ hơn.')); else resolve(result);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function FormulaView({ node, updateAttributes, deleteNode }) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  let html = '';
  try { html = katex.renderToString(node.attrs.latex || '\\text{LaTeX}', { throwOnError: false, displayMode: true, trust: false }); } catch { /* invalid formula remains editable */ }
  return <NodeViewWrapper className="nw-formula" data-block-kind="formula">
    <div contentEditable={false}><button className="nw-formula-preview" onClick={() => setEditing(!editing)} title="Sửa công thức" dangerouslySetInnerHTML={{ __html: html }} />
      {editing && <label className="nw-node-field">LaTeX<input aria-label="Công thức LaTeX" value={node.attrs.latex} onChange={event => updateAttributes({ latex: event.target.value })} placeholder="\\frac{a}{b}" onKeyDown={event => { if (event.key === 'Enter' || event.key === 'Escape') setEditing(false); }} /></label>}
      <button className="nw-node-delete" onClick={deleteNode} aria-label="Xóa công thức">×</button>
    </div>
  </NodeViewWrapper>;
}
export const Formula = Node.create({ name: 'formula', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ latex: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-formula]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-formula': '' }), HTMLAttributes.latex || ''],
  addNodeView: () => ReactNodeViewRenderer(FormulaView),
});
function FlashcardView({ node, updateAttributes, deleteNode }) {
  const [revealed, setRevealed] = useState(false);
  return <NodeViewWrapper className="nw-flashcard" data-block-kind="flashcard"><div contentEditable={false}>
    <span className="nw-node-eyebrow">✦ FLASHCARD · TỰ KIỂM TRA</span>
    <textarea aria-label="Câu hỏi flashcard" placeholder="Nhập câu hỏi…" value={node.attrs.question} onChange={event => updateAttributes({ question: event.target.value })} />
    <button className="nw-small-button" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>{revealed ? 'Ẩn đáp án' : 'Hiện đáp án'}</button>
    {revealed && <textarea aria-label="Đáp án flashcard" placeholder="Nhập đáp án…" value={node.attrs.answer} onChange={event => updateAttributes({ answer: event.target.value })} />}
    <button className="nw-node-delete" onClick={deleteNode} aria-label="Xóa flashcard">×</button>
  </div></NodeViewWrapper>;
}
export const Flashcard = Node.create({ name: 'flashcard', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ question: { default: '' }, answer: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-flashcard]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-flashcard': '' }), `${HTMLAttributes.question || ''}\n${HTMLAttributes.answer || ''}`],
  addNodeView: () => ReactNodeViewRenderer(FlashcardView),
});
export const CALLOUTS = { remember: ['💡', 'Ghi nhớ'], important: ['⚠', 'Quan trọng'], example: ['📌', 'Ví dụ'], question: ['❓', 'Câu hỏi'], definition: ['📖', 'Định nghĩa'] };
function CalloutView({ node, updateAttributes }) {
  const kind = CALLOUTS[node.attrs.kind] ? node.attrs.kind : 'remember';
  return <NodeViewWrapper className={`nw-callout nw-callout-${kind}`}><div className="nw-callout-label" contentEditable={false}><span>{CALLOUTS[kind][0]}</span><select aria-label="Loại ghi chú học tập" value={kind} onChange={event => updateAttributes({ kind: event.target.value })}>{Object.entries(CALLOUTS).map(([key, item]) => <option key={key} value={key}>{item[1]}</option>)}</select></div><NodeViewContent className="nw-callout-content" /></NodeViewWrapper>;
}
export const StudyCallout = Node.create({ name: 'studyCallout', group: 'block', content: 'block+', defining: true, draggable: true,
  addAttributes: () => ({ kind: { default: 'remember' } }),
  parseHTML: () => [{ tag: 'aside[data-study-callout]', getAttrs: element => ({ kind: element.getAttribute('data-study-callout') || 'remember' }) }],
  renderHTML: ({ node, HTMLAttributes }) => ['aside', mergeAttributes(HTMLAttributes, { 'data-study-callout': node.attrs.kind }), 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
});
function CornellView({ node, updateAttributes, deleteNode }) {
  return <NodeViewWrapper className="nw-cornell"><div contentEditable={false}><span className="nw-node-eyebrow">CORNELL NOTES</span><div className="nw-cornell-columns"><label>TỪ KHÓA / CÂU HỎI<textarea aria-label="Cornell: Từ khóa và câu hỏi" value={node.attrs.cues} onChange={event => updateAttributes({ cues: event.target.value })} placeholder="Từ khóa, câu hỏi gợi nhớ…" /></label><label>GHI CHÚ<textarea aria-label="Cornell: Ghi chú" value={node.attrs.notes} onChange={event => updateAttributes({ notes: event.target.value })} placeholder="Ghi lại kiến thức của bạn…" /></label></div><label className="nw-cornell-summary">TÓM TẮT<textarea aria-label="Cornell: Tóm tắt" value={node.attrs.summary} onChange={event => updateAttributes({ summary: event.target.value })} placeholder="Tóm tắt bằng lời của bạn…" /></label><button className="nw-node-delete" onClick={deleteNode} aria-label="Xóa Cornell Notes">×</button></div></NodeViewWrapper>;
}
export const Cornell = Node.create({ name: 'cornell', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ cues: { default: '' }, notes: { default: '' }, summary: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-cornell]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-cornell': '' }), `${HTMLAttributes.cues || ''}\n${HTMLAttributes.notes || ''}\n${HTMLAttributes.summary || ''}`],
  addNodeView: () => ReactNodeViewRenderer(CornellView),
});
function ImageView({ node, updateAttributes, deleteNode, selected, editor }) {
  const [error, setError] = useState('');
  return <NodeViewWrapper className={`nw-image-block ${selected ? 'is-selected' : ''}`} style={{ textAlign: node.attrs.align || 'center' }}>
    <figure contentEditable={false} style={{ width: `${Math.max(20, Math.min(100, Number(node.attrs.width) || 100))}%` }}>
      <img src={safeHref(node.attrs.src)} alt={node.attrs.alt || node.attrs.caption || 'Ảnh ghi chú'} draggable="false" onError={() => setError('Không tải được ảnh. Hãy thay ảnh khác.')} onLoad={() => setError('')} />
      {error && <small role="alert">{error}</small>}
      <input className="nw-image-caption" aria-label="Chú thích ảnh" placeholder="Thêm chú thích…" value={node.attrs.caption || ''} onChange={event => updateAttributes({ caption: event.target.value })} />
      <div className="nw-image-tools"><label>Kích thước<input aria-label="Kích thước ảnh" type="range" min="20" max="100" value={Number(node.attrs.width) || 100} onChange={event => updateAttributes({ width: Number(event.target.value) })} /></label><select aria-label="Căn ảnh" value={node.attrs.align || 'center'} onChange={event => updateAttributes({ align: event.target.value })}><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select><label className="nw-small-button">Thay ảnh<input className="nw-hidden-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async event => { const input = event.currentTarget, file = input.files?.[0]; if (!file) return; try { const src = await imageFileToDataURL(file); if (JSON.stringify(editor.getJSON()).length - String(node.attrs.src || '').length + src.length > 950000) throw new Error('Trang gần đạt giới hạn lưu trữ. Hãy chọn ảnh nhỏ hơn.'); updateAttributes({ src }); } catch (cause) { setError(cause.message); } input.value = ''; }} /></label><button onClick={deleteNode} aria-label="Xóa ảnh">Xóa</button></div>
    </figure>
  </NodeViewWrapper>;
}
export const NotebookImage = Image.extend({ draggable: true,
  addAttributes() { return { ...this.parent?.(), caption: { default: '' }, width: { default: 100, parseHTML: element => parseFloat(element.style.width || element.getAttribute('width')) || 100, renderHTML: attrs => ({ style: `width: ${Math.max(20, Math.min(100, parseFloat(attrs.width) || 100))}%; max-width: 100%` }) }, align: { default: 'center', parseHTML: element => element.getAttribute('data-align') || 'center', renderHTML: attrs => ({ 'data-align': attrs.align, style: `display: block; margin-left: ${attrs.align === 'left' ? '0' : 'auto'}; margin-right: ${attrs.align === 'right' ? '0' : 'auto'}` }) } }; },
  renderHTML({ HTMLAttributes }) { return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src: safeHref(HTMLAttributes.src) })]; },
  addNodeView: () => ReactNodeViewRenderer(ImageView),
}).configure({ allowBase64: true });
function AttachmentView({ node, deleteNode }) {
  const href = safeHref(node.attrs.href);
  return <NodeViewWrapper className="nw-attachment"><div contentEditable={false}><span>📎</span>{href ? <a href={href} target="_blank" rel="noopener noreferrer" download={href.startsWith('data:') ? node.attrs.name : undefined}>{node.attrs.name || 'Tệp đính kèm'}</a> : <span>Liên kết tệp không hợp lệ</span>}<button onClick={deleteNode} aria-label="Xóa tệp đính kèm">×</button></div></NodeViewWrapper>;
}
export const Attachment = Node.create({ name: 'attachment', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ href: { default: '' }, name: { default: '' } }),
  parseHTML: () => [{ tag: 'a[data-attachment]' }],
  renderHTML: ({ HTMLAttributes }) => ['a', mergeAttributes(HTMLAttributes, { 'data-attachment': '', href: safeHref(HTMLAttributes.href), rel: 'noopener noreferrer' }), HTMLAttributes.name || 'Tệp đính kèm'],
  addNodeView: () => ReactNodeViewRenderer(AttachmentView),
});
function CodeView({ node, updateAttributes }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  return <NodeViewWrapper className="nw-code-block"><div className="nw-code-header" contentEditable={false}><select aria-label="Ngôn ngữ code" value={node.attrs.language || 'javascript'} onChange={event => updateAttributes({ language: event.target.value })}>{CODE_LANGUAGES.map(language => <option key={language} value={language}>{language === 'csharp' ? 'C#' : language === 'cpp' ? 'C++' : language.toUpperCase()}</option>)}</select><button onClick={async () => { try { await navigator.clipboard.writeText(node.textContent); setCopied(true); setError(''); setTimeout(() => setCopied(false), 1800); } catch { setError('Không sao chép được. Hãy chọn code và nhấn Ctrl+C.'); } }}>{copied ? '✓ Đã sao chép' : 'Copy code'}</button>{error && <span role="status">{error}</span>}</div><pre><NodeViewContent as="code" /></pre></NodeViewWrapper>;
}
export const NotebookCode = CodeBlockLowlight.extend({ addNodeView: () => ReactNodeViewRenderer(CodeView) }).configure({ lowlight: createLowlight(common), defaultLanguage: 'javascript' });
export const FontSize = Extension.create({ name: 'fontSize', addGlobalAttributes: () => [{ types: ['textStyle'], attributes: { fontSize: { default: null, parseHTML: element => element.style.fontSize || null, renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {} } } }],
  addCommands() { return { setFontSize: size => ({ chain }) => chain().setMark('textStyle', { fontSize: `${parseInt(size, 10) || 16}px` }).run(), unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run() }; },
});
export const NotebookComment = Mark.create({ name: 'notebookComment', inclusive: false,
  addAttributes: () => ({ text: { default: '' } }), parseHTML: () => [{ tag: 'span[data-notebook-comment]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { 'data-notebook-comment': HTMLAttributes.text, class: 'nw-comment-mark', title: HTMLAttributes.text }, 0],
});
