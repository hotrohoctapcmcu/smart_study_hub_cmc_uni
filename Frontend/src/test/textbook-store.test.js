import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBook, listBooks, getBook, saveBook, duplicateBook, deleteBook, readVersions, saveVersion, restoreVersion, textbookStorageKey, setTextbookOwner, searchableBookText, parseTextbookBackup, importTextbookBackup } from '../utils/textbookStore';

beforeEach(() => { localStorage.clear(); setTextbookOwner('device'); });
describe('Textbook local persistence and recovery', () => {
  it('round trips crop percentages, text formatting, affine skew and table size weights', () => {
    const book = createBook({ title: 'Định dạng' });
    book.pages[0].paper.color = '#f0e5cc';
    book.pages[0].objects = [
      { type: 'text', x: 1, y: 2, skewX: -25, data: { text: 'Tiếng Việt', font: 'Be Vietnam Pro', fontSize: 24, bold: true, italic: false, underline: true, strike: false, lineHeight: 1.8, letterSpacing: 2, paragraphSpacing: 12, indent: 24, opacity: .8, background: '#ffefcc', highlight: '#ffe000', textShadow: true, textBorder: '#000000', align: 'justify', list: 'bullet' } },
      { type: 'image', x: 1, y: 2, data: { src: 'data:image/png;base64,aGVsbG8=', crop: { x: 10, y: 20, width: 80, height: 60 }, flipX: true, flipY: false } },
      { type: 'table', x: 1, y: 2, data: { rows: 2, cols: 3, columnWidths: [1, 2, 3], colWidths: [1, 1, 1], rowHeights: [2, 1] } },
    ];
    const [copy] = parseTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }));
    expect(copy.pages[0].paper.color).toBe('#f0e5cc');
    expect(copy.pages[0].objects).toEqual(book.pages[0].objects);
  });
  it.each([
    { skewX: 89 }, { skewX: -89 }, { skewX: '30' },
    { data: { crop: null } }, { data: { crop: { x: 40, width: 80 } } }, { data: { crop: { y: -1 } } },
    { data: { fontSize: '24' } }, { data: { lineHeight: 0 } }, { data: { opacity: 2 } },
    { data: { bold: 'yes' } }, { data: { textBorder: [] } }, { data: { indent: -1 } },
    { type: 'table', data: { rows: 2, cols: 2, colWidths: [1, 0] } },
    { type: 'table', data: { rows: 2, cols: 2, rowHeights: ['20'] } },
  ])('rejects malformed extended object fields atomically: %j', patch => {
    const book = createBook({ title: 'Bản an toàn' }), raw = localStorage.getItem(textbookStorageKey());
    book.pages[0].objects = [{ type: 'text', x: 10, y: 20, data: { text: 'Nội dung' }, ...patch }];
    expect(() => importTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }))).toThrow();
    expect(localStorage.getItem(textbookStorageKey())).toBe(raw);
  });
  it('round trips study instruments, embedded attachments and OCR text', () => {
    const book = createBook({ title: 'Dụng cụ học tập' });
    book.pages[0].objects = ['triangle-ruler', 'coordinate-grid', 'number-line', 'code', 'diagram', 'mindmap'].map((type, index) => ({ id: `o-${index}`, type, x: 10, y: 20, width: 200, height: 100, data: {} }));
    book.pages[0].objects.push({ id: 'file', type: 'file', x: 0, y: 0, data: { name: 'Bài giảng.pdf', src: 'data:application/pdf;base64,aGVsbG8=', size: 5, mimeType: 'application/pdf' } });
    book.pages[0].objects.push({ id: 'image', type: 'image', x: 0, y: 0, data: { src: 'data:image/png;base64,aGVsbG8=', ocrText: 'Định lý hình học' } });
    const [parsed] = parseTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }));
    expect(parsed.pages[0].objects).toHaveLength(8);
    expect(searchableBookText(parsed)).toContain('dinh ly hinh hoc');
    expect(searchableBookText(parsed)).toContain('bai giang.pdf');
    const copy = importTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }))[0];
    expect(getBook(copy.id).pages[0].objects[6].data.src).toBe('data:application/pdf;base64,aGVsbG8=');
  });
  it('rejects malformed manual versions without poisoning the stored database', () => {
    const book = createBook({ title: 'Giữ nguyên' }), raw = localStorage.getItem(textbookStorageKey());
    for (const invalid of [{ ...book, title: {} }, { ...book, pages: [] }, { ...book, pages: [{ ...book.pages[0], paper: [] }] }]) {
      expect(() => saveVersion(invalid)).toThrow('không hợp lệ');
      expect(() => saveBook(invalid)).toThrow('không hợp lệ');
      expect(localStorage.getItem(textbookStorageKey())).toBe(raw);
    }
  });
  it('persists canvas objects without sharing mutable state between reads', () => {
    const book = createBook({ title: 'Giải tích' });
    book.pages[0].objects.push({ id: 'stroke', type: 'drawing', data: { points: [[1, 2, .5], [2, 3, .7]] } });
    saveBook(book);
    const loaded = getBook(book.id);
    expect(loaded.pages[0].objects[0].data.points[1]).toEqual([2, 3, .7]);
    loaded.pages[0].objects.length = 0;
    expect(getBook(book.id).pages[0].objects).toHaveLength(1);
  });
  it('creates independent page and object identities when duplicating', () => {
    const original = createBook({ title: 'Vở' });
    original.pages[0].objects.push({ id: 'object-one', type: 'text', data: { text: 'Nội dung' } });
    saveBook(original);
    const copy = duplicateBook(original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.pages[0].id).not.toBe(original.pages[0].id);
    expect(copy.pages[0].bookId).toBe(copy.id);
    expect(copy.pages[0].objects[0].id).not.toBe('object-one');
    deleteBook(original.id);
    expect(getBook(copy.id).pages[0].objects[0].data.text).toBe('Nội dung');
    expect(readVersions(original.id)).toEqual([]);
  });
  it('restores a snapshot while keeping a recovery version of current content', () => {
    const book = createBook({ title: 'Ban đầu' });
    const originalVersion = readVersions(book.id)[0];
    saveBook({ ...book, title: 'Đã sửa' });
    const restored = restoreVersion(book.id, originalVersion.id);
    expect(restored.title).toBe('Ban đầu');
    expect(readVersions(book.id).some(version => version.book.title === 'Đã sửa')).toBe(true);
    for (let i = 0; i < 10; i++) saveVersion(restored);
    expect(readVersions(book.id)).toHaveLength(5);
  });
  it('never overwrites corrupted data or claims a quota failure saved content', () => {
    localStorage.setItem(textbookStorageKey(), '{broken');
    expect(() => createBook({ title: 'Mới' })).toThrow('không đọc được');
    expect(localStorage.getItem(textbookStorageKey())).toBe('{broken');
    localStorage.clear();
    const book = createBook({ title: 'Nội dung an toàn' });
    const originalData = localStorage.getItem(textbookStorageKey());
    const setter = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    expect(() => saveBook({ ...book, title: 'Không lưu được' })).toThrow('bộ nhớ trình duyệt');
    setter.mockRestore();
    expect(localStorage.getItem(textbookStorageKey())).toBe(originalData);
  });
  it('isolates configured owner scopes and indexes page content without accents', () => {
    setTextbookOwner('student-a');
    const book = createBook({ title: 'Hóa học' });
    book.pages[0].objects.push({ id: 'text', type: 'text', data: { text: 'Định luật bảo toàn' } });
    saveBook(book);
    expect(searchableBookText(book)).toContain('dinh luat bao toan');
    setTextbookOwner('student-b');
    expect(listBooks()).toEqual([]);
    setTextbookOwner('student-a');
    expect(listBooks()).toHaveLength(1);
  });
  it('imports backup and shared-book formats with fresh identities, retaining originals', () => {
    const original = createBook({ title: 'Vở gốc' });
    const imported = importTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [original] }));
    expect(listBooks()).toHaveLength(2);
    expect(imported[0].id).not.toBe(original.id);
    expect(imported[0].pages[0].bookId).toBe(imported[0].id);
    expect(imported[0].pages[0].id).not.toBe(original.pages[0].id);
    expect(getBook(original.id).title).toBe('Vở gốc');
    expect(parseTextbookBackup(JSON.stringify({ format: 'smart-study-textbook-v1', book: original }))).toHaveLength(1);
  });
  it('rejects corrupt imports before writing any existing data', () => {
    const original = createBook({ title: 'Giữ nguyên' }), raw = localStorage.getItem(textbookStorageKey());
    expect(() => importTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [{ title: 'Không hợp lệ', pages: [] }] }))).toThrow('không hợp lệ');
    expect(localStorage.getItem(textbookStorageKey())).toBe(raw);
    expect(getBook(original.id).title).toBe('Giữ nguyên');
  });
  it('prioritizes the latest page content over expendable snapshots at storage quota', () => {
    const original = createBook({ title: 'Ban đầu' });
    const nativeSet = Storage.prototype.setItem;
    const setter = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (Object.keys(JSON.parse(value).versions).length) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return nativeSet.call(this, key, value);
    });
    saveBook({ ...original, title: 'Nội dung mới nhất' });
    setter.mockRestore();
    expect(getBook(original.id).title).toBe('Nội dung mới nhất');
    expect(readVersions(original.id)).toEqual([]);
  });
  it.each([
    ['negative width', { width: -1 }], ['zero height', { height: 0 }], ['oversized width', { width: 16001 }],
    ['string height', { height: '120' }], ['non-finite width', { width: NaN }], ['non-finite rotation', { rotation: Infinity }],
    ['script link', { data: { text: 'Click', url: 'javascript:alert(1)' } }],
    ['HTML data link', { data: { url: 'data:text/html,<script>alert(1)</script>' } }],
    ['remote image', { type: 'image', data: { src: 'https://external.example/track.png' } }],
    ['script image', { type: 'image', data: { src: 'javascript:alert(1)' } }],
    ['remote formula', { type: 'formula', data: { latex: 'x', svg: 'https://external.example/x.svg' } }],
    ['invalid drawing pressure', { type: 'drawing', data: { points: [{ x: 0, y: 0, pressure: '0.7' }] } }],
  ])('rejects %s imports atomically', (_, patch) => {
    const original = createBook({ title: 'Bản an toàn' }), stored = localStorage.getItem(textbookStorageKey());
    const unsafe = JSON.parse(JSON.stringify(original));
    unsafe.pages[0].objects = [{ id: 'unsafe', type: 'text', x: 10, y: 10, width: 200, height: 50, rotation: 0, data: { text: 'Nội dung' }, ...patch }];
    expect(() => importTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [unsafe] }))).toThrow();
    expect(localStorage.getItem(textbookStorageKey())).toBe(stored);
  });
  it('normalizes old paper defaults and accepts embedded media and absent legacy dimensions', () => {
    const book = createBook({ title: 'Vở cũ' });
    book.pages[0].paper = { type: 'unsupported', size: 'giant', orientation: 'upside-down', color: 'url(https://external.example)' };
    book.pages[0].objects = [
      { type: 'image', x: 10, y: 20, data: { src: 'data:image/png;base64,aGVsbG8=' } },
      { type: 'formula', x: 20, y: 40, data: { latex: 'x^2' } },
      { type: 'formula', x: 30, y: 50, data: { svg: 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E' } },
      { type: 'text', x: 40, y: 70, data: { text: 'Tài liệu', url: 'https://example.com/lesson' } },
    ];
    const parsed = parseTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }));
    expect(parsed[0].pages[0].paper).toEqual({ type: 'grid', size: 'A4', orientation: 'portrait', color: '#ffffff' });
    expect(parsed[0].pages[0].objects[1].data.latex).toBe('x^2');
    expect(parsed[0].pages[0].objects[0].width).toBeUndefined();
    book.pages[0].background = 'https://external.example/page.png';
    expect(() => parseTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }))).toThrow('URL bên ngoài');
  });
  it('rejects display objects, malformed cells, merge ranges and paper dimensions before import', () => {
    const original = createBook({ title: 'Giữ lại' }), raw = localStorage.getItem(textbookStorageKey());
    const mutations = [
      book => { book.subjectName = {}; }, book => { book.pages[0].title = {}; },
      book => { book.pages[0].objects[0].data.text = {}; }, book => { book.pages[0].objects[0].data.latex = []; },
      book => { book.pages[0].objects[0].data.name = 3; }, book => { book.pages[0].paper.width = 'huge'; },
      book => { book.pages[0].paper.height = -1; }, book => { book.pages[0].objects[0] = { type: 'table', x: 1, y: 1, data: { rows: 2, cols: 2, cells: {} } }; },
      book => { book.pages[0].objects[0] = { type: 'table', x: 1, y: 1, data: { rows: 2, cols: 2, cells: [[{}]] } }; },
      book => { book.pages[0].objects[0] = { type: 'table', x: 1, y: 1, data: { rows: 2, cols: 2, merges: [{ row: 0, col: 0, rowSpan: 3, colSpan: 1 }] } }; },
    ];
    for (const mutate of mutations) {
      const book = JSON.parse(JSON.stringify(original)); book.pages[0].objects = [{ type: 'text', x: 1, y: 1, data: { text: 'Đúng' } }]; mutate(book);
      expect(() => importTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }))).toThrow();
      expect(localStorage.getItem(textbookStorageKey())).toBe(raw);
    }
    const book = JSON.parse(JSON.stringify(original));
    book.pages[0].objects = [{ type: 'table', x: 1, y: 1, data: { rows: 2, cols: 2, cells: [['Tên', 42], ['Giá', 1.5]], merges: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }] } }];
    expect(parseTextbookBackup(JSON.stringify({ schemaVersion: 1, books: [book] }))[0].pages[0].objects[0].data.cells).toEqual([['Tên', '42'], ['Giá', '1.5']]);
  });
});
