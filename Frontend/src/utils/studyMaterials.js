// EDUX lectures use text. Uploaded images and PDF pages are handled separately.
export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
function readableContent(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^(?:data:image\/|iVBORw0KGgo|\/9j\/|R0lGOD[dl]|UklGR)/i.test(value.trim())) return '';
  if (typeof value !== 'string') {
    if (/^(?:image|inlineImage|picture|img)$/i.test(value.type || '')) return '';
    if (Array.isArray(value)) return value.map(readableContent).filter(Boolean).join('\n');
    if (typeof value.text === 'string') return value.text;
    if (value.insert) return typeof value.insert === 'string' ? value.insert : '';
    return readableContent(value.content || value.ops || value.children || '');
  }
  try { if (/^[\[{]/.test(value.trim())) return readableContent(JSON.parse(value)); } catch { /* plain content */ }
  value = value.replace(/!\[[^\]]*\]\((?:[^()\n]|\([^()\n]*\))*\)/g, '');
  if (/<\/?(?:p|h[1-6]|div|ul|li|br|img|svg|picture)\b/i.test(value)) {
    const doc = new DOMParser().parseFromString(value.replace(/<\/(p|h[1-6]|div|li)>|<br\s*\/?\s*>/gi, '\n'), 'text/html');
    doc.querySelectorAll('script,style,iframe,img,svg,picture').forEach(node => node.remove());
    return doc.body.textContent.trim();
  }
  return value;
}
export function adaptCourse(course, scope = {}) {
  const id = String(course.id ?? course.subjectId ?? course.subject_id);
  return {
    ...course, id, title: course.subject || course.subjectName || course.subject_name || course.name || 'Môn học',
    code: course.subjectCode || course.subject_code || '',
    semester: course.semester || (scope.semester ? `Học kỳ ${scope.semester}${scope.academicYear ? ` · ${scope.academicYear}` : ''}` : ''),
    chapters: (course.chapters || []).map((chapter, ci) => {
      const chapterId = String(chapter.id ?? chapter.chapterId ?? ci);
      const slides = (chapter.documents || chapter.slides || chapter.pages || []).map((slide, si) => {
        const slideId = String(slide.id ?? slide.document_id ?? slide.page ?? si);
        return { ...slide, id: slideId, key: JSON.stringify([id, chapterId, slideId]), number: si + 1,
          sourceNumber: slide.number ?? slide.page ?? si + 1,
          title: slide.title || slide.name || `Slide ${String(si + 1).padStart(2, '0')}`,
          text: readableContent(slide.content || slide.rawContent || ''),
          images: [], category: 'slides' };
      });
      return { ...chapter, id: chapterId, number: ci + 1, title: chapter.title || chapter.name || `Chương ${ci + 1}`, slides };
    }),
  };
}
export const allSlides = course => course.chapters.flatMap(chapter => chapter.slides);
export function studyStats(slides, records) {
  const learned = slides.filter(slide => records[slide.key]?.learned).length;
  const opened = slides.filter(slide => records[slide.key]?.openedAt).length;
  return { total: slides.length, learned, opened, percent: slides.length ? Math.round(learned / slides.length * 100) : 0,
    status: learned && learned === slides.length ? 'completed' : opened ? 'learning' : 'new' };
}
export function recentSlides(courses, records) {
  return courses.flatMap(course => course.chapters.flatMap(chapter => chapter.slides.filter(slide => records[slide.key]?.openedAt)
    .map(slide => ({ course, chapter, slide, openedAt: records[slide.key].openedAt })))).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}
export function courseCover(course) {
  const slides = allSlides(course);
  return slides.find(slide => slide.images.length || slide.pdf) || slides.find(slide => slide.text && !/Nội dung trống/i.test(slide.text)) || slides[0];
}
export function matchesStudyFilters(course, { subject = '', semester = '', category = '', status = '' }, records) {
  return (!subject || course.id === subject) && (!semester || (semester === '__unclassified' ? !course.semester : course.semester === semester))
    && (!category || allSlides(course).some(slide => slide.category === category))
    && (!status || studyStats(allSlides(course), records).status === status);
}
