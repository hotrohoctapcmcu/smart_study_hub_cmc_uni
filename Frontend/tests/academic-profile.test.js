/**
 * UniStudy CMC - Automated Tests for Academic Profile & Paper Notes
 * Kiểm thử chi tiết:
 * 1. Thông tin sinh viên chỉ để xem, không có form sửa hay cấu hình đồng bộ
 * 2. Thang xếp loại GPA hệ 4 dùng duy nhất một hàm chuẩn
 * 3. Quy tắc điểm số: điểm 0 hiển thị là 0, null/undefined là Chưa có điểm
 * 4. Môn điểm P có hệ 4 = 0 nhưng đánh giá vẫn "Đạt"
 * 5. Bảng điểm chi tiết theo năm học & học kỳ, tổng kết học kỳ và card Tổng điểm
 * 6. Loại bỏ mock/seed data và tab Textbook điện tử
 * 7. Trình soạn thảo ghi chú dạng trang giấy
 */

import {
  classifyGpa,
  formatGradeValue,
  formatGpaDisplay,
  GPA_SCALE_NOTE
} from "../src/shared/utils/academic.js";

import {
  renderProfileView,
  renderGradeDetailModal
} from "../src/features/profile/profile.view.js";

import {
  renderDocumentsView
} from "../src/features/documents/documents.view.js";

import {
  getDocuments,
  getNotes,
  saveNote,
  deleteNote
} from "../src/features/documents/documents.service.js";

import { state, resetSessionState } from "../src/app/state.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ACADEMIC PROFILE TEST FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log("\n====================================================");
console.log("   KIỂM THỬ HỒ SƠ HỌC TẬP & PHÂN LOẠI GPA HỆ 4      ");
console.log("====================================================");

// ========================================================
// 1. KIỂM THỬ THANG XẾP LOẠI GPA HỆ 4 DÙNG DUY NHẤT MỘT HÀM
// ========================================================
console.log("\n[TEST 1] THANG XẾP LOẠI GPA HỆ 4");

// Xuất sắc: 3.6 <= GPA <= 4.0
assert(classifyGpa(4.0) === "Xuất sắc", "GPA 4.0 -> Xuất sắc");
assert(classifyGpa(3.8) === "Xuất sắc", "GPA 3.8 -> Xuất sắc");
assert(classifyGpa(3.6) === "Xuất sắc", "GPA 3.6 (ngưỡng) -> Xuất sắc");

// Giỏi: 3.2 <= GPA < 3.6
assert(classifyGpa(3.59) === "Giỏi", "GPA 3.59 (sát ngưỡng trên) -> Giỏi, không tự làm tròn");
assert(classifyGpa(3.599) === "Giỏi", "GPA 3.599 -> Giỏi (không làm tròn trước khi phân loại)");
assert(classifyGpa(3.4) === "Giỏi", "GPA 3.4 -> Giỏi");
assert(classifyGpa(3.2) === "Giỏi", "GPA 3.2 (ngưỡng) -> Giỏi");

// Khá: 2.5 <= GPA < 3.2
assert(classifyGpa(3.19) === "Khá", "GPA 3.19 -> Khá");
assert(classifyGpa(2.8) === "Khá", "GPA 2.8 -> Khá");
assert(classifyGpa(2.5) === "Khá", "GPA 2.5 (ngưỡng) -> Khá");

// Trung bình: 2.0 <= GPA < 2.5
assert(classifyGpa(2.49) === "Trung bình", "GPA 2.49 -> Trung bình");
assert(classifyGpa(2.2) === "Trung bình", "GPA 2.2 -> Trung bình");
assert(classifyGpa(2.0) === "Trung bình", "GPA 2.0 (ngưỡng) -> Trung bình");

// Yếu: 1.0 <= GPA < 2.0
assert(classifyGpa(1.99) === "Yếu", "GPA 1.99 -> Yếu");
assert(classifyGpa(1.5) === "Yếu", "GPA 1.5 -> Yếu");
assert(classifyGpa(1.0) === "Yếu", "GPA 1.0 (ngưỡng) -> Yếu");

