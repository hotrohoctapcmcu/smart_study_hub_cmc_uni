export const SLASH_COMMANDS = [
  { id: 'text', title: 'Văn bản', hint: 'Text', icon: 'T', group: 'CƠ BẢN' },
  { id: 'h1', title: 'Tiêu đề 1', hint: 'Heading 1', icon: 'H₁', group: 'CƠ BẢN' },
  { id: 'h2', title: 'Tiêu đề 2', hint: 'Heading 2', icon: 'H₂', group: 'CƠ BẢN' },
  { id: 'h3', title: 'Tiêu đề 3', hint: 'Heading 3', icon: 'H₃', group: 'CƠ BẢN' },
  { id: 'bullet', title: 'Danh sách dấu đầu dòng', hint: 'Bullet List', icon: '•', group: 'CƠ BẢN' },
  { id: 'number', title: 'Danh sách đánh số', hint: 'Numbered List', icon: '1.', group: 'CƠ BẢN' },
  { id: 'checklist', title: 'Danh sách công việc', hint: 'Checklist', icon: '☑', group: 'CƠ BẢN' },
  { id: 'quote', title: 'Trích dẫn', hint: 'Quote', icon: '❝', group: 'CƠ BẢN' },
  { id: 'table', title: 'Bảng', hint: 'Table', icon: '▦', group: 'NỘI DUNG' },
  { id: 'image', title: 'Ảnh', hint: 'Image', icon: '▧', group: 'NỘI DUNG' },
  { id: 'lecture', title: 'Chèn từ bài giảng', hint: 'Lecture slide', icon: '▣', group: 'NỘI DUNG' },
  { id: 'file', title: 'Tệp đính kèm', hint: 'File', icon: '↗', group: 'NỘI DUNG' },
  { id: 'link', title: 'Liên kết', hint: 'Link', icon: '⌁', group: 'NỘI DUNG' },
  { id: 'code', title: 'Code', hint: 'Code block', icon: '</>', group: 'NỘI DUNG' },
  { id: 'formula', title: 'Công thức', hint: 'Formula LaTeX', icon: '∑', group: 'NỘI DUNG' },
  { id: 'divider', title: 'Đường phân cách', hint: 'Divider', icon: '―', group: 'NỘI DUNG' },
  { id: 'flashcard', title: 'Flashcard', hint: 'Flashcard', icon: '✦', group: 'HỌC TẬP' },
  { id: 'remember', title: 'Ghi nhớ', hint: 'Callout remember', icon: '💡', group: 'HỌC TẬP' },
  { id: 'important', title: 'Quan trọng', hint: 'Important', icon: '⚠', group: 'HỌC TẬP' },
  { id: 'example', title: 'Ví dụ', hint: 'Example', icon: '📌', group: 'HỌC TẬP' },
  { id: 'question', title: 'Câu hỏi', hint: 'Question', icon: '?', group: 'HỌC TẬP' },
  { id: 'definition', title: 'Định nghĩa', hint: 'Definition', icon: '📖', group: 'HỌC TẬP' },
  { id: 'cornell', title: 'Cornell Notes', hint: 'Cornell', icon: '▥', group: 'HỌC TẬP' },
  { id: 'drawing', title: 'Bản vẽ', hint: 'Drawing', icon: '✎', group: 'CÔNG CỤ' },
  { id: 'ai', title: 'AI Tutor', hint: 'AI', icon: '✧', group: 'CÔNG CỤ' },
];
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
export const filterCommands = query => SLASH_COMMANDS.filter(item => normalize(`${item.id} ${item.title} ${item.hint}`).includes(normalize(query))).sort((a, b) => Number(b.id === normalize(query)) - Number(a.id === normalize(query)));
export default function SlashMenu({ state, items, onChoose, onClose }) {
  if (!state) return null;
  return <div className="nw-slash-menu" role="listbox" aria-label="Chèn block" style={{ left: state.left, top: state.top }} onMouseDown={event => event.preventDefault()}>
    <div className="nw-slash-heading"><span>CHÈN NỘI DUNG</span><button onClick={onClose} aria-label="Đóng lệnh">×</button></div>
    {items.length ? items.map((item, index) => <button key={item.id} role="option" aria-selected={state.index === index} className={state.index === index ? 'is-active' : ''} onClick={() => onChoose(item.id)} ref={element => { if (state.index === index) element?.scrollIntoView?.({ block: 'nearest' }); }}><span className="nw-slash-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.hint}</small></span><kbd>↵</kbd></button>) : <p>Không tìm thấy lệnh phù hợp.</p>}
    <div className="nw-slash-footer">↑ ↓ chọn · Enter chèn · Esc đóng</div>
  </div>;
}
