# Hoàn thiện Sprint 2 — 27/10/2026

Phạm vi: chức năng **5, 6, 8, 10, 11, 12, 17**. Các luồng đã được nối từ giao diện qua Express vào SQLite. Phần Outlook dựa trên cách dùng phiên Outlook Web và Microsoft Graph của [vtishan/thoiGianBieu](https://github.com/vtishan/thoiGianBieu), commit tham chiếu `a7861896ad6d86ee1e146426724668780ef9405f`; không đưa SMTP hoặc chức năng gửi thư của dự án đó vào ứng dụng.

| # | Kết quả triển khai |
|---|---|
| 5 | Chọn và upload tệp tối đa 25 MB; lưu byte thật trên đĩa, metadata trong SQLite; mở/tải xuống/xóa; tên tệp gốc, dung lượng thật và kiểm tra quyền sở hữu. Hỗ trợ PDF, DOCX, PPTX, TXT, MD, PNG, JPG. |
| 6 | Thanh tìm kiếm gắn vào shell, Ctrl+K, tìm nội dung tài liệu/ghi chú/công việc nội bộ và EDUX/lịch học/lịch tự học/thi/email; tìm tag bằng `#tag`. Tag tài liệu, ghi chú và công việc lưu trong DB. Kết quả mở đúng trang ghi chú hoặc ngữ cảnh tính năng. |
| 8 | Giữ timer timestamp, chuông, pause/resume và khôi phục phiên; bổ sung đồng bộ lịch sử SQLite bằng ID ổn định, không giới hạn 50 phiên; giữ lịch sử chưa gửi để thử lại. Lưu từng khoảng tập trung để loại trừ pause/nghỉ. |
| 10 | Time Map đọc các khoảng tập trung đã lưu, cắt đúng ngày UTC+7, bao gồm phiên qua nửa đêm; giữ quy tắc ưu tiên lịch thi/lớp/Pomodoro/tự học. |
| 11 | Báo cáo cùng khoảng ngày/tuần/tháng được chọn; tổng hợp task nội bộ và EDUX, loại bài EDUX đã ẩn; có thao tác hoàn thành buổi tự học trên lịch; không cộng trùng Pomodoro và tự học. Giữ AI nhận xét tiến độ hiện có. |
| 12 | CRUD sổ tay và ghi chú, autosave DB, bản nháp khi lỗi, môn/chương/tag/đánh dấu khó; đính kèm textbook thật và đọc PDF trong editor; xuất trang hoặc sổ thành DOCX. Editor được giữ khi shell cập nhật nền. |
| 17 | `CRWEB/OUTLOOK`: đăng nhập qua cửa sổ Electron riêng; đọc Inbox bằng Graph có phân trang hoặc phản hồi Outlook Web; lấy nội dung đầy đủ khi nguồn cho phép; đồng bộ SQLite; phân tích ngày giờ từ nội dung thật; người dùng xác nhận tạo task/lịch thi, chống tạo trùng; lưu trạng thái đã đọc, ngắt kết nối và báo phiên hết hạn. |

## Cách chạy và sử dụng

1. Chạy `npm install`, sau đó `npm start`. Bản headless chạy bằng `npm run start:headless`.
2. Đồng bộ hồ sơ IU để các bản ghi học liệu và phiên học thuộc đúng hồ sơ sinh viên. Các API ghi học liệu trả hướng dẫn nếu chưa có hồ sơ.
3. Trong **Tài liệu**, tải tệp lên; tick **Dùng làm Textbook** nếu là giáo trình. Trong **Ghi chú & Sổ tay**, chọn tài liệu, chương và sổ; ghi chú tự lưu. Có thể xuất DOCX từng trang hoặc toàn sổ.
4. Trong **Pomodoro**, hoàn thành/kết thúc sớm một phiên. Lịch sử được gửi lên DB; nếu lỗi, giữ bản cục bộ và dùng **Đồng bộ lịch sử** để thử lại. Khi mạng trở lại, ứng dụng cũng thử đồng bộ.
5. Trong **Lịch học**, mở chi tiết lịch tự học và chọn **Hoàn thành buổi học**. Trong **Tiến độ**, chọn ngày/tuần/tháng để xem báo cáo cùng khoảng thời gian.
6. Trong **Thông báo**, chọn **Kết nối Outlook**, đăng nhập tài khoản trường, rồi **Đồng bộ hòm thư**. Dùng **Xem nội dung email → Tải nội dung đầy đủ** nếu Outlook Web chỉ trả preview. Chỉ tạo công việc/lịch thi sau khi kiểm tra thông tin trích xuất.

Không cần cấu hình Azure client ID cho cách đăng nhập Electron này. Token Graph chỉ được giữ trong tiến trình chính; cookie được Chromium quản lý trong partition riêng `persist:cmc-outlook`, không gửi vào renderer. Bản headless có thể cấu hình `OUTLOOK_ACCESS_TOKEN` được cấp quyền `Mail.Read` trong môi trường chạy server; không đưa token vào mã nguồn hoặc giao diện. Token headless cần được cấp lại khi hết hạn.

Metadata và dữ liệu nghiệp vụ nằm trong `DB_PATH`. Tệp nằm trong thư mục `documents` cạnh database; có thể đặt `DOCUMENTS_PATH`. Khi sao lưu/chuyển máy phải sao lưu cả database và thư mục tệp. Migration tự chạy, bổ sung cột/index/bảng `SchoolEmails`, giữ dữ liệu cũ. Ghi chú và lịch sử Pomodoro cục bộ được nhập khi kết nối thành công; metadata tài liệu cũ không có byte gốc vẫn hiển thị yêu cầu tải tệp gốc.

## API bổ sung

Các đường dẫn dưới đây có tiền tố `/api/v1`:

| Nhóm | API |
|---|---|
| Tài liệu | `GET/POST /documents`, `DELETE /documents/:id`, `GET /documents/:id/file?download=1`, `PATCH /documents/:id/tags` |
| Sổ tay | `GET/POST /notebooks`, `PUT/DELETE /notebooks/:id`, `GET /notebooks/:id/export` |
| Ghi chú | `GET/POST /notes`, `PUT/DELETE /notes/:id`, `GET /notes/:id/export` |
| Pomodoro | `GET/POST/DELETE /pomodoro` |
| Tìm kiếm/tag | `GET /search?q=...&tag=...`, `PATCH /tags/tasks/:id`, `PATCH /tags/edux/:id` |
| Email | `GET /email`, `GET /email/status`, `POST /email/sync`, `DELETE /email/session`, `PATCH /email/read`, `PATCH /email/:id/read`, `POST /email/:id/refresh`, `POST /email/:id/task`, `POST /email/:id/exam` |
| Báo cáo | `GET /progress?advice=false&from=YYYY-MM-DD&to=YYYY-MM-DD`; giữ tương thích báo cáo tuần hiện tại khi không truyền khoảng ngày. |

Upload dùng body nhị phân `application/octet-stream` và header `X-Document-Meta = encodeURIComponent(JSON.stringify({filename,title,subject,category,tags,isTextbook}))`. API không nhận đường dẫn tệp tùy ý từ máy khách. API DOCX trả dữ liệu nhị phân; các API nghiệp vụ trả `{success,data}`.

## Kiểm thử và giới hạn xác minh

| Lệnh | Phạm vi |
|---|---|
| `npm run test:sprint2-complete` | 11 test đạt: migration, byte tệp, giới hạn upload, quyền sở hữu, note/textbook/DOCX, pause và nửa đêm, báo cáo EDUX và chống cộng trùng, tag/tìm kiếm, email/idempotency, mở lại DB, Graph phân trang và lỗi xác thực. |
| `npm run test:sprint2-complete:e2e` | Electron ẩn + giao diện/API/SQLite thật: file picker, autosave qua đổi tab/reload, bản nháp khi DB từ chối và thử lại, tìm tag/mở note, timer thực, email → task; kiểm tra escape nội dung bên ngoài. |
| Các bộ hồi quy | Đạt: frontend; learning APIs 48/48; nhóm API tích hợp Sprint 2, AI và lịch thi (gộp bộ mới) 48/48; Electron E2E cũ 3 luồng. Import/HTML references và `git diff --check` đạt. `npm audit` không còn lỗ hổng sau cập nhật bản vá body-parser. |

Các test dùng database tạm riêng. Chỉ phía Microsoft/AI được giả lập khi cần. Không dùng bộ email seed làm dữ liệu mặc định và không báo đồng bộ thành công khi API lỗi.

**Chưa nghiệm thu kết nối hộp thư trường thật trong môi trường này.** Người dùng cần đăng nhập tài khoản trường để xác minh tenant cấp quyền và Outlook Web trả dữ liệu. Nếu tenant không cấp Graph, bản Web có thể chỉ có preview; giao diện thông báo rõ và có liên kết thư gốc. Bộ trích xuất hiện tại nhận ngày rõ `DD/MM/YYYY` (cũng nhận dấu `.`/`-`) và giờ `HH:mm`/`HHhmm`; thư thiếu ngày/giờ, ngày không hợp lệ hoặc diễn đạt mơ hồ không được tự suy ra hạn. Không có tự gửi thư hoặc tự tạo task/lịch thi không qua thao tác xác nhận.

Trạng thái phù hợp là **đã triển khai 7 chức năng Sprint 2 và kiểm thử tích hợp**, với nghiệm thu tài khoản Outlook thật còn cần xác minh. Không suy ra việc hoàn thành Sprint 1 hoặc Sprint 3 từ các kết quả này.
