/**
 * UniStudy CMC - Automated Tests for Sprint 2 Features
 * Kiểm thử: Kho tài liệu, Tìm kiếm & gắn tag, Textbook, Ghi chú môn,
 * Sổ tay cá nhân, Bản đồ thời gian, Tiến độ và Email trường trích xuất deadline.
 */
import {
  getDocuments,
  saveDocument,
  deleteDocument,
  toggleDocumentBookmark,
  getTextbooks,
  getNotes,
  saveNote,
  deleteNote,
  getAllUniqueTags,
  seedTestDataForTesting
} from "../src/features/documents/documents.service.js";

import { getProgressAnalytics } from "../src/features/progress/progress.service.js";

import {
  getSchoolEmails,
  markEmailRead,
  createTaskFromEmail,
  createExamFromEmail,
  seedTestEmailsForTesting
} from "../src/features/school-email/school-email.service.js";

import { state } from "../src/app/state.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SPRINT 2 TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("\n====================================================");
console.log("       UNISTUDY CMC SPRINT 2 - AUTOMATED TESTS      ");
console.log("====================================================");

// Khởi tạo fixtures riêng cho bài kiểm thử
seedTestDataForTesting();
seedTestEmailsForTesting();

// ========================================================
// 1. KHO TÀI LIỆU, TÌM KIẾM & GẮN TAG
// ========================================================
console.log("\n[SPRINT 2 - 1] KIỂM THỬ KHO TÀI LIỆU, TÌM KIẾM & GẮN TAG");
const initialDocs = getDocuments();
assert(Array.isArray(initialDocs) && initialDocs.length > 0, "Có danh mục tài liệu khởi đầu mẫu");

// Thêm tài liệu mới kèm tags
const createdDoc = saveDocument({
  title: "Đề cương Ôn tập An toàn thông tin",
  subject: "An toàn thông tin",
  code: "SEC301",
  type: "Đề thi cũ",
  tags: ["Bảo mật", "Đề cương", "Thi cuối kỳ"],
  summary: "Tóm tắt mã hóa RSA, AES và chữ ký số."
});
assert(createdDoc.id.startsWith("doc-"), "Tạo tài liệu thành công với ID hợp lệ");

// Kiểm tra tìm kiếm và tag
const allTags = getAllUniqueTags();
assert(allTags.includes("Bảo mật"), "Tag mới được ghi nhận vào danh mục tag chung");

// Bookmark tài liệu
const bookmarkedDocs = toggleDocumentBookmark(createdDoc.id);
const targetDoc = bookmarkedDocs.find((d) => d.id === createdDoc.id);
assert(targetDoc.isBookmarked === true, "Đánh dấu lưu (Bookmark) tài liệu thành công");

// Xóa tài liệu
deleteDocument(createdDoc.id);
const docsAfterDelete = getDocuments();
assert(!docsAfterDelete.some((d) => d.id === createdDoc.id), "Xóa tài liệu thành công");

// ========================================================
// 2. TEXTBOOK ĐIỆN TỬ, GHI CHÚ THEO MÔN & SỔ TAY CÁ NHÂN
// ========================================================
console.log("\n[SPRINT 2 - 2] KIỂM THỬ TEXTBOOK, GHI CHÚ MÔN & SỔ TAY CÁ NHÂN");
const textbooks = getTextbooks();
assert(Array.isArray(textbooks) && textbooks.length >= 3, "Có đủ danh mục Textbook chuẩn các môn học");
assert(textbooks[0].chapters.length > 0, "Textbook có đầy đủ mục lục các chương và số trang");

// Tạo ghi chú theo môn
const courseNote = saveNote({
  title: "Thuật toán sắp xếp QuickSort",
  subject: "Cấu trúc dữ liệu",
  category: "Môn học",
  content: "Độ phức tạp trung bình O(N log N). Chọn pivot phân đoạn.",
  tags: ["CTDL", "QuickSort", "Lý thuyết"]
});
assert(courseNote.category === "Môn học", "Tạo ghi chú môn học thành công");

