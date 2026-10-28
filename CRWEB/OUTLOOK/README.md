# Outlook trong CRWEB

Mô-đun đọc thư của ứng dụng, tham khảo cách Outlook Web + Microsoft Graph trong [vtishan/thoiGianBieu](https://github.com/vtishan/thoiGianBieu), commit `a786189`.

- `index.js`: client đăng nhập Electron, giữ credential ở main process, đọc Inbox/Graph, lấy nội dung thư, trạng thái và logout. `createOutlookClient` cho phép truyền transport để kiểm thử.
- `parser.js`: chuẩn hóa Graph/OWA và chuyển HTML thành text.
- `analysis.js`: trích xuất deadline/lịch thi từ ngày giờ có thật trong nội dung; không tự đoán ngày/giờ thiếu.

Ứng dụng gọi qua `electron/outlook-bridge.js` và API `/api/v1/email/*`. Thư đồng bộ được lưu trong `SchoolEmails`, không chỉ localStorage. Tạo công việc/lịch thi là thao tác người dùng riêng, có chống trùng. Các hàm không gửi hoặc trả lời thư.

Chạy Electron bằng `npm start`, mở **Thông báo → Kết nối Outlook**. Với headless, cấu hình biến môi trường `OUTLOOK_ACCESS_TOKEN` có quyền `Mail.Read`. Xem [hướng dẫn Sprint 2](../../docs/hoan_thien_sprint2.md) để biết dữ liệu lưu trữ, API và giới hạn xác minh.

Tài liệu giao thức: [Microsoft Graph list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0), [Electron Debugger](https://www.electronjs.org/docs/latest/api/debugger).
