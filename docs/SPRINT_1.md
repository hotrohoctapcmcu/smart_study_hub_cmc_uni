# Sprint 1 — Nền tảng và quản lý học tập cốt lõi

Tổng hợp ngày **02/11/2026** từ báo cáo Sprint 1 ngày 22/10 và phân công GitHub. Đây là báo cáo lịch sử; trạng thái bản cập nhật được theo dõi tại [Sprint 4](SPRINT_4.md).

## Mục tiêu và phạm vi

Xây dựng ứng dụng Electron/Express/SQLite, lấy dữ liệu IU và kết nối những nghiệp vụ sinh viên dùng hằng ngày.

| Chức năng theo kế hoạch nhóm | Kết quả ghi nhận cuối báo cáo Sprint 1 | Phần chuyển tiếp |
| --- | --- | --- |
| 1. Thời khóa biểu | Có các chức năng chính và dữ liệu IU. | Hoàn thiện AI, chuẩn ngày giờ và đồng bộ. |
| 2. AI xếp tự học, cảnh báo trùng | Có triển khai cơ bản. | Tích hợp context, kiểm tra lịch và xác nhận lưu. |
| 3. Deadline và checklist | Phần lớn đã triển khai. | Sửa API xóa, kiểm tra quan hệ và lưu bền. |
| 4. Nhắc nhở nhiều cấp độ | Có nghiệp vụ chính. | Kiểm thử mốc đến hạn và chống trùng. |
| 9. Lịch thi và kế hoạch ôn | Có triển khai. | Kiểm thử dữ liệu đồng bộ và thao tác kế hoạch. |
| 18. Hồ sơ học tập | Frontend chưa hoàn thiện ở mốc báo cáo. | Bổ sung giao diện, đối soát hồ sơ và điểm IU. |

Các số 1–18 là mã chức năng xuyên suốt kế hoạch nhóm. Backlog từng có cách chia sprint khác; không dùng số sprint của bản cũ để suy ra tiến độ hiện tại.

## Phân công kế thừa

| Thành viên | Công việc Sprint 1 | Liên kết GitHub |
| --- | --- | --- |
| Văn Tuấn — `vtishan` | Điều phối, cấu trúc Electron/Express, giao thức/mã hóa IU, SSO/CDP, context và tích hợp AI/lịch. | [#1](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/1), [#7](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/7), [#11](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/11) |
| Anh Tuấn — `AnhTuancode-25` | Phân tích endpoint, lấy/giải mã/chuẩn hóa hồ sơ, môn, điểm, lịch; phân tích EDUX và phối hợp ánh xạ nguồn. | [#2](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/2), [#12](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/12) |
| Long Nhật — `longnhatdinhviet8-byte` | API lịch, task/checklist, nhắc nhở, kỳ thi, hồ sơ; validation, lỗi và kết nối database/AI. | [#4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/4), nhóm [#6](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/6)–[#12](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/12) |
| Hồng Thắm — `Tham2007` | Schema SQLite, khóa/index/quan hệ, CRUD và nghiệp vụ; rà soát tính toàn vẹn và đồng bộ dữ liệu. | [#3](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/3), [#12](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/12) |
| Huyền Trang — `kieudu-dlst` | Giao diện các chức năng Sprint 1, nối API, tiếp tục hoàn thiện hồ sơ. Báo cáo gốc dùng tên Kiều Trang. | [#5](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/5), nhóm [#6](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/6)–[#10](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/10) |

Issue #12 còn dùng tên SQL Server trong tiêu đề lịch sử; database thực tế của bản bàn giao hiện tại là SQLite qua `sql.js`.

## Tiêu chí bàn giao và việc chuyển tiếp

- Đăng nhập/đồng bộ → API → SQLite → UI hiển thị cùng dữ liệu và tải lại vẫn còn.
- Lịch tự học được kiểm tra xung đột tại server; đề xuất AI chỉ lưu sau xác nhận.
- Xóa task/checklist không để lại nhắc nhở hoặc bản ghi phụ thuộc sai.
- Đối soát lịch thi, hồ sơ, điểm, ngày giờ UTC+7 và dữ liệu thiếu/trùng.
- Giữ dữ liệu đã lưu khi nguồn lỗi; ghi rõ kiểm thử fixture và tài khoản trường thật.

Báo cáo Sprint 1 không có một tổng số test đủ căn cứ để công bố. Các vấn đề trên được chuyển sang Sprint 2 và các đợt hoàn thiện tiếp theo; không giữ chúng như danh sách lỗi hiện hành nếu đã có bằng chứng sửa. Trạng thái issue đóng cũng không thay cho nghiệm thu lại trên kiến trúc Sprint 4.

## Nguồn tổng hợp

- [Báo cáo Sprint 1 gốc tại commit a861b79](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/a861b79/docs/bao_cao_sprin1.md).
- [Phân công và backlog hiện tại](product_backlog.md#phân-công-nhóm-và-3-sprint), các issue được liên kết trong bảng.
- [Sprint 2](SPRINT_2.md) ghi các đợt nối dữ liệu/AI tiếp theo; [TESTING.md](TESTING.md) phân biệt bằng chứng theo mốc.
