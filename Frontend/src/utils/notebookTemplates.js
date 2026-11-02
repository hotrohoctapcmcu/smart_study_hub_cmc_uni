import { newId } from './textbookStore';

export const NOTEBOOK_TEMPLATES = [
  { id: 'ruled', name: 'Vở kẻ ngang', description: 'Ghi bài theo dòng, gọn gàng và quen thuộc.', paperType: 'ruled' },
  { id: 'grid', name: 'Vở ô ly', description: 'Căn chữ, vẽ hình và trình bày bài giải.', paperType: 'grid' },
  { id: 'dot', name: 'Dot grid', description: 'Chấm nhẹ để tự do phác thảo ý tưởng.', paperType: 'dot' },
  { id: 'cornell', name: 'Cornell Notes', description: 'Từ khóa, ghi chép và tóm tắt trên cùng một trang.', paperType: 'cornell' },
  { id: 'blank', name: 'Blank', description: 'Một trang trắng cho mọi cách học.', paperType: 'blank' },
  { id: 'mindmap', name: 'Mind map', description: 'Chủ đề trung tâm và bốn nhánh có thể chỉnh sửa.', paperType: 'dot' },
  { id: 'todo', name: 'To-do', description: 'Mục tiêu hôm nay và danh sách việc cần làm.', paperType: 'ruled' },
  { id: 'lecture', name: 'Lecture note', description: 'Thông tin buổi học, ý chính và câu hỏi cần ôn.', paperType: 'ruled' },
  { id: 'math', name: 'Math note', description: 'Giả thiết, lời giải và hệ trục tọa độ.', paperType: 'math' },
  { id: 'lab', name: 'Lab note', description: 'Mục tiêu, quy trình, bảng đo và kết luận.', paperType: 'grid' },
];

const text = (value, x, y, width = 650, height = 50, style = {}) => ({
  id: newId(), type: 'text', x, y, width, height, rotation: 0,
  data: { text: value, font: 'Arial', fontSize: 18, color: '#343047', lineHeight: 1.5, opacity: 1, ...style },
});
const heading = (value, x = 56, y = 50, width = 680) => text(value, x, y, width, 60, { fontSize: 30, bold: true, color: '#8060c9', variant: 'heading' });
const box = (x, y, width, height, fill = '#eee8ff') => ({ id: newId(), type: 'shape', x, y, width, height, rotation: 0, data: { shape: 'rounded', color: '#a594bf', fill, thickness: 1, opacity: 1 } });
const line = (x, y, width, height, flipY = false) => ({ id: newId(), type: 'shape', x, y, width, height, rotation: 0, data: { shape: 'line', color: '#a594bf', thickness: 2, opacity: 1, flipY } });

