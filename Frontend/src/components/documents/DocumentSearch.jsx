import { SearchBox, EmptyState } from '../common/ui';
import { ArrowUpRight, BookOpen, Layers, Presentation, FileText, Search } from 'lucide-react';
import { normalizeSearch } from '../../utils/studyMaterials';
import { documentTerm } from '../../utils/learningFlow';

export function DocumentFilters({ courses, documents = [], value, onChange }) {
  const options = [
    ['subject', 'Lọc môn học', 'Tất cả môn học', courses.map(c => [c.id, c.title])],
    ['semester', 'Học kỳ', 'Tất cả học kỳ', [...new Set([...courses.map(c => c.semester), ...documents.map(documentTerm)].filter(Boolean))].map(s => [s, s]).concat([['__unclassified', 'Chưa phân loại']])],
    ['category', 'Loại tài liệu', 'Tất cả loại tài liệu', [['slides', 'Bài giảng'], ['pdf', 'PDF'], ['word', 'Word'], ['presentation', 'PowerPoint'], ['image', 'Ảnh']]],
    ['status', 'Trạng thái học', 'Tất cả trạng thái', [['learning', 'Đang học'], ['completed', 'Đã hoàn thành'], ['new', 'Chưa học']]],
  ];
  return <div className="study-filters">{options.map(([key, label, empty, values]) => <select key={key} aria-label={label} value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}><option value="">{empty}</option>{values.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>)}{Object.values(value).some(Boolean) && <button className="study-clear-filters" onClick={() => onChange({ subject: '', semester: '', category: '', status: '' })}>Xóa bộ lọc</button>}</div>;
}
export default function DocumentSearch({ query, setQuery, children }) {
  return <div className="study-search-area"><SearchBox value={query} onChange={setQuery} placeholder="Tìm môn học, chương, slide, tài liệu..." />{children}</div>;
}
export function SearchResults({ query, courses, documents, category, onSubject, onChapter, onSlide, onDocument }) {
  const q = normalizeSearch(query), results = [];
  const match = (...values) => normalizeSearch(values.filter(Boolean).join(' ')).includes(q);
  for (const course of courses) {
    if (match(course.title, course.code) && !category) results.push({ key: `subject-${course.id}`, label: course.title, detail: course.code, kind: 'Môn học', Icon: BookOpen, open: () => onSubject(course) });
    for (const chapter of course.chapters) {
      if (match(chapter.title) && (!category || chapter.slides.some(s => s.category === category))) results.push({ key: `chapter-${course.id}-${chapter.id}`, label: chapter.title, detail: course.title, kind: 'Chương', Icon: Layers, open: () => onChapter(course, chapter) });
      for (const slide of chapter.slides) if ((!category || slide.category === category) && match(slide.title, slide.text, `Slide ${slide.number}`, `Slide ${String(slide.number).padStart(2, '0')}`)) results.push({ key: slide.key, label: slide.title, detail: `${course.title} · ${chapter.title} · Slide ${slide.number}`, kind: 'Slide', Icon: Presentation, open: () => onSlide({ course, chapter, slide }) });
    }
  }
  for (const doc of documents) {
    const type = String(doc.type || doc.mime_type || doc.mimeType || (doc.title || '').split('.').at(-1)).toLowerCase();
    const kind = /pdf/.test(type) ? 'pdf' : /word|docx?/.test(type) ? 'word' : /ppt|presentation/.test(type) ? 'presentation' : /image|png|jpe?g/.test(type) ? 'image' : 'file';
    if ((!category || kind === category) && match(doc.title, doc.filename, doc.subject)) results.push({ key: `file-${doc.document_id ?? doc.id}`, label: doc.title || doc.filename, detail: doc.subject, kind: ({ pdf: 'PDF', word: 'Word', presentation: 'PowerPoint', image: 'Ảnh' })[kind] || 'File', Icon: FileText, open: () => onDocument(doc) });
  }
  return <section className="study-search-results"><div className="study-section-heading"><h2><Search size={18} />Kết quả tìm kiếm</h2><span>{results.length} kết quả</span></div>{results.length ? <div className="study-result-list">{results.slice(0, 100).map(({ key, Icon, label, detail, kind, open }) => <button key={key} onClick={open}><span className="study-result-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{detail}</small></span><span className="study-result-kind">{kind}</span><ArrowUpRight size={17} /></button>)}{results.length > 100 && <p className="hint">Đang hiển thị 100 kết quả đầu tiên. Nhập thêm từ khóa để tìm chính xác hơn.</p>}</div> : <EmptyState icon={<Search size={32} />} title="Chưa tìm thấy kết quả" description="Thử tên môn, chương, số slide hoặc một từ khóa trong bài giảng." />}</section>;
}
