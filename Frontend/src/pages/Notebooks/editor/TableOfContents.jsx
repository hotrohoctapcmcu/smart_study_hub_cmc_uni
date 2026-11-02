import { ListTree, Keyboard } from 'lucide-react';
export default function TableOfContents({ editor }) {
  const headings = [];
  if (editor && !editor.isDestroyed) editor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') headings.push({ title: node.textContent, level: node.attrs.level, pos }); });
  return <aside className="nw-toc" aria-label="Mục lục trang"><h3><ListTree size={15} /> NỘI DUNG</h3>{headings.length ? <nav>{headings.map((heading, i) => <button key={heading.pos} style={{ paddingLeft: (heading.level - 1) * 12 + 10 }} onClick={() => { editor.commands.focus(); editor.commands.setTextSelection(heading.pos + 1); editor.view.nodeDOM(heading.pos)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span>{i + 1}.</span>{heading.title || 'Tiêu đề chưa đặt tên'}</button>)}</nav> : <p>Thêm tiêu đề H1, H2 hoặc H3 để tạo mục lục.</p>}<div className="nw-shortcut-hint"><Keyboard size={18} /><strong>Viết theo dòng suy nghĩ.</strong><p>Gõ <kbd>/</kbd> để chèn block.<br /><kbd>Ctrl</kbd> + <kbd>B</kbd> để in đậm.<br /><kbd>#</kbd> + dấu cách để tạo tiêu đề.</p></div></aside>;
}
