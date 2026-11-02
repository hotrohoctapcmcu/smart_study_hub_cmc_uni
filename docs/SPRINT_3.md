# Sprint 3 — AI học tập và tích hợp tổng thể

Tổng hợp ngày **02/11/2026** từ đợt hoàn thiện **28/10/2026**, các issue Sprint 3 và lịch sử main đến `faecc05`. Đây là mốc triển khai trên cấu trúc trước refactor; phiên bản kế tiếp được ghi ở [Sprint 4](SPRINT_4.md).

## Mục tiêu và phạm vi

Hoàn thiện 5 chức năng AI còn lại, nối kết quả học với dữ liệu thật và kiểm thử cùng các chức năng Sprint 1–2.

| Chức năng | Đầu ra tại mốc Sprint 3 |
| --- | --- |
| 7. Gia sư AI | Hỏi đáp theo context học tập; lưu lượt thành công và hội thoại SQLite; chọn lịch sử, tạo mới, mở lại và gửi lại khi lỗi. |
| 13. Quiz AI | Sinh 3–15 câu theo môn/chủ đề/độ khó; server tự chấm, giấu đáp án trước nộp; lưu đề/lựa chọn/kết quả và phục hồi bài đang làm. |
| 14. Điểm yếu | Tổng hợp từ quiz đã nộp theo môn/chủ đề; xem câu sai, luyện lại; đủ hai lần mới có chênh lệch điểm phần trăm. |
| 15. Kế hoạch ôn thi AI | Preview giai đoạn/buổi ôn dựa trên kỳ thi và lịch trống; chỉnh/chọn/xác nhận; kiểm tra xung đột mới, transaction và chống gửi lặp. |
| 16. Đơn nghỉ | Dựa trên ngày/môn/lịch và hồ sơ có thật; chỉnh, lưu/mở nháp, sao chép, xuất TXT/DOCX; thông tin thiếu để trống. |

Đề xuất cũ về điểm yếu hết hiệu lực khi có bài nộp mới. Quiz chưa nộp không được dùng làm bằng chứng điểm yếu. Khi provider hoặc lưu DB thất bại, UI giữ dữ liệu cần thử lại.

## Phân công theo thành viên

| Thành viên | Công việc Sprint 3 | Issue gốc |
| --- | --- | --- |
| Văn Tuấn — `vtishan` | Prompt/context và kiểm tra đầu ra cho 5 luồng AI; điều phối tích hợp, hồi quy và bàn giao toàn hệ thống. | [#22](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/22) |
| Anh Tuấn — `AnhTuancode-25` | Chuẩn hóa dữ liệu context, nguồn sinh quiz, quiz đã nộp, kỳ thi/lịch đầy đủ và hồ sơ đúng ngày; fixture và đối soát dữ liệu. | [#23](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/23) |
| Long Nhật — `longnhatdinhviet8-byte` | API lịch sử/chat/quiz/chấm/điểm yếu/kế hoạch/bản nháp/DOCX; validation, chủ sở hữu, lỗi provider, chống lặp và kiểm thử tích hợp. | [#20](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/20) |
| Hồng Thắm — `Tham2007` | Migration `AiConversations`, `AiQuizzes`, `AiWeaknessReports`, `AiLeaveDrafts`, `AiExamConfirmations`; persist, toàn vẹn và transaction kế hoạch. | [#21](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/21) |
| Huyền Trang — `kieudu-dlst` | UI 5 luồng AI, điều hướng, giữ nháp/lựa chọn, xem lịch sử, sửa/xác nhận, export; kiểm tra lỗi/reload và trải nghiệm tổng thể. | [#19](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/19) |

Tại lần đối chiếu GitHub 02/11, #19–#23 vẫn mở và chưa gán assignee. Báo cáo triển khai không tự đóng các issue này. Sprint 4 tạo issue riêng đã gán đúng tài khoản để tiếp tục rà soát và nghiệm thu.

## Hợp đồng và lưu trữ

- Nhóm API chính: `/api/v1/ai/ask`, `/conversations`, `/quizzes`, `/weaknesses`, `/exam-plan`, `/exam-plan/confirm`, `/draft-leave`, `/leave-drafts`.
- Server dùng đáp án đã lưu để chấm; gửi lại cùng lựa chọn trả kết quả đã có, sửa lựa chọn sau nộp bị từ chối.
- Giai đoạn ôn và buổi học được ghi chung transaction. Lịch đầy đủ phải được tải lại khi xác nhận; context rút gọn không thay cho kiểm tra xung đột.
- Nội dung đơn đã chỉnh được lưu nguyên để mở lại/xuất; không có luồng tự gửi email hoặc nộp đơn lên trường.
- Dữ liệu gắn hồ sơ cấu hình của ứng dụng, chưa phải hệ thống nhiều người dùng.

API hiện hành và đường dẫn sau refactor xem [API.md](API.md), [ARCHITECTURE.md](ARCHITECTURE.md).

## Kết quả kiểm thử lịch sử 28/10

| Bộ kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| `test:sprint3` | 14/14 đạt. | Migration, quiz, chấm/lưu, lịch sử, đơn/DOCX, preview, xung đột, rollback, đồng thời và mở lại DB. |
| Sprint 3 Electron E2E | Đạt cả 5 luồng. | UI/API/SQLite thật; provider HTTP giả lập. |
| Gemini live | Đạt tại lượt chạy. | 3 câu quiz, nhận xét/đơn/chat và kế hoạch 1 giai đoạn, 4 buổi hợp lệ trên DB tạm. |
| AI hồi quy | 20/20 đạt. | Context/provider/nghiệp vụ tại snapshot Sprint 3. |
| Learning APIs / Sprint 2 integration / complete | 48/48, 8/8, 11/11 đạt. | Hồi quy nghiệp vụ Sprint 1–2; không cộng với bộ có giao nhau. |

Các số này thuộc lịch sử, không thay cho lượt test mã React hiện tại. Các lệnh kiểm tra import/HTML frontend cũ trong báo cáo nguồn không còn áp dụng sau refactor.

## Giới hạn và chuyển tiếp Sprint 4

AI có thể sai kiến thức; đề/đáp án AI không thay đánh giá của giảng viên. Kết quả live chỉ xác nhận thời điểm chạy. Không suy ra dịch vụ IU/EDUX/Outlook thật đã đạt từ mock.

Sprint 4 tiếp tục nâng cấp giao diện, context/Unicode, tóm tắt dài theo job, pipeline học liệu toàn môn, cache/flashcard, sổ tay mới và kiểm thử khả năng phục hồi. Những thay đổi đó được báo cáo ở Sprint 4 thay vì sửa ngược kết quả lịch sử Sprint 3.

## Nguồn tổng hợp

- [Hoàn thiện Sprint 3 ngày 28/10](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/a861b79/docs/hoan_thien_sprint3.md).
- [Main trước bản cập nhật — faecc05](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/faecc05), các issue #19–#23 trong bảng.
- [Kiểm thử và giới hạn bằng chứng](TESTING.md).