// Templates create normal editor objects; nothing is flattened into an image.
export function buildNotebookTemplate(id) {
  const template = NOTEBOOK_TEMPLATES.find(item => item.id === id);
  if (!template) throw new Error('Không tìm thấy mẫu trang này.');
  let objects = [];
  if (id === 'cornell') objects = [
    heading('Chủ đề buổi học', 56, 40),
    text('Từ khóa / câu hỏi', 35, 140, 150, 70, { bold: true, fontSize: 17 }),
    text('Ghi chép chính\n\nÝ tưởng, ví dụ và điều cần nhớ…', 225, 140, 510, 170),
    text('TÓM TẮT\nViết lại kiến thức quan trọng bằng lời của bạn.', 56, 950, 675, 110, { fontSize: 17 }),
  ];
  if (id === 'todo') objects = [
    heading('Hôm nay mình sẽ…'),
    text('Mục tiêu quan trọng nhất:', 56, 130, 650, 50, { bold: true }),
    text('☐ Hoàn thành bài tập\n☐ Đọc lại nội dung buổi học\n☐ Ôn tập kiến thức còn vướng\n☐ Chuẩn bị cho buổi học tiếp theo', 68, 235, 640, 270, { fontSize: 23, lineHeight: 2.1 }),
    text('Điều mình đã làm tốt\n\n', 56, 670, 650, 130, { bold: true }),
    text('Chuyển sang ngày mai\n\n', 56, 860, 650, 130),
  ];
  if (id === 'lecture') objects = [
    heading('Ghi chép bài giảng'),
    text('Môn học: …                          Ngày: …\nGiảng viên: …                        Bài học: …', 56, 130, 680, 100, { fontSize: 17 }),
    text('01   KIẾN THỨC CHÍNH', 56, 280, 650, 50, { bold: true, color: '#8060c9' }),
    text('Nhập ghi chép tại đây…', 56, 340, 680, 230),
    text('02   VÍ DỤ & ỨNG DỤNG', 56, 590, 650, 50, { bold: true, color: '#8060c9' }),
    text('03   CÂU HỎI CẦN ÔN', 56, 840, 650, 50, { bold: true, color: '#8060c9' }),
  ];
  if (id === 'math') objects = [
    heading('Bài toán & lời giải'),
    text('Đề bài / giả thiết\nNhập dữ kiện đã cho…', 56, 135, 680, 110),
    text('Hướng giải', 56, 300, 650, 50, { bold: true, color: '#8060c9' }),
    { id: newId(), type: 'coordinate-grid', x: 425, y: 385, width: 300, height: 300, rotation: 0, data: { step: 25, color: '#8060c9', fill: '#ffffff', opacity: 1 } },
    text('Các bước biến đổi\n\n1. …\n\n2. …\n\n3. …', 56, 385, 330, 360),
    text('Kết luận / kiểm tra kết quả', 56, 880, 650, 70, { bold: true }),
  ];
  if (id === 'lab') objects = [
    heading('Nhật ký thí nghiệm'),
    text('Tên thí nghiệm: …\nNgày: …                         Nhóm: …', 56, 130, 680, 90, { fontSize: 17 }),
    text('Mục tiêu & giả thuyết', 56, 245, 680, 50, { bold: true, color: '#8060c9' }),
    text('Dụng cụ & quy trình\n1. …\n2. …\n3. …', 56, 360, 680, 160),
    { id: newId(), type: 'table', x: 56, y: 560, width: 680, height: 200, rotation: 0, data: { rows: 5, cols: 4, cells: [['Lần đo', 'Đại lượng 1', 'Đại lượng 2', 'Ghi chú'], ['1', '', '', ''], ['2', '', '', ''], ['3', '', '', ''], ['Trung bình', '', '', '']], fontSize: 15, color: '#a594bf', fill: '#ffffff', headerColor: '#eee8ff', thickness: 1, opacity: 1 } },
    text('Kết quả, sai số & kết luận', 56, 830, 680, 70, { bold: true, color: '#8060c9' }),
  ];
  if (id === 'mindmap') {
    const branches = [
      { label: 'Ý chính 1', x: 56, y: 240, fill: '#e0edf9', flip: false },
      { label: 'Ý chính 2', x: 520, y: 240, fill: '#e2f1e7', flip: true },
      { label: 'Ý chính 3', x: 56, y: 680, fill: '#fff0cc', flip: true },
      { label: 'Ý chính 4', x: 520, y: 680, fill: '#f9e4ee', flip: false },
    ];
    objects = [heading('Sơ đồ tư duy'), line(230, 310, 165, 210), line(395, 310, 165, 210, true), line(230, 545, 165, 180, true), line(395, 545, 165, 180), box(255, 460, 285, 115), text('CHỦ ĐỀ TRUNG TÂM', 270, 495, 255, 65, { bold: true, align: 'center', fontSize: 22 })];
    for (const branch of branches) objects.push(box(branch.x, branch.y, 215, 115, branch.fill), text(branch.label, branch.x + 12, branch.y + 20, 190, 75, { align: 'center', fontSize: 20, bold: true }));
  }
  return { paperType: template.paperType, objects };
}