// Kém: 0.0 <= GPA < 1.0
assert(classifyGpa(0.99) === "Kém", "GPA 0.99 -> Kém");
assert(classifyGpa(0.5) === "Kém", "GPA 0.5 -> Kém");
assert(classifyGpa(0.0) === "Kém", "GPA 0.0 -> Kém");

// Xử lý thiếu dữ liệu và không hợp lệ
assert(classifyGpa(null) === "Chưa đủ dữ liệu xếp loại", "GPA null -> Chưa đủ dữ liệu xếp loại");
assert(classifyGpa(undefined) === "Chưa đủ dữ liệu xếp loại", "GPA undefined -> Chưa đủ dữ liệu xếp loại");
assert(classifyGpa("") === "Chưa đủ dữ liệu xếp loại", "GPA rỗng -> Chưa đủ dữ liệu xếp loại");
assert(classifyGpa("abc") === "Dữ liệu không hợp lệ", "GPA text không hợp lệ -> Dữ liệu không hợp lệ");
assert(classifyGpa(-0.1) === "Dữ liệu không hợp lệ", "GPA âm (-0.1) -> Dữ liệu không hợp lệ, không ép về 0");
assert(classifyGpa(4.1) === "Dữ liệu không hợp lệ", "GPA vượt 4.0 (4.1) -> Dữ liệu không hợp lệ, không ép về 4");

// Ghi chú chuẩn thang điểm
assert(GPA_SCALE_NOTE.includes("thang GPA hệ 4"), "Có thông điệp ghi chú chuẩn thang GPA hệ 4");

// ========================================================
// 2. QUY TẮC HIỂN THỊ ĐIỂM SỐ (ĐIỂM 0 vs NULL/UNDEFINED)
// ========================================================
console.log("\n[TEST 2] QUY TẮC HIỂN THỊ ĐIỂM SỐ");

assert(formatGradeValue(0) === "0", "Điểm 0 số hiển thị là '0'");
assert(formatGradeValue("0") === "0", "Điểm '0' chuỗi hiển thị là '0'");
assert(formatGradeValue(null) === "Chưa có điểm", "Điểm null hiển thị là 'Chưa có điểm'");
assert(formatGradeValue(undefined) === "Chưa có điểm", "Điểm undefined hiển thị là 'Chưa có điểm'");
assert(formatGradeValue("") === "Chưa có điểm", "Điểm chuỗi rỗng hiển thị là 'Chưa có điểm'");
assert(formatGradeValue(8.5) === "8.5", "Điểm 8.5 hiển thị đúng '8.5'");

assert(formatGpaDisplay(3.567) === "3.57", "GPA định dạng 2 chữ số thập phân chuẩn");
assert(formatGpaDisplay(0) === "0.00", "GPA 0 hiển thị '0.00'");
assert(formatGpaDisplay(null) === "Chưa có dữ liệu", "GPA null fallback 'Chưa có dữ liệu'");

// ========================================================
// 3. THÔNG TIN SINH VIÊN CHỈ ĐỂ XEM & BỎ CẤU HÌNH ĐỒNG BỘ
// ========================================================
console.log("\n[TEST 3] THÔNG TIN SINH VIÊN & BỎ CẤU HÌNH ĐỒNG BỘ TRÊN HỒ SƠ");

// Trạng thái chưa có profile
resetSessionState();
const emptyProfileHtml = renderProfileView();
assert(!emptyProfileHtml.includes("openEditProfileBtn"), "Không còn nút 'Chỉnh sửa thông tin'");
assert(!emptyProfileHtml.includes("profileEditForm"), "Không còn form chỉnh sửa hồ sơ");
assert(!emptyProfileHtml.includes("profileSyncNowBtn"), "Không còn nút đồng bộ ngay trong hồ sơ");
assert(!emptyProfileHtml.includes("Cấu hình nguồn đồng bộ dữ liệu"), "Đã bỏ khối cấu hình nguồn đồng bộ");
assert(emptyProfileHtml.includes("Chưa có dữ liệu"), "Hiển thị Chưa có dữ liệu khi thiếu thông tin");
assert(emptyProfileHtml.includes("profileLogoutBtn"), "Giữ lại nút Thoát phiên làm việc");

