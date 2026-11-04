export const normalizeLearning = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function sameLearningSubject(a, b) {
  const first = normalizeLearning(a), second = normalizeLearning(b);
  const base = value => value.replace(/\s+k(?:hoa)?\s*\d+$/, '').trim();
  return Boolean(first && second && (first === second || base(first) === base(second) && (first === base(first) || second === base(second))));
}
export function matchesTopic(card, topic) {
  const wanted = normalizeLearning(topic);
  if (!wanted) return true;
  const chapters = [card.chapter, card.topic].map(normalizeLearning).filter(Boolean);
  // Match complete words, so “Chương 2” never includes “Chương 20”.
  return chapters.some(value => ` ${value} `.includes(` ${wanted} `) || ` ${wanted} `.includes(` ${value} `));
}
export function reviewCards(cards, { subject = '', topic = '', deckId = '' } = {}, now = Date.now()) {
  return cards.filter(card => (!subject || sameLearningSubject(card.deckTitle, subject))
    && (!deckId || card.deckId === deckId) && matchesTopic(card, topic)).sort((a, b) =>
    Number(Date.parse(b.dueAt) <= now) - Number(Date.parse(a.dueAt) <= now)
    || (Number(b.forgottenCount) || 0) - (Number(a.forgottenCount) || 0)
    || (Date.parse(a.dueAt) || 0) - (Date.parse(b.dueAt) || 0) || String(a.id).localeCompare(String(b.id)));
}
export function documentTerm(doc) {
  const semester = doc.semester || '';
  return semester ? /^Học kỳ /i.test(semester) ? semester : `Học kỳ ${semester}${doc.academicYear || doc.academic_year ? ` · ${doc.academicYear || doc.academic_year}` : ''}` : '';
}
export function matchesDocumentFilters(doc, filters, courses = [], records = {}) {
  const course = courses.find(c => c.id === filters.subject);
  const id = String(doc.document_id ?? doc.id);
  const slides = courses.flatMap(c => c.chapters || []).flatMap(ch => ch.slides || []).filter(s => String(s.fileId) === id);
  const opened = slides.some(s => records[s.key]?.openedAt), completed = slides.length > 0 && slides.every(s => records[s.key]?.learned);
  const status = completed ? 'completed' : opened ? 'learning' : 'new';
  const subjectMatches = !filters.subject || (filters.subject === '__unclassified' ? !doc.subjectId && !doc.subject_id && !doc.subject
    : String(doc.subjectId ?? doc.subject_id ?? '') === filters.subject || [course?.title, course?.code].filter(Boolean).some(name => sameLearningSubject(name, doc.subject)));
  return subjectMatches
    && (!filters.semester || (filters.semester === '__unclassified' ? !documentTerm(doc) : documentTerm(doc) === filters.semester))
    && (!filters.status || status === filters.status);
}
