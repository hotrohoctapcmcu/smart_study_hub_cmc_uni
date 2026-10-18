/**
 * UniStudy CMC - Sync Sources Configuration
 * Điểm vào cổng trường chính thức do chủ dự án cung cấp (NAVIGATION_MAP.md)
 * Hiện tại chỉ hướng tới IU.
 */
export const SYNC_SOURCES = [
  {
    id: "iu",
    name: "Hệ thống Quản lý Đào tạo (IU)",
    code: "IU",
    description: "Thời khóa biểu chính khóa, lịch thi học kỳ, phòng học, giảng viên",
    portalUrl: "https://iu.cmcu.edu.vn/congthongtin/Index.aspx",
    defaultSelected: true,
    priority: 1
  }
];
// NOTE: Hiện tại chỉ hướng tới IU - EduX sẽ bổ sung sau.
