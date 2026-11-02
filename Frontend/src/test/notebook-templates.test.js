import { describe, expect, it } from 'vitest';
import { buildNotebookTemplate, NOTEBOOK_TEMPLATES } from '../utils/notebookTemplates';
import { createBook, parseTextbookBackup } from '../utils/textbookStore';

describe('Notebook editable page templates', () => {
  it('provides the ten requested templates and independent object identities', () => {
    expect(NOTEBOOK_TEMPLATES).toHaveLength(10);
    const first = buildNotebookTemplate('mindmap'), second = buildNotebookTemplate('mindmap');
    expect(first.objects.some(object => object.type === 'text')).toBe(true);
    expect(first.objects.some(object => object.type === 'shape')).toBe(true);
    expect(first.objects.every(object => !second.objects.some(copy => copy.id === object.id))).toBe(true);
  });
  it('keeps template content editable, within A4, and valid through backup import', () => {
    for (const template of NOTEBOOK_TEMPLATES) {
      const { paperType, objects } = buildNotebookTemplate(template.id);
      const book = createBook({ title: template.name });
      book.pages[0].objects = objects;
      book.pages[0].paper.type = paperType;
      const parsed = parseTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }));
      expect(parsed[0].pages[0].objects).toHaveLength(objects.length);
      expect(objects.every(object => object.x >= 0 && object.y >= 0 && object.x + object.width <= 794 && object.y + object.height <= 1123)).toBe(true);
    }
    expect(buildNotebookTemplate('lab').objects.some(object => object.type === 'table')).toBe(true);
    expect(buildNotebookTemplate('math').objects.some(object => object.type === 'coordinate-grid')).toBe(true);
    expect(() => buildNotebookTemplate('missing')).toThrow('Không tìm thấy');
  });
});
