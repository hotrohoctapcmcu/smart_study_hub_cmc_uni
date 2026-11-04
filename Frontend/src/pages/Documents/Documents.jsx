import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { courseApi, studentApi } from '../../api';
import { unwrapResponse } from '../../api/apiClient';
import { useApi } from '../../hooks/useApi';
import { useLearningCatalog, learningJobActive } from '../../hooks/useLearningCatalog';
import LearningQueue from '../../components/learning/LearningQueue';
import useStudyLibrary from '../../hooks/useStudyLibrary';
import useStudyProgress from '../../hooks/useStudyProgress';
import { matchesStudyFilters, recentSlides } from '../../utils/studyMaterials';
import { matchesDocumentFilters } from '../../utils/learningFlow';
import { PageHeader, Button, Tabs, Modal, ApiContent, ErrorState, LoadingSkeleton, useAction } from '../../components/common/ui';
import { StudySummary } from '../../components/documents/StudyCards';
import DocumentSearch, { DocumentFilters, SearchResults } from '../../components/documents/DocumentSearch';
import StudyLectureContent from '../../components/documents/StudyLectureContent';
import SlideViewer from '../../components/documents/SlideViewer';
import DocumentLibrary, { UploadForm } from './DocumentLibrary';
const Notebooks = lazy(() => import('../Notebooks/Notebooks'));
import './Documents.css';

