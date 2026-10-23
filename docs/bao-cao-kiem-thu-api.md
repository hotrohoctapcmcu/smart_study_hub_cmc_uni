# Báo cáo kiểm thử tích hợp API học tập

## Cách chạy

Chạy từ thư mục gốc dự án:

```bash
npm run test:learning-apis
```

Mỗi lượt chạy tạo một database SQLite tạm trong thư mục hệ thống, khởi động API trên cổng động, rồi đóng server và xóa dữ liệu thử nghiệm. Bộ kiểm thử không ghi vào `data/unistudy.db`.

Gemini được thay bằng hàm giả trong tiến trình kiểm thử để không gọi mạng hoặc dùng thông tin xác thực thật.

## Kết quả lần chạy

- Kết quả: **48/48 kiểm tra đạt**.
- StudySchedules: kiểm tra xung đột với lịch trường và lịch tự học, tạo/sửa/đổi trạng thái/xóa buổi học, từ chối lịch bị trùng.
- Lịch thi: tạo, đọc lịch sắp tới, sửa, tạo/cập nhật/xóa kế hoạch ôn thi, xóa kỳ thi cùng nhắc nhở liên quan.
- Time Map: tổng hợp lịch học, kỳ thi, buổi tự học và khoảng trống; xác nhận mốc UTC+7 và từ chối ngày sai.
- Progress: bài quá hạn, tỷ lệ hoàn thành, giờ tự học tuần, GPA, kỳ thi gần nhất và lời khuyên từ Gemini giả lập.
- Thông báo/nhắc nhở: tạo, đọc, đếm thông báo đến hạn, đánh dấu đã đọc, xóa và xác nhận gọi nhiều tầng lặp lại không tạo trùng.
- Xóa dữ liệu: xóa task nội bộ và nhắc nhở liên quan, từ chối task khác chủ sở hữu, ẩn task EDUX qua đồng bộ lại, bảo vệ checklist khác chủ sở hữu.

## Giới hạn đã biết

Schema hiện tại chưa có bảng Pomodoros. Các kiểm tra xác nhận API trả cảnh báo và giờ học chỉ tính từ StudySchedules; chúng chưa xác nhận số giờ Pomodoro thực tế. Gemini được giả lập nên lần chạy này không xác minh kết nối tới dịch vụ Gemini bên ngoài.
