// Textbooks are user-created browser documents. No backend routes are invented.
const PREFIX = 'ssh-textbooks-v1:';
let owner = 'device';
const clone = (value) => JSON.parse(JSON.stringify(value));
function validBook(book) {
  return !!book && typeof book.id === 'string' && !!book.id && typeof book.title === 'string' && !!book.title.trim()
    && Array.isArray(book.pages) && !!book.pages.length
    && book.pages.every(page => page && typeof page.id === 'string' && !!page.id && Array.isArray(page.objects) && page.paper && typeof page.paper === 'object' && !Array.isArray(page.paper));
}
export const coverColors = ['#8064d8', '#639dcc', '#6da98e', '#d5ad57', '#ce87ad'];

export function newId(prefix = 'object') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}
export function setTextbookOwner(id = 'device') { owner = String(id || 'device'); }
export function getTextbookOwner() { return owner; }
export function textbookStorageKey() { return PREFIX + encodeURIComponent(owner); }
function readDatabase() {
  let raw;
  try { raw = localStorage.getItem(textbookStorageKey()); }
  catch { throw new Error('Trình duyệt đang chặn bộ nhớ. Hãy cho phép lưu trữ để giữ vở ghi.'); }
  if (!raw) return { schemaVersion: 1, books: [], versions: {} };
  try {
    const data = JSON.parse(raw);
    if (data.schemaVersion !== 1 || !Array.isArray(data.books) || !data.versions || typeof data.versions !== 'object' || Array.isArray(data.versions)) throw new Error();
    if (data.books.some(book => !book?.id || typeof book.title !== 'string' || !Array.isArray(book.pages) || !book.pages.length || book.pages.some(page => !page?.id || !Array.isArray(page.objects) || !page.paper || typeof page.paper !== 'object'))) throw new Error();
    if (Object.values(data.versions).some(versions => !Array.isArray(versions) || versions.some(version => !version?.id || !Array.isArray(version.book?.pages)))) throw new Error();
    return data;
  } catch { throw new Error('Dữ liệu vở ghi trên trình duyệt không đọc được. Hãy sao lưu bộ nhớ trước khi khôi phục; dữ liệu hiện tại chưa bị ghi đè.'); }
}
function writeDatabase(data, allowHistoryPruning = false) {
  try { localStorage.setItem(textbookStorageKey(), JSON.stringify(data)); }
  catch (cause) {
    // Recovery history is expendable; the user's latest actual pages are not.
    if (allowHistoryPruning && (cause.name === 'QuotaExceededError' || cause.code === 22) && Object.keys(data.versions).length) {
      try { localStorage.setItem(textbookStorageKey(), JSON.stringify({ ...data, versions: {} })); }
      catch { throw new Error('Không thể lưu vở: bộ nhớ trình duyệt đã đầy hoặc bị chặn. Nội dung đang mở vẫn còn; hãy xuất bản sao trước khi đóng trang.'); }
    } else throw new Error('Không thể lưu vở: bộ nhớ trình duyệt đã đầy hoặc bị chặn. Nội dung đang mở vẫn còn; hãy xuất bản sao trước khi đóng trang.');
  }
  window.dispatchEvent(new CustomEvent('textbook-updated', { detail: { owner } }));
}
export function subscribeTextbooks(listener) {
  const storage = (event) => { if (!event.key || event.key === textbookStorageKey()) listener(); };
  window.addEventListener('textbook-updated', listener);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener('textbook-updated', listener); window.removeEventListener('storage', storage); };
}
export function createPage(bookId, index = 1) {
  return { id: newId('page'), bookId, title: `Trang ${index}`, paper: { type: 'grid', size: 'A4', orientation: 'portrait', color: '#ffffff' }, objects: [], bookmarked: false, tags: [], updatedAt: new Date().toISOString() };
}
export function listBooks() { return clone(readDatabase().books).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); }
export function getBook(id) { return listBooks().find(book => book.id === id) || null; }
export const readBook = getBook;
export function createBook({ title, subjectId = '', subjectName = '', coverColor = coverColors[0] } = {}) {
  const name = String(title || '').trim();
  if (!name) throw new Error('Hãy đặt tên cho vở ghi.');
  const now = new Date().toISOString(), id = newId('book');
  return saveBook({ id, title: name, subjectId, subjectName, coverColor, createdAt: now, updatedAt: now, pages: [createPage(id, 1)] });
}
export function saveBook(book) {
  if (!validBook(book)) throw new Error('Vở ghi không hợp lệ.');
  const database = readDatabase(), index = database.books.findIndex(row => row.id === book.id);
  const saved = clone({ ...book, title: book.title.trim(), updatedAt: new Date().toISOString() });
  if (index < 0) database.books.push(saved); else database.books[index] = saved;
  const versions = database.versions[book.id] || [];
  // Keep recovery points bounded: media-heavy pages should not fill storage on each stroke.
  if (!versions.length || Date.now() - Date.parse(versions[0].createdAt) > 120000) {
    database.versions[book.id] = [{ id: newId('version'), createdAt: saved.updatedAt, book: clone(saved) }, ...versions].slice(0, 5);
  }
  writeDatabase(database, true);
  return clone(saved);
}
export function deleteBook(id) {
  const database = readDatabase();
  database.books = database.books.filter(book => book.id !== id);
  delete database.versions[id];
  writeDatabase(database);
}
export function duplicateBook(id) {
  const original = getBook(id);
  if (!original) throw new Error('Không tìm thấy vở ghi.');
  const now = new Date().toISOString(), bookId = newId('book');
  return saveBook({ ...original, id: bookId, title: `${original.title} (bản sao)`, createdAt: now,
    pages: original.pages.map(page => ({ ...page, id: newId('page'), bookId, updatedAt: now, objects: page.objects.map(object => ({ ...object, id: newId() })) })) });
}
export function readVersions(bookId) { return clone(readDatabase().versions[bookId] || []); }
export function saveVersion(book) {
  if (!validBook(book)) throw new Error('Vở ghi không hợp lệ.');
  const database = readDatabase();
  const version = { id: newId('version'), createdAt: new Date().toISOString(), book: clone(book) };
  database.versions[book.id] = [version, ...(database.versions[book.id] || [])].slice(0, 5);
  writeDatabase(database);
  return clone(version);
}
export function restoreVersion(bookId, versionId) {
  const version = readVersions(bookId).find(row => row.id === versionId);
  if (!version) throw new Error('Bản lưu này không còn tồn tại.');
  const current = getBook(bookId);
  if (current) saveVersion(current);
  return saveBook(version.book);
}
export function parseTextbookBackup(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Tệp sao lưu không phải JSON hợp lệ.'); }
  if (data?.format === 'smart-study-textbook-v1' && data.book) data = { schemaVersion: 1, books: [data.book] };
  if (data?.schemaVersion !== 1 || !Array.isArray(data.books) || !data.books.length || data.books.length > 200) throw new Error('Tệp sao lưu cần có từ 1 đến 200 vở ghi và phiên bản dữ liệu 1.');
  const allowedTypes = new Set(['drawing', 'text', 'image', 'shape', 'table', 'formula', 'ruler', 'protractor', 'sticker', 'link', 'triangle-ruler', 'set-square', 'coordinate-grid', 'grid', 'number-line', 'compass', 'file', 'attachment', 'code', 'diagram', 'mindmap', 'mind-map']);
  const validateImage = value => {
    if (value != null && value !== '' && (typeof value !== 'string' || !/^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;[a-z0-9=._-]+)*,[\s\S]+$/i.test(value))) throw new Error('Ảnh trong bản sao lưu phải được nhúng dưới dạng PNG, JPEG, WebP hoặc SVG; không hỗ trợ URL bên ngoài.');
  };
  const validateStrings = (value, keys) => {
    if (keys.some(key => value[key] !== undefined && typeof value[key] !== 'string')) throw new Error('Tên hoặc nội dung hiển thị trong bản sao lưu phải là chuỗi văn bản.');
  };
  const validateNumber = (value, key, min, max, exclusiveMin = false) => {
    if (value[key] !== undefined && (!Number.isFinite(value[key]) || (exclusiveMin ? value[key] <= min : value[key] < min) || value[key] > max)) throw new Error('Thuộc tính số trong bản sao lưu không hợp lệ: ' + key + '.');
  };
  for (const book of data.books) {
    if (!book || typeof book.title !== 'string' || !book.title.trim() || !Array.isArray(book.pages) || !book.pages.length || book.pages.length > 500) throw new Error('Có vở thiếu tên hoặc danh sách trang không hợp lệ.');
    validateStrings(book, ['subjectName']);
    for (const page of book.pages) {
      if (!page || !Array.isArray(page.objects) || page.objects.length > 10000 || (page.paper != null && (typeof page.paper !== 'object' || Array.isArray(page.paper)))) throw new Error('Có trang thiếu định dạng giấy hoặc danh sách đối tượng không hợp lệ.');
      const paper = page.paper || {};
      validateStrings(page, ['title']);
      if (['width', 'height'].some(key => paper[key] !== undefined && (!Number.isFinite(paper[key]) || paper[key] <= 0 || paper[key] > 16000))) throw new Error('Kích thước giấy trong bản sao lưu không hợp lệ.');
      page.paper = {
        ...paper,
        type: ['blank', 'ruled', 'grid', 'dot', 'cornell', 'math'].includes(paper.type) ? paper.type : 'grid',
        size: ['A4', 'A5', 'Infinite'].includes(paper.size) ? paper.size : 'A4',
        orientation: paper.orientation === 'landscape' ? 'landscape' : 'portrait',
        color: /^#[0-9a-f]{6}$/i.test(String(paper.color)) ? paper.color.toLowerCase() : '#ffffff',
      };
      validateImage(page.background);
      if (page.tags != null && (!Array.isArray(page.tags) || page.tags.some(tag => typeof tag !== 'string'))) throw new Error('Nhãn trang trong tệp sao lưu không hợp lệ.');
      for (const object of page.objects) {
        if (!object || !allowedTypes.has(object.type) || !Number.isFinite(object.x) || !Number.isFinite(object.y) || !object.data || typeof object.data !== 'object' || Array.isArray(object.data)) throw new Error('Có đối tượng canvas không hợp lệ trong tệp sao lưu.');
        validateStrings(object.data, ['text', 'latex', 'name', 'content', 'ocrText', 'mimeType']);
        if (['width', 'height'].some(key => object[key] !== undefined && (!Number.isFinite(object[key]) || object[key] <= 0 || object[key] > 16000)) || (object.rotation !== undefined && !Number.isFinite(object.rotation))) throw new Error('Kích thước hoặc góc xoay đối tượng không hợp lệ.');
        if (object.skewX !== undefined && (!Number.isFinite(object.skewX) || Math.abs(object.skewX) >= 89)) throw new Error('Độ nghiêng đối tượng phải nằm giữa -89° và 89°.');
        const style = object.data;
        validateStrings(style, ['font', 'align', 'variant', 'list', 'color', 'fill', 'background', 'highlight', 'headerColor', 'textColor', 'borderStyle']);
        for (const key of ['bold', 'italic', 'underline', 'strike', 'strikethrough', 'uppercase', 'lowercase', 'textShadow', 'flipX', 'flipY', 'border', 'shadow']) {
          if (style[key] !== undefined && typeof style[key] !== 'boolean') throw new Error('Thuộc tính định dạng trong bản sao lưu không hợp lệ: ' + key + '.');
        }
        if (style.textBorder !== undefined && typeof style.textBorder !== 'boolean' && typeof style.textBorder !== 'string') throw new Error('Viền chữ trong bản sao lưu không hợp lệ.');
        for (const [key, min, max, exclusive] of [['fontSize', 0, 1000, true], ['lineHeight', 0, 20, true], ['letterSpacing', -100, 100], ['paragraphSpacing', 0, 16000], ['indent', 0, 16000], ['opacity', 0, 1], ['thickness', 0, 1000, true]]) validateNumber(style, key, min, max, exclusive);
        if (['coordinate-grid', 'grid'].includes(object.type)) validateNumber(style, 'step', 1, 16000);
        if (object.type === 'ruler') validateNumber(style, 'length', 0, 1000, true);
        if (object.type === 'protractor') validateNumber(style, 'markerAngle', 0, 180);
        if (object.type === 'number-line') {
          validateNumber(style, 'min', -1000000, 1000000); validateNumber(style, 'max', -1000000, 1000000);
          if ((style.min ?? -5) >= (style.max ?? 5)) throw new Error('Giới hạn trục số trong bản sao lưu không hợp lệ.');
        }
        if (style.crop !== undefined && typeof style.crop !== 'boolean') {
          if (!style.crop || typeof style.crop !== 'object' || Array.isArray(style.crop)) throw new Error('Vùng cắt ảnh trong bản sao lưu không hợp lệ.');
          validateNumber(style.crop, 'x', 0, 99); validateNumber(style.crop, 'y', 0, 99);
          validateNumber(style.crop, 'width', 0, 100, true); validateNumber(style.crop, 'height', 0, 100, true);
          if ((style.crop.x || 0) + (style.crop.width ?? 100) > 100.000001 || (style.crop.y || 0) + (style.crop.height ?? 100) > 100.000001) throw new Error('Vùng cắt ảnh vượt quá kích thước ảnh nguồn.');
        }
        if (!['file', 'attachment'].includes(object.type)) validateImage(object.data.src);
        validateImage(object.data.svg);
        if (object.type === 'file' || object.type === 'attachment') {
          const file = object.data;
          if (file.size !== undefined && (!Number.isFinite(file.size) || file.size < 0)) throw new Error('Dung lượng tệp đính kèm không hợp lệ.');
          if (file.src != null && file.src !== '' && (typeof file.src !== 'string' || !/^data:[a-z0-9!#$&^_.+\/-]+(?:;[a-z0-9=._-]+)*;base64,[a-z0-9+/=\r\n]*$/i.test(file.src))) throw new Error('Tệp đính kèm phải được nhúng dưới dạng dữ liệu base64.');
        }
        if (object.data.url != null && object.data.url !== '') {
          let url;
          try { url = typeof object.data.url === 'string' ? new URL(object.data.url) : null; } catch { /* Reject below. */ }
          if (!url || !['http:', 'https:'].includes(url.protocol)) throw new Error('Liên kết trong vở chỉ được dùng http hoặc https.');
          object.data.url = url.href;
        }
        if (object.type === 'drawing' && (!Array.isArray(object.data.points) || object.data.points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || (point.pressure !== undefined && (!Number.isFinite(point.pressure) || point.pressure < 0 || point.pressure > 1))))) throw new Error('Có nét vẽ không hợp lệ trong tệp sao lưu.');
        if (object.type === 'table' && (!Number.isInteger(object.data.rows) || !Number.isInteger(object.data.cols) || object.data.rows < 1 || object.data.rows > 100 || object.data.cols < 1 || object.data.cols > 100)) throw new Error('Có bảng không hợp lệ trong tệp sao lưu.');
        if (object.type === 'table') {
          const table = object.data;
          for (const key of ['columnWidths', 'colWidths', 'rowHeights']) {
            if (table[key] !== undefined && (!Array.isArray(table[key]) || table[key].length > 100 || table[key].some(value => !Number.isFinite(value) || value <= 0 || value > 16000))) throw new Error('Kích thước ô bảng không hợp lệ.');
          }
          if (table.cells !== undefined) {
            if (!Array.isArray(table.cells) || table.cells.some(row => !Array.isArray(row) || row.some(cell => typeof cell !== 'string' && !(typeof cell === 'number' && Number.isFinite(cell))))) throw new Error('Nội dung ô bảng phải là các hàng văn bản hoặc số.');
            table.cells = table.cells.map(row => row.map(String));
          }
          if (table.merged !== undefined && typeof table.merged !== 'boolean') throw new Error('Trạng thái gộp tiêu đề bảng không hợp lệ.');
          if (table.merges !== undefined && (!Array.isArray(table.merges) || table.merges.some(merge => !merge || !Number.isInteger(merge.row) || !Number.isInteger(merge.col) || !Number.isInteger(merge.rowSpan) || !Number.isInteger(merge.colSpan) || merge.row < 0 || merge.col < 0 || merge.rowSpan < 1 || merge.colSpan < 1 || merge.row + merge.rowSpan > table.rows || merge.col + merge.colSpan > table.cols))) throw new Error('Vùng gộp ô bảng không hợp lệ.');
        }
      }
    }
  }
  return clone(data.books);
}
export function importTextbookBackup(raw) {
  const books = parseTextbookBackup(raw), database = readDatabase(), now = new Date().toISOString();
  const imported = books.map(book => {
    const id = newId('book');
    return { ...book, id, title: book.title.trim(), createdAt: now, updatedAt: now,
      pages: book.pages.map((page, index) => ({ ...page, id: newId('page'), bookId: id, title: page.title || `Trang ${index + 1}`, updatedAt: now, objects: page.objects.map(object => ({ ...object, id: newId() })) })) };
  });
  // One storage transaction: a quota error leaves every original book untouched.
  database.books.push(...imported);
  writeDatabase(database, true);
  return clone(imported);
}
export function searchableBookText(book) {
  const text = [book.title, book.subjectName, ...book.pages.flatMap(page => [page.title, ...(page.tags || []), ...page.objects.map(object => {
    const data = object.data || {};
    return [data.text, data.content, data.latex, data.url, data.label, data.name, data.ocrText, ...(Array.isArray(data.cells) ? data.cells.flat() : [])].filter(Boolean).join(' ');
  })])].join(' ');
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}
