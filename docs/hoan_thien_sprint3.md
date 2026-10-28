# Hoàn thiện Sprint 3

Ngày: **28/10/2026**. Phạm vi theo `sprint3.txt`: chức năng **7, 13, 14, 15, 16**.

Đã triển khai đủ năm luồng trên Electron, frontend, Express và SQLite. Có kiểm thử tích hợp với provider HTTP giả lập, kiểm thử giao diện Electron và smoke test Gemini thật trên database tạm. Không ghi dữ liệu kiểm thử vào database cá nhân.

## Chức năng và cách sử dụng

| Mục | Vị trí | Kết quả |
|---|---|---|
| 7. Trợ lý gia sư AI | Trợ lý AI / panel nổi | Hỏi đáp với ngữ cảnh học tập; lưu các lượt thành công vào SQLite; mở lại hội thoại sau khi khởi động; chọn hội thoại cũ, tạo hội thoại mới, gửi lại câu hỏi khi lỗi. |
| 13. Kiểm tra kiến thức | Quiz AI | Nhập môn, chủ đề, độ khó, 3–15 câu và nội dung học tùy chọn; AI sinh trắc nghiệm; làm bài, nộp, xem đáp án và giải thích; lịch sử đề và kết quả lưu DB. Lựa chọn chưa nộp được giữ trên thiết bị. |
| 14. Điểm yếu và gợi ý học | Điểm yếu & gợi ý học | Thống kê số câu đúng, tỷ lệ đúng, lần gần nhất và chênh lệch hai lần kiểm tra theo chủ đề; AI đề xuất nội dung và bài luyện tập; mở lại câu sai hoặc luyện lại đúng chủ đề. |
| 15. AI tạo kế hoạch ôn thi | AI ôn thi / nút AI trong Lịch thi | Chọn kỳ thi; tạo giai đoạn và buổi học từ lịch trống, điểm, ghi chú khó và kết quả kiểm tra; chỉnh nội dung/ngày/giờ, chọn buổi muốn thêm và xác nhận; lưu giai đoạn vào ExamStudyPlans, buổi học vào StudySchedules. |
| 16. Đơn xin nghỉ học | Đơn xin nghỉ học | Nhập ngày, môn, buổi, người nhận và lý do; AI đối chiếu lịch đúng ngày; chỉnh nội dung; lưu/mở lại bản nháp; sao chép, tải TXT hoặc Word. |

Khởi chạy bằng `npm start`. Các màn hình nằm trong nhóm **Công cụ** và có liên kết nhanh trên trang Trợ lý AI. Migration chạy tự động khi mở database.

Khi xác nhận kế hoạch, máy chủ kiểm tra lại lịch lớp, lịch tự học, lịch thi và giờ thi. Một lỗi ghi sẽ hoàn tác cả giai đoạn lẫn buổi học. Mã xác nhận giúp gửi lại cùng yêu cầu không tạo dữ liệu trùng. Các giai đoạn đã lưu được tải lại trên trang Lịch thi; có thể hoàn thành, mở lại hoặc xóa mốc. Các buổi tự học được quản lý tại Lịch học.

Đã sửa luồng chỉnh kỳ thi gửi đối tượng cũ: form gửi giá trị vừa nhập và giữ form khi lưu thất bại. Không còn tạo hai mốc ôn tập giả trong bộ nhớ khi thêm kỳ thi.

## API

Base: `/api/v1/ai`. Thành công: `{ "success": true, "data": ... }`. Lỗi giữ hợp đồng của module AI hiện có.

| Method | Route | Nội dung |
|---|---|---|
| POST | `/ask` | `{question, conversationId?, studyData?}`; trả lời và lưu lượt hội thoại thành công. Tự cấp ID nếu chưa có. |
| GET | `/conversations` | Danh sách tối đa 100 hội thoại gần nhất. |
| GET | `/conversations/:id` | Các tin nhắn trong hội thoại thuộc người dùng hiện tại. |
| POST | `/quizzes` | `{subject, topic, count: 3..15, difficulty: easy/medium/hard, sourceText?, studyData?}`; tạo và lưu đề. |
| GET | `/quizzes` | Tối đa 100 đề gần nhất và điểm nếu đã nộp. |
| GET | `/quizzes/:id` | Đề đang làm hoặc kết quả đã nộp. |
| POST | `/quizzes/:id/submit` | `{answers: {q1: 0, q2: 2, ...}}`; chỉ số lựa chọn 0–3. |
| GET | `/weaknesses` | Số liệu đo từ bài đã nộp và đề xuất phù hợp với phiên bản dữ liệu hiện tại. |
| POST | `/weaknesses/analyze` | Sinh và lưu đề xuất học tập từ kết quả kiểm tra; không gọi AI khi chưa có bài nộp. |
| POST | `/exam-plan` | `{examId, studyData?}`; trả `phases` và `sessions` hợp lệ, chưa ghi lịch. |
| POST | `/exam-plan/confirm` | `{confirmed: true, requestId, phases, sessions?}`; xác nhận và ghi bằng transaction. |
| POST | `/draft-leave` | `{date, reason, subject?, session?, recipient?}`; nội dung và số lớp khớp. |
| GET | `/leave-drafts` | Tối đa 100 bản nháp đã lưu gần nhất. |
| POST | `/leave-drafts` | `{fields: {date, reason, subject?, session?, recipient?}, content}`. |
| PUT | `/leave-drafts/:id` | Lưu các chỉnh sửa của bản nháp. |
| GET | `/leave-drafts/:id/docx` | Tệp Word thực từ nội dung đã lưu. |

