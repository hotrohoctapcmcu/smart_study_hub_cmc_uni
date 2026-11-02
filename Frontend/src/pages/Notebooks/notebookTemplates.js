const text = value => ({ type: 'text', text: value });
const paragraph = value => ({ type: 'paragraph', ...(value ? { content: [text(value)] } : {}) });
const heading = value => ({ type: 'heading', attrs: { level: 2 }, content: [text(value)] });
export const NOTEBOOK_TEMPLATES = [
  { id: 'blank', label: 'Trống', description: 'Bắt đầu với một trang trắng.' },
  { id: 'lecture', label: 'Ghi chú bài giảng', description: 'Mục tiêu, kiến thức chính và điều cần hỏi.' },
  { id: 'exam', label: 'Ôn thi', description: 'Hệ thống kiến thức và kế hoạch ôn tập.' },
  { id: 'cornell', label: 'Cornell Notes', description: 'Từ khóa, ghi chú và tóm tắt.' },
  { id: 'exercise', label: 'Bài tập', description: 'Đề bài, hướng giải và kết quả.' },
  { id: 'coding', label: 'Coding Notes', description: 'Ý tưởng, mã nguồn và bài học.' },
  { id: 'math', label: 'Toán học', description: 'Định nghĩa, công thức và ví dụ.' },
];
export function templateDocument(template = 'blank') {
  const section = labels => labels.flatMap(label => [heading(label), paragraph()]);
  let content;
  switch (template) {
    case 'lecture': content = section(['Mục tiêu bài học', 'Kiến thức chính', 'Ví dụ', 'Câu hỏi cần giải đáp']); break;
    case 'exam': content = section(['Nội dung trọng tâm', 'Công thức cần nhớ', 'Câu hỏi ôn tập', 'Kế hoạch ôn thi']); break;
    case 'cornell': content = [{ type: 'cornell', attrs: { cues: '', notes: '', summary: '' } }, paragraph()]; break;
    case 'exercise': content = section(['Đề bài', 'Phân tích', 'Lời giải', 'Kết quả và kiểm tra']); break;
    case 'coding': content = [heading('Bài toán'), paragraph(), heading('Ý tưởng'), paragraph(), { type: 'codeBlock', attrs: { language: 'javascript' } }, heading('Độ phức tạp và bài học'), paragraph()]; break;
    case 'math': content = section(['Định nghĩa', 'Công thức', 'Chứng minh', 'Ví dụ áp dụng']); break;
    default: content = [paragraph()];
  }
  return { type: 'doc', content };
}
