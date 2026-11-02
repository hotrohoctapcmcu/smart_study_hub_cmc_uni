import { ArrowRight, BookOpen, Check, Clock3, Layers, Play, Presentation, Files } from 'lucide-react';
import { Button, ProgressBar } from '../common/ui';
import SlidePreview from './SlidePreview';
import { allSlides, courseCover, studyStats } from '../../utils/studyMaterials';

export function StudySummary({ courses, documents }) {
  const values = [
    [BookOpen, courses.length, 'Môn học'], [Layers, courses.reduce((n, c) => n + c.chapters.length, 0), 'Chương'],
    [Presentation, courses.reduce((n, c) => n + allSlides(c).length, 0), 'Slide'],
    [Files, documents.filter(d => !/^(pdf|png|jpe?g)$/.test(String(d.type || d.extension || (d.title || '').split('.').at(-1)).toLowerCase()) && !/^(image\/|application\/pdf)/.test(d.mime_type || d.mimeType || '')).length, 'Tài liệu khác'],
  ];
  return <div className="study-summary" aria-label="Tổng quan tài liệu">{values.map(([Icon, count, label]) => <div className="study-stat" key={label}><span className="study-stat-icon"><Icon size={20} /></span><div><strong>{count.toLocaleString('vi-VN')}</strong><span>{label}</span></div></div>)}</div>;
}
function Progress({ stats }) {
  return <div className="study-progress"><div><span>{stats.learned ? `Đã học ${stats.learned}/${stats.total} slide` : 'Chưa học'}{stats.opened > 0 && !stats.learned ? ` · Đã mở ${stats.opened}` : ''}</span><strong>{stats.percent}%</strong></div><ProgressBar value={stats.percent} /></div>;
}
export function SubjectCard({ course, records, onSelect }) {
  const stats = studyStats(allSlides(course), records);
  return <button className="study-subject-card" onClick={() => onSelect(course)} aria-label={`Mở môn ${course.title}`}>
    <div className="subject-cover"><SlidePreview slide={courseCover(course)} /><span className="subject-cover-badge"><BookOpen size={12} /> {course.code || 'Cá nhân'}</span></div>
    <div className="subject-card-body"><h3>{course.title}</h3><p>{course.semester || 'Tài liệu học tập của bạn'}</p><div className="subject-counts"><span><Layers size={14} />{course.chapters.length} chương</span><span><Presentation size={14} />{stats.total} slide</span></div><Progress stats={stats} /><div className="subject-card-action"><span>{stats.status === 'completed' ? 'Xem lại bài giảng' : stats.opened ? 'Tiếp tục học' : 'Khám phá bài giảng'}</span><ArrowRight size={17} /></div></div>
  </button>;
}
export function SubjectHeader({ course, records }) {
  const stats = studyStats(allSlides(course), records);
  return <div className="study-detail-header"><div><span className="study-kicker">{course.code || 'MÔN HỌC CỦA BẠN'}</span><h2>{course.title}</h2><p>{course.chapters.length} chương <span>·</span> {stats.total} slide {course.semester && <> <span>·</span> {course.semester}</>}</p></div><Progress stats={stats} /></div>;
}
export function ChapterCard({ chapter, records, onSelect }) {
  const stats = studyStats(chapter.slides, records);
  return <article className="study-chapter-card"><button className="chapter-cover" onClick={() => onSelect(chapter)} aria-label={`Mở ${chapter.title}`}><SlidePreview slide={chapter.slides.find(s => s.images.length || s.pdf) || chapter.slides[0]} /></button><div className="chapter-card-body"><span className="study-kicker">CHƯƠNG {String(chapter.number).padStart(2, '0')}</span><h3>{chapter.title}</h3><p><Presentation size={14} /> {stats.total} slide {stats.status === 'completed' && <span className="study-complete"><Check size={13} /> Hoàn thành</span>}</p><Progress stats={stats} />{chapter.error && <small className="study-data-warning">{chapter.error}</small>}</div><Button variant="outline" onClick={() => onSelect(chapter)}>{stats.status === 'completed' ? 'Xem lại' : stats.opened ? 'Tiếp tục học' : 'Bắt đầu học'}<ArrowRight size={15} /></Button></article>;
}
export function SlideCard({ slide, record, current, onSelect }) {
  return <button className={`study-slide-card ${current ? 'is-current' : ''} ${record?.learned ? 'is-learned' : ''}`} onClick={() => onSelect(slide)} aria-label={`Mở slide ${slide.number}: ${slide.title}`}><div className="slide-card-image"><SlidePreview slide={slide} /><span className="slide-number">{String(slide.number).padStart(2, '0')}</span>{record?.learned && <span className="slide-learned" aria-label="Đã học"><Check size={15} /></span>}</div><div className="slide-card-caption"><strong>Slide {String(slide.number).padStart(2, '0')}</strong><span>{slide.title}</span>{current && <small>Đang học</small>}</div></button>;
}
export function ContinueLearning({ item, records, onResume }) {
  if (!item) return <section className="study-start-card"><span className="study-start-icon"><BookOpen size={25} /></span><div><span className="study-kicker">MỖI NGÀY, THÊM MỘT CHÚT KIẾN THỨC</span><h2>Bài học tiếp theo đang chờ bạn</h2><p>Chọn một môn bên dưới để bắt đầu. Bạn có thể quay lại đúng slide đang học bất cứ lúc nào.</p></div></section>;
  const { course, chapter, slide } = item, stats = studyStats(chapter.slides, records);
  return <section className="study-continue"><div className="continue-content"><span className="study-kicker"><span className="study-live-dot" /> TIẾP TỤC HỌC</span><h2>{course.title}</h2><p>Chương {chapter.number} · {chapter.title}</p><div className="continue-slide"><Presentation size={15} /> Slide {String(slide.number).padStart(2, '0')} / {chapter.slides.length}<span>·</span>{stats.percent}% chương đã hoàn thành</div><Button onClick={() => onResume(item)}><Play size={15} fill="currentColor" /> Tiếp tục học<ArrowRight size={16} /></Button></div><div className="continue-image"><SlidePreview slide={slide} /></div></section>;
}
export function RecentLearning({ items, onResume }) {
  const recent = items.filter((item, index) => items.findIndex(other => other.course.id === item.course.id) === index).slice(0, 3);
  if (!recent.length) return null;
  const timeLabel = value => {
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
    return minutes < 1 ? 'Vừa học' : minutes < 60 ? `${minutes} phút trước` : minutes < 1440 ? `${Math.floor(minutes / 60)} giờ trước` : `${Math.floor(minutes / 1440)} ngày trước`;
  };
  return <section className="study-recent"><div className="study-section-heading"><h2><Clock3 size={18} />Học gần đây</h2><span>Quay lại nhịp học của bạn</span></div><div className="recent-learning-grid">{recent.map(item => <button key={item.course.id} onClick={() => onResume(item)}><div className="recent-thumb"><SlidePreview slide={item.slide} /></div><div><strong>{item.course.title}</strong><span>Chương {item.chapter.number} · Slide {String(item.slide.number).padStart(2, '0')}</span><small>{timeLabel(item.openedAt)}</small></div><ArrowRight size={16} /></button>)}</div></section>;
}
