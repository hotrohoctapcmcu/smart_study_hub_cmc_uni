import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { documentApi } from '../../api';
import { saveBlob } from '../../utils/files';
import { Button, ErrorState, Modal } from '../common/ui';
import SlidePreview from './SlidePreview';
import SlideToolbar from './SlideToolbar';
import SlideStudyPanel from './SlideStudyPanel';

export default function SlideViewer({ course, chapter, slide, records, update, onSlide, onClose, storageError }) {
  const root = useRef(null), active = useRef(null), [zoom, setZoom] = useState(1), [panel, setPanel] = useState(''), [navigator, setNavigator] = useState(true);
  const [fullscreen, setFullscreen] = useState(false), [error, setError] = useState(null), [downloading, setDownloading] = useState(false), [pdfText, setPdfText] = useState('');
  const stage = useRef(null), [stageSize, setStageSize] = useState({ width: 0, height: 0 }), [dimensions, setDimensions] = useState({ width: 16, height: 9 });
  const receiveDimensions = useCallback(value => setDimensions(value), []);
  useEffect(() => {
    const node = stage.current;
    const measure = () => { const style = getComputedStyle(node); setStageSize({ width: node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), height: node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const visualWidth = Math.min(stageSize.width, stageSize.height * dimensions.width / dimensions.height);
  const pageStyle = { width: (slide.pdf || slide.images.length) && visualWidth > 0 ? `${visualWidth * zoom}px` : `${zoom * 100}%`, flexShrink: 0, '--slide-zoom': zoom };
  const index = chapter.slides.findIndex(item => item.id === slide.id), record = records[slide.key] || {};
  const receiveText = useCallback(text => setPdfText(text), []);
  const onUpdate = patch => update(slide.key, patch);
  useEffect(() => { update(slide.key, { openedAt: new Date().toISOString() }); setZoom(1); setPdfText(''); active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [slide.key, update]);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else throw new Error('Trình duyệt chưa hỗ trợ toàn màn hình.'); }
    catch (cause) { setError(cause); }
  }
  useEffect(() => {
    const keydown = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); onSlide(chapter.slides[index - 1]); }
      else if (event.key === 'ArrowRight' && index < chapter.slides.length - 1) { event.preventDefault(); onSlide(chapter.slides[index + 1]); }
      else if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(); }
      else if (['+', '='].includes(event.key)) { event.preventDefault(); setZoom(z => Math.min(3, z + .25)); }
      else if (event.key === '-') { event.preventDefault(); setZoom(z => Math.max(.5, z - .25)); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  async function download() {
    setDownloading(true); setError(null);
    try {
      if (slide.fileId) saveBlob(await documentApi.download(slide.fileId, true), slide.filename);
      else if (slide.images.length) {
        const response = await fetch(slide.images[0]);
        if (!response.ok) throw new Error('Không tải được ảnh gốc. Hãy thử lại.');
        const blob = await response.blob(), ext = blob.type.split('/')[1] || 'png';
        saveBlob({ data: blob }, `${course.code || course.title}-slide-${slide.number}.${ext}`);
      } else saveBlob({ data: new Blob([typeof slide.rawContent === 'string' ? slide.rawContent : slide.text], { type: 'text/plain;charset=utf-8' }) }, `${slide.title}.txt`);
    } catch (cause) { setError(cause); }
    finally { setDownloading(false); }
  }
  return <Modal isOpen size="study" title={`${course.title} · ${chapter.title}`} onClose={onClose}><div className="study-viewer" ref={root}>
    <SlideToolbar zoom={zoom} setZoom={setZoom} fullscreen={fullscreen} onFullscreen={toggleFullscreen} record={record} onUpdate={onUpdate} panel={panel} setPanel={setPanel} onDownload={download} downloading={downloading} />
    {(error || storageError) && <ErrorState title="Chưa hoàn tất thao tác" error={error || storageError} />}
    <div className={`study-viewer-layout ${navigator ? '' : 'without-navigator'} ${panel ? 'with-study-panel' : ''}`}>
      {navigator && <nav className="study-slide-navigator" aria-label="Điều hướng slide"><div className="slide-navigator-title">{chapter.slides.length} SLIDE</div>{chapter.slides.map(item => <button key={item.id} ref={item.id === slide.id ? active : null} onClick={() => onSlide(item)} aria-label={`Đến slide ${item.number}`} aria-current={item.id === slide.id ? 'page' : undefined}><SlidePreview slide={item} /><span>{String(item.number).padStart(2, '0')}{records[item.key]?.learned && <Check size={12} />}</span></button>)}</nav>}
      <div className="study-main-slide"><div className="study-current-heading"><Button variant="ghost" aria-label={navigator ? 'Ẩn danh sách slide' : 'Hiện danh sách slide'} onClick={() => setNavigator(value => !value)}>{navigator ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}</Button><span>SLIDE {String(slide.number).padStart(2, '0')}<strong>{slide.title}</strong></span></div><div className="study-slide-stage" ref={stage}><div className="study-slide-page" style={pageStyle}><SlidePreview key={slide.key} slide={slide} full onText={receiveText} onDimensions={receiveDimensions} /></div></div></div>
      {panel && <SlideStudyPanel key={`${slide.key}:${panel}`} panel={panel} onClose={() => setPanel('')} course={course} chapter={chapter} slide={slide} text={slide.text || pdfText} record={record} onUpdate={onUpdate} />}
    </div><footer className="study-viewer-footer"><Button variant="outline" disabled={index <= 0} onClick={() => onSlide(chapter.slides[index - 1])}><ChevronLeft size={17} /><span>Slide trước</span></Button><span className="study-page-count" aria-live="polite"><strong>{index + 1}</strong> / {chapter.slides.length}<small>← → chuyển slide · F toàn màn hình · + − thu phóng</small></span><Button variant="outline" disabled={index === chapter.slides.length - 1} onClick={() => onSlide(chapter.slides[index + 1])}><span>Slide sau</span><ChevronRight size={17} /></Button></footer>
  </div></Modal>;
}