// Trạng thái có thông tin và email dài
state.studentProfile = {
  name: "Nguyễn Hoàng Nam",
  studentId: "24IT005",
  email: "nguyenhoangnam.cntt.khoa2024.chinhquy.daihoccmc@student.cmcu.edu.vn"
};
const filledProfileHtml = renderProfileView();
assert(filledProfileHtml.includes("Nguyễn Hoàng Nam"), "Hiển thị đúng họ tên sinh viên");
assert(filledProfileHtml.includes("24IT005"), "Hiển thị đúng mã sinh viên");
assert(filledProfileHtml.includes("nguyenhoangnam.cntt"), "Hiển thị email sinh viên");
assert(filledProfileHtml.includes("student-email-text"), "Email hiển thị dạng văn bản ngay dưới MSSV");
assert(!filledProfileHtml.includes("profile-field-box"), "Bỏ khung nền riêng bao quanh email");

// ========================================================
// 4. BẢNG ĐIỂM CHI TIẾT THEO HỌC KỲ & MÔN ĐIỂM P
// ========================================================
console.log("\n[TEST 4] BẢNG ĐIỂM CHI TIẾT & MÔN ĐIỂM P");

state.academicSemesters = [
  {
    id: "sem-2025-1",
    academicYear: "2025 - 2026",
    semesterName: "Học kỳ 1",
    title: "Năm học 2025 - 2026 - Học kỳ 1",
    courses: [
      {
        id: "c-1",
        courseCode: "DBI202",
        courseName: "Cơ sở dữ liệu",
        credits: 3,
        studyAttempt: 1,
        examAttempt: 1,
        grade10: 8.5,
        grade4: 3.5,
        gradeChar: "B+",
        evaluation: "Đạt",
        note: "",
        components: [
          { name: "Chuyên cần", weight: 10, score: 10 },
          { name: "Kiểm tra giữa kỳ", weight: 30, score: 8.0 },
          { name: "Thi kết thúc học phần", weight: 60, score: 8.5 }
        ]
      },
      {
        id: "c-2",
        courseCode: "GDTC101",
        courseName: "Giáo dục thể chất 1 (Điểm P)",
        credits: 1,
        studyAttempt: 1,
        examAttempt: 1,
        grade10: 7.0,
        grade4: 0.0, // Điểm hệ 4 bằng 0 đối với môn đạt/không đạt (P)
        gradeChar: "P",
        evaluation: "Đạt", // Môn P vẫn Đạt dù hệ 4 là 0
        note: "Môn điều kiện",
        components: []
      }
    ],
    summary: {
      semesterCredits: 4,
      cumulativeCredits: 4,
      semesterGpa10: 8.5,
      semesterGpa4: 3.5,
      cumulativeGpa10: 8.5,
      cumulativeGpa4: 3.5,
      semesterClassification: "Giỏi"
    }
  }
];

state.academicSummary = {
  programCredits: 135,
  enrolledCredits: 16,
  cumulativeCredits: 16,
  averageGrade10: 8.2,
  averageGrade4: 3.4,
  cumulativeGpa10: 8.2,
  cumulativeGpa4: 3.4
};

const profileWithGradesHtml = renderProfileView();
assert(profileWithGradesHtml.includes("DBI202"), "Hiển thị mã môn DBI202");
assert(profileWithGradesHtml.includes("Cơ sở dữ liệu"), "Hiển thị tên môn Cơ sở dữ liệu");
assert(profileWithGradesHtml.includes("GDTC101"), "Hiển thị môn GDTC101");
assert(profileWithGradesHtml.includes("Điểm chữ"), "Có cột Điểm chữ");
assert(profileWithGradesHtml.includes("Đánh giá"), "Có cột Đánh giá");
assert(profileWithGradesHtml.includes("Chi tiết"), "Có nút xem Chi tiết");

