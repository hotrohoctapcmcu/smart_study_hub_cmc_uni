/**
 * UniStudy CMC - Academic Utilities & GPA Classification
 * Thang xếp loại học lực theo GPA hệ 4 chuẩn người dùng cung cấp.
 * Dùng duy nhất một hàm dùng chung trong toàn bộ dự án.
 */

export const GPA_SCALE_NOTE = "Xếp loại theo thang GPA hệ 4 được cung cấp";

/**
 * Phân loại học lực theo GPA hệ 4.
 * Thang xếp loại:
 *   3.6 <= GPA <= 4.0   -> Xuất sắc
 *   3.2 <= GPA < 3.6    -> Giỏi
 *   2.5 <= GPA < 3.2    -> Khá
 *   2.0 <= GPA < 2.5    -> Trung bình
 *   1.0 <= GPA < 2.0    -> Yếu
 *   0.0 <= GPA < 1.0    -> Kém
 *
 * Quy tắc:
 * - Thiếu GPA (null, undefined, NaN, ""): "Chưa đủ dữ liệu xếp loại"
 * - Giá trị không hợp lệ hoặc ngoài 0 - 4: "Dữ liệu không hợp lệ"
 * - Phân loại trên giá trị gốc, KHÔNG làm tròn trước rồi phân loại.
 * - Đây là phân loại theo ngưỡng GPA, không phải thứ hạng sinh viên và không tự suy ra xếp loại tốt nghiệp chính thức.
 *
 * @param {number|string|null|undefined} gpa
 * @returns {string}
 */
export function classifyGpa(gpa) {
  if (gpa === null || gpa === undefined || gpa === "") {
    return "Chưa đủ dữ liệu xếp loại";
  }

  const num = typeof gpa === "number" ? gpa : Number(gpa);
  if (isNaN(num)) {
    return "Dữ liệu không hợp lệ";
  }

  if (num < 0 || num > 4.0) {
    return "Dữ liệu không hợp lệ";
  }

  if (num >= 3.6) return "Xuất sắc";
  if (num >= 3.2) return "Giỏi";
  if (num >= 2.5) return "Khá";
  if (num >= 2.0) return "Trung bình";
  if (num >= 1.0) return "Yếu";
  return "Kém";
}

/**
 * Lấy class badge màu sắc tương ứng với xếp loại học lực
 * @param {string} classification
 * @returns {string} class name
 */
export function getGpaClassificationBadgeClass(classification) {
  switch (classification) {
    case "Xuất sắc":
      return "badge-gpa-excellent";
    case "Giỏi":
      return "badge-gpa-good";
    case "Khá":
      return "badge-gpa-fair";
    case "Trung bình":
      return "badge-gpa-average";
    case "Yếu":
      return "badge-gpa-weak";
    case "Kém":
      return "badge-gpa-poor";
    default:
      return "badge-gpa-neutral";
  }
}

/**
 * Định dạng điểm số chi tiết hiển thị an toàn:
 * - Điểm 0 (số hoặc chuỗi "0") phải hiển thị là "0" (hoặc "0.0")
 * - null/undefined/chuỗi rỗng: "Chưa có điểm"
 * - Không tự biến null thành 0
 *
 * @param {number|string|null|undefined} val
 * @param {string} [fallback="Chưa có điểm"]
 * @returns {string}
 */
export function formatGradeValue(val, fallback = "Chưa có điểm") {
  if (val === null || val === undefined || val === "") {
    return fallback;
  }
  if (val === 0 || val === "0") {
    return "0";
  }
  const num = Number(val);
  if (isNaN(num)) {
    return String(val);
  }
  // Giữ nguyên định dạng số rõ ràng
  return Number.isInteger(num) ? String(num) : num.toString();
}

/**
 * Định dạng GPA hiển thị (2 chữ số thập phân):
 * - Điểm 0: "0.00"
 * - null/undefined: fallback
 *
 * @param {number|string|null|undefined} val
 * @param {string} [fallback="Chưa có dữ liệu"]
 * @returns {string}
 */
export function formatGpaDisplay(val, fallback = "Chưa có dữ liệu") {
  if (val === null || val === undefined || val === "") {
    return fallback;
  }
  const num = Number(val);
  if (isNaN(num)) {
    return fallback;
  }
  return num.toFixed(2);
}