export { documentCategory, DocumentCard } from './DocumentLibrary';
const emptyFilters = { subject: '', semester: '', category: '', status: '' };
export default function Documents() {
  const [params, setParams] = useSearchParams();
  const tab = ['files', 'reference', 'notes', 'notebooks'].includes(params.get('tab')) ? params.get('tab') : params.has('document') ? 'files' : 'lectures';
  const library = useStudyLibrary(tab === 'lectures');
  const profile = useApi(studentApi.getProfile);
  const owner = profile.data?.student_code || profile.data?.student_id || profile.data?.studentId || profile.data?.ma_sinh_vien || profile.data?.user_id || 'device';
  const progress = useStudyProgress(owner);
  const [query, setQuery] = useState(''), [filters, setFilters] = useState(emptyFilters), [upload, setUpload] = useState(false), [revision, setRevision] = useState(0);
  const { run, busy, notify } = useAction();
  const queue = useLearningCatalog({ onChange: () => library.refetch(), onSettled: entry => { library.refetch(); notify(entry.message || entry.error, String(entry.status).toLowerCase() === "completed" ? "success" : "error"); } });
  const courses = library.data?.courses || [], documents = library.data?.documents || [];
  const selected = courses.find(course => course.id === params.get('subject'));
  const chapter = selected?.chapters.find(item => item.id === params.get('chapter'));
  const slide = chapter?.slides.find(item => item.id === params.get('slide'));
  const recent = useMemo(() => recentSlides(courses, progress.records), [courses, progress.records]);
  const filteredCourses = courses.filter(course => matchesStudyFilters(course, filters, progress.records));
  const filteredDocuments = documents.filter(doc => matchesDocumentFilters(doc, filters, courses, progress.records));
  function navigateTo(course, targetChapter, targetSlide) {
    const next = new URLSearchParams(params);
    ['subject', 'chapter', 'slide', 'document', 'note', 'tab'].forEach(key => next.delete(key));
    if (course) next.set('subject', course.id);
    if (targetChapter) next.set('chapter', targetChapter.id);
    if (targetSlide) next.set('slide', targetSlide.id);
    setParams(next); setQuery('');
  }
  function resume(item) { navigateTo(item.course, item.chapter, item.slide); }
  function changeFilters(value) {
    setFilters(value);
    if (selected) {
      const next = new URLSearchParams(params);
      ['subject', 'chapter', 'slide'].forEach(key => next.delete(key));
      setParams(next);
    }
  }
  const closeSlide = () => { const next = new URLSearchParams(params); next.delete('slide'); setParams(next, { replace: true }); };
  useEffect(() => { setQuery(''); setFilters(emptyFilters); }, [tab]);
  const switchTab = value => {
    const next = new URLSearchParams(params);
    ['tab', 'subject', 'chapter', 'slide', 'document', 'note'].forEach(key => next.delete(key));
    if (value !== 'lectures') next.set('tab', value);
    setParams(next);
  };
  if (tab === 'notebooks') return <Suspense fallback={<div className="page"><LoadingSkeleton /></div>}><Notebooks embedded /></Suspense>;
  return <div className="page documents-page study-documents-page">
    <PageHeader eyebrow="KHÔNG GIAN HỌC TẬP" title="Tài liệu học tập" description="Toàn bộ bài giảng của bạn, được sắp xếp theo môn học và chương.">
      <Button variant="outline" disabled={busy} onClick={() => run(async () => {
        const result = unwrapResponse(await courseApi.sync());
        if (!result?.jobId) throw new Error('Máy chủ chưa trả yêu cầu đồng bộ hợp lệ.'); queue.watch(result, { kind: 'sync' });
      })}><RefreshCw size={15} className={queue.jobs.some(learningJobActive) ? 'study-spinning' : ''} />Đồng bộ tài liệu</Button>
      <Button onClick={() => setUpload(true)}><Plus size={17} />Tải tài liệu</Button>
    </PageHeader>
    <LearningQueue queue={queue} />
    {!library.loading && library.data && <StudySummary courses={courses} documents={documents} />}
    <Tabs items={[["lectures", "Bài giảng"], ["reference", "Tài liệu tham khảo"], ["files", "File"], ["notes", "Ghi chú"], ["notebooks", "Sổ tay"]]} value={tab} onChange={switchTab} />
    {tab === 'lectures' ? <>
      <DocumentSearch query={query} setQuery={setQuery}><DocumentFilters courses={courses} documents={documents} value={filters} onChange={changeFilters} /></DocumentSearch>
      <ApiContent state={library}>
        {library.data?.failures?.length > 0 && <details className="study-partial-errors"><summary>Một số tài liệu chưa tải được ({library.data.failures.length})</summary>{library.data.failures.map((failure, i) => <ErrorState key={i} title={failure.title} error={failure.error} onRetry={library.refetch} />)}</details>}
        {progress.error && <ErrorState title="Chưa lưu được tiến độ học" error={progress.error} />}
        {query.trim() || ['word', 'presentation'].includes(filters.category) ? <SearchResults query={query} courses={filteredCourses} documents={filteredDocuments} category={filters.category} onSubject={navigateTo} onChapter={navigateTo} onSlide={resume} onDocument={doc => { const next = new URLSearchParams(params); next.set('tab', 'files'); next.set('document', String(doc.document_id ?? doc.id)); setParams(next); }} />
          : <StudyLectureContent courses={courses} filteredCourses={filteredCourses} records={progress.records} recent={recent} selected={selected} chapter={chapter} slide={slide} params={params} navigateTo={navigateTo} resume={resume} filters={filters} scope={library.data?.scope} />}
        <p className="study-storage-hint">Tiến độ, đánh dấu và ghi chú theo slide được lưu trên trình duyệt này. Các slide thiếu ảnh gốc hiển thị nội dung thật của bài giảng.</p>
      </ApiContent>
    </> : <DocumentLibrary key={`${tab}-${revision}`} />}
    <Modal isOpen={upload} title="Tải tài liệu lên" onClose={() => setUpload(false)}><UploadForm onClose={() => setUpload(false)} onSaved={async () => { setUpload(false); setRevision(n => n + 1); await library.refetch(); }} /></Modal>
    {tab === 'lectures' && !library.loading && !profile.loading && selected && chapter && slide && <SlideViewer course={selected} chapter={chapter} slide={slide} records={progress.records} update={progress.update} storageError={progress.error} onSlide={s => navigateTo(selected, chapter, s)} onClose={closeSlide} />}
  </div>;
}
