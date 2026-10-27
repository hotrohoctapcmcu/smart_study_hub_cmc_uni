# Tích hợp hai nhánh Sprint 2 — 27/10/2026

Nguồn đã fetch trực tiếp từ `origin`:

- `test`: `8a9878be6432c4fa23deba700012c3992dbf0e77` — 5 tệp database Sprint 2.
- `feature/sprint2-api-deliverables`: `ec9030510aec928d849d2691bf0623b5f92462a7` — 26 tệp API, dịch vụ, kiểm thử và tài liệu.
- Nền chung: `5acbf234a715a5afdb295e168ec9f828f6bb46b5`. Tích hợp vào working tree của nhánh `API`, kết hợp với chỉnh sửa AI/IU hiện có; chưa tạo commit hoặc push.

## Các phần đã khớp nối

- `getPool()` tự chạy migration Sprint 2 trước khi nhận request. Các bảng `PomodoroSessions`, `Notebooks`, `Notes`, `EduxDocuments`, `EduxSyncLog` và cột mới được tạo trên database cũ mà không xóa dữ liệu. Cổng `database/index.js` xuất chung dịch vụ Sprint 1, Sprint 2 và các hàm kiểm tra toàn vẹn.
- Registry API đăng ký `/api/v1/timemap` và `/api/v1/progress`. Cả hai đọc bảng `PomodoroSessions`; không còn phụ thuộc tên bảng `Pomodoros` khác với database mới. Chỉ tính phiên kết thúc có thời lượng thực học; lọc theo hồ sơ sinh viên.
- Trang Tiến độ tải số liệu đã lưu qua `GET /progress?advice=false`, hiển thị tiến độ môn, giờ học tuần hiện tại, GPA và kỳ thi gần nhất. Time Map tải theo ngày/tuần/tháng được chọn. Việc xem số liệu không tự gọi Gemini. Biểu đồ Pomodoro cục bộ hiện có vẫn có nhãn nguồn riêng.
- AI nhận `Notes.is_hard` và `EduxDocuments` trong study context. Giữ phần AI hiện có, bổ sung hợp đồng `timeoutMs`, `signal`, `retry: false` từ nhánh API mới.
- Xóa bài EDUX là ẩn bền trong database; bài đã ẩn không hiện lại khi đồng bộ. Xóa checklist có kiểm tra ID/quyền sở hữu. Frontend gọi API xóa công việc trước khi cập nhật danh sách, lưu thao tác thêm/sửa/xóa và trạng thái checklist.
- Trigger Pomodoro giữ thời lượng thực tế được cung cấp. Đồng bộ tài liệu EDUX dùng transaction của connection chung; một tài liệu lỗi khiến cả đợt ghi tài liệu rollback, đồng thời giữ log lỗi.

## Phạm vi dữ liệu

Giao diện timer Pomodoro, metadata tài liệu và ghi chú hiện có vẫn lưu trên thiết bị theo thiết kế trước đó. Các dịch vụ Sprint 2 cho các bảng này đã được xuất qua cổng database; bản tích hợp này không tự nhập toàn bộ localStorage vào SQLite và không thêm API upload tệp. Báo cáo server chỉ phản ánh bản ghi đã nằm trong database. Time Map biểu diễn phiên Pomodoro bằng khoảng liên tục từ thời điểm bắt đầu với độ dài bằng thời gian tập trung; chưa tái hiện chi tiết các lần tạm dừng/nghỉ.

Các báo cáo bàn giao ngày 24/10 từ nhánh API là tài liệu lịch sử. Đọc tài liệu này và `luong-xu-ly-he-thong.md` để đối chiếu trạng thái sau tích hợp.

## Kiểm thử đã chạy

| Lệnh | Kết quả |
|---|---|
| `npm run test:frontend` | Đạt; gồm kiểm tra gọi API tiến độ/Time Map, năm nhuận, checklist và xóa bị từ chối |
| `npm run test:learning-apis` | 48/48 kiểm tra đạt |
| `npm run test:sprint2-integration` | 8/8 test đạt; database cũ, idempotency, Pomodoro thực tế, AI notes, rollback và mở lại database |
| `npm run test:ai` | 20/20 test đạt; có timeout, cancellation và tắt retry |
| `npm run test:exam-sync` | 9/9 test đạt |
| `npm run test:sprint2:e2e` | Đạt trên Electron ẩn: render báo cáo thật, CRUD checklist và xóa công việc qua API thật |
| `node Frontend/tests/check-imports.mjs` | Đạt |
| `node Frontend/tests/check-html-refs.mjs` | Đạt |

Đã kiểm tra cú pháp 36 tệp JavaScript thuộc API/database và `git diff --check`. Kiểm thử API/Electron dùng database tạm và Gemini giả lập khi cần, không xác nhận kết nối thật với IU/EDUX/Gemini. Kiểm thử self-study frontend đã được cách ly khỏi backend đang chạy trên máy.

## Khởi chạy

Khởi động lại ứng dụng/API đang chạy để nạp backend mới. Chạy `npm start` cho Electron hoặc `npm run start:headless` cho API và frontend. Migration chạy tự động với `DB_PATH` đã cấu hình, mặc định `data/unistudy.db`.

Bản sao trạng thái trước tích hợp nằm ngoài repository tại `../.codex-integration-backups/2026-10-27T10-01-49-636Z/`, gồm patch, bản sao tệp và log kiểm thử. Không thêm thư mục này vào Git.
