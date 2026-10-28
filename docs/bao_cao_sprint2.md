> Cập nhật 27/10/2026: xem [Hoàn thiện Sprint 2](hoan_thien_sprint2.md) cho trạng thái triển khai mới. Các phần thiếu được nêu trong báo cáo cũ bên dưới là thông tin trước đợt hoàn thiện.

Báo cáo tiến độ Sprint 2 – UniStudy CMC
1. Kết quả thực hiện
- Kho tài liệu môn học: Đã có Frontend.
- Tìm kiếm nhanh và gắn thẻ Tag: Đã có Frontend.
- Đồng hồ Pomodoro: Chức năng đã ổn định.
- Bản đồ thời gian học tập: Chưa thực hiện.
- Phân tích tiến độ học tập: Đã tích hợp AI nhận xét; đã kiểm tra Gemini khách với công việc EDUX và điểm IU thật, không tạo thời lượng học khi chưa có dữ liệu đo.
- Textbook và sổ tay học tập: Sổ tay đã tích hợp đánh dấu khó hiểu và gợi ý ôn tập bằng AI; lưu ghi chú cục bộ. Textbook chưa triển khai.
- Đồng bộ và phân tích Email trường: Chưa thực hiện.
2. Công việc theo thành viên
- Văn Tuấn: Phát triển luồng dữ liệu AI, tích hợp dữ liệu học tập và điều phối nhóm.
- Long Nhật: Tích hợp AI thành API, sửa lỗi API, kết nối EDUX và SQL Server.
- Anh Tuấn: Xây dựng hàm lấy dữ liệu EDUX, chuẩn hóa dữ liệu và hỗ trợ tích hợp IU/EDUX.
- Hồng Thắm: Rà soát cấu trúc database, thiết kế bảng và kiểm tra tính toàn vẹn dữ liệu.
- Kiều Trang: Phát triển Frontend kho tài liệu, tìm kiếm và Tag; hoàn thiện Pomodoro và các giao diện liên quan.
3. Công việc tồn đọng
- Nghiệm thu bổ sung sinh lộ trình ôn thi với kỳ thi tương lai khi tài khoản có dữ liệu; 2 kỳ thi hiện tại đã qua và API đã được kiểm tra trả đúng trạng thái thiếu kỳ thi sắp tới.
- Sửa lỗi API xóa Deadline và Checklist.
- Xây dựng Frontend hồ sơ học tập cá nhân.
- Hoàn thiện tích hợp API, database và dữ liệu thực tế cho các chức năng đã có giao diện.
- Triển khai các chức năng Sprint 2 còn thiếu.
4. Đánh giá
Sprint 2 đã có tiến triển ở phần Frontend và chức năng Pomodoro. Các công việc tích hợp AI, API và database đang tiếp tục được triển khai. Nhóm cần hoàn thiện các chức năng còn tồn đọng, kiểm thử hệ thống và cập nhật tiến độ trước khi nghiệm thu Sprint 2.

5. Bàn giao phần việc Văn Tuấn – cập nhật 27/10/2026
- Hoàn thiện API/shared/study-context.js: tổng hợp dữ liệu thật, chuẩn hóa giờ Việt Nam, giới hạn nội dung và báo nguồn thiếu/bị cắt.
- PB-23: API lập kế hoạch từ khoảng trống thật; loại buổi quá khứ/trùng lớp/tự học/thi; preview và xác nhận lưu cả nhóm bằng transaction. Đã nối trang Kế hoạch học tập và modal AI trong Thời khóa biểu.
- PB-33/PB-34: generateProgressAdvice(progress), chỉ phân tích số liệu có thật; giao diện Tiến độ gọi API theo dữ liệu Pomodoro/công việc.
- PB-38: analyzeDifficultNotes(studentId), chọn ghi chú được đánh dấu khó/cần ôn; giao diện Sổ tay có đánh dấu và yêu cầu AI phân tích.
- Các API ask, plan, exam-plan, check, summarize, draft-leave có hợp đồng success/data và xử lý JSON/schema/timeout. Theo yêu cầu cập nhật, Gemini dùng phiên web chưa đăng nhập mặc định; không dùng API key hoặc cookie đăng nhập Google.
- Đã bổ sung kiểm thử HTTP/SQLite/Gemini giả lập, kiểm thử frontend và script kiểm tra context trên bản sao dữ liệu cục bộ.
- Đã nghiệm thu dữ liệu CMC đã đồng bộ: 1 hồ sơ, 87 buổi học IU, 10 điểm, 2 lịch thi đã qua, 97 bài EDUX và 3 bài chưa hoàn thành.
- Kiểm thử Gemini thật: 10/10 tình huống HTTP đạt, bao gồm preview, đối chiếu toàn bộ lịch IU, xác nhận/lưu/tải lại và chặn lưu lặp. Electron E2E đạt 6/6 bước, có ghi chú khó và nhận xét tiến độ; kiểm thử ghi dữ liệu chỉ chạy trên bản sao, database gốc giữ nguyên.
- Sửa lỗi thiếu hồ sơ trong hỏi đáp, bỏ sót lớp khi cắt ngắn lịch sử và mất kết quả phân tích khi shell dựng lại. Bộ AI tự động đạt 19/19.
- Tài liệu: docs/api_ai_sprint2.md. Bằng chứng và giới hạn kiểm thử: docs/ket_qua_kiem_thu_ai_sprint2.md.