// Tạo sổ tay cá nhân
const personalNote = saveNote({
  title: "Kế hoạch tuần này",
  subject: "Cá nhân",
  category: "Sổ tay cá nhân",
  content: "Hoàn thành Sprint 2, review Git diff và chuẩn bị báo cáo.",
  tags: ["Kế hoạch", "Sprint2"]
});
assert(personalNote.category === "Sổ tay cá nhân", "Tạo sổ tay cá nhân thành công");

// Sửa ghi chú
const updatedNote = saveNote({
  id: courseNote.id,
  title: "Thuật toán QuickSort & MergeSort",
  subject: "Cấu trúc dữ liệu",
  content: "Đã bổ sung so sánh hai thuật toán chia để trị."
});
assert(updatedNote.title.includes("MergeSort"), "Cập nhật ghi chú thành công");

// Xóa ghi chú
deleteNote(courseNote.id);
assert(!getNotes().some((n) => n.id === courseNote.id), "Xóa ghi chú thành công");

// ========================================================
// 3. PHÂN TÍCH TIẾN ĐỘ & BẢN ĐỒ THỜI GIAN HỌC TẬP
// ========================================================
console.log("\n[SPRINT 2 - 3] KIỂM THỬ PHÂN TÍCH TIẾN ĐỘ & BẢN ĐỒ THỜI GIAN");
const analytics = getProgressAnalytics("week");
assert(analytics.totalStudyHours >= 0, "Tính toán tổng số giờ học tập thành công");
assert(analytics.weekChart.labels.length === 7, "Biểu đồ tuần có đầy đủ 7 ngày (T2 - CN)");
assert(analytics.weekChart.values.length === 7, "Có dữ liệu thời lượng cho từng ngày trong tuần");

assert(Array.isArray(analytics.heatmap) && analytics.heatmap.length === 7, "Bản đồ nhiệt Heatmap có đủ 7 ngày");
assert(analytics.heatmap[0].morning !== undefined, "Heatmap có khung giờ Sáng");
assert(analytics.heatmap[0].afternoon !== undefined, "Heatmap có khung giờ Chiều");
assert(analytics.heatmap[0].evening !== undefined, "Heatmap có khung giờ Tối");

assert(analytics.subjects.length > 0, "Có phân tích tiến độ theo từng môn học");
assert(analytics.habits.peakHour !== undefined, "Xác định được khung giờ học hiệu quả nhất");

// ========================================================
// 4. ĐỒNG BỘ VÀ PHÂN TÍCH EMAIL TRƯỜNG CMC
// ========================================================
console.log("\n[SPRINT 2 - 4] KIỂM THỬ ĐỒNG BỘ VÀ PHÂN TÍCH EMAIL TRƯỜNG CMC");
const emails = getSchoolEmails();
assert(Array.isArray(emails) && emails.length > 0, "Lấy danh sách email trường CMC thành công");

// Đánh dấu đã đọc
markEmailRead(emails[0].id);
const readCheck = getSchoolEmails().find((m) => m.id === emails[0].id);
assert(readCheck.isRead === true, "Đánh dấu đã đọc email thành công");

// Trích xuất Deadline tự động từ Email vào state.tasks
const initialTasksCount = state.tasks.length;
const createdTaskFromMail = createTaskFromEmail("mail-1");
assert(createdTaskFromMail !== null, "Trích xuất deadline từ email thành công");
assert(state.tasks.length === initialTasksCount + 1, "Task được tự động thêm vào state.tasks");
assert(createdTaskFromMail.subject === "Lập trình Web", "Task mang đúng môn học được trích xuất");

// Trích xuất Lịch thi tự động từ Email vào state.exams
const initialExamsCount = state.exams.length;
const createdExamFromMail = createExamFromEmail("mail-2");
assert(createdExamFromMail !== null, "Trích xuất lịch thi từ email thành công");
assert(state.exams.length === initialExamsCount + 1, "Kỳ thi được tự động thêm vào state.exams");
assert(createdExamFromMail.code === "DBI202", "Lịch thi mang đúng mã môn trích xuất");

console.log("\n====================================================");
console.log("       TẤT CẢ TEST SPRINT 2 ĐỀU ĐÃ ĐẠT (PASS)!      ");
console.log("====================================================\n");
