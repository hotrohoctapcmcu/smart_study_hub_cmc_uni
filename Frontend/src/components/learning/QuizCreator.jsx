import { useEffect, useState } from 'react';
import { courseApi, documentApi } from '../../api';
import { useCurrentCourses } from '../../hooks/useCurrentCourses';
import { useApi } from '../../hooks/useApi';
import { responseList } from '../../api/apiClient';
import { sameLearningSubject } from '../../utils/learningFlow';
import CurrentCourseHint from '../common/CurrentCourseHint';
import { Button, Field, ErrorState } from '../common/ui';

export default function QuizCreator({ initialSubject, initialTopic, initialCount = 10, onCreate, busy }) {
  const current = useCurrentCourses(), catalog = useApi(courseApi.list), files = useApi(documentApi.list);
  const detail = useApi(courseApi.detail, { immediate: false });
  const [subject, setSubject] = useState(initialSubject || ''), [topic, setTopic] = useState(initialTopic || ''), [count, setCount] = useState(initialCount), [difficulty, setDifficulty] = useState('medium');
  const [chapterId, setChapterId] = useState(''), [source, setSource] = useState(''), [error, setError] = useState(null);
  useEffect(() => {
    const matching = current.subjects.find(s => sameLearningSubject(s.subject_name, initialSubject));
    if (matching && subject === initialSubject) setSubject(matching.subject_name);
  }, [current.data, initialSubject, subject]);
  const course = responseList(catalog.data, 'courses').find(c => !c.pending && sameLearningSubject(c.subject, subject));
  useEffect(() => { if (course) detail.execute(course.id); }, [course?.id, detail.execute]);
  const chapters = !detail.loading && String(detail.data?.id) === String(course?.id) ? detail.data?.chapters || [] : [];
  const sourceDocs = chapters.filter(ch => !chapterId || String(ch.id) === chapterId).flatMap(ch => (ch.documents || []).map(d => ({ ...d, chapterId: String(ch.id), chapter: ch.title })));
  const uploads = responseList(files.data, 'documents').filter(d => sameLearningSubject(d.subject, subject));
  return <form className="stack" onSubmit={e => {
    e.preventDefault();
    if (!current.subjects.some(s => s.subject_name === subject) || !topic.trim() || busy) return;
    setError(null);
    const selected = sourceDocs.find(d => `slide:${d.chapterId}:${d.id}` === source);
    if (source.startsWith('slide:') && !selected || source && !source.startsWith('upload:') && (!course || detail.loading)) {
      setError(new Error('Nguồn đã chọn không còn sẵn sàng. Hãy tải lại và chọn đúng tài liệu trước khi tạo quiz.')); return;
    }
    onCreate({ subject, topic, count: Number(count), difficulty,
      ...(source ? { source: source.startsWith('upload:') ? { uploadId: source.slice(7) } : selected ? { courseId: course.id, chapterId: selected.chapterId, documentId: String(selected.id) } : { courseId: course?.id, ...(chapterId ? { chapterId } : {}) } } : {}) });
  }}>
    <fieldset disabled={busy} className="stack" style={{ border: 0, padding: 0 }}>
      {error && <ErrorState error={error} title="Chưa dùng được tài liệu nguồn" />}
      <Field label="Môn học / chủ đề"><select required value={subject} onChange={e => { setSubject(e.target.value); setChapterId(''); setSource(''); }}><option value="">Chọn môn kỳ hiện tại</option>{current.subjects.map(s => <option key={s.subject_id}>{s.subject_name}</option>)}</select></Field>
      <CurrentCourseHint state={current} />
      {initialSubject && !current.loading && !current.subjects.some(s => sameLearningSubject(s.subject_name, initialSubject)) && <p role="status">Môn từ màn hình nguồn chưa có trong kỳ hiện tại. Hãy đồng bộ IU hoặc chọn môn khác.</p>}
      <Field label="Chương"><select value={chapterId} onChange={e => { setChapterId(e.target.value); setSource(''); const ch = chapters.find(c => String(c.id) === e.target.value); if (ch) setTopic(ch.title); }}><option value="">Chọn chương (tùy chọn)</option>{chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}</select></Field>
      <Field label="Chủ đề ôn tập" required maxLength={180} value={topic} onChange={e => setTopic(e.target.value)} />
      <Field label="Tài liệu nguồn"><select value={source} onChange={e => setSource(e.target.value)}><option value="">Kiến thức chung (không dùng tài liệu)</option>{course && <option value="course">{chapterId ? 'Nội dung chương đã chọn' : 'Bài giảng toàn môn'}</option>}{sourceDocs.map(d => <option key={`${d.chapterId}:${d.id}`} value={`slide:${d.chapterId}:${d.id}`}>{d.chapter} · {d.title}</option>)}{uploads.map(d => <option key={d.id} value={`upload:${d.id}`}>{d.title} · {d.fileType || d.type || 'File'}</option>)}</select></Field>
      {detail.loading && <p role="status">Đang tải chương và nguồn…</p>}
      {(catalog.error || detail.error || files.error) && <ErrorState error={catalog.error || detail.error || files.error} title="Một số nguồn chưa tải được" onRetry={() => { catalog.refetch(); files.refetch(); if (course) detail.execute(course.id); }} />}
      <p className="hint">Chỉ dùng nguồn có văn bản đọc được, tối đa 15.000 ký tự. File tải lên hỗ trợ TXT/Markdown; định dạng khác cần chuyển sang văn bản. Nguồn lỗi sẽ báo lỗi để bạn chọn lại.</p>
      <div className="form-grid"><Field label="Số câu"><select value={count} onChange={e => setCount(Number(e.target.value))}>{[5, 10, 15].map(n => <option key={n} value={n}>{n} câu</option>)}</select></Field><Field label="Độ khó"><select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></select></Field></div>
      <Button type="submit" disabled={busy || !current.subjects.some(s => s.subject_name === subject) || !topic.trim() || (source && (detail.loading || !course) && !source.startsWith('upload:'))}>{busy ? 'Đang tạo quiz…' : 'Tạo quiz'}</Button>
    </fieldset>
  </form>;
}
