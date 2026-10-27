# Kết quả kiểm thử AI Sprint 2 – Văn Tuấn

Cập nhật ngày 27/10/2026. Môi trường: Windows, Node.js 24.16.0, Electron 44.7.0, SQLite sql.js; lịch dùng `Asia/Ho_Chi_Minh`. Gemini chạy bằng phiên web **chưa đăng nhập**, không dùng API key hoặc cookie đăng nhập Google.

## Kết quả nghiệm thu

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run test:ai` | PASS 19/19: 18 tình huống con và 1 nhóm tổng |
| `node tests/API/test-ai-api.js` | PASS 21 kiểm tra giao thức Gemini khách |
| `npm run test:frontend` | PASS bộ frontend và hồi quy AI Sprint 2 |
| `npm run test:ai:live` | PASS 10/10 tình huống HTTP với Gemini thật và dữ liệu CMC đã đồng bộ |
| `npm run test:ai:e2e` | PASS 6/6 bước giao diện Electron với Gemini thật |
| Import frontend và tham chiếu HTML | PASS |
| `git diff --check` | PASS |

Bằng chứng có thể đọc bằng máy: [ai_live_result.json](ai_live_result.json), [ai_e2e_result.json](ai_e2e_result.json). Các báo cáo chỉ chứa số lượng và trạng thái, không ghi tên, mã sinh viên, điểm cụ thể, cookie hay token.

## Dữ liệu tài khoản CMC thực tế

Sau lần người dùng đồng bộ IU và EDUX:

- 1 hồ sơ sinh viên.
- 87 buổi học IU, phạm vi từ 03/09/2026 đến 19/11/2026.
- 10 bản ghi điểm.
- 2 lịch thi, ngày 09/09/2026 và 12/09/2026; đều đã qua tại thời điểm kiểm thử.
- 97 bản ghi EDUX; context lấy đúng 3 bài chưa hoàn thành.
- Ban đầu chưa có lịch tự học. Chưa có bảng tài liệu/ghi chú trong DB; nguồn giao diện dùng snapshot từ localStorage.

Context nhận diện đúng hồ sơ, có 17.679 ký tự trong lần chạy live, dưới giới hạn 48.000 ký tự. Context gửi mô hình chứa 40/87 bản ghi thời khóa biểu và báo `truncated:true`; việc kiểm tra xung đột dùng toàn bộ 87 buổi học, không dùng riêng danh sách bị cắt.

## HTTP và Gemini thật: 10/10

1. `ask`: nhận và phản hồi được từ ngữ cảnh CMC đã đồng bộ.
2. `progress-advice`: nhận số liệu EDUX và 10 điểm có thật; nhóm thời gian học vẫn được báo thiếu vì chưa có dữ liệu đo lường tương ứng.
3. `plan`: tạo 2 buổi hợp lệ, tổng thời lượng không vượt mục tiêu; đối chiếu độc lập với toàn bộ lịch IU, lịch thi, lịch tự học và các đề xuất trước đó. Không có buổi bị loại trong lần chạy này.
4. `plan/confirm`: chỉ lưu sau xác nhận; kiểm tra tải lại qua API và mở lại file SQLite, có cờ `is_ai_suggested=1`.
5. Gửi lại xác nhận cùng kế hoạch: HTTP 409, mã `PLAN_CONFLICT`.
6. `exam-plan`: HTTP 404 và `data:null` do cả hai kỳ thi thật đã qua; không tạo kỳ thi tương lai giả.
7. `difficult-notes`: nguồn DB thiếu được báo đúng, không tạo chủ đề ghi chú giả.
8. `summarize`: tóm tắt được nội dung từ bài EDUX thật.
9. `check`: trả `correct` cho dữ liệu kiểm thử chức năng `1 + 1 = 2`.
10. `draft-leave`: soạn được bản nháp cho ngày có lớp IU thật; số lớp khớp đúng truy vấn toàn bộ lịch, kể cả khi context lịch sử đã bị giới hạn.

Các thao tác ghi chạy trong bản sao tạm. Database gốc giữ nguyên theo kiểm tra SHA-256 trước/sau; không thêm lịch thử vào thời khóa biểu của người dùng.

## Giao diện Electron: 6/6

- Nạp hồ sơ, lịch IU và công việc EDUX từ backend thật.
- Bấm tạo kế hoạch: hiện preview, chưa ghi lịch.
- Bấm xác nhận: lưu vào bản sao SQLite, có cờ đề xuất AI.
- Tải lại trang: nạp lại được các buổi đã xác nhận.
- Tạo ghi chú khó trong browser storage riêng bằng trích đoạn EDUX thật; gọi Gemini và hiển thị gợi ý ôn tập.
- Gọi AI nhận xét tiến độ từ công việc EDUX đã đồng bộ.

Hai bước phân tích chủ động dựng lại shell trong khi chờ Gemini để kiểm tra loading/kết quả không bị mất. Không tạo hoặc sửa ghi chú trong trình duyệt của người dùng. Sau khi Electron thoát, helper dọn thư mục test đã xác định để tránh xóa khi Chromium còn giữ file.

## Lỗi tích hợp đã sửa sau khi có dữ liệu IU

- Hỏi đáp chưa nhận phần hồ sơ dù context đã có: bổ sung hồ sơ vào payload hỏi đáp.
- Đơn xin nghỉ có thể bỏ sót lớp nằm ngoài 40 bản ghi đầu: lọc theo ngày trước khi giới hạn dữ liệu và thêm test hồi quy với hơn 40 lịch cũ.
- Planner có thể gửi kỳ thi đã qua cho mô hình: lọc kỳ thi sắp tới trước khi tạo context lập kế hoạch.
- Ghi chú và tiến độ cập nhật vào phần tử DOM cũ khi shell dựng lại: giữ trạng thái phân tích ngoài DOM, chặn gửi lặp và phân biệt nhận xét theo chu kỳ/ngày.

## Giới hạn kết quả

- Chưa có kỳ thi tương lai trong dữ liệu tài khoản để nghiệm thu sinh lộ trình ôn thi bằng Gemini thật. Ca kỳ thi tương lai đã được kiểm thử bằng fixture trong bộ HTTP/SQLite tự động.
- Ghi chú khó trong E2E là ghi chú kiểm thử tạm từ trích đoạn EDUX thật, không phải ghi chú cá nhân có sẵn.
- Chưa có lịch sử Pomodoro thật trong dữ liệu kiểm thử này; không kết luận về nhận xét thời lượng học cá nhân. Phân tích tiến độ được nghiệm thu với công việc/điểm thật, đồng thời kiểm tra xử lý số liệu thời gian còn thiếu.
- Bộ frontend cũ có log lỗi kết nối/localStorage trong các ca mô phỏng; các assertion vẫn PASS.

Tài liệu cấu hình và hợp đồng: [api_ai_sprint2.md](api_ai_sprint2.md).
