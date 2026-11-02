import { backendOrigin } from '../api/apiClient';

// Adapt source images and content from the Learning API and EDUX payloads.
export const normalizeSearch = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
export function base64ImageSource(value) {
  if (typeof value !== 'string') return '';
  const input = value.trim(), match = input.match(/^data:image\/(png|jpe?g|webp|gif);base64,([\s\S]+)$/i);
  const data = (match ? match[2] : input).replace(/\s/g, '');
  if (!/^[a-z\d+/]+={0,2}$/i.test(data) || data.length < 16 || data.length % 4 === 1) return '';
  let mime;
  if (data.startsWith('iVBORw0KGgo')) mime = 'png';
  else if (data.startsWith('/9j/')) mime = 'jpeg';
  else if (/^R0lGOD[dl]/.test(data)) mime = 'gif';
  else {
    try { const header = atob(data.slice(0, 16)); if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') mime = 'webp'; } catch { /* not image data */ }
  }
  return mime ? `data:image/${mime};base64,${data}` : '';
}
export function imageSource(value, baseUrl) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const source = value.trim();
  const base64 = base64ImageSource(source);
  if (base64) return base64;
  try {
    // Relative image paths belong to their source, never to an invented CDN.
    const url = new URL(source, baseUrl || backendOrigin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
export function extractSlideImages(value, baseUrl) {
  const images = [], seen = new Set();
  const add = value => { const url = imageSource(value, baseUrl); if (url && !seen.has(url)) { seen.add(url); images.push(url); } };
  const walk = (node, depth = 0) => {
    if (depth > 14 || node == null) return;
    if (typeof node === 'string') {
      const input = node.trim();
      if (/^[\[{]/.test(input)) { try { walk(JSON.parse(input), depth + 1); return; } catch { /* HTML or Markdown */ } }
      if (base64ImageSource(input) || /^https?:\/\/\S+\.(png|jpe?g|webp|gif)([?#].*)?$/i.test(input) || input.startsWith('data:image/')) add(input);
      if (/<img\b/i.test(input)) new DOMParser().parseFromString(input, 'text/html').querySelectorAll('img').forEach(img => add(img.getAttribute('src') || img.getAttribute('data-src')));
      for (const match of input.matchAll(/!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)) add(match[1]);
    } else if (Array.isArray(node)) node.forEach(item => walk(item, depth + 1));
    else if (typeof node === 'object') {
      for (const key of ['image_base64', 'imageBase64']) { const source = base64ImageSource(node[key]); if (source) add(source); }
      if (Array.isArray(node.images)) node.images.forEach(item => typeof item === 'string' ? add(item) : walk(item, depth + 1));
      for (const key of ['imageUrl', 'image_url', 'image', 'src', 'url', 'thumbnail', 'thumbnailUrl']) if (typeof node[key] === 'string' && (key !== 'url' || /image/i.test(node.type || ''))) add(node[key]);
      for (const [key, item] of Object.entries(node)) if (!['image_base64', 'imageBase64', 'images', 'imageUrl', 'image_url', 'thumbnail', 'thumbnailUrl', 'src', 'url'].includes(key)) walk(item, depth + 1);
    }
  };
  walk(value);
  return images;
}
function readableContent(value) {
  if (!value) return '';
  if (typeof value === 'string' && base64ImageSource(value)) return '';
  if (typeof value !== 'string') {
    if (Array.isArray(value)) return value.map(readableContent).filter(Boolean).join('\n');
    if (typeof value.text === 'string') return value.text;
    if (value.insert) return typeof value.insert === 'string' ? value.insert : '';
    return readableContent(value.content || value.ops || value.children || '');
  }
  try { if (/^[\[{]/.test(value.trim())) return readableContent(JSON.parse(value)); } catch { /* plain content */ }
  if (/<\/?(?:p|h[1-6]|div|ul|li|br)\b/i.test(value)) {
    const doc = new DOMParser().parseFromString(value.replace(/<\/(p|h[1-6]|div|li)>|<br\s*\/?\s*>/gi, '\n'), 'text/html');
    doc.querySelectorAll('script,style,iframe').forEach(node => node.remove());
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
          images: extractSlideImages(slide, slide.baseUrl || course.baseUrl), category: 'slides' };
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
  return (!subject || course.id === subject) && (!semester || course.semester === semester)
    && (!category || allSlides(course).some(slide => slide.category === category))
    && (!status || studyStats(allSlides(course), records).status === status);
}
