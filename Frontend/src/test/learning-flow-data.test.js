import { describe, expect, it } from 'vitest';
import { documentTerm, matchesDocumentFilters, reviewCards, sameLearningSubject } from '../utils/learningFlow';

describe('Scoped learning data uses real metadata', () => {
  it('matches IU/EDUX cohort suffixes without merging different named cohorts', () => {
    expect(sameLearningSubject('Cơ sở dữ liệu', 'Cơ sở dữ liệu - K4')).toBe(true);
    expect(sameLearningSubject('Cơ sở dữ liệu - K4', 'Cơ sở dữ liệu - K5')).toBe(false);
    expect(sameLearningSubject('Cơ sở dữ liệu', 'Cơ sở dữ liệu nâng cao')).toBe(false);
  });
  it('filters both subject and topic before prioritizing due and forgotten cards', () => {
    const now = Date.parse('2026-11-04T09:00:00Z');
    const base = { deckTitle: 'SQL - K4', chapter: 'Chương 2', dueAt: '2026-11-01T09:00:00Z' };
    const cards = [{ ...base, id: 'remembered', forgottenCount: 0 }, { ...base, id: 'forgotten', forgottenCount: 3 },
      { ...base, id: 'not-due', dueAt: '2026-11-06T09:00:00Z', forgottenCount: 20 },
      { ...base, id: 'wrong-chapter', chapter: 'Chương 20' }, { ...base, id: 'wrong-subject', deckTitle: 'Web' }];
    expect(reviewCards(cards, { subject: 'SQL', topic: 'Ôn Chương 2' }, now).map(c => c.id)).toEqual(['forgotten', 'remembered', 'not-due']);
    expect(reviewCards(cards, { subject: 'SQL', topic: 'Không có chủ đề' }, now)).toEqual([]);
  });
  it('retains uploads for matching semester/new status and distinguishes unclassified files', () => {
    const file = { id: 'a', subjectId: 1, subject: 'SQL', semester: '1', academicYear: '2026-2027' };
    expect(documentTerm(file)).toBe('Học kỳ 1 · 2026-2027');
    expect(matchesDocumentFilters(file, { subject: 'sql', semester: documentTerm(file), status: 'new' }, [{ id: 'sql', title: 'SQL' }])).toBe(true);
    expect(matchesDocumentFilters(file, { semester: 'Học kỳ 2 · 2026-2027' })).toBe(false);
    expect(matchesDocumentFilters({ id: 'old' }, { semester: '__unclassified', status: 'new' })).toBe(true);
    expect(matchesDocumentFilters({ id: 'old' }, { semester: documentTerm(file) })).toBe(false);
  });
  it('uses recorded opened/learned pages for file status without inventing completion', () => {
    const courses = [{ id: 'sql', chapters: [{ slides: [{ key: 'page-1', fileId: 'a' }, { key: 'page-2', fileId: 'a' }] }] }];
    expect(matchesDocumentFilters({ id: 'a' }, { status: 'learning' }, courses, { 'page-1': { openedAt: 'now' } })).toBe(true);
    expect(matchesDocumentFilters({ id: 'a' }, { status: 'completed' }, courses, { 'page-1': { learned: true } })).toBe(false);
    expect(matchesDocumentFilters({ id: 'a' }, { status: 'completed' }, courses, { 'page-1': { learned: true }, 'page-2': { learned: true } })).toBe(true);
  });
});
