/**
 * UniStudy CMC - Sync Sources Configuration
 * Điểm vào cổng trường chính thức do chủ dự án cung cấp (NAVIGATION_MAP.md)
 *
 * IU:   SSO cổng trường, tự động qua Electron bridge (phiên do API giữ).
 * EDUX: đăng nhập bằng chính tài khoản EDUX (email + mật khẩu) qua API.
 * Hai nguồn độc lập: trạng thái kết nối/đăng nhập/đồng bộ tách riêng.
 */
export const SYNC_SOURCES = [
  {
    id: "iu",
    name: "Hệ thống Quản lý Đào tạo (IU)",
    code: "IU",
    description: "Thời khóa biểu chính khóa, lịch thi học kỳ, phòng học, giảng viên",
    portalUrl: "https://iu.cmcu.edu.vn/congthongtin/Index.aspx",
    authMethod: "sso",
    defaultSelected: true,
    priority: 1
  },
  {
    id: "edux",
    name: "EduX CMC",
    code: "EDUX",
    description: "Bài giảng theo chương, tiến độ học và bài tập AI của từng học phần",
    portalUrl: "https://edux.cmcu.edu.vn/",
    authMethod: "password",
    defaultSelected: true,
    priority: 2
  }
];

/**
 * Lấy cấu hình nguồn theo id ("iu" | "edux"), null nếu không có.
 * @param {string} sourceId
 */
export function getSyncSource(sourceId) {
  return SYNC_SOURCES.find((source) => source.id === sourceId) || null;
}
