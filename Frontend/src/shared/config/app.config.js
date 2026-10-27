/**
 * UniStudy CMC - Sprint 1 App Configuration
 */
export const APP_CONFIG = {
  appName: "UniStudy CMC",
  appSubtitle: "Trợ lý học tập thông minh dành cho sinh viên CMC University",
  version: "1.0.0-sprint1",
  timezone: "Asia/Ho_Chi_Minh",
  locale: "vi-VN",
  apiBaseUrl: "http://localhost:3001", // Đã kết nối API Backend Sprint 1
  isApiConnected: true,
  examLookaheadDays: 70,
  // Ngưỡng sắp đến hạn (CHƯA CHỐT trong hợp đồng backend, cấu hình minh bạch)
  dueSoonThresholdHours: 48,
  // Breakpoints chuẩn (YouTube-style sidebar & layout)
  breakpoints: {
    mobileMax: 768,
    tabletMax: 1024,
    desktopMin: 1025
  }
};
