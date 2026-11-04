import { useEffect, useRef } from 'react';
import { courseApi, documentApi } from '../api';
import { responseList, unwrapResponse } from '../api/apiClient';
import { useApi } from './useApi';
import { adaptCourse, normalizeSearch } from '../utils/studyMaterials';
import { openPdf } from '../utils/pdfPages';
import { documentTerm } from '../utils/learningFlow';

async function pool(items, work, concurrency = 3) {
  const results = new Array(items.length); let index = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
    while (index < items.length) { const i = index++; results[i] = await work(items[i]); }
  }));
  return results;
}
export default function useStudyLibrary(loadPages = true) {
  const resources = useRef(new Set()), generation = useRef(0);
  useEffect(() => () => { generation.current++; for (const resource of resources.current) resource.destroy ? resource.destroy() : URL.revokeObjectURL(resource); resources.current.clear(); }, []);
  const state = useApi(async () => {
    const current = ++generation.current;
    for (const resource of resources.current) resource.destroy ? resource.destroy() : URL.revokeObjectURL(resource);
    resources.current.clear();
    const [catalog, files] = await Promise.allSettled([courseApi.list(), documentApi.list()]);
    if (catalog.status === 'rejected' && files.status === 'rejected') throw catalog.reason;
    const data = catalog.status === 'fulfilled' ? unwrapResponse(catalog.value) : {};
    const failures = [];
    if (catalog.status === 'rejected') failures.push({ title: 'Không tải được môn học', error: catalog.reason });
    if (files.status === 'rejected') failures.push({ title: 'Không tải được file cá nhân', error: files.reason });
    const courses = await pool(responseList(data, 'courses'), async item => {
      try { return adaptCourse(item.pending || item.chapters?.some(ch => ch.documents || ch.slides || ch.pages) ? item : { ...item, ...unwrapResponse(await courseApi.detail(item.id)) }, data.scope); }
      catch (error) { failures.push({ title: `Chưa tải đủ slide: ${item.subject || item.subject_name}`, error }); return adaptCourse(item, data.scope); }
    });
    const documents = files.status === 'fulfilled' ? responseList(files.value, 'documents') : [];
    const lectureFiles = loadPages ? documents.filter(file => /^(pdf|png|jpe?g)$/.test(String(file.type || file.fileType || file.extension || (file.title || file.filename || '').split('.').at(-1)).toLowerCase()) || /^image\//.test(file.mime_type || file.mimeType || '') || (file.mime_type || file.mimeType) === 'application/pdf' || /^(application\/pdf|image\/)/.test(file.type || '')) : [];
    // Actual uploaded PDF pages use the same renderer as the notebook importer.
    const chapters = await pool(lectureFiles, async file => {
      const id = String(file.document_id ?? file.id), title = file.title || file.filename || 'Tài liệu';
      try {
        const response = await documentApi.download(id), blob = response.data;
        if (!(blob instanceof Blob)) throw new Error('Máy chủ chưa trả dữ liệu tập tin hợp lệ.');
        const pdf = /pdf/i.test(file.type || file.fileType || file.mime_type || file.mimeType || title.split('.').at(-1));
        if (pdf) {
          const handle = await openPdf(new Uint8Array(await blob.arrayBuffer()));
          if (current !== generation.current) { await handle.destroy(); return null; }
          resources.current.add(handle);
          return { file, id: `file-${id}`, title, slides: Array.from({ length: handle.numPages }, (_, i) => ({ id: `page-${i + 1}`, title: `Trang ${i + 1} · ${title}`, number: i + 1, text: '', images: [], category: 'pdf', pdf: handle, pdfPage: i + 1, fileId: id, filename: title })) };
        }
        const url = URL.createObjectURL(blob);
        if (current !== generation.current) { URL.revokeObjectURL(url); return null; }
        resources.current.add(url);
        return { file, id: `file-${id}`, title, slides: [{ id: 'image', title, number: 1, text: '', images: [url], category: 'image', fileId: id, filename: title }] };
      } catch (error) { failures.push({ title: `Không đọc được ${title}`, error }); return null; }
    }, 2);
    for (const chapter of chapters.filter(Boolean)) {
      const subject = chapter.file.subject || chapter.file.subject_name || 'Tài liệu chưa phân môn';
      let course = courses.find(course => [course.title, course.code].some(value => normalizeSearch(value) === normalizeSearch(subject)));
      if (course && course.semester !== documentTerm(chapter.file)) course = null;
      if (!course) { const term = documentTerm(chapter.file); const id = `files-${normalizeSearch(subject)}${term ? `-${term}` : ''}`;
        course = courses.find(item => item.id === id);
        if (!course) { course = { id, title: subject, code: '', semester: term, chapters: [] }; courses.push(course); }
      }
      chapter.number = course.chapters.length + 1;
      chapter.slides = chapter.slides.map(slide => ({ ...slide, key: JSON.stringify([course.id, chapter.id, slide.id]) }));
      course.chapters.push(chapter);
    }
    return { courses, documents, failures, scope: data.scope || {}, jobs: data.jobs || [] };
  }, { immediate: false });
  useEffect(() => { state.execute(); }, [loadPages, state.execute]);
  return { ...state, loading: state.loading || (!state.data && !state.error) };
}
