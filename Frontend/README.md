# UniStudy CMC — Frontend

Giao diện HTML/CSS và JavaScript ES modules dùng chung với Electron, Express API và SQLite của dự án.

## Chạy ứng dụng

Tại thư mục gốc repository:

```powershell
npm install
npm start
```

Để chạy API và giao diện web:

```powershell
npm run start:headless
```

Mở `http://localhost:8080`. API mặc định ở cổng `3001`; cấu hình frontend nằm trong `src/shared/config/app.config.js` và registry route ở `src/shared/config/endpoints.js`. Đồng bộ IU tự động cần Electron để mở cửa sổ đăng nhập và sử dụng IPC bridge.

## Tiến độ và dữ liệu

Trang Tiến độ đọc báo cáo đã lưu từ `/api/v1/progress?advice=false` và bản đồ thời gian từ `/api/v1/timemap`. Các biểu đồ Pomodoro trên thiết bị vẫn được ghi nhãn riêng. Metadata tài liệu, ghi chú và lịch sử timer hiện có lưu trong localStorage; chưa có upload file hoặc tự động nhập localStorage vào SQLite.

## Kiểm tra

```powershell
npm run test:frontend
npm run test:learning-apis
npm run test:sprint2-integration
npm run test:sprint2:e2e
```

Xem [báo cáo tích hợp hai nhánh](../docs/tich_hop_sprint2.md) và [luồng hệ thống](../docs/luong-xu-ly-he-thong.md) để biết phạm vi và kết quả kiểm thử.
