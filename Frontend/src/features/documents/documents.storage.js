/**
 * UniStudy CMC - Documents & Notebook Storage
 * Lưu trữ cục bộ danh sách tài liệu và các trang sổ tay ghi chú
 */

const STORAGE_KEYS = {
  documents: "unistudy_documents_list",
  notes: "unistudy_notebook_pages"
};

const DEFAULT_DOCUMENTS = [
  {
    id: "doc-1",
    title: "Slide bài giảng Chương 4 - Cây tìm kiếm nhị phân & AVL Tree",
    subject: "Cấu trúc dữ liệu & Giải thuật",
    category: "Slide bài giảng",
    fileType: "PDF",
    sizeStr: "3.4 MB",
    uploadedAt: "2026-10-18T10:30:00"
  },
  {
    id: "doc-2",
    title: "Đề cương ôn tập & bài tập mẫu thi Giữa kỳ Kỹ thuật Lập trình",
    subject: "Kỹ thuật lập trình Web",
    category: "Đề cương & Tài liệu ôn",
    fileType: "DOCX",
    sizeStr: "1.8 MB",
    uploadedAt: "2026-10-19T14:15:00"
  },
  {
    id: "doc-3",
    title: "Hướng dẫn cài đặt môi trường Docker & Microservices Lab",
    subject: "Kiến trúc hệ thống phần mềm",
    category: "Tài liệu tham khảo",
    fileType: "PDF",
    sizeStr: "2.1 MB",
    uploadedAt: "2026-10-20T09:00:00"
  }
];

const DEFAULT_NOTES = [
  {
    id: "note-1",
    title: "Ôn tập chương 3: Đồ thị và thuật toán Dijkstra",
    subject: "Cấu trúc dữ liệu & Giải thuật",
    tags: ["đồ-thị", "thuật-toán", "giữa-kỳ"],
    content: "1. Định nghĩa đồ thị G = (V, E)\n2. Biểu diễn: Ma trận kề vs Danh sách kề\n3. Thuật toán Dijkstra: Tìm đường đi ngắn nhất từ một đỉnh nguồn đến tất cả các đỉnh còn lại đối với đồ thị có trọng số không âm.\nĐộ phức tạp: O((V + E) log V) khi dùng min-heap.",
    updatedAt: "2026-10-21T14:30:00"
  },
  {
    id: "note-2",
    title: "Ghi chú kiến trúc RESTful API và JWT Authentication",
    subject: "Lập trình Web nâng cao",
    tags: ["web", "api", "jwt"],
    content: "Các nguyên tắc RESTful:\n- Stateless: Mỗi request phải chứa đầy đủ thông tin xác thực.\n- Cacheable: Hỗ trợ header Cache-Control, ETag.\n- Chuẩn HTTP status codes: 200, 201, 400, 401, 403, 404, 500.",
    updatedAt: "2026-10-20T16:20:00"
  }
];

export function loadStoredDocuments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.documents);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(DEFAULT_DOCUMENTS));
      return DEFAULT_DOCUMENTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DOCUMENTS;
  }
}

export function saveStoredDocuments(docs) {
  try {
    localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(docs));
  } catch (err) {
    console.error("[Documents Storage] Lưu thất bại:", err);
  }
}

export function loadStoredNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.notes);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(DEFAULT_NOTES));
      return DEFAULT_NOTES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_NOTES;
  }
}

export function saveStoredNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  } catch (err) {
    console.error("[Notes Storage] Lưu thất bại:", err);
  }
}
