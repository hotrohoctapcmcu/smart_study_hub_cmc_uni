import { Component, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './AIContent.css';
import { aiText } from '../../utils/aiText';
import { prepareAIMarkdown } from '../../utils/aiMarkdown';
class ContentBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="ai-plain">{this.props.text}</div> : this.props.children; }
}
const components = {
  a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
  // No remote image loads or raw HTML execution in generated answers.
  img: ({ alt }) => <span className="ai-image-alt">[Ảnh: {alt || 'không có mô tả'}]</span>,
  table: ({ children }) => <div className="ai-table-scroll" tabIndex={0} role="region" aria-label="Bảng trong câu trả lời"><table>{children}</table></div>,
};
export default function AIContent({ children, text, className = '' }) {
  const source = aiText(text ?? children);
  return <div className={'ai-content ' + className} dir="auto">
    <ContentBoundary key={source} text={source}>
      {source.length > 100000 ? <div className="ai-plain">{source}</div> :
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false, maxExpand: 1000, maxSize: 10 }]]} components={components}>{prepareAIMarkdown(source)}</ReactMarkdown>}
    </ContentBoundary>
  </div>;
}
export function EditableAIContent({ text, onChange, label = 'Nội dung AI' }) {
  const [value, setValue] = useState(aiText(text)), [baseline, setBaseline] = useState(aiText(text)), [editing, setEditing] = useState(false), [preview, setPreview] = useState(false);
  useEffect(() => { setValue(aiText(text)); setBaseline(aiText(text)); }, [text]);
  return <div className="ai-editable">
    {editing && !preview ? <textarea aria-label={'Chỉnh sửa ' + label} value={value} onChange={e => setValue(e.target.value)} rows={10} spellCheck={false} /> : <AIContent text={value} />}
    <div className="ai-content-actions">
      {editing ? <>
        <button type="button" onClick={() => setPreview(v => !v)}>{preview ? 'Tiếp tục sửa' : 'Xem trước'}</button>
        <button type="button" onClick={() => { setBaseline(value); onChange?.(value); setEditing(false); setPreview(false); }}>Áp dụng bản sửa</button>
        <button type="button" onClick={() => { setValue(baseline); setEditing(false); setPreview(false); }}>Hủy sửa</button>
        <small>Markdown: **đậm**, *nghiêng*, `mã`, $công thức$</small>
        {!onChange && <small>Bản sửa chỉ áp dụng trong màn hình này.</small>}
      </> : <button type="button" onClick={() => setEditing(true)}>Chỉnh sửa định dạng</button>}
    </div>
  </div>;
}
