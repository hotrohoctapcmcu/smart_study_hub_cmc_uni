import { describe, expect, it } from 'vitest';
import { normalizeNotebook, normalizePage, encodeNotebook, encodePage, createPage, pageText, countWords, NOTEBOOK_TEMPLATES } from '../pages/Notebooks/notebookModel';

describe('structured notebook API adaptation', () => {
  it('round-trips notebook metadata without dropping existing descriptions', () => {
    const legacy = normalizeNotebook({ notebook_id: 12, title: 'CSDL', description: 'Mô tả cũ', updated_at: '2026-10-30' });
    expect(legacy.description).toBe('Mô tả cũ');
    const adapted = normalizeNotebook({ notebook_id: 12, ...encodeNotebook({ ...legacy, subject: 'Database', bookmarked: true }) });
    expect(adapted).toMatchObject({ id: '12', subject: 'Database', description: 'Mô tả cũ', bookmarked: true });
  });
  it('imports legacy notes literally, including markup and JSON that is not our format', () => {
    for (const value of ['# Tiêu đề\nNội dung <script>alert(1)</script>', '{"unknown":true}']) {
      const page = normalizePage({ id: 'old', notebookId: 1, content: value });
      expect(pageText(page)).toBe(value);
      expect(pageText(normalizePage({ id: 'old', ...encodePage(page) }))).toBe(value);
    }
  });
  it('round-trips hierarchy, study blocks and canonical editor content', () => {
    const page = createPage(1, 'blank', 'parent');
    page.content = { type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'ERD và SQL' }] },
      { type: 'flashcard', attrs: { question: 'Khóa ngoại?', answer: 'Tham chiếu bảng khác.' } },
      { type: 'formula', attrs: { latex: 'x^2' } },
    ] };
    const result = normalizePage({ ...encodePage({ ...page, pinned: true, completed: true, order: 5 }) });
    expect(result).toMatchObject({ parentId: 'parent', pinned: true, completed: true, order: 5 });
    expect(result.content).toEqual(page.content);
    expect(pageText(result)).toContain('Tham chiếu bảng khác.');
    expect(countWords(result)).toBeGreaterThan(5);
  });
  it('generates seven independent usable templates', () => {
    expect(NOTEBOOK_TEMPLATES).toHaveLength(7);
    NOTEBOOK_TEMPLATES.forEach(template => expect(createPage(1, template.id).content.type).toBe('doc'));
    expect(createPage(1, 'cornell').content.content[0]).toEqual({ type: 'cornell', attrs: { cues: '', notes: '', summary: '' } });
    const first = createPage(1, 'lecture'), second = createPage(1, 'lecture');
    first.content.content[0].attrs.level = 1;
    expect(second.content.content[0].attrs.level).toBe(2);
  });
});