Đáp án và giải thích không xuất hiện trong API đề chưa nộp. Máy chủ tự chấm bằng đáp án đã lưu, không tin điểm do frontend gửi. Nộp lại cùng lựa chọn trả lại kết quả cũ; đổi lựa chọn sau khi đã nộp trả 409. Muốn kiểm tra lại cần tạo đề mới.

Phân tích chỉ tính bài đã nộp. Chênh lệch điểm là số **điểm phần trăm**, không phải mức tăng tương đối. Chủ đề có điểm lần gần nhất dưới 50% được ưu tiên cao, dưới 80% ưu tiên vừa, còn lại duy trì. Đây là quy tắc xếp ưu tiên trong ứng dụng. Đề xuất AI gắn với key chủ đề có thật; bài nộp mới làm mất hiệu lực đề xuất cũ cho đến khi phân tích lại.

## Lưu trữ và mã nguồn

Migration cộng thêm các bảng `AiConversations`, `AiQuizzes`, `AiWeaknessReports`, `AiLeaveDrafts`, `AiExamConfirmations`; giữ dữ liệu các Sprint trước. Tất cả truy vấn mới giới hạn theo người dùng cấu hình của ứng dụng một hồ sơ hiện tại.

- Backend: `API/modules/sprint3.js`, `sprint3.service.js`, tích hợp trong `troLyAI.js`.
- Database: `database/sprint3/migration.js`, gọi từ `database/connection/db.js`.
- Frontend: `Frontend/src/features/ai-study/`, các thay đổi trong `ai-tutor/`, `exams/`, routes và shell.
- Không thêm dependency. DOCX dùng thư viện `docx` đang có.

## Kết quả kiểm thử

| Lệnh | Kết quả | Phạm vi |
|---|---|---|
| `npm run test:sprint3` | **14/14 đạt** | Migration, schema AI lỗi, không lộ đáp án, chấm/lưu, số liệu và cải thiện, lịch sử chat, đơn/Word, preview, quyền sở hữu, xung đột, rollback, xác nhận đồng thời và mở lại DB. |
| `npm run test:sprint3:e2e` | **Đạt cả 5 luồng** | Electron offscreen + frontend + API + SQLite thật, provider HTTP giả lập. Khôi phục đáp án sau reload; giữ đáp án khi lưu lỗi; luyện chủ đề; chỉnh/xác nhận kế hoạch; giữ đề xuất khi lịch mới phát sinh xung đột; hoàn thành mốc; khôi phục đơn; chọn lịch sử chat và gửi lại khi provider lỗi. |
| `npm run test:sprint3:live` | **Đạt** | Gemini web thật: sinh 3 câu hợp lệ, gợi ý học từ bài nộp, soạn đơn khi thiếu hồ sơ, hỏi đáp và kế hoạch thi với **1 giai đoạn, 4 buổi hợp lệ** trong lần chạy 28/10/2026. Database và hồ sơ kiểm thử tạm. |
| `npm run test:frontend` | **Đạt** | Bộ hồi quy frontend hiện có; cập nhật kỳ vọng điều hướng Sprint 3. |
| `npm run test:ai` | **20/20 đạt** | Hồi quy ngữ cảnh, kế hoạch, xử lý provider và các API AI cũ. |
| `npm run test:learning-apis` | **48/48 đạt** | API học tập hiện có. |
| `npm run test:sprint2-integration` | **8/8 đạt** | Hồi quy tích hợp Sprint 2. |
| `npm run test:sprint2-complete` | **11/11 đạt** | Hồi quy lưu trữ, tệp, ghi chú, Pomodoro, email và mở lại DB. |
| `npm run test:sprint2-complete:e2e` | **Đạt** | Hồi quy Electron: file picker, autosave/lỗi lưu, tìm kiếm, timer, EDUX và email. |
| `node Frontend/tests/check-imports.mjs` | **Đạt** | Đường dẫn import frontend. |
| `node Frontend/tests/check-html-refs.mjs` | **Đạt** | Tệp CSS/JS được HTML tham chiếu. |

Trong E2E có các lỗi được chủ động tạo để xác minh giữ dữ liệu và thử lại. Các log HTTP lỗi tương ứng là dự kiến. Screenshot được tạo trong thư mục tạm của hệ điều hành, tên `unistudy-sprint3-*.png`.

## Giới hạn

- Gemini hiện dùng phiên web khách theo cấu hình sẵn của dự án. Smoke test đạt tại thời điểm chạy; khả dụng sau này vẫn phụ thuộc dịch vụ ngoài. Frontend hiển thị lỗi và cho phép thử lại.
- Điểm yếu phản ánh bài trắc nghiệm đã làm theo tên môn/chủ đề, không thay thế đánh giá chính thức của giảng viên. Chưa có lần thứ hai thì chưa có mức cải thiện.
- Câu hỏi/đáp án do AI tạo có thể sai kiến thức; kết quả tự chấm dựa trên đáp án của đề đó. Nội dung người học dán vào dùng làm phạm vi sinh đề; không trích xuất toàn bộ PDF/DOCX.
- Preview buổi ôn AI xét tối đa 31 ngày tới, tối đa 30 buổi, mỗi buổi 30–240 phút. Không có buổi phù hợp thì vẫn cho lưu giai đoạn để xếp lịch sau.
- Hỗ trợ soạn và xuất đơn; không tự gửi email hoặc nộp đơn vào hệ thống trường. Bản chỉnh chưa lưu của đơn và lựa chọn quiz lưu cục bộ trên thiết bị; các bản đã lưu/nộp nằm trong SQLite.
- Các kết quả này nghiệm thu phạm vi Sprint 3; không thay cho nghiệm thu đăng nhập IU/EDUX/Outlook thật hoặc các hạng mục Sprint 1 còn lại.
