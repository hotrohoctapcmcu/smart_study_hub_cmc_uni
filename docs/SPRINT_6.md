# Sprint 6 — Sửa luồng IU

Cập nhật ngày 19/11/2026 (UTC+7).

## Mục tiêu

Đồng bộ dữ liệu sinh viên từ cổng IU `/sinhvien` trên ứng dụng desktop, giữ khả năng sử dụng các phiên ASPX cũ và tạo được bộ cài Windows x64 từ GitHub Actions.

## Phạm vi triển khai

| Hạng mục | Kết quả |
| --- | --- |
| Phân tích bản lưu IU | Trích cấu trúc và dữ liệu mẫu đã ẩn danh để kiểm thử. [Bản phân tích và mẫu](../CRWEB/tests/fixtures/iu-student-portal/README.md) |
| Phiên đăng nhập | Electron mở cổng sinh viên cho kết nối mới. Phiên đã lưu đi qua bộ đọc tương ứng với cổng đăng nhập. |
| Lịch học và lịch thi | Lấy lịch học chi tiết theo tuần. Lịch thi lấy danh sách cá nhân theo học kỳ, lọc trong cửa sổ tối đa 70 ngày và bỏ bản ghi trùng. Nhóm lịch thiếu dữ liệu báo lỗi để ứng dụng giữ bản đã lưu. |
| Dữ liệu học vụ | Chuẩn hóa hồ sơ, bảng điểm, kết quả đăng ký và chương trình học về định dạng đồng bộ hiện có. |
| Đóng gói Windows | Workflow chạy kiểm thử, tạo Setup và Portable x64 bằng `npm run dist:win` và tải hai tệp cùng `SHA256SUMS.txt` lên mục Artifacts. [Build Windows app](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/actions/workflows/build-windows.yml) |

## Kiểm chứng

- Chạy kiểm thử đồng bộ IU trên dữ liệu mẫu, gồm tuần thiếu dữ liệu, phiên hết hạn và lọc lịch thi cá nhân. Các bài hồi quy kiểm tra cả phiên ASPX, làm mới tín chỉ và giữ lại lịch sử.
- Trên bản Windows, vào **Đồng bộ dữ liệu → IU → Kết nối** hoặc **Cập nhật phiên**, đăng nhập tài khoản trường rồi bấm **Đồng bộ**. Đối chiếu **Lịch học**, **Kỳ thi** và **Hồ sơ** với cổng IU.
- Xác nhận đăng nhập và đồng bộ với tài khoản sinh viên thật là bước nghiệm thu còn mở. Nguồn văn bằng trên cổng mới cũng còn chờ xác minh.