// Môn điểm P: đánh giá vẫn "Đạt"
assert(profileWithGradesHtml.includes("Giáo dục thể chất 1 (Điểm P)"), "Môn điểm P có mặt trong bảng");
assert(profileWithGradesHtml.includes("status-pill green"), "Môn P được đánh giá Đạt với badge xanh");

// Tổng kết học kỳ
assert(profileWithGradesHtml.includes("Tổng kết học kỳ"), "Có khối Tổng kết học kỳ");
assert(profileWithGradesHtml.includes("ĐTB học kỳ hệ 4:"), "Có chỉ số ĐTB học kỳ hệ 4");
assert(profileWithGradesHtml.includes("ĐTB tích lũy hệ 4:"), "Có chỉ số ĐTB tích lũy hệ 4");

// Card Tổng điểm bên phải
assert(profileWithGradesHtml.includes("cumulative-summary-card"), "Có card Tổng điểm");
assert(profileWithGradesHtml.includes("Tổng số tín chỉ chương trình"), "Có mục Tổng số tín chỉ chương trình");
assert(profileWithGradesHtml.includes("135"), "Hiển thị đúng 135 tín chỉ chương trình");
assert(profileWithGradesHtml.includes("Xếp loại học lực tích lũy:"), "Có xếp loại học lực tích lũy");

// Modal Chi tiết điểm thành phần
const detailModalHtml = renderGradeDetailModal(
  state.academicSemesters[0].courses[0],
  "Năm học 2025 - 2026 - Học kỳ 1"
);
assert(detailModalHtml.includes("DBI202"), "Modal có mã học phần");
assert(detailModalHtml.includes("Cơ sở dữ liệu"), "Modal có tên học phần");
assert(detailModalHtml.includes("Chuyên cần"), "Modal thể hiện điểm thành phần Chuyên cần");
assert(detailModalHtml.includes("Kiểm tra giữa kỳ"), "Modal thể hiện điểm Kiểm tra giữa kỳ");

// ========================================================
// 5. TRÌNH SOẠN THẢO GHI CHÚ DẠNG TRANG GIẤY & BỎ TEXTBOOK
// ========================================================
console.log("\n[TEST 5] GHI CHÚ TRANG GIẤY & BỎ TAB TEXTBOOK");

const docViewHtml = renderDocumentsView({ activeTab: "docs" });
assert(!docViewHtml.includes("data-doc-tab=\"textbooks\""), "Đã bỏ tab 'Textbook điện tử'");
assert(docViewHtml.includes("data-doc-tab=\"docs\""), "Còn tab 'Kho tài liệu'");
assert(docViewHtml.includes("data-doc-tab=\"notes\""), "Còn tab 'Ghi chú & Sổ tay'");

// Tạo ghi chú trang giấy mới
const newPaperNote = saveNote({
  id: "test-paper-note-1",
  title: "Tóm tắt chương 1 Cơ sở dữ liệu",
  subject: "Cơ sở dữ liệu",
  content: "Mô hình ERD gồm Thực thể, Thuộc tính và Mối quan hệ.",
  tags: ["CSDL", "Chương 1"]
});
assert(newPaperNote.id === "test-paper-note-1", "Tạo trang ghi chú mới thành công");

const notesViewHtml = renderDocumentsView({ activeTab: "notes", activeNoteId: newPaperNote.id });
assert(notesViewHtml.includes("paper-notes-workspace"), "Giao diện soạn thảo dạng trang giấy");
assert(notesViewHtml.includes("paper-sheet"), "Có khung trang giấy (paper sheet)");
assert(notesViewHtml.includes("noteInputContent"), "Textarea soạn thảo gõ trực tiếp");
assert(notesViewHtml.includes("Tóm tắt chương 1 Cơ sở dữ liệu"), "Nội dung tiêu đề hiển thị trên trang giấy");

// Xóa ghi chú
deleteNote(newPaperNote.id);
assert(!getNotes().some((n) => n.id === newPaperNote.id), "Xóa trang ghi chú thành công");

console.log("\n====================================================");
console.log("   TẤT CẢ TEST HỒ SƠ HỌC TẬP & GHI CHÚ ĐÃ ĐẠT!      ");
console.log("====================================================");
