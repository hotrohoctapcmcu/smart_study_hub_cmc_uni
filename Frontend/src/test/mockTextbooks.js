// Representative editor fixtures only; production never seeds user notebooks.
export function makeTextbookFixture() {
  const updatedAt = '2026-10-29T08:00:00.000Z';
  return {
    id: 'test-book', title: 'Lập trình C#', subjectId: '1', subjectName: 'Lập trình C#', coverColor: '#8064d8', createdAt: updatedAt, updatedAt,
    pages: [
      { id: 'test-page-one', bookId: 'test-book', title: 'Khái niệm OOP', updatedAt, bookmarked: false, tags: ['Cần ôn'], paper: { type: 'grid', size: 'A4', orientation: 'portrait', color: '#ffffff' }, objects: [
        { id: 'test-text', type: 'text', x: 70, y: 75, width: 450, height: 90, rotation: 0, data: { text: 'Đóng gói bảo vệ trạng thái của đối tượng.', color: '#343047', fontSize: 22, font: 'Arial' } },
        { id: 'test-stroke', type: 'drawing', x: 70, y: 190, width: 160, height: 20, rotation: 0, data: { tool: 'pen', color: '#8060c9', thickness: 3, opacity: 1, points: [{ x: 0, y: 0, pressure: .4 }, { x: 80, y: 20, pressure: .6 }, { x: 160, y: 0, pressure: .5 }] } },
        { id: 'test-table', type: 'table', x: 70, y: 270, width: 420, height: 132, rotation: 0, data: { rows: 3, cols: 2, cells: [['Tính chất', 'Ý nghĩa'], ['Đóng gói', 'Ẩn chi tiết'], ['Kế thừa', 'Tái sử dụng']], color: '#8b7da7', fontSize: 14 } },
      ] },
      { id: 'test-page-two', bookId: 'test-book', title: 'Bài tập hình học', updatedAt: '2026-10-29T09:00:00.000Z', bookmarked: true, tags: ['Thi'], paper: { type: 'dot', size: 'A5', orientation: 'landscape', color: '#fffaf0' }, objects: [
        { id: 'test-shape', type: 'shape', x: 90, y: 100, width: 180, height: 120, rotation: 15, data: { shape: 'triangle', fill: '#eee8ff', color: '#8060c9', thickness: 2, opacity: 1 } },
        { id: 'test-ruler', type: 'ruler', x: 60, y: 300, width: 400, height: 65, rotation: 0, data: { opacity: .8 } },
      ] },
    ],
  };
}
