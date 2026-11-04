import { useState } from 'react';
import { BookImage, ChevronRight, Check } from 'lucide-react';
import useStudyLibrary from '../../../hooks/useStudyLibrary';
import SlidePreview from '../../../components/documents/SlidePreview';
import { renderPdfPage } from '../../../utils/pdfPages';
import { Modal, Button, ApiContent, ErrorState } from '../../../components/common/ui';

const blobData = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Không đọc được ảnh bài giảng.')); reader.readAsDataURL(blob); });
export default function LecturePicker({ subject, onClose, onInsert }) {
  const library = useStudyLibrary(true), courses = library.data?.courses || [];
  const [courseId, setCourseId] = useState(''), [chapterId, setChapterId] = useState(''), [slideId, setSlideId] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const course = courses.find(item => item.id === courseId) || (!courseId && courses.find(item => item.title === subject));
  const chapter = course?.chapters.find(item => item.id === chapterId);
  const slide = chapter?.slides.find(item => item.id === slideId);
  async function insert() {
    if (!slide || busy) return;
    setBusy(true); setError(null);
    try {
      let src = slide.pdf ? (await renderPdfPage(slide.pdf, slide.pdfPage, 1.3)).src : slide.images?.[0];
      if (!src) throw new Error('Slide này chưa có ảnh gốc. Bạn có thể chọn slide khác hoặc tải PDF gốc vào Tài liệu.');
      if (src.startsWith('blob:')) src = await blobData(await (await fetch(src)).blob());
      if (src.length > 800000) throw new Error('Ảnh slide quá lớn cho trang hiện tại. Hãy dùng ảnh nhỏ hơn hoặc tách trang.');
      onInsert({ src, alt: slide.title, caption: `${course.title} · ${chapter.title} · Slide ${slide.number}`, width: '100%', align: 'center' });
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }
  return <Modal isOpen title="Chèn từ bài giảng" onClose={onClose} size="lg"><p className="nw-modal-hint">Chọn trang PDF hoặc ảnh đã tải lên trong Tài liệu học tập.</p><ApiContent state={library}><div className="nw-lecture-path"><label>Môn học<select aria-label="Chọn môn bài giảng" value={course?.id || ''} onChange={event => { setCourseId(event.target.value); setChapterId(''); setSlideId(''); }}><option value="">Chọn môn học</option>{courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><ChevronRight size={15} /><label>Chương<select aria-label="Chọn chương bài giảng" value={chapterId} disabled={!course} onChange={event => { setChapterId(event.target.value); setSlideId(''); }}><option value="">Chọn chương</option>{course?.chapters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>{library.data?.failures?.length > 0 && <details className="nw-lecture-errors"><summary>Một số tài liệu chưa tải được ({library.data.failures.length})</summary>{library.data.failures.map((failure, i) => <p key={i}>{failure.title}: {failure.error?.message}</p>)}</details>}{!courses.length && <p className="nw-modal-hint">Tải PDF hoặc ảnh lên Tài liệu học tập để chèn vào ghi chú.</p>}<div className="nw-lecture-grid">{chapter?.slides.map(item => <button key={item.id} className={item.id === slideId ? 'selected' : ''} onClick={() => setSlideId(item.id)}><SlidePreview slide={item} /><span><b>{item.number.toString().padStart(2, '0')}</b>{item.title}{item.id === slideId && <Check size={15} />}</span>{!item.images?.length && !item.pdf && <small>Chưa có ảnh gốc</small>}</button>)}</div>{chapter && !chapter.slides.length && <p>Chương này chưa có slide.</p>}</ApiContent>{error && <ErrorState error={error} />}<div className="form-actions"><Button variant="outline" onClick={onClose}>Hủy</Button><Button disabled={!slide || busy || (!slide.pdf && !slide.images?.length)} onClick={insert}><BookImage size={15} />{busy ? 'Đang lấy ảnh gốc…' : 'Chèn slide vào trang'}</Button></div></Modal>;
}
