import { useEffect, useRef, useState } from 'react';
import { FileImage, RefreshCw } from 'lucide-react';
import { renderPdfPage } from '../../utils/pdfPages';
import AIContent from '../common/AIContent';

// Lazy rendering keeps long, real-world chapters from allocating hundreds of canvases.
export default function SlidePreview({ slide, full = false, onText, onDimensions }) {
  const ref = useRef(null), [visible, setVisible] = useState(full), [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(null), [error, setError] = useState(null), [imageIndex, setImageIndex] = useState(0);
  useEffect(() => { setImageIndex(0); setError(null); setPage(null); }, [slide?.key, slide?.id]);
  useEffect(() => {
    if (full || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '240px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [full]);
  useEffect(() => {
    if (!slide?.pdf || !visible) return;
    let canceled = false;
    setPage(null); setError(null);
    renderPdfPage(slide.pdf, slide.pdfPage, full ? 1.6 : .5).then(value => { if (!canceled) setPage(value.src); }).catch(cause => { if (!canceled) setError(cause); });
    if (full && onText) slide.pdf.getPage(slide.pdfPage).then(page => page.getTextContent()).then(content => { if (!canceled) onText(content.items.map(item => item.str).join(' ')); }).catch(() => { /* Preview remains usable; AI reports unavailable text. */ });
    return () => { canceled = true; };
  }, [slide, visible, full, attempt, onText]);
  const source = page || slide?.images?.[imageIndex];
  return <div ref={ref} className={`slide-preview ${full ? 'is-full' : ''}`}>
    {source && !error ? <img src={source} alt={slide?.title || 'Trang bài giảng'} loading={full ? 'eager' : 'lazy'} decoding="async" onLoad={event => onDimensions?.({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => { if (imageIndex + 1 < (slide?.images?.length || 0)) setImageIndex(i => i + 1); else setError(new Error('Không tải được ảnh gốc.')); }} />
      : slide?.pdf && !error ? <span className="slide-preview-loading" role="status">Đang tải trang PDF…</span>
      : full && error ? <div className="slide-preview-missing"><FileImage size={28} /><span>{error.message}</span><button onClick={() => { setImageIndex(0); setError(null); setAttempt(n => n + 1); }}><RefreshCw size={14} /> Thử lại</button>{slide?.text && <AIContent text={slide.text} />}</div>
      : slide?.text ? <div className="slide-text-preview"><span className="slide-source-label">NỘI DUNG BÀI GIẢNG{error ? ' · Ảnh chưa tải được' : ''}</span><h4>{slide.title}</h4>{full ? <AIContent text={slide.text} /> : <p>{slide.text}</p>}</div>
      : <div className="slide-preview-missing"><FileImage size={24} /><span>{error ? 'Ảnh chưa tải được' : slide ? 'Chưa có ảnh hoặc nội dung gốc' : 'Chưa có slide'}</span></div>}
  </div>;
}
