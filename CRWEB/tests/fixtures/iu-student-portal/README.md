# Phân tích bản lưu cổng IU

Bản ZIP có 731 tệp, gồm cổng ASPX ở `/congthongtin` và cổng sinh viên ở `/sinhvien`. Nhiều tệp khác tên do tham số truy vấn nhưng nội dung giống nhau. Ví dụ, 143 bản `Config.js` của ASPX có cùng SHA-256. `snapshot.json` giữ cấu trúc và kiểu dữ liệu của những bản ghi phục vụ kiểm thử. Giá trị cá nhân, định danh, ngày giờ và nội dung mẫu được thay bằng dữ liệu giả lập. Các tệp trang đầy đủ, SSO, danh sách điểm danh, ảnh, font và CSS nằm trong ZIP ban đầu.

| Nguồn đối chiếu trong ZIP | Dữ liệu dùng trong CRWEB |
| --- | --- |
| `sinhvien/_next/static/chunks/0rqnw1cc_ekyh.js` và `0suidkj74yfha.js` | Trang chuyển tuần bằng `GET /sinhvien/api/timetable/week?start=…&end=…&date=…`. Lấy `events` theo tuần từ thứ hai đến chủ nhật, lọc lại khoảng người dùng chọn. Các lớp trong `noDetail` chưa có buổi học cụ thể. |
| `sinhvien/api/timetable/days_…` | `days` chứa số buổi học và lịch thi từng ngày. Fixture giữ cấu trúc này để kiểm thử việc từ chối dữ liệu đếm ở luồng lịch chi tiết. |
| `sinhvien/congsinhvien/thoikhoabieu/lichthi__rsc_…` và chunk `0nw34fpzbxoir.js` | Trang trả danh sách học kỳ. Luồng lấy `personal` từ `GET /sinhvien/api/exam-schedule/schedule` theo học kỳ và lọc cửa sổ 1–70 ngày. |
| Các trang `profile/hoso`, `hoctap/diemhoc`, `hoctap/chuontrinhhoc`, `hoctap/phuckhao` và `tintuc` | Đọc dữ liệu JSON mà Next.js gửi cùng HTML. Những nhóm trang này dùng chung cấu trúc đầu ra `{ IU: … }` với luồng ASPX. |

Electron mở cổng `/sinhvien` để đăng nhập Microsoft. Đồng bộ dùng cookie do Electron cấp cho đúng phạm vi IU. Phiên ASPX đã lưu vẫn đi qua nhánh cũ. Một tuần hoặc học kỳ lịch thi trả thiếu dữ liệu làm nhóm lịch tương ứng báo lỗi để ứng dụng giữ dữ liệu đã lưu. Phiên hết hạn làm lần đồng bộ dừng với lỗi xác thực.

ZIP có nội dung trang ban đầu và mã JavaScript mô tả cách gọi các API chi tiết. Kiểm thử tái tạo phản hồi lịch tuần và lịch thi theo học kỳ từ những cấu trúc đó. Văn bằng từ cổng mới chưa có nguồn xác minh trong ZIP.
