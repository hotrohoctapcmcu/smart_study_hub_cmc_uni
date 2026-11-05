# BÁO CÁO ĐỐI CHIẾU TỒN ĐỌNG SPRINT 3 VÀ KẾT QUẢ SPRINT 4

**Dự án:** Smart Study Hub — CMC University

**Mục đích:** Làm căn cứ kiểm tra, phân công bàn giao và lập biên bản nghiệm thu.

**Ngày lập:** 05/11/2026 — múi giờ Việt Nam, Asia/Saigon (UTC+7).

**Cập nhật bổ sung:** 05/11/2026 — nhận diện ứng dụng và logo tại commit 1d7ada6, bằng chứng E16.

**Cập nhật phát hành Windows:** 05/11/2026 — Setup/Portable 1.0.0, bằng chứng E17; xem mục 5.2 và 7.5. Kết quả này không thay các lượt triển khai/kiểm thử lịch sử.

**Trạng thái văn bản:** Báo cáo tổng hợp phục vụ nghiệm thu; chưa có chữ ký chấp thuận của thành viên hoặc người nhận bàn giao.

**Điều hướng:** [Phân công 5 thành viên](#2-phân-công-5-thành-viên-được-giữ-nguyên) · [Kết quả Sprint 3](#3-kết-quả-đã-có-tại-cuối-sprint-3) · [Tồn đọng chuyển tiếp](#4-tồn-đọng-cuối-sprint-3-và-cách-sprint-4-tiếp-nhận) · [Kết quả Sprint 4](#5-kết-quả-triển-khai-sprint-4-theo-từng-hạng-mục) · [Hồ sơ từng người](#6-hồ-sơ-công-việc-và-đầu-ra-bàn-giao-theo-từng-thành-viên) · [Bằng chứng](#8-danh-mục-bằng-chứng-dùng-để-nghiệm-thu) · [Phần còn mở](#9-phần-còn-mở-và-trách-nhiệm-hoàn-thiện-hồ-sơ-nghiệm-thu) · [Kịch bản kiểm tra](#10-kịch-bản-đề-nghị-thực-hiện-trong-buổi-nghiệm-thu) · [Phiếu ký xác nhận](#12-phiếu-xác-nhận-nghiệm-thu-và-bàn-giao).

## 1. Phạm vi và căn cứ đối chiếu

### 1.1. Phiên bản và thời gian

| Nội dung | Mốc đối chiếu |
| --- | --- |
| Bản trước Sprint 4 | [faecc05](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/faecc05), sau đợt hoàn thiện Sprint 3 ngày 28/10/2026. |
| Bản mã triển khai Sprint 4 đã push | [4fc38af](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/4fc38af). |
| HEAD khi lập báo cáo | [0b6a2e0](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/0b6a2e0); commit này bổ sung tài liệu đối chiếu bộ đếm milestone. |
| Bản bổ sung logo sau khi lập báo cáo | [1d7ada6](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/1d7ada6); tài nguyên PNG/ICO, nhận diện Electron, sidebar và favicon. Kết quả riêng tại mục 7.4. |
| Sprint 3 | 23/10–29/10/2026; báo cáo thứ Năm 29/10/2026. |
| Sprint 4 | 30/10–05/11/2026; báo cáo thứ Năm 05/11/2026. |
| Deadline Sprint 4 | 23:59:59 ngày 05/11/2026, UTC+7; đây là quy ước cuối ngày, chưa ấn định giờ họp nghiệm thu. |

Báo cáo giữ nguyên ngày triển khai, ngày kiểm thử và kết quả lịch sử. Việc lập báo cáo này không chạy lại bộ kiểm thử, không tạo kết quả live mới và không thay thế kết quả của từng lượt chạy đã lưu.

### 1.2. Tài liệu và bằng chứng

- [Báo cáo Sprint 3](SPRINT_3.md), [Báo cáo Sprint 4](SPRINT_4.md).
- [Kiểm thử và bằng chứng](TESTING.md), [API](API.md), [Kiến trúc](ARCHITECTURE.md), [Hướng dẫn tính năng](FEATURES.md), [Product backlog](product_backlog.md).
- Mã hiện tại trong Frontend, API, database, CRWEB và electron; đối chiếu với lịch sử main trước Sprint 4.
- Các báo cáo JSON trong [docs/evidence](evidence/); danh mục mã bằng chứng tại mục 8.
- Các issue Sprint 3 số 19–23, issue Sprint 4 số 24–28 và milestone tương ứng.

Đây là báo cáo nghiệm thu tổng hợp, không thay thế bốn báo cáo tiến độ Sprint 1–4.

### 1.3. Cách ghi trách nhiệm và trạng thái

Tên người trong báo cáo xác định **trách nhiệm kỹ thuật, phối hợp và bàn giao theo phân công đã có**. Kết quả mã nguồn được đối chiếu theo từng tầng. Báo cáo không coi người commit tập hợp/tích hợp là tác giả của toàn bộ tính năng; phần việc cá nhân cần được thành viên xác nhận cùng PR, commit hoặc biên bản bàn giao liên quan khi ký nghiệm thu.

| Cách ghi | Ý nghĩa |
| --- | --- |
| Đã triển khai | Có mã nguồn cho hành vi được mô tả; chưa mặc nhiên được chấp thuận nghiệm thu. |
| Đạt kiểm thử tự động | Có kết quả test trong đúng phạm vi, phiên bản và môi trường ghi nhận; có thể dùng provider giả lập/SQLite tạm. |
| Đạt kiểm tra UI với fixture | Đã có bằng chứng tương tác/bố cục trên dữ liệu giả lập; không đại diện kết nối nguồn thật. |
| Có kiểm chứng nguồn thật, giới hạn | Có lượt kết nối dịch vụ thật thành công cho một phạm vi cụ thể; không suy rộng ra mọi hồ sơ hoặc mọi chức năng. |
| Chờ nghiệm thu bổ sung | Thiếu lượt tái kiểm, bằng chứng nguồn thật, thiết bị hoặc xác nhận của người nhận. |
| Chưa hỗ trợ/chưa triển khai | Giới hạn hiện hữu được công bố; chỉ trở thành điều kiện bắt buộc của lần nghiệm thu nếu được chọn vào phạm vi bàn giao. |

Các ô xác nhận ở cuối báo cáo để trống cho người thực hiện nghiệm thu. Tỷ lệ issue đóng trên GitHub chỉ phản ánh trạng thái quản lý công việc, không thay cho bằng chứng kỹ thuật và chữ ký chấp thuận.

## 2. Phân công 5 thành viên được giữ nguyên

| Thành viên | Tài khoản | Trách nhiệm chính | Issue Sprint 3 | Issue Sprint 4 |
| --- | --- | --- | --- | --- |
| **Văn Tuấn** | vtishan | Nhóm trưởng; kiến trúc, Electron, AI/context, tích hợp và điều phối bàn giao. | [#22](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/22) | [#24](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/24) |
| **Anh Tuấn** | AnhTuancode-25 | Thu thập, giải mã, chuẩn hóa và đối soát dữ liệu IU/EDUX/Outlook. | [#23](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/23) | [#25](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/25) |
| **Long Nhật** | longnhatdinhviet8-byte | API, validation, nghiệp vụ, kiểm tra chủ sở hữu và kiểm thử HTTP/tích hợp. | [#20](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/20) | [#26](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/26) |
| **Hồng Thắm** | Tham2007 | Database, schema/migration, tính toàn vẹn, transaction và persist. | [#21](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/21) | [#27](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/27) |
| **Huyền Trang** | kieudu-dlst | Frontend React/Vite, UI/UX, nối API và bằng chứng giao diện. | [#19](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/19) | [#28](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/28) |

Tên Kiều Trang trong tài liệu cũ tương ứng Huyền Trang, cùng tài khoản kieudu-dlst. Các issue Sprint 3 hiện không có assignee trong metadata; trách nhiệm lịch sử được đối chiếu bằng tên/nội dung issue và báo cáo sprint. Không tự gán lại assignee lịch sử để làm bằng chứng tác giả.

Dấu vết lịch sử theo tầng gồm IU [b2e04b8](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/b2e04b8), API [deb4447](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/deb4447), database [570dd33](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/570dd33) và [e7a5512](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/e7a5512), frontend [27ac67c](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/27ac67c). Các mốc tập hợp/tích hợp như 7ba8fcf, a10ea60 và 1f0be43 được dùng để xác định phiên bản, không dùng để quy toàn bộ sản phẩm cho người commit.

## 3. Kết quả đã có tại cuối Sprint 3

Sprint 3 đã triển khai năm luồng AI dưới đây. Phần mở rộng về React, tóm tắt song song, Flashcard theo lô, Pomodoro có mục tiêu và sổ tay/canvas của Sprint 4 không được ghi ngược thành nhiệm vụ Sprint 3 làm thiếu.

| Mã | Chức năng đã triển khai tại mốc 28/10/2026 | Trách nhiệm theo tầng |
| --- | --- | --- |
| S3-01 | Gia sư AI có context học tập, lưu lượt trả lời thành công và hội thoại; tạo mới, mở lại và thử lại khi lỗi. | Văn Tuấn: AI/context; Long Nhật: API hội thoại; Hồng Thắm: lưu trữ; Huyền Trang: giao diện; Anh Tuấn: dữ liệu context. |
| S3-02 | Quiz 3–15 câu theo môn/chủ đề/độ khó; giấu đáp án trước nộp; server chấm và lưu đề/lựa chọn/kết quả, chống nộp lặp. | Văn Tuấn: prompt/schema; Long Nhật: API/chấm bài; Hồng Thắm: dữ liệu; Huyền Trang: làm bài/kết quả; Anh Tuấn: nguồn kiểm tra. |
| S3-03 | Phân tích điểm yếu từ quiz đã nộp; câu sai/chủ đề cần ôn; hai lượt đo mới có chênh lệch điểm phần trăm. | Long Nhật: nghiệp vụ; Văn Tuấn: nhận xét AI; Hồng Thắm: truy vấn/persist; Huyền Trang: giao diện; Anh Tuấn: đối soát dữ liệu. |
| S3-04 | Kế hoạch ôn thi AI có preview, chỉnh/chọn buổi, xác nhận; kiểm tra lại lịch và lưu giai đoạn/buổi bằng transaction. | Văn Tuấn: AI; Long Nhật: kiểm tra/xác nhận; Hồng Thắm: transaction; Anh Tuấn: kỳ thi/lịch nguồn; Huyền Trang: preview và thao tác xác nhận. |
| S3-05 | Soạn đơn nghỉ học theo hồ sơ/ngày/môn/lý do; chỉnh, lưu/mở nháp, sao chép, xuất TXT/DOCX; thông tin thiếu để trống. | Văn Tuấn: prompt/context; Long Nhật: API/export; Hồng Thắm: bản nháp; Anh Tuấn: hồ sơ/lịch đúng ngày; Huyền Trang: form/editor/export. |

Bằng chứng lịch sử: backend Sprint 3 **14/14 đạt**; Electron E2E đạt năm luồng với provider HTTP giả lập; AI hồi quy **20/20 đạt**. Lượt Gemini thật ngày 28/10 ghi nhận quiz ba câu và kế hoạch một giai đoạn/bốn buổi trên DB tạm, cùng các kiểm tra AI được mô tả trong [SPRINT_3.md](SPRINT_3.md). Đây là kết quả của frontend cũ và thời điểm chạy cũ, không phải lượt nghiệm thu React hiện tại.

## 4. Tồn đọng cuối Sprint 3 và cách Sprint 4 tiếp nhận

| Mã | Nội dung chuyển tiếp | Người chịu trách nhiệm xử lý/kiểm chứng | Sprint 4 đã xử lý | Trạng thái còn lại |
| --- | --- | --- | --- | --- |
| TD-01 | Audit UI ngày 29/10 trên frontend cũ ghi nhận 10 lỗi về bàn phím, modal, ngày giờ, stored XSS và lưu lịch. | Huyền Trang chủ trì UI; Long Nhật phối hợp API/validation; Văn Tuấn điều phối. | Thay frontend React, sửa form lịch và ngày giờ, bổ sung test liên quan. | Chưa có biên bản tái kiểm đủ từng lỗi cũ trên React. Chi tiết 10 ca ở phụ lục A. |
| TD-02 | Chưa nghiệm thu đầy đủ nguồn IU/EDUX/Outlook với tài khoản thật, hết phiên, mất mạng và quyền tenant. | Anh Tuấn chủ trì nguồn; Văn Tuấn bridge/phiên; Long Nhật API; Hồng Thắm lưu trữ; Huyền Trang UI. | Jobs/trạng thái nguồn, phạm vi môn hiện tại, giữ cache tốt; luồng tín chỉ IU có bằng chứng thật ngày 05/11. | Outlook, toàn luồng IU/EDUX và các hồ sơ khác vẫn cần lượt nghiệm thu riêng. |
| TD-03 | AI mới có kết quả thành công theo các lượt chạy cụ thể; thiếu bằng chứng cho mọi đầu vào, độ dài và tình huống lỗi. | Văn Tuấn chủ trì AI; Long Nhật truyền hủy/validation; Anh Tuấn dữ liệu; Huyền Trang trạng thái UI; Hồng Thắm persist. | Nâng cấp client/provider, Unicode/context, timeout/hủy, schema và cache/khả năng thử lại. | Tóm tắt dài và chia mục tiêu vẫn có lượt thật timeout; chưa nghiệm thu toàn bộ chất lượng đầu ra. |
| TD-04 | Cấu trúc frontend/API/database/crawler cũ gây khó bảo trì và mở rộng. Đây là nhu cầu nâng cấp kiến trúc, không phải bằng chứng năm chức năng AI chưa được triển khai. | Văn Tuấn kiến trúc; Huyền Trang frontend; Long Nhật API; Hồng Thắm DB; Anh Tuấn crawler. | React/Vite, API nhiều tầng, DB theo module/migration và crawler/bridge riêng. | Có mã và kiểm thử; tiếp tục kiểm chứng bản bàn giao, dữ liệu cũ và môi trường máy sạch. |
| TD-05 | Chưa đủ bằng chứng tương tác trên thiết bị thật và đầy đủ hành trình liên chức năng. | Huyền Trang chủ trì UI/thiết bị; Văn Tuấn điều phối; các thành viên xác nhận tầng của mình. | Thêm nhiều test React, HTTP/SQLite và kiểm tra desktop/mobile với fixture. | Tablet/stylus/camera, screen reader, hai cửa sổ và toàn hành trình nguồn thật vẫn còn mở. |
| TD-06 | Giới hạn vận hành chung tại cuối Sprint 3: một hồ sơ cấu hình, chưa có bộ cài độc lập và nghiệm thu dữ liệu trong bản cài. | Văn Tuấn điều phối; Huyền Trang build frontend; Long Nhật startup/API; Hồng Thắm DB; Anh Tuấn tài nguyên crawler. | Đã bổ sung Setup/Portable 1.0.0, runtime tự chạy và kiểm tra persist/cài đè trên máy hiện tại, E17. | PB-49/PB-50 có đầu ra đóng gói và kiểm chứng cục bộ; nghiệm thu máy sạch vẫn mở. Nhiều tài khoản là PB-09/PB-10. |

Các lỗi GPA/tín chỉ/khóa nhập học được phát hiện và sửa trong Sprint 4 được ghi ở mục 5. Báo cáo không suy đoán chúng đã được giao hoặc đã được phát hiện tại cuối Sprint 3 khi chưa có tài liệu chứng minh thời điểm đó.

## 5. Kết quả triển khai Sprint 4 theo từng hạng mục

Các mã S4 bên dưới là mã đối chiếu trong báo cáo, không phải issue mới. Trách nhiệm theo tầng giữ đúng năm người; một hạng mục liên chức năng có thể có nhiều người chịu trách nhiệm cho các đầu ra khác nhau.

| Mã / loại | Kết quả mã nguồn đã triển khai | Người chịu trách nhiệm và phối hợp | Mức kiểm chứng và phần còn mở |
| --- | --- | --- | --- |
| **S4-01 — Thay nền tảng frontend** | React/Vite, router, lazy loading, pages/components/hooks/API adapter; giao diện thống nhất, loading/rỗng/lỗi/thử lại và responsive. | **Huyền Trang:** frontend; **Văn Tuấn:** kiến trúc; **Long Nhật:** hợp đồng API. | E01, E02. Test React/build đạt; còn các ca thiết bị và audit UI cũ cần tái kiểm. |
| **S4-02 — Tái cấu trúc API** | Routes → controllers → services; validators/middlewares/utils; giữ tương thích route/alias, status và lỗi nghiệp vụ. | **Long Nhật:** API/contract; **Văn Tuấn:** tích hợp; **Hồng Thắm:** hàm DB; **Huyền Trang:** adapter UI. | E01, E03. API/contract đạt trong phạm vi test; toàn bộ HTTP với nguồn thật chưa nghiệm thu đủ. |
| **S4-03 — Tái cấu trúc DB** | Modules/migrations/shared, connection/facade chung; giữ dữ liệu cũ, quan hệ, rollback và persist. | **Hồng Thắm:** schema/module/migration; **Long Nhật:** caller/transaction; **Văn Tuấn:** tích hợp. | E01, E07, E11. Có test SQLite tạm/mở lại DB; cần kiểm chứng nâng cấp/khôi phục trên bản sao DB bàn giao. |
| **S4-04 — Nguồn và Electron** | Crawler theo module IU/EDUX/Outlook; preload/bridges riêng, timeout/hủy/restore; theo dõi tiến trình đồng bộ và kết quả từng nguồn. | **Anh Tuấn:** collector/mapping; **Văn Tuấn:** bridge/phiên; **Long Nhật:** jobs/API; **Hồng Thắm:** lưu; **Huyền Trang:** trạng thái UI. | E01, E06, E13. Electron mock đạt; nguồn thật toàn diện còn chờ, riêng tín chỉ IU có lượt thành công. |
| **S4-05 — Môn kỳ hiện tại** | Dùng phạm vi IU hiện tại cho Pomodoro, công việc, lịch, thi, quiz và sổ tay; giữ môn cũ khi sửa; báo chưa xác định kỳ thay vì lấy lịch sử làm dự phòng. | **Anh Tuấn:** quy tắc nguồn; **Long Nhật:** phạm vi API; **Huyền Trang:** chọn môn; **Hồng Thắm:** dữ liệu; **Văn Tuấn:** context AI. | E04, E06. Test phạm vi môn đạt; cần đối chiếu thêm các hồ sơ/học kỳ thật. |
| **S4-06 — Kho học liệu** | Môn/chương/slide, upload/viewer/PDF, tìm/tag, metadata học kỳ và chưa phân loại; polling job nền cập nhật số chương/slide và giữ catalog khi lỗi. | **Huyền Trang:** thư viện/viewer; **Long Nhật:** API/upload/catalog; **Anh Tuấn:** EDUX; **Hồng Thắm:** metadata; **Văn Tuấn:** tích hợp AI. | E04, E06. Đồng bộ EDUX hiện chỉ lưu văn bản/metadata, lọc ảnh trước khi lưu; không nghiệm thu cache ảnh EDUX như mô tả cũ. |
| **S4-07 — Lịch/ngày giờ, sửa lỗi** | Tách payload lịch tự học và lớp học; sửa className/room; chặn tạo/dời lịch quá khứ, lọc giờ trống đã qua theo UTC+7; form kiểm tra lại khi lưu. | **Huyền Trang:** form/UI; **Long Nhật:** validator/service; **Anh Tuấn:** giờ nguồn; **Hồng Thắm:** lưu dữ liệu. | E01, E03. Có React/HTTP regression; các form khác nhau có mức kiểm tra UI/API khác nhau, không suy ra tất cả endpoint đều đã chặn cùng quy tắc. |
| **S4-08 — Pomodoro có mục tiêu** | Môn/việc/mục tiêu, nhịp 15/3–25/5–50/10, cảnh báo lịch, pause/nháp/reload; kết quả/học tiếp, lịch sử; phút thực học qua nửa đêm và lưu chống trùng. | **Huyền Trang:** timer/UI; **Long Nhật:** API/nghiệp vụ; **Hồng Thắm:** learning_context/transaction; **Anh Tuấn:** môn/việc/lịch; **Văn Tuấn:** tích hợp. | E01, E03, E04. Test đạt; bố cục và toàn hành trình phiên thật sau build còn cần nghiệm thu. |
| **S4-09 — AI chia mục tiêu** | AI gợi ý 2–5 bước theo thời lượng; người học chọn nhận, tick và lưu cùng phiên; hủy phản hồi cũ, cache hợp lệ và lỗi không chặn tự học. | **Văn Tuấn:** prompt/schema/context; **Long Nhật:** endpoint/validation; **Huyền Trang:** gợi ý/checklist; **Hồng Thắm:** JSON phiên; **Anh Tuấn:** phạm vi môn/việc. | E01, E03, E04, E10. Model giả lập đạt; chia mục tiêu thật có lượt timeout. |
| **S4-10 — Checklist công việc** | Bản nháp AI có đầu ra và phút ước tính; chỉnh/bỏ trước lưu; batch transaction và liên kết sang Pomodoro. | **Long Nhật:** API/batch; **Huyền Trang:** editor/luồng UI; **Văn Tuấn:** AI; **Hồng Thắm:** cột dữ liệu/rollback; **Anh Tuấn:** dữ liệu nguồn. | E04, E05. Test HTTP/UI đạt; live chia nhỏ công việc chưa đạt ở lượt timeout. |
| **S4-11 — Quiz theo nguồn** | Môn/chủ đề/độ khó/số câu; đọc lại nguồn đúng hồ sơ/môn, lưu provenance; server chấm và hiển thị chủ đề sai để luyện lại. | **Long Nhật:** nguồn/chấm/API; **Văn Tuấn:** sinh đề/schema; **Anh Tuấn:** nội dung nguồn; **Hồng Thắm:** source_json/kết quả; **Huyền Trang:** tạo/làm/luyện lại. | E04, E10. Có lượt thật hai câu JOIN trên văn bản tổng hợp; quiz upload chỉ đọc TXT/Markdown, chưa trích PDF/DOCX/PPTX/ảnh. |
| **S4-12 — Ôn thi/điểm cần cải thiện** | Sửa/chọn buổi ôn trước xác nhận, kiểm tra lại tương lai/trước thi/xung đột; hành động luyện quiz, học 15 phút, mở tài liệu; mức thay đổi từ hai quiz đã nộp. | **Long Nhật:** nghiệp vụ/lưu; **Văn Tuấn:** AI; **Anh Tuấn:** lịch/kỳ thi/context; **Hồng Thắm:** transaction/kết quả; **Huyền Trang:** preview/hành động UI. | E01, E04. Có kiểm thử tự động; chưa đủ nghiệm thu AI ôn thi mới với kỳ thi thật trên React hiện tại. |
| **S4-13 — Tóm tắt toàn môn song song** | Nút bấm mới gọi AI; FIFO giữa môn; trong môn chia n phần, mặc định 12.000 ký tự/phần và bốn request đồng thời; ghép đúng thứ tự, lưu phần đã xong để thử lại. | **Văn Tuấn:** pipeline/AI; **Long Nhật:** jobs/API; **Hồng Thắm:** cache/phần đã lưu; **Anh Tuấn:** đủ nguồn; **Huyền Trang:** tiến trình/hàng đợi. | E06, E07, E08, E10. Chứng minh đồng thời với provider localhost; benchmark 2,11 lần là mô phỏng. Tóm tắt thật còn timeout. |
| **S4-14 — Flashcard theo lô** | Sinh từ tóm tắt đã lưu, parse/validate/repair hữu hạn, giảm lô 4 → 2 → 1; thẻ/checkpoint cùng transaction; tạo tiếp lô thiếu; ôn theo môn/chủ đề/đến hạn và chế độ 5 phút. | **Văn Tuấn:** sinh thẻ/JSON; **Hồng Thắm:** checkpoint/dedup/lịch sử; **Long Nhật:** API; **Huyền Trang:** ôn thẻ; **Anh Tuấn:** ngữ cảnh môn/nguồn. | E04, E07, E08, E10. Mock/recovery đạt; bước thẻ thật sau lượt tóm tắt timeout đã bỏ qua, chưa được ghi đạt. |
| **S4-15 — AI Tutor/lịch sử** | Nâng cấp vùng đọc, dừng yêu cầu, giữ nháp, bỏ phản hồi muộn; chọn môn/kỳ thi; tìm lịch sử không dấu, khôi phục đúng conversationId. | **Huyền Trang:** giao diện/lịch sử; **Long Nhật:** API/hủy; **Văn Tuấn:** client/context; **Hồng Thắm:** persist hội thoại; **Anh Tuấn:** context. | E09, E10. Có kiểm tra UI fixture và persistence. Lưu hội thoại là phần đã có ở Sprint 3, không tính thành backend mới hoàn toàn. |
| **S4-16 — Sổ tay cấu trúc** | Tiptap, template/trang con, nháp/autosave theo revision, preview/chèn AI block, xuất Markdown/HTML và liên kết học liệu. | **Huyền Trang:** editor/nháp; **Long Nhật:** notes/notebooks/export API; **Hồng Thắm:** SQLite; **Văn Tuấn:** AI; **Anh Tuấn:** nguồn học liệu. | E01, E02. Có test/UI fixture; cần nghiệm thu lại lưu/mở sau lỗi mạng trên bản bàn giao. |
| **S4-17 — Canvas** | Thư viện vở, viết/vẽ, đối tượng/bảng/công thức, OCR, phiên bản cục bộ, import/export JSON/PDF/ảnh/SVG. | **Huyền Trang:** canvas/lưu cục bộ/export; **Văn Tuấn:** AI tích hợp; **Long Nhật:** API dùng chung khi gọi AI/tài liệu. | E02. Canvas lưu localStorage, không được ghi là Hồng Thắm đã lưu canvas vào SQLite. Chưa nghiệm thu đầy đủ viết tay/toán/stylus/camera thật. |
| **S4-18 — GPA/lịch sử học lực** | Chung công thức hệ 10/4, tổng/tích lũy; P/NP ngoài GPA; giữ lần học/thi, chọn kết quả hoàn tất mới nhất; context AI giữ tổng hợp học kỳ khi rút gọn dữ liệu. | **Hồng Thắm:** công thức/migration; **Anh Tuấn:** điểm gốc/mapping; **Long Nhật:** profile/progress; **Huyền Trang:** hiển thị; **Văn Tuấn:** context/prompt. | E01, E11. Có test/màn hình fixture và đối chiếu dữ liệu đã đồng bộ; chưa phải đối chiếu portal live cho mọi hồ sơ. |
| **S4-19 — Chương trình/tín chỉ IU** | Học phần từ rsChiTiet; tổng chương trình đúng trường tổng; khối/bắt buộc/tích lũy tách riêng; đồng bộ tín chỉ riêng giữ bảng điểm/lịch/hồ sơ ngoài phạm vi. | **Anh Tuấn:** collector/trường nguồn; **Hồng Thắm:** schema/catalog/persist; **Long Nhật:** refresh/validation; **Huyền Trang:** hồ sơ/nút đồng bộ; **Văn Tuấn:** tích hợp. | E12, E13. Có nguồn thật ngày 05/11, quan sát Electron và đọc lại SQLite; giới hạn ở hồ sơ/phạm vi đã thử. |
| **S4-20 — Khóa nhập học** | Bỏ năm 2023 cố định; mã CMC hợp lệ lấy YY, mã khác dùng năm được cung cấp; migration chạy lại an toàn, API/UI/context cùng quy tắc. | **Anh Tuấn:** quy tắc mã/nguồn; **Hồng Thắm:** migration/helper; **Long Nhật:** profile/progress; **Huyền Trang:** adapter/UI; **Văn Tuấn:** context. | E01, E02. Test migration/sync/UI fixture đạt; cần đối chiếu thêm mã ngoài mẫu khi nghiệm thu. |
| **S4-21 — Kiểm thử/tài liệu** | Bổ sung hồi quy API/AI/React/HTTP/SQLite; README, API, kiến trúc, tính năng, sprint, bằng chứng và giới hạn. | **Văn Tuấn:** điều phối/tổng hợp; **Long Nhật:** API/integration; **Hồng Thắm:** DB; **Anh Tuấn:** nguồn/fixture; **Huyền Trang:** React/UI. | E01–E13. Các cảnh báo build và khác biệt tài liệu còn được ghi rõ ở mục 9. |
| **S4-22 — Theo dõi bàn giao** | Cập nhật 27 issue/4 milestone, lịch/deadline và phân công; sửa bộ đếm milestone, giữ trạng thái/assignee lịch sử. | **Văn Tuấn:** đầu mối điều phối; **cả năm thành viên:** xác nhận nội dung phần việc của mình. | E14, E15. Chưa cập nhật trường ngày Projects do thiếu quyền; chưa tự đóng issue Sprint 4. |
| **S4-23 — Logo và nhận diện ứng dụng, bổ sung mới** | Logo cáo kết hợp cuốn sách/ngôi sao trên nền tím; PNG gốc trong suốt, ICO chín cỡ; tích hợp icon cửa sổ/thanh tác vụ Electron, sidebar, favicon và touch icon. Có script xuất lại từ PNG gốc. | **Văn Tuấn:** đầu mối rà soát/bàn giao Electron và tài nguyên icon; **Huyền Trang:** đầu mối rà soát/bàn giao sidebar/favicon và hiển thị sáng/tối. Thiết kế và tích hợp trong phiên này do trợ lý thực hiện theo yêu cầu người dùng, không suy ra tác giả cá nhân từ phân công. | E16. Electron 31/31, routes 37/37, smoke riêng 8/8 và build đạt; đã xem ảnh sáng/tối. Cần mở lại ứng dụng để nạp icon mới; icon của chính electron.exe chưa đổi và bộ cài vẫn thuộc NT-09. |
| **S4-24 — Đóng gói/phát hành Windows, bổ sung mới** | Setup NSIS và Portable x64 1.0.0, nhúng logo vào executable; kèm Electron/API/React/SQLite/WASM/schema/module nguồn. Tự chọn cổng loopback, API nhận địa chỉ lúc chạy; origin cố định, DB/tệp/phiên lưu AppData, không kèm dữ liệu cá nhân. | **Văn Tuấn:** đầu mối build/Electron/release; **Long Nhật:** startup/API; **Hồng Thắm:** đường dẫn ghi/persist; **Huyền Trang:** frontend/icon/shortcut; **Anh Tuấn:** module nguồn/endpoint map. Trợ lý triển khai theo yêu cầu người dùng; thành viên xác nhận phần nhận bàn giao. | E17. Có kiểm tra executable và cài đè trên máy hiện tại, Node.js không nằm trong PATH của app; giới hạn máy sạch, nguồn thật/AI và chữ ký nghiệm thu vẫn được giữ. |

### 5.1. Bổ sung nhận diện ứng dụng ngày 05/11/2026

<img src="../Frontend/public/brand/app-icon.png" alt="Logo Smart Study Hub: cáo và cuốn sách trên nền tím" width="96" height="96">

- **Thiết kế:** hình cáo, cuốn sách và ngôi sao gợi học tập; dùng tông tím thống nhất với giao diện, không có chữ nhỏ trong icon.
- **Tài nguyên bàn giao:** [PNG gốc 1254 px](../assets/branding/smart-study-hub.png), [ICO Windows](../assets/branding/smart-study-hub.ico), PNG sidebar 512 px, favicon 32 px và touch icon 180 px. ICO gồm các cỡ 16, 20, 24, 32, 40, 48, 64, 128 và 256 px.
- **Điểm tích hợp:** Electron khai báo icon cửa sổ và thông tin relaunch trên thanh tác vụ Windows với AppUserModelID vn.cmcu.smartstudyhub; sidebar dùng ảnh logo mới; HTML dùng favicon/touch icon tương ứng. Tên package, đường dẫn userData, dữ liệu ứng dụng và phiên đăng nhập được giữ nguyên.
- **Nguồn thiết kế:** công cụ imagegen tích hợp hỗ trợ tạo logo theo yêu cầu người dùng; trợ lý xuất định dạng và tích hợp mã. Vai trò Văn Tuấn/Huyền Trang ở S4-23 là trách nhiệm rà soát, nhận bàn giao và xác nhận trong nhóm, không phải xác nhận hai thành viên đã tự vẽ logo.
- **Tái tạo tài nguyên:** [script build-app-icons.cjs](../scripts/build-app-icons.cjs); prompt, vị trí tệp và hướng dẫn trong [hồ sơ logo](../assets/branding/README.md).
- **Giới hạn của lượt logo E16:** phải đóng/mở lại ứng dụng để nạp main process mới; shortcut đã ghim cũ có thể cần ghim lại. File electron.exe của môi trường phát triển giữ icon gốc. Lượt đóng gói sau đó đã nhúng icon vào SmartStudyHub.exe của bản phát hành, ghi riêng tại E17.

### 5.2. Bổ sung bộ cài và Portable Windows — 05/11/2026

Đầu ra: [Release v1.0.0](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/releases/tag/v1.0.0), gồm Setup và Portable cho Windows x64. Người nhận tải về dùng mà không phải cài Git/Node.js/npm hoặc bật backend thủ công. Hướng dẫn build, sử dụng, sao lưu và giới hạn: [WINDOWS_RELEASE.md](WINDOWS_RELEASE.md).

Setup cài theo tài khoản Windows, tạo shortcut; Portable mở trực tiếp. Cả hai dùng `%APPDATA%\SmartStudyHubCMC`, tách DB/tệp/phiên khỏi thư mục cài; origin `studyhub://app` giữ localStorage khi cổng backend đổi. Dữ liệu phát triển không được nhập tự động. Gói không chứa `.env`, cookie hay DB sinh viên của máy phát triển. Các executable chưa có chứng thư ký số.

Đây là phần **mới** về đóng gói và **nâng cấp** startup/lưu trữ cho bản phân phối; không biến các mục AI/nguồn thật/thiết bị còn mở thành đã nghiệm thu. Phân công rà soát/bàn giao giữ đúng năm người ở S4-24, không quy toàn bộ công việc cho người commit tích hợp.

## 6. Hồ sơ công việc và đầu ra bàn giao theo từng thành viên

### 6.1. Văn Tuấn — kiến trúc, AI và tích hợp — issue #24

**Phạm vi chính:** S4-04, S4-09, S4-13, S4-14, phần AI của S4-11/S4-12/S4-15/S4-18, đầu mối bàn giao phần Electron của S4-23 và điều phối S4-21/S4-22.

| Nhóm công việc | Đầu ra chịu trách nhiệm | Đầu ra phối hợp của người khác |
| --- | --- | --- |
| Kiến trúc/tích hợp | Thống nhất hướng React → API → DB/provider, startup Electron/headless và hợp đồng giữa các tầng; kiểm soát lỗi tích hợp. | Huyền Trang bàn giao React; Long Nhật API; Hồng Thắm DB; Anh Tuấn collector. |
| Gemini và context | Client/provider, Unicode, ngân sách context, deadline/hủy, schema; giữ academicHistory và phân biệt GPA tổng/tích lũy trong prompt. | Long Nhật truyền signal từ HTTP; Anh Tuấn chuẩn hóa nguồn; Hồng Thắm công thức dữ liệu; Huyền Trang thao tác dừng/thử lại. |
| Tóm tắt dài | Chia nguồn, giới hạn worker, thứ tự ghép, retry phần lỗi và không làm mất kết quả tốt. | Long Nhật jobs/API; Hồng Thắm cache; Anh Tuấn độ đầy đủ nguồn; Huyền Trang trạng thái tiến trình. |
| Flashcard/AI học tập | Sinh thẻ theo lô, schema/repair hữu hạn; AI mục tiêu/checklist/quiz/ôn thi đúng ngữ cảnh. | Hồng Thắm checkpoint/transaction; Long Nhật API; Huyền Trang UI; Anh Tuấn đối soát nội dung nguồn. |
| Bàn giao chung | Tổng hợp bằng chứng, lỗi còn mở, tài liệu và lịch/issue; phân biệt mock/live và giữ ngày thực tế. | Mỗi thành viên bàn giao bằng chứng tầng mình, không chuyển toàn bộ trách nhiệm nghiệm thu cho nhóm trưởng. |
| Nhận diện Electron, S4-23 | Rà soát/nhận bàn giao PNG/ICO, cấu hình icon/AppUserModelID/relaunch và hướng dẫn mở lại ứng dụng; xác nhận giới hạn bộ cài. | Huyền Trang rà soát logo sidebar/favicon; nguồn thiết kế và tích hợp do trợ lý hỗ trợ được ghi tại mục 5.1. |

Mã đối chiếu: [Electron main](../electron/main.js), [Gemini client](../API/utils/gemini-client.js), [tóm tắt nhiều phần](../API/utils/course-summary-ai.js), [Flashcard AI](../API/utils/course-cards-ai.js), [pipeline toàn môn](../API/services/course-summary.pipeline.js), [AI mục tiêu](../API/services/pomodoro-goals.service.js).

**Hồ sơ còn phải bàn giao để xác nhận phần việc:**

- [ ] Biên bản chạy lại AI thật cho tóm tắt → lưu → tạo tiếp Flashcard, ghi lỗi/timeout và phần bỏ qua đúng thực tế.
- [ ] Đối chiếu prompt/context và chất lượng đầu ra trên nguồn học tập đã được chọn; không lấy benchmark mô phỏng làm cam kết tốc độ provider thật.
- [ ] Biên bản tổng hợp nghiệm thu liên tầng và danh sách giới hạn được người nhận chấp thuận.

### 6.2. Anh Tuấn — dữ liệu IU/EDUX/Outlook — issue #25

**Phạm vi chính:** Nguồn của S4-04/S4-05/S4-06/S4-18/S4-19/S4-20 và dữ liệu phục vụ các luồng AI.

| Nhóm công việc | Đầu ra chịu trách nhiệm | Đầu ra phối hợp của người khác |
| --- | --- | --- |
| IU/lịch/môn hiện tại | Collector, giải mã/mapping, hồ sơ, môn, lịch/thi, học kỳ và cửa sổ thi theo UTC+7. | Văn Tuấn bridge; Long Nhật API; Hồng Thắm upsert/persist; Huyền Trang chọn môn/hiển thị. |
| EDUX/học liệu | Hạn riêng/học phần, mapping môn, chương/slide/văn bản; phân biệt nguồn thiếu, lỗi, rỗng hợp lệ và dữ liệu một phần. | Long Nhật catalog/jobs; Hồng Thắm lưu text/metadata; Huyền Trang thư viện/tiến trình. |
| Điểm và học vụ | Giữ điểm hệ 4 gốc, P/NP, lần học/thi; rsChiTiet, trường tổng chương trình và khối kiến thức; quy tắc khóa từ mã CMC. | Hồng Thắm công thức/migration; Long Nhật profile/progress/refresh; Huyền Trang UI; Văn Tuấn context AI. |
| Outlook | Nguồn Graph/OWA, phân trang, nội dung và ngày/giờ trong thư; ghi rõ thiếu quyền/nội dung không đủ. | Văn Tuấn đăng nhập/phiên; Long Nhật API chuyển thư; Hồng Thắm dữ liệu; Huyền Trang đọc/xác nhận. |
| Fixture/đối soát | Bộ dữ liệu không chứa thông tin xác thực; ánh xạ nguồn → trường chuẩn → API/DB; báo cáo nguồn thật theo phạm vi. | Các tầng còn lại đối chiếu dữ liệu hiển thị và lưu, không tự điền điểm/tín chỉ khi nguồn thiếu. |

Mã đối chiếu: [IU fetch](../CRWEB/modules/IU/data/fetch.js), [IU maps](../CRWEB/modules/IU/data/maps.js), [chương trình/khối IU](../CRWEB/modules/IU/data/program.js), [EDUX data](../CRWEB/modules/EDUX/data/index.js), [phạm vi môn hiện tại](../API/utils/current-courses.js), [IU client](../API/utils/iu-client.js).

**Hồ sơ còn phải bàn giao để xác nhận phần việc:**

- [ ] Biên bản IU/EDUX/Outlook cho đăng nhập, hết phiên, mất mạng, dữ liệu rỗng/partial và quyền tenant.
- [ ] Đối soát GPA/P/NP/học lại, chương trình/tín chỉ/khóa trên trường hợp ngoài hồ sơ đã có bằng chứng E13.
- [ ] Xác nhận nguồn học liệu hiện chỉ lưu văn bản/metadata EDUX; ghi rõ định dạng quiz chưa trích xuất và phạm vi nội dung Outlook thực sự đọc được.

### 6.3. Long Nhật — API và nghiệp vụ — issue #26

**Phạm vi chính:** S4-02; phần API/nghiệp vụ của S4-04 đến S4-16, S4-18 đến S4-20 và kiểm thử tích hợp.

| Nhóm công việc | Đầu ra chịu trách nhiệm | Đầu ra phối hợp của người khác |
| --- | --- | --- |
| API nhiều tầng | Route/alias/contract; validation, chủ sở hữu, 400/404/409; không báo lưu/xóa thành công khi bản ghi không tồn tại. | Văn Tuấn kiến trúc; Hồng Thắm kết quả truy vấn; Huyền Trang hợp đồng UI. |
| Đồng bộ/học liệu | Jobs FIFO/gộp yêu cầu/partial/retry, catalog, upload/download, notes/notebooks/export. | Anh Tuấn nguồn; Hồng Thắm metadata; Huyền Trang thư viện/trạng thái. |
| Lịch và học tập | Quy tắc ngày giờ/giờ trống; Pomodoro learningContext, checklist batch, quiz nguồn/chấm bài và xác nhận kế hoạch. | Huyền Trang form/timer; Văn Tuấn AI; Hồng Thắm transaction; Anh Tuấn lịch/nguồn. |
| Chat/học vụ | API hội thoại/hủy; profile/progress/context dùng số liệu chuẩn; refresh tín chỉ riêng có kiểm tra sinh viên và gộp yêu cầu. | Hồng Thắm dữ liệu; Anh Tuấn mapping; Huyền Trang lịch sử/hồ sơ; Văn Tuấn provider. |
| Hợp đồng và kiểm thử | API/HTTP/frontend–API, lỗi/race/cancel/rollback, docs/API.md và bước tái hiện. | Các thành viên xác nhận hợp đồng dữ liệu trước khi nối tầng. |

Mã đối chiếu: [Workspace](../API/services/workspace.service.js), [thời khóa biểu](../API/services/thoikhoabieu.service.js), [checklist](../API/services/baitap.service.js), [nguồn quiz](../API/services/quiz-source.service.js), [quiz](../API/services/quiz.service.js), [hội thoại](../API/services/hoithoai.service.js), [đồng bộ](../API/services/dongbo.service.js), [tích hợp frontend–API](../tests/frontend-api-integration.cjs).

**Hồ sơ còn phải bàn giao để xác nhận phần việc:**

- [ ] Biên bản HTTP → UI → DB trên bản bàn giao, gồm submit lặp, hủy, lỗi provider và lịch đổi khi AI đang xử lý.
- [ ] Đối chiếu API.md với payload thật; công bố giới hạn quiz, hàng đợi RAM và các validation chỉ thực hiện tại UI.
- [ ] Tái kiểm các ca lỗi API liên quan audit UI cũ; phối hợp Hồng Thắm kiểm tra rollback và mở lại dữ liệu.

### 6.4. Hồng Thắm — database và tính toàn vẹn — issue #27

**Phạm vi chính:** S4-03; phần dữ liệu của Pomodoro/checklist/quiz/AI/học liệu, S4-18/S4-19/S4-20 và persist.

| Nhóm công việc | Đầu ra chịu trách nhiệm | Đầu ra phối hợp của người khác |
| --- | --- | --- |
| Cấu trúc/migration | Schema/modules/migrations/shared, connection chung, dữ liệu cũ và migration chạy lại an toàn. | Long Nhật caller; Văn Tuấn tích hợp; Anh Tuấn mapping nguồn. |
| Dữ liệu học tập | learning_context, microGoals, checklist đầu ra/thời lượng, source_json của quiz; chống trùng và transaction. | Long Nhật kiểm tra nghiệp vụ; Huyền Trang tạo/đọc trạng thái. |
| AI và học liệu | Cache tóm tắt/phần đã xong, checkpoint Flashcard, thẻ và lịch sử ôn, hội thoại thành công sống qua mở lại DB. | Văn Tuấn AI; Long Nhật jobs/API; Anh Tuấn nguồn; Huyền Trang UI. |
| Học vụ | Công thức GPA chung, P/NP/học lại; schema catalog/chương trình/khối; provenance tổng tín chỉ và migration khóa nhập học. | Anh Tuấn dữ liệu gốc; Long Nhật API/context; Huyền Trang hồ sơ; Văn Tuấn prompt. |
| Toàn vẹn/backup | Owner, khóa/index/quan hệ, rollback, sync lặp, persist, sao lưu DB và thư mục file theo phạm vi. | Các tầng gọi phải báo đúng lỗi và đối soát dữ liệu sau reload. |

Mã đối chiếu: [migration học tập](../database/migrations/learningMigration.js), [migration workspace](../database/migrations/workspaceMigration.js), [migration học lực](../database/migrations/academicMigration.js), [migration chương trình](../database/migrations/curriculumMigration.js), [migration khóa nhập học](../database/migrations/studentIdentityMigration.js), [công thức học lực](../database/shared/academic-results.js), [quy tắc mã sinh viên](../database/shared/student-identity.js), [IU sync](../database/modules/iuSync.js).

**Hồ sơ còn phải bàn giao để xác nhận phần việc:**

- [ ] Biên bản nâng cấp bản sao DB Sprint 1–3, chạy migration lặp, backup/restore và đối soát số bản ghi.
- [ ] Kiểm tra rollback/ghi lỗi/gửi lại, chống trùng thời gian học và checkpoint, mở lại DB sau đóng ứng dụng.
- [ ] Xác nhận ranh giới SQLite với localStorage: canvas và bookmark/tiến độ slide chưa thuộc đồng bộ DB nhiều máy.

### 6.5. Huyền Trang — React/Vite và giao diện — issue #28

**Phạm vi chính:** S4-01; giao diện S4-05 đến S4-20, sổ tay/canvas, đầu mối bàn giao phần UI của S4-23 và bằng chứng tương tác.

| Nhóm công việc | Đầu ra chịu trách nhiệm | Đầu ra phối hợp của người khác |
| --- | --- | --- |
| React và trải nghiệm chung | Router/layout/adapter, loading/rỗng/lỗi/retry, responsive, form/nháp/refresh, điều hướng đủ chức năng kế thừa. | Long Nhật API; Văn Tuấn kiến trúc. |
| Lịch/công việc/Pomodoro | Payload form đúng loại; ngày giờ UTC+7; chọn môn hiện tại; mục tiêu/checklist/nhịp học, cảnh báo, kết quả/học tiếp/ôn lại. | Long Nhật nghiệp vụ; Anh Tuấn nguồn; Hồng Thắm persist; Văn Tuấn AI. |
| Học liệu và AI | Thư viện/slide/PDF, hàng đợi gọn, tóm tắt/Flashcard/quiz/điểm yếu/ôn thi; AI Tutor dừng/giữ nháp/lịch sử. | Văn Tuấn AI; Long Nhật API; Anh Tuấn dữ liệu; Hồng Thắm kết quả đã lưu. |
| Sổ tay/canvas | Tiptap/template/trang con/AI block, nháp/autosave/export; canvas, OCR, đối tượng/công thức và sao lưu cục bộ. | Long Nhật notes/API; Hồng Thắm sổ tay SQLite; Văn Tuấn AI. Canvas vẫn lưu localStorage. |
| Hồ sơ và UI QA | GPA đúng hệ/phạm vi; danh mục/tín chỉ/khối/khóa; React test/build, desktop/mobile, bàn phím/focus, ảnh/biên bản và FEATURES.md. | Anh Tuấn nguồn; Hồng Thắm công thức/schema; Long Nhật API. |
| Logo giao diện, S4-23 | Rà soát/nhận bàn giao ảnh sidebar, favicon/touch icon, kích thước và khả năng hiển thị sáng/tối; không thay ghi nhận nguồn thiết kế bằng phân công UI. | Văn Tuấn nhận bàn giao icon Electron và relaunch; bằng chứng chung E16. |

Mã đối chiếu: [App/router](../Frontend/src/App.jsx), [Pomodoro](../Frontend/src/components/learning/PomodoroTimer.jsx), [Flashcard](../Frontend/src/components/learning/FlashcardReview.jsx), [hàng đợi](../Frontend/src/components/learning/LearningQueue.jsx), [lịch sử chat](../Frontend/src/pages/AITutor/ConversationHistory.jsx), [sổ tay và autosave](../Frontend/src/pages/Notebooks/useNotebooks.js), [canvas](../Frontend/src/pages/Textbook/TextbookEditor.jsx), [refresh tín chỉ](../Frontend/src/components/profile/useIuCredits.js).

**Hồ sơ còn phải bàn giao để xác nhận phần việc:**

- [ ] Tái kiểm đủ 10 ca audit cũ và các hành trình sau build trên Electron/browser theo phiên bản bàn giao.
- [ ] Biên bản bàn phím/focus, zoom, screen reader và thiết bị tablet/stylus/camera trong phạm vi được yêu cầu.
- [ ] Ảnh hoặc video/biên bản của các luồng học tập chính; công bố phần dữ liệu local và hướng dẫn sao lưu.

## 7. Kết quả kiểm thử và kiểm chứng đã có

### 7.1. Lượt xác minh trước push ngày 05/11/2026

| Lệnh | Kết quả ghi nhận | Phạm vi có thể kết luận |
| --- | --- | --- |
| npm run test:api | **152/152 đạt** | Contract, API, HTTP, SQLite tạm và provider giả lập. |
| npm run test:ai | **96/96 đạt** | Context/GPA, pipeline học tập, tóm tắt/Flashcard, HTTP provider localhost/mock. |
| npm run test:electron | **31/31 đạt** | Entry/preload/IPC, restore/timeout/luồng nguồn giả lập; không phải toàn bộ UI live. |
| npm run test:course-learning | **63/63 đạt** | Môn hiện tại, nguồn học liệu, phục hồi và refresh trong phạm vi bộ test. |
| npm run test:frontend-api | **10/10 đạt** | Axios gọi HTTP thật tới API, dùng SQLite tạm. |
| npm --prefix Frontend test -- --maxWorkers=2 | **455/455 đạt trong 50 file** | React/Vitest/jsdom. |
| npm --prefix Frontend run build | **Đạt, 13,70 giây** | Build Vite production; còn cảnh báo MathJax eval và chunk lớn đã có. |

Nguồn E01. Các nhóm có ca giao nhau, không cộng thành một tổng test duy nhất. Lượt viết báo cáo không chạy lại các lệnh trên. Bằng chứng thành phần trước đó vẫn giữ nguyên ngày 02/11, 04/11 hoặc 05/11 tương ứng.

### 7.2. Kiểm tra nguồn thật và giới hạn kết luận

| Phạm vi / ngày | Kết quả thật đã ghi nhận | Kết luận được phép sử dụng |
| --- | --- | --- |
| Gemini, 28/10, frontend cũ | Có lượt thành công cho các kiểm tra AI mô tả ở Sprint 3, gồm quiz ba câu và kế hoạch một giai đoạn/bốn buổi trên DB tạm. | Xác nhận snapshot Sprint 3 tại thời điểm đó; không thay nghiệm thu mã React hoặc giao thức provider đã thay đổi. |
| Gemini, 04/11 | Trả lời tiếng Việt và tạo hai câu hỏi JSON từ nguồn JOIN tổng hợp thành công. | Chứng minh hai yêu cầu cụ thể; không xác nhận mọi môn/chất lượng quiz hay toàn bộ AI đã đạt. |
| Tóm tắt dài, 04/11 | Timeout trong ngân sách khoảng 25 giây; bước Flashcard phụ thuộc không chạy. | Ghi **chưa đạt lượt live này** và **bỏ qua bước thẻ**, không chuyển thành PASS từ kết quả mock. |
| Chia nhỏ công việc/mục tiêu, 04/11 | Có lượt nguồn tổng hợp trả GEMINI_TIMEOUT. | Chưa đủ bằng chứng nghiệm thu provider thật cho luồng chia nhỏ. |
| IU tín chỉ, 05/11 | Đồng bộ riêng bằng phiên thật thành công; thấy 129 tín chỉ bắt buộc trên Electron và đọc lại SQLite xác nhận persist. | Đạt kiểm chứng giới hạn cho hồ sơ và luồng tín chỉ đã thử, không thay nghiệm thu mọi nguồn/hồ sơ. |
| Outlook và toàn bộ đồng bộ trường | Chưa có biên bản live đủ phạm vi bàn giao hiện tại. | Giữ phần này ở trạng thái chờ nghiệm thu bổ sung. |

E13 ghi nhận ở hồ sơ đã đối soát: tổng chương trình **126**, bắt buộc **129**, tổng khối **203**, tích lũy theo khối **28**, tích lũy bảng điểm **25**, GPA tích lũy **2,52/4**. Đây là số liệu của một hồ sơ kiểm chứng, không phải hằng số sản phẩm và không được suy ra tổng chương trình bằng cách cộng các khối.

### 7.3. Hiệu năng tóm tắt song song

E08 ghi nhận benchmark với độ trễ giả lập 50 ms/request: 67.215 ký tự chia tám phần, cùng chín request; một worker 575 ms, bốn worker 272 ms, nhanh 2,11 lần trong lượt mô phỏng. Kiểm tra HTTP localhost ghi nhận bốn POST đồng thời trước khi trả câu trả lời đầu tiên. Kết quả này chứng minh cơ chế concurrency/đủ nguồn/thứ tự trong fixture, không phải cam kết tốc độ, chất lượng hay khả năng tránh rate limit của Gemini thật.

### 7.4. Kiểm tra bổ sung logo ngày 05/11/2026

Phạm vi riêng tại commit 1d7ada6, nguồn E16:

| Kiểm tra | Kết quả ghi nhận | Giới hạn |
| --- | --- | --- |
| npm run test:electron | **31/31 đạt** | Startup regression xác nhận icon có thật, tên cửa sổ và cấu hình nhận diện Windows. |
| React routes | **37/37 đạt trong routes.test.jsx** | Kiểm tra điều hướng liên quan; không phải chạy lại toàn bộ 455 test React. |
| Electron smoke riêng | **8/8 đạt** | ICO chín cỡ, Electron đọc icon, PNG 512 px có góc trong suốt, cửa sổ nhận thông tin taskbar, logo sidebar 40 px, favicon, sáng/tối và không tràn viewport; dùng profile riêng và mock adapter. |
| Build production | **Đạt, 33,66 giây** | Còn cảnh báo MathJax eval/chunk lớn đã có. |

Đã xem ảnh sidebar sáng/tối; artifact ở tests/artifacts/branding. Lượt logo không restart ứng dụng người dùng, không sửa DB, không đổi đường dẫn userData và không chạy lại toàn bộ API/AI. Số liệu của mục 7.1 giữ nguyên theo lượt trước; lượt cập nhật báo cáo này chỉ dẫn lại bằng chứng, không tạo một lượt test mới.

### 7.5. Kiểm tra bản phân phối Windows — 05/11/2026

Nguồn E17 ghi riêng lượt đóng gói: kiểm tra runtime/đường dẫn, API/AI/Electron/React và HTTP tích hợp; đọc tài nguyên trong ASAR; chạy executable thật với profile thử, không có Node.js trong PATH của app. Kiểm tra giao diện/logo, backend, DB mới rỗng và ghi chú/tài liệu/localStorage qua ba lần mở; bản Setup còn được cài đè để kiểm tra giữ dữ liệu. Số ca/kết quả và SHA-256 cụ thể nằm trong [windows-release.json](evidence/windows-release.json).

Đã xem ảnh lần mở đầu của executable. Chỉ có dữ liệu tổng hợp trong profile thử, không chạy lại Gemini hoặc nguồn trường thật. Đây là kiểm chứng trên máy Windows hiện tại; chưa có biên bản máy ảo sạch không cài Node.js hoặc cài toàn máy trong Program Files. Các ô ký nghiệm thu vẫn để người nhận xác nhận.

## 8. Danh mục bằng chứng dùng để nghiệm thu

| Mã | Tệp/tài liệu | Phạm vi và ngày cần giữ khi trích dẫn |
| --- | --- | --- |
| E01 | [sprint4-publish-verification.json](evidence/sprint4-publish-verification.json) | Lượt trước push 05/11: API 152, AI 96, Electron 31, học liệu 63, frontend–API 10, React 455/50 file và build. |
| E02 | [TESTING.md](TESTING.md) | Lịch sử theo mốc; UI canvas/sổ tay, ngày giờ, Pomodoro, khóa nhập học và giới hạn thiết bị/nguồn. |
| E03 | [API.md](API.md), [test lịch](../API/tests/schedule-planning.test.cjs), [test Pomodoro](../API/tests/pomodoro-learning.test.cjs), [test AI goals](../API/tests/pomodoro-goals.test.cjs) | Hợp đồng và các ca đã được bao gồm trong lượt kiểm thử; không tự tính thêm số test ngoài E01. |
| E04 | [learning-flows-tests.json](evidence/learning-flows-tests.json) | 04/11: các luồng môn/checklist/quiz/ôn thi/Pomodoro/Flashcard; provider mock/SQLite tạm. |
| E05 | [learning-flows-live.json](evidence/learning-flows-live.json) | 04/11: chia nhỏ công việc thật timeout, dữ liệu tổng hợp, không ghi DB ứng dụng. |
| E06 | [learning-queue-tests.json](evidence/learning-queue-tests.json), [learning-queue-ui.json](evidence/learning-queue-ui.json) | 04/11: FIFO, đồng bộ không tự gọi AI, cập nhật catalog/partial; UI hàng đợi với fixture. |
| E07 | [learning-recovery-tests.json](evidence/learning-recovery-tests.json), [learning-recovery-live.json](evidence/learning-recovery-live.json) | 04/11: recovery summary/JSON/lô thẻ; live summary timeout và thẻ bỏ qua. |
| E08 | [learning-parallel-tests.json](evidence/learning-parallel-tests.json), [learning-parallel-benchmark.json](evidence/learning-parallel-benchmark.json) | 04/11: song song trong môn, FIFO giữa môn, cache/thứ tự và benchmark mô phỏng. |
| E09 | [ai-history-ui.json](evidence/ai-history-ui.json), [ai-tutor-layout.json](evidence/ai-tutor-layout.json) | History 05/11; layout 04/11. UI fixture/provider mock và persistence theo phạm vi báo cáo. |
| E10 | [ai-connection-audit.json](evidence/ai-connection-audit.json) | 04/11: sửa client/context/cancel/deadline; chat/quiz tổng hợp thật đạt, summary/goals còn timeout. |
| E11 | [gpa-iu-audit.json](evidence/gpa-iu-audit.json) | 05/11: công thức GPA, P/NP/lần học, lịch sử/context; không phải đối chiếu portal live đã đăng nhập cho mọi hồ sơ. |
| E12 | [iu-curriculum-audit.json](evidence/iu-curriculum-audit.json) | 05/11: catalog/tổng chương trình trên fixture; tại lượt này chưa có phiên live khả dụng. |
| E13 | [iu-credit-refresh.json](evidence/iu-credit-refresh.json) | 05/11, lượt sau: tín chỉ/khối IU thật, UI Electron và SQLite readback trong phạm vi hồ sơ thử. Không xóa giới hạn lịch sử của E12. |
| E14 | [github-sprint-sync.json](evidence/github-sprint-sync.json) | 05/11: cập nhật 27 issue/4 milestone, giữ assignee/trạng thái, có hash nội dung trước/sau. |
| E15 | [github-milestone-counters.json](evidence/github-milestone-counters.json) | 05/11: sửa bộ đếm bằng gắn lại metadata; giữ trạng thái và ngày đóng issue. |
| E16 | [app-branding.json](evidence/app-branding.json), [hồ sơ PNG/ICO và prompt](../assets/branding/README.md) | 05/11: logo do imagegen hỗ trợ, tích hợp Electron/sidebar/favicon; 31 test Electron, 37 routes, 8 smoke riêng và build 33,66 giây. Phạm vi và nguồn đóng góp ở mục 5.1/7.4. |
| E17 | [windows-release.json](evidence/windows-release.json), [hướng dẫn Windows](WINDOWS_RELEASE.md) | 05/11: bộ cài/Portable 1.0.0, kiểm tra ASAR/tài nguyên, executable và giữ dữ liệu qua khởi động/cài đè trên máy hiện tại. Kết quả không thay nghiệm thu máy sạch, nguồn trường, AI hoặc thiết bị. |

Ảnh/video/log bổ sung thường nằm trong thư mục tests/artifacts, được gitignore. Người bàn giao cần cung cấp bản sao artifact được chọn nếu hội đồng/người nhận cần kiểm chứng lại; các tệp local này không được mặc nhiên coi là có sẵn trong một clone GitHub mới. Không đưa cookie, mật khẩu, token hoặc response hồ sơ thô vào hồ sơ nghiệm thu.

## 9. Phần còn mở và trách nhiệm hoàn thiện hồ sơ nghiệm thu

Mức P1/P2 dưới đây là đề xuất ưu tiên kiểm chứng trong báo cáo, không phải bằng chứng một lỗi vẫn tái hiện trên bản hiện tại. Deadline công việc Sprint 4 giữ nguyên 05/11/2026, 23:59:59 UTC+7. Lịch kiểm tra lại hoặc thời hạn bổ sung sau mốc này chưa được chốt; người nhận ghi vào biên bản khi thống nhất, không sửa lùi ngày triển khai/kiểm thử.

| Mã / ưu tiên | Nội dung còn mở | Đầu mối chịu trách nhiệm | Người phối hợp | Điều kiện kết thúc / ảnh hưởng nghiệm thu |
| --- | --- | --- | --- | --- |
| NT-01 / P1 | Tóm tắt dài → Flashcard và AI chia mục tiêu còn lượt thật timeout; chất lượng AI theo môn chưa được nghiệm thu đủ. | **Văn Tuấn** | Long Nhật, Anh Tuấn, Hồng Thắm, Huyền Trang. | Có biên bản đúng revision và nguồn đại diện; tách PASS/FAIL/SKIPPED, kiểm tra nguồn/độ đầy đủ và giữ kết quả sau lỗi. Chưa nghiệm thu toàn bộ AI chỉ bằng test mock. |
| NT-02 / P1 | Toàn luồng IU/EDUX/Outlook, hết phiên/mất mạng/rỗng/partial/quyền tenant. | **Anh Tuấn** | Văn Tuấn: phiên; Long Nhật: API; Hồng Thắm: dữ liệu; Huyền Trang: UI. | Biên bản nguồn thật của từng nguồn; đối soát dữ liệu trước/sau, không suy rộng E13 ra mọi hồ sơ hoặc Outlook. |
| NT-03 / P1 | Tái kiểm 10 phát hiện audit UI cũ, đặc biệt stored XSS, lưu lịch và bàn phím/focus. | **Huyền Trang** | Long Nhật: API/validation; Văn Tuấn: điều phối. | Mỗi ca phụ lục A có kết quả trên React hiện tại, bước tái hiện và bằng chứng; không mặc định đã hết lỗi do thay framework. |
| NT-04 / P1 | Nghiệm thu hành trình đầu-cuối trên đúng bản định bàn giao, thuộc PB-48. | **Văn Tuấn** | Cả bốn thành viên còn lại theo tầng. | Đồng bộ → lịch/việc → học liệu/ghi chú/Pomodoro → quiz → điểm cần cải thiện → kế hoạch; lưu và mở lại khớp DB, có bằng chứng UI. |
| NT-05 / P1 | DB cũ → mới, backup/restore, rollback, ghi lỗi/hai cửa sổ và persist. | **Hồng Thắm** | Long Nhật, Văn Tuấn; Anh Tuấn đối soát nguồn; Huyền Trang reload UI. | Chạy trên bản sao DB thử; giữ bản ghi cũ, migration lặp không trùng, khôi phục và mở lại dữ liệu đúng. |
| NT-06 / P2 | Quiz upload chưa trích văn bản PDF/DOCX/PPTX/ảnh. | **Long Nhật** | Anh Tuấn: nguồn; Văn Tuấn: AI; Huyền Trang: thông báo UI. | Người nhận chấp thuận phạm vi hiện tại TXT/Markdown hoặc lập yêu cầu mở rộng riêng. Trong phạm vi hiện tại, định dạng chưa hỗ trợ phải báo lỗi rõ và không giả nhận đã dùng nguồn. |
| NT-07 / P2 | Canvas, bookmark/tiến độ slide còn lưu theo origin; chưa đồng bộ nhiều máy/cộng tác. | **Huyền Trang** | Hồng Thắm: ranh giới DB; Long Nhật/Văn Tuấn: kiến trúc khi mở rộng. | Xác nhận phạm vi local, sao lưu/nhập lại hoạt động; nếu cần đồng bộ nhiều máy thì đánh giá thành yêu cầu bổ sung. |
| NT-08 / P2 | Tablet/stylus/camera, OCR viết tay/toán, zoom và screen reader chưa được nghiệm thu đủ. | **Huyền Trang** | Văn Tuấn điều phối; Long Nhật khi có lỗi API liên quan. | Ghi thiết bị/phần mềm đầu vào và kết quả thật; không dùng touch/pointer giả lập để chứng minh lực nhấn hoặc OCR phức tạp. |
| NT-09 / P1 khi nghiệm thu máy sạch | PB-49/PB-50 đã có script, Setup/Portable, kiểm tra tài nguyên và DB/cài đè cục bộ theo E17. Còn thiếu lượt trên máy sạch không cài Node.js và xác nhận người nhận. | **Văn Tuấn** | Huyền Trang: build; Long Nhật: startup/API; Hồng Thắm: DB; Anh Tuấn: endpoint_map và nguồn. | Bổ sung chạy trên máy sạch, kiểm tra tài nguyên/quyền ghi/nâng cấp đúng phạm vi bản cài theo người dùng. Program Files chưa thuộc kết quả cục bộ và chưa phải cấu hình phát hành hiện tại. |
| NT-10 / giới hạn kiến trúc | Một hồ sơ cấu hình; chưa có xác thực/phân quyền nhiều tài khoản nội bộ, liên quan thiết kế PB-09/PB-10. | **Văn Tuấn** | Long Nhật: API; Hồng Thắm: dữ liệu; Huyền Trang: UI; Anh Tuấn: danh tính nguồn. | Ghi phạm vi một hồ sơ khi nghiệm thu; chỉ đánh giá nhiều tài khoản sau khi yêu cầu và thiết kế riêng được chốt. Không gán việc này cho PB-50. |
| NT-11 / P2 | README/ARCHITECTURE còn câu mô tả đọc/cache ảnh EDUX chưa khớp mã text-only hiện tại. | **Văn Tuấn** | Anh Tuấn: quy tắc nguồn; Long Nhật: API; Hồng Thắm: persist; Huyền Trang: hướng dẫn tính năng. | Đồng bộ tài liệu với mã lọc ảnh và API hiện có. Chưa được dùng mô tả cũ làm bằng chứng tính năng cache ảnh đã được nghiệm thu. |
| NT-12 / P2, quản lý dự án | Chưa xác định/cập nhật trường ngày Projects do thiếu quyền đọc/ghi Project. | **Văn Tuấn** | Từng thành viên kiểm tra phần việc của mình khi Project khả dụng. | Có quyền/phiên phù hợp và xác minh Project liên kết, nếu có. Ngày milestone/issue đã cập nhật; phần Projects vẫn ghi chưa hoàn tất. |

## 10. Kịch bản đề nghị thực hiện trong buổi nghiệm thu

### 10.1. Cách ghi kết quả

Ghi một trong các trạng thái: **Đạt**, **Không đạt**, **Bị chặn** hoặc **Chưa thực hiện**. Mỗi kết quả phải có revision, ngày giờ UTC+7, môi trường, loại dữ liệu/provider và liên kết bằng chứng. Các dòng dưới đây là kế hoạch kiểm tra cho buổi nghiệm thu; báo cáo này không tự đánh dấu đã chạy các kịch bản đó.

Dùng fixture/DB tạm hoặc bản sao cho ca thay đổi/xóa/migration. Ca nguồn thật dùng phiên được cấp quyền, ghi phạm vi nhưng không ghi thông tin xác thực. Ngày lịch và kỳ thi của ca mới phải nằm ở tương lai theo UTC+7. Kiểm tra dữ liệu sau reload/mở lại, không chỉ xem thông báo thành công trên UI.

### 10.2. Danh sách ca và người thực hiện

| Ca | Người chủ trì / phối hợp | Thao tác và kết quả cần đạt | Kết quả buổi nghiệm thu |
| --- | --- | --- | --- |
| **TC-01 — Khởi chạy** | Văn Tuấn / Long Nhật, Huyền Trang, Hồng Thắm, Anh Tuấn. | Clone đúng revision, cài hai lockfile, build, mở Electron/headless theo tài liệu. UI/API lên đúng, tài nguyên cần thiết đọc được, DB thử persist sau đóng/mở. Đây là kiểm tra mã nguồn, tách khỏi TC-15 về bộ cài. | Chưa thực hiện; bằng chứng: ______ |
| **TC-02 — Đồng bộ nguồn** | Anh Tuấn / Văn Tuấn, Long Nhật, Hồng Thắm, Huyền Trang. | Đồng bộ IU → EDUX; kiểm tra môn kỳ hiện tại, lịch, deadline và học liệu. Thử hết phiên/lỗi nguồn; dữ liệu tốt và lịch tự nhập được giữ. Outlook ghi rõ Graph/OWA và quyền/nội dung thực tế. | Chưa thực hiện; bằng chứng: ______ |
| **TC-03 — Lịch/ngày giờ** | Huyền Trang / Long Nhật, Anh Tuấn, Hồng Thắm. | Tạo/sửa lịch tự học và lớp học, Chủ Nhật, thời điểm qua nửa đêm; ngày/giờ cũ bị chặn khi tạo/dời, sửa ghi chú lịch sử vẫn đúng quy tắc. Form không gửi trường ngoài hợp đồng; kiểm tra trùng loại trừ chính lịch đang sửa. | Chưa thực hiện; bằng chứng: ______ |
| **TC-04 — Pomodoro có mục tiêu** | Huyền Trang / Long Nhật, Hồng Thắm, Anh Tuấn, Văn Tuấn. | Chọn môn/việc, nhịp học và mục tiêu; nhận checklist chủ động; học một khoảng đo được, pause/chuyển trang/reload, lưu/thử lại. Phút thực học và ngày UTC+7 đúng; ID lặp không tạo trùng; chỉ hoàn thành việc khi người học chọn. | Chưa thực hiện; bằng chứng: ______ |
| **TC-05 — Checklist AI** | Long Nhật / Văn Tuấn, Huyền Trang, Hồng Thắm, Anh Tuấn. | Tạo bản nháp bước, sửa đầu ra/phút, bỏ một bước và xác nhận. Batch ghi đủ hoặc rollback khi mô phỏng lỗi; ngữ cảnh đổi không nhận phản hồi cũ; chuyển sang Pomodoro giữ mục tiêu. | Chưa thực hiện; bằng chứng: ______ |
| **TC-06 — Quiz và điểm cần cải thiện** | Long Nhật / Văn Tuấn, Anh Tuấn, Hồng Thắm, Huyền Trang. | Chọn môn/nguồn hợp lệ, sinh đề, làm/nộp, gửi lặp và mở lại. Đáp án chỉ xuất hiện sau nộp, server chấm; nguồn được lưu đúng. Sau hai quiz đã nộp, chênh lệch điểm khớp dữ liệu; nguồn chưa hỗ trợ phải báo rõ. | Chưa thực hiện; bằng chứng: ______ |
| **TC-07 — Ôn thi AI** | Long Nhật / Văn Tuấn, Anh Tuấn, Hồng Thắm, Huyền Trang. | Chọn kỳ thi tương lai, sinh preview, sửa/bỏ buổi. Tạo xung đột mới trước xác nhận để kiểm tra server đọc lại lịch; lưu hợp lệ bằng transaction, không có bản ghi nửa chừng hoặc buổi sau giờ thi. | Chưa thực hiện; bằng chứng: ______ |
| **TC-08 — Tóm tắt và Flashcard** | Văn Tuấn / Anh Tuấn, Long Nhật, Hồng Thắm, Huyền Trang. | Dùng nguồn có độ dài đại diện và đoạn kiểm tra ở cuối. Đồng bộ/mở trang không tự gọi AI; nút bấm chạy FIFO giữa môn, các phần trong môn song song có giới hạn. Lỗi một phần/lô giữ phần đã lưu; tạo tiếp không trùng; thẻ dựa trên tóm tắt. Provider thật phải có biên bản riêng với fixture. | Chưa thực hiện; bằng chứng: ______ |
| **TC-09 — AI Tutor/lịch sử/đơn** | Huyền Trang / Văn Tuấn, Long Nhật, Hồng Thắm, Anh Tuấn. | Gửi chat, hủy, sửa câu hỏi, mở lịch sử/tìm không dấu, khôi phục và tiếp tục đúng hội thoại. Giữ nháp, bỏ phản hồi muộn, tạo mới không xóa lịch sử. Soạn/sửa/lưu/mở lại/xuất đơn, không báo đã gửi lên trường. | Chưa thực hiện; bằng chứng: ______ |
| **TC-10 — Sổ tay cấu trúc** | Huyền Trang / Long Nhật, Hồng Thắm, Văn Tuấn. | Tạo sổ/template/trang con, sửa nội dung, preview/chèn AI, xuất; ngắt mạng khi sửa rồi khôi phục. Nháp mới không bị phản hồi cũ xóa; đóng/mở lại đọc đúng bản đã persist theo hồ sơ. | Chưa thực hiện; bằng chứng: ______ |
| **TC-11 — Canvas** | Huyền Trang / Văn Tuấn, Long Nhật khi dùng AI/API. | Vẽ/sửa đối tượng/bảng/công thức, undo/redo, autosave, mốc phiên bản; reload cùng origin; xuất và nhập JSON thành bản mới. Ghi rõ OCR/thiết bị thật đã thử và giới hạn; không mô tả localStorage là đồng bộ tài khoản. | Chưa thực hiện; bằng chứng: ______ |
| **TC-12 — GPA/học lại** | Hồng Thắm / Anh Tuấn, Long Nhật, Huyền Trang, Văn Tuấn. | Đối soát hệ 10/4, tổng/tích lũy, điểm thiếu, P/NP và nhiều lần học/thi với dữ liệu thử có đáp án chuẩn. Hồ sơ/progress/context dùng cùng số liệu; đổi bộ lọc kỳ không làm sai tổng toàn bộ. | Chưa thực hiện; bằng chứng: ______ |
| **TC-13 — Tín chỉ/chương trình/khóa** | Anh Tuấn / Hồng Thắm, Long Nhật, Huyền Trang, Văn Tuấn. | Đối chiếu trường tổng và catalog IU; refresh tín chỉ riêng giữ bảng điểm/lịch/hồ sơ. Mã sinh viên không khớp bị từ chối; không cộng khối thành tổng chương trình; mã CMC và mã ngoài mẫu có năm đúng nguồn/quy tắc. Kiểm tra reload và SQLite. | Chưa thực hiện trong buổi mới; đã có bằng chứng giới hạn E13. |
| **TC-14 — Migration/toàn vẹn** | Hồng Thắm / Long Nhật, Văn Tuấn, Anh Tuấn, Huyền Trang. | Nâng cấp bản sao DB cũ, chạy lại migration/sync, cố ý gây lỗi ghi, gửi lặp và mở lại. Giữ dữ liệu/index, owner đúng, rollback đủ, không trùng phiên/checklist/quiz/checkpoint. Backup/restore phải đối chiếu số liệu. | Chưa thực hiện; bằng chứng: ______ |
| **TC-15 — Bộ cài/máy sạch** | Văn Tuấn / Huyền Trang, Long Nhật, Hồng Thắm, Anh Tuấn. | Dùng Setup/Portable trong E17; kiểm tra máy sạch không cài Node.js, tài nguyên và DB trong thư mục người dùng; nâng cấp giữ dữ liệu. Nếu chọn cài toàn máy/Program Files, cần cấu hình và lượt riêng. | Đã kiểm chứng executable/cài đè cục bộ theo E17; máy sạch và chấp thuận chính thức chưa thực hiện. |
| **TC-16 — UI và thiết bị** | Huyền Trang / Long Nhật, Văn Tuấn. | Thực hiện từng ca phụ lục A; desktop/mobile, bàn phím/focus, zoom/screen reader và thiết bị được chọn. Lưu kích thước/thiết bị, ảnh và lỗi còn lại; kiểm tra toàn hành trình TC-02 → TC-07. | Chưa thực hiện; bằng chứng: ______ |
| **TC-17 — Logo/nhận diện** | Văn Tuấn: Electron; Huyền Trang: UI. | Mở lại bản mới trên máy người nhận; kiểm tra icon cửa sổ/thanh tác vụ, tên relaunch, sidebar sáng/tối và favicon. Xác nhận PNG/ICO có trong bàn giao; ghi nhận shortcut ghim cũ và phân biệt icon ứng dụng với icon electron.exe chưa đóng gói. | Chưa thực hiện trên máy người nhận; đã có E16 trong phiên thử riêng. |

## 11. Đánh giá và đề xuất phạm vi nghiệm thu

### 11.1. Phần có căn cứ để trình kiểm tra nghiệm thu

1. Bản mã đã có nền React/Vite, API nhiều tầng, database/module/migration và crawler/Electron theo cấu trúc mới.
2. Có mã và bằng chứng tự động cho các luồng học tập, lịch/ngày giờ, Pomodoro có mục tiêu, checklist/quiz/ôn thi, tóm tắt song song và Flashcard theo lô.
3. Có mã/bằng chứng theo phạm vi cho AI Tutor/lịch sử chat, sổ tay/canvas và dữ liệu học vụ GPA/chương trình/tín chỉ/khóa.
4. Lượt tín chỉ IU ngày 05/11 có bằng chứng nguồn thật, UI Electron và SQLite; phạm vi có thể trình xác nhận riêng theo E13.
5. Bộ kiểm thử và build của bản trước push đã đạt theo E01; tài liệu/phân công/bằng chứng đã được tổng hợp để người nhận kiểm tra.
6. Logo và nhận diện Electron/sidebar/favicon đã có tài nguyên, mã tích hợp và kết quả kiểm tra riêng E16; đầu mối rà soát/bàn giao là Văn Tuấn và Huyền Trang theo tầng.
7. Setup/Portable x64 1.0.0 đã có đầu ra phát hành và kiểm tra runtime/persist/cài đè cục bộ E17; các phần nghiệm thu nguồn thật và máy sạch vẫn xét riêng.

Đây là căn cứ trình nghiệm thu, chưa phải quyết định nghiệm thu toàn bộ. Các phần chỉ được kiểm tra bằng mock/fixture phải được ghi đúng mức bằng chứng khi ký.

### 11.2. Phần chưa đủ căn cứ kết luận đạt toàn bộ

- NT-01 đến NT-05: cần kết quả live/tái kiểm/toàn hành trình và dữ liệu bàn giao theo phạm vi lựa chọn.
- NT-06, NT-07, NT-08, NT-10: phải công bố rõ giới hạn và được người nhận xác nhận; yêu cầu mở rộng cần kế hoạch riêng.
- NT-09: đã có bộ cài và kiểm tra giữ dữ liệu khi cài đè cục bộ; còn nghiệm thu máy sạch và xác nhận bàn giao PB-49/PB-50.
- NT-11, NT-12: tài liệu ảnh EDUX và trường ngày Projects còn việc cần hoàn thiện/xác minh.

Không suy ra còn lỗi trên React chỉ từ audit frontend cũ; cũng không suy ra đã hết mọi lỗi do test tổng đạt. Quyết định cuối cùng cần dựa vào kết quả từng ca, mức ảnh hưởng, phạm vi chấp thuận và bằng chứng kèm theo.

### 11.3. Trạng thái quản lý GitHub khi lập báo cáo

Đã đọc lại GitHub ngày 05/11/2026:

| Đối tượng | Trạng thái | Ý nghĩa trong báo cáo |
| --- | --- | --- |
| Issue Sprint 3 #19–#23 | Cả năm đã đóng; metadata hiện không có assignee. | Giữ nguyên trạng thái lịch sử; phân công tham chiếu tên/nội dung và báo cáo cũ. Không dùng việc đóng issue thay kiểm tra tồn đọng UI/nguồn thật. |
| [Milestone Sprint 3](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/4) | Open; 0 issue mở / 5 issue đóng; due date 29/10/2026. | Milestone còn mở nên có thể hiện quá hạn, độc lập với kết quả mã và quyết định nghiệm thu. |
| Issue Sprint 4 #24–#28 | Cả năm mở; assignee lần lượt vtishan, AnhTuancode-25, longnhatdinhviet8-byte, Tham2007, kieudu-dlst. | Theo dõi rà soát/hoàn thiện/bàn giao của đúng năm người. |
| [Milestone Sprint 4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/3) | Open; 5 issue mở / 0 issue đóng; due date 05/11/2026. | Tỷ lệ đóng issue hiện 0%; không phải phép đo tỷ lệ mã đã triển khai. |

GitHub lưu due date milestone theo ngày, chuẩn hóa 00:00 UTC; giờ chốt 23:59:59 UTC+7 nằm trong mô tả/issue. Không sửa lịch sử commit hoặc tự đánh dấu hoàn thành khi lập báo cáo. Mục trong SPRINT_3.md nói về trạng thái issue ngày 02/11 là snapshot lịch sử khác ngày, không được ghi thành trạng thái hiện tại ngày 05/11.

## 12. Phiếu xác nhận nghiệm thu và bàn giao

### 12.1. Thông tin buổi nghiệm thu

| Trường | Người nghiệm thu điền |
| --- | --- |
| Ngày giờ thực hiện, UTC+7 | ____________________ |
| Revision chính xác của bản chạy | ____________________ |
| Môi trường/thiết bị/cấu hình | ____________________ |
| Dữ liệu: fixture / DB tạm / bản sao / phiên thật và phạm vi | ____________________ |
| Người bàn giao / người nhận / người chứng kiến | ____________________ |
| Các mã S4/TC được chọn trong phạm vi | ____________________ |
| Artifact/biên bản đính kèm | ____________________ |

### 12.2. Xác nhận phần việc của từng thành viên

| Thành viên / issue | Nội dung phải xác nhận | Kết quả, mã ca và bằng chứng | Ngày / chữ ký |
| --- | --- | --- | --- |
| **Văn Tuấn — #24** | Kiến trúc, AI/context, summary/Flashcard, tích hợp, nhận bàn giao nhận diện Electron S4-23 và tổng hợp lỗi/phạm vi bàn giao; xác nhận đóng góp cá nhân kèm PR/commit/biên bản liên quan. | Chưa xác nhận: ____________________ | ____________________ |
| **Anh Tuấn — #25** | Collector/mapping/đối soát IU/EDUX/Outlook, nguồn học liệu và học vụ; công bố dữ liệu thiếu/giới hạn live; xác nhận đóng góp cá nhân. | Chưa xác nhận: ____________________ | ____________________ |
| **Long Nhật — #26** | API/validation/nghiệp vụ/ownership, HTTP integration, lỗi/race/rollback và hợp đồng; xác nhận đóng góp cá nhân. | Chưa xác nhận: ____________________ | ____________________ |
| **Hồng Thắm — #27** | Schema/migration, công thức học vụ, transaction/persist/checkpoint, DB cũ/backup/restore; xác nhận đóng góp cá nhân. | Chưa xác nhận: ____________________ | ____________________ |
| **Huyền Trang — #28** | React/UI/adapter, timer/nháp/lịch sử, sổ tay/canvas/hồ sơ, nhận bàn giao logo sidebar/favicon S4-23, UI/thiết bị và tái kiểm audit; xác nhận đóng góp cá nhân. | Chưa xác nhận: ____________________ | ____________________ |

### 12.3. Quyết định của người nhận nghiệm thu

- [ ] Chấp thuận các hạng mục: ____________________; bằng chứng: ____________________.
- [ ] Chấp thuận có điều kiện các hạng mục: ____________________; điều kiện/đầu mối/hạn bổ sung: ____________________.
- [ ] Chưa chấp thuận các hạng mục: ____________________; lý do/mã lỗi: ____________________.
- [ ] Đã ghi rõ các giới hạn được chấp thuận: nguồn thật, AI, quiz upload, dữ liệu local, thiết bị, một hồ sơ và bộ cài.
- [ ] Đã nhận tài liệu, hướng dẫn chạy/sao lưu, artifact cần thiết và danh sách vấn đề mở.
- [ ] Việc đóng issue/milestone được thực hiện sau quyết định nghiệm thu và đúng phạm vi được xác nhận.

**Người nhận nghiệm thu:** ____________________

**Vai trò:** ____________________

**Ngày / chữ ký:** ____________________

## Phụ lục A. Danh sách tái kiểm 10 phát hiện UI ngày 29/10

Nguồn lịch sử: mục “Những lỗi đã được khắc phục và việc cần xác minh lại” trong [TESTING.md](TESTING.md) và artifact local tests/artifacts/qa-ui-audit-result.json, generatedAt 2026-10-29T07:23:33.788Z. Artifact thuộc frontend cũ, nằm trong thư mục gitignored; việc đọc lại artifact khi viết báo cáo không phải lượt tái kiểm React.

| Mã | Phát hiện tại snapshot cũ | Người chủ trì / phối hợp | Điều kiện cần đạt trên bản nghiệm thu | Kết quả mới |
| --- | --- | --- | --- | --- |
| UI-01 | Drawer mobile không đóng theo ca Escape đã kiểm tra. | Huyền Trang. | Escape đóng drawer đúng trạng thái; focus trở lại vị trí hợp lý, không ảnh hưởng form đang mở. | Chưa tái kiểm: ______ |
| UI-02 | Tab workspace là DIV không có tabindex, không focus được bằng bàn phím. | Huyền Trang. | Tab vào được nhóm tab; thao tác bàn phím đúng và focus nhìn thấy được. | Chưa tái kiểm: ______ |
| UI-03 | Task chấp nhận hạn bằng giờ bắt đầu trong ca audit. | Huyền Trang / Long Nhật. | Kiểm tra quan hệ thời gian theo hợp đồng hiện hành; ca biên đúng phải có assertion/biên bản. Các sửa ngày giờ 04/11 là bằng chứng liên quan, chưa thay ca này. | Chưa tái kiểm: ______ |
| UI-04 | Chuỗi stored XSS trong tiêu đề task đã được thực thi ở frontend cũ. | Huyền Trang / Long Nhật. | Nội dung dữ liệu hiển thị an toàn khi lưu/mở lại; không thực thi script hoặc event handler của chuỗi kiểm thử. | Chưa tái kiểm: ______ |
| UI-05 | Chuỗi stored XSS trong lịch tự học đã được thực thi ở frontend cũ. | Huyền Trang / Long Nhật. | Tạo/lưu/reload lịch bằng dữ liệu thử có ký tự HTML không thực thi nội dung như mã. | Chưa tái kiểm: ______ |
| UI-06 | Chuỗi stored XSS từ tên hồ sơ đã được thực thi trên dashboard cũ. | Huyền Trang / Long Nhật. | Dashboard/profile và vị trí dùng lại tên đều hiển thị dữ liệu an toàn sau reload. | Chưa tái kiểm: ______ |
| UI-07 | Payload forceSave không được backend hỗ trợ; lịch không persist sau reload trong ca audit. | Long Nhật / Huyền Trang, Hồng Thắm. | Payload đúng hợp đồng, bản ghi DB thực sự được lưu và đọc lại sau reload. Phân biệt lỗi cũ forceSave với lỗi className/room đã sửa sau đó. | Chưa tái kiểm: ______ |
| UI-08 | Modal không bẫy focus. | Huyền Trang. | Khi modal mở, Tab/Shift+Tab đi trong modal theo phạm vi đã thống nhất; không lọt vào nội dung nền. | Chưa tái kiểm: ______ |
| UI-09 | Đóng modal không trả focus về phần tử kích hoạt. | Huyền Trang. | Focus trở về nút/phần tử hợp lý sau đóng, kể cả Escape và hoàn tất thao tác. | Chưa tái kiểm: ______ |
| UI-10 | Nhóm tab/lọc thiếu role tabs và aria-selected trong ca audit. | Huyền Trang. | Vai trò, trạng thái lựa chọn và quan hệ điều khiển đúng; có kiểm tra bàn phím và accessibility. | Chưa tái kiểm: ______ |

Không ghi các phát hiện này là lỗi mới đang tồn tại hoặc là lỗi đã sửa hoàn toàn nếu chưa có kết quả mới. Mỗi ca hoàn tất phải dẫn đúng revision và bằng chứng tương ứng.
