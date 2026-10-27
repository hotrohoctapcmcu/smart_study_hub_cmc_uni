# Khoảng đồng bộ lịch thi IU

Lịch thi được lấy từ ngày hiện tại theo giờ Việt Nam đến **70 ngày sau**, độc lập với khoảng thời khóa biểu. Ví dụ khi đồng bộ ngày 27/10/2026, cửa sổ là 27/10/2026–05/01/2027, lấy cả hai ngày biên. Ngày được tính lại tại mỗi lần gọi.

- Bỏ mốc năm học 2026–2027 cố định ở frontend. Thời khóa biểu dùng năm học hiện tại do backend tính; lịch thi có cửa sổ riêng.
- IU nhận `strNgayDangChon` theo từng tuần: crawler tra mỗi 7 ngày và thêm ngày cuối khi khoảng không chia hết cho 7, tối đa 3 request đồng thời. Cửa sổ 70 ngày có tối đa 11 mốc tra để lấy đủ cả tuần đầu và tuần cuối.
- Nếu cần endpoint theo học kỳ, quét các học kỳ giao với cửa sổ, gồm cả kỳ tiếp theo. Không chọn cố định học kỳ đầu hay ưu tiên cờ hiện tại của một kỳ đã cũ.
- Chuẩn hóa ngày, gộp trùng và loại kết quả trước hôm nay hoặc sau ngày cuối. Cả kéo riêng lịch thi và đồng bộ IU đầy đủ dùng chung logic.
- Đồng bộ thành công nhưng không có kỳ thi sẽ cập nhật cache IU về rỗng, tránh giữ lại lịch cũ. Kỳ thi tự nhập không bị xóa. Nếu không xác minh được đầy đủ kết quả, giữ dữ liệu IU đã lưu và báo lỗi.
- UI hiển thị “70 ngày tới” cùng ngày bắt đầu/kết thúc đồng bộ.

`POST /api/v1/sync/iu/pull` và `POST /api/v1/sync/iu/group` (`nhom: "lichthi"`) nhận `soNgayLichThi`, mặc định 70, có thể giảm xuống 60 hoặc giá trị nguyên từ 1 đến 70. Đây là giới hạn ứng dụng, không khẳng định là giới hạn tối đa của cổng IU. `ngayBatDau`/`ngayKetThuc` của thời khóa biểu không ghi đè khoảng lịch thi.

Sau khi cập nhật mã, mở lại ứng dụng và đồng bộ IU để thay thế cache lịch thi cũ. Nếu phiên IU hết hạn, đăng nhập qua mục Đồng bộ dữ liệu trước khi kéo lại. Trong lần kiểm tra hiện tại không có cookie IU cục bộ để xác nhận lấy lịch thi trực tiếp, nên chưa cập nhật database cá nhân.

Kiểm thử: `npm run test:exam-sync` đạt 9/9, bao gồm đổi ngày theo giờ Việt Nam, qua năm mới/năm nhuận, 60/70 ngày, học kỳ tiếp theo, gộp trùng, loại ngày ngoài khoảng, lỗi phiên/nguồn không đầy đủ, chuyển tham số qua HTTP/Electron và cập nhật cache SQLite khi kết quả rỗng. Bộ frontend và AI hiện có cũng đã chạy qua.
