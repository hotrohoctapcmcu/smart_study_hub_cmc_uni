# Sprint 2 — Học liệu, không gian học tập và tích hợp dữ liệu

Tổng hợp ngày **02/11/2026** từ báo cáo tiến độ và đợt hoàn thiện **27/10/2026**. Nội dung thể hiện kết quả tại mốc Sprint 2; phần React, học liệu mở rộng và sổ tay mới được ghi ở [Sprint 4](SPRINT_4.md).

## Mục tiêu và kết quả

Nối các công cụ học tập với dữ liệu lưu bền, đồng thời xử lý các tồn đọng Sprint 1 về AI, API và hồ sơ.

| Chức năng | Báo cáo đầu Sprint 2 | Bổ sung tại mốc 27/10 |
| --- | --- | --- |
| 5. Kho tài liệu | Có frontend. | Upload tối đa 25 MB, lưu byte thật, metadata SQLite, mở/tải/xóa và kiểm tra chủ sở hữu. |
| 6. Tìm kiếm và tag | Có frontend. | Tìm nhiều loại dữ liệu, `#tag`, điều hướng kết quả và lưu tag qua DB. |
| 8. Pomodoro | Chức năng cơ bản ổn định. | Timer timestamp, pause/resume, khôi phục, focus segments và lịch sử SQLite chống gửi trùng. |
| 10. Time Map | Chưa thực hiện ở báo cáo ban đầu. | Tổng hợp lớp/thi/tự học/Pomodoro, cắt ngày UTC+7, quy tắc ưu tiên khi giao nhau. |
| 11. Phân tích tiến độ | Đã nối AI nhận xét. | Task nội bộ/EDUX, giờ học không cộng trùng, GPA và số liệu thật. |
| 12. Textbook và sổ tay | Có ghi chú cục bộ; Textbook chưa có. | CRUD sổ/trang, autosave DB và nháp khi lỗi, đính kèm tài liệu/PDF, đánh dấu khó, xuất DOCX. |
| 17. Email trường | Chưa thực hiện ở báo cáo ban đầu. | Module Outlook, Graph/OWA, đồng bộ SQLite, đọc/refresh và xác nhận tạo task/thi chống trùng. |

Đợt này cũng bổ sung context dữ liệu học tập, AI xếp tự học theo lịch trống, nhận xét tiến độ và phân tích ghi chú khó. Preview không ghi DB; xác nhận kiểm tra lại lịch và lưu bằng transaction.

## Phân công theo thành viên

| Thành viên | Công việc và đầu ra Sprint 2 | GitHub |
| --- | --- | --- |
| Văn Tuấn — `vtishan` | Điều phối, hợp nhất IU/EDUX cho context, Gemini, AI tự học/tiến độ/ghi chú khó, tích hợp và tổng hợp bằng chứng. | [#14](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/14), [#16](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/16), [#17](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/17) |
| Anh Tuấn — `AnhTuancode-25` | Đăng nhập/lấy dữ liệu EDUX, chuẩn hóa bài tập/hạn nộp, hợp nhất IU/EDUX và đối soát dữ liệu dùng cho AI. | [#16](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/16), [#17](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/17) |
| Long Nhật — `longnhatdinhviet8-byte` | API tài liệu/tìm kiếm/tag/sổ tay/email, Time Map/Progress, kết nối AI và DB, xử lý lỗi và kiểm thử HTTP. | [#13](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/13), [#15](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/15), [PR #18](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/pull/18) |
| Hồng Thắm — `Tham2007` | Migration/index/quan hệ, dữ liệu workspace/Pomodoro/email, transaction, persist và đối soát đồng bộ. | [#16](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/16), [#17](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/17) |
| Huyền Trang — `kieudu-dlst` | UI tài liệu, tìm kiếm/tag, Pomodoro, Time Map, tiến độ, sổ tay/email và hồ sơ; nối API, giữ nháp và xử lý tải/lỗi. | [#13](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/13), [#14](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/14), [#15](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/15) |

Tên Kiều Trang trong báo cáo cũ tương ứng vai trò frontend/tài khoản `kieudu-dlst` nêu trên. Phân công mô tả trách nhiệm, không gán lại tác giả commit.

## Kiểm thử đã ghi nhận tại mốc Sprint 2

| Bộ kiểm tra | Kết quả lịch sử | Giới hạn |
| --- | --- | --- |
| Sprint 2 complete | 11/11 đạt. | DB/tệp/ghi chú/Pomodoro/tag/email, dữ liệu tạm và mock khi cần. |
| Learning APIs | 48/48 đạt. | API nghiệp vụ; không nghiệm thu dịch vụ trường thật. |
| AI live HTTP | 10/10 đạt. | Provider thật tại lần chạy 27/10, dữ liệu CMC đã đồng bộ trên bản sao DB. |
| Electron AI E2E | 6/6 bước đạt. | Kiểm tra tích hợp tại giao diện cũ, không thay cho React Sprint 4. |
| Electron Sprint 2 complete E2E | Đạt theo báo cáo. | Upload, autosave/nháp, tìm kiếm, timer và email → task. |

Dữ liệu AI lịch sử có 87 buổi IU, 10 điểm, 2 kỳ thi đã qua và 97 bản ghi EDUX. Không dùng chúng làm dữ liệu mẫu mặc định hoặc bằng chứng có kỳ thi tương lai. Không cộng các bộ test giao nhau.

## Chuyển tiếp và giới hạn

- Outlook trường chưa được nghiệm thu bằng tài khoản thật; quyền Graph/tenant và nội dung OWA cần xác minh.
- Email chỉ đọc/phân tích; tạo task/thi cần xác nhận, không tự gửi thư.
- Tóm tắt/AI cần báo thiếu dữ liệu, nguồn bị giới hạn và lỗi provider; không sinh giờ học không có phép đo.
- Mã frontend `src/features` và database `sprint2/` của mốc này đã được tái cấu trúc trong Sprint 4; dùng [ARCHITECTURE.md](ARCHITECTURE.md) để tìm mã hiện hành.
- Các issue #13–#15 vẫn mở tại lần đối chiếu 02/11; báo cáo triển khai và trạng thái issue chưa được đồng nhất. Việc đóng issue cần nhóm đối chiếu bằng chứng.

## Nguồn tổng hợp

- [Báo cáo Sprint 2 gốc](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/a861b79/docs/bao_cao_sprint2.md).
- [Hoàn thiện Sprint 2 ngày 27/10](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/a861b79/docs/hoan_thien_sprint2.md).
- [Kết quả AI Sprint 2](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/a861b79/docs/ket_qua_kiem_thu_ai_sprint2.md), [TESTING.md](TESTING.md).
