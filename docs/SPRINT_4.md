# Sprint 4 — Bản cập nhật toàn diện Smart Study Hub

Tổng hợp bản mã và phân công ngày **02/11/2026** (Asia/Saigon). Sprint 4 kế thừa đủ 18 chức năng của [Sprint 1](SPRINT_1.md), [Sprint 2](SPRINT_2.md), [Sprint 3](SPRINT_3.md), đồng thời ghi nhận các thay đổi sau mốc hoàn thiện 28/10.

- Nhánh bàn giao: [`sprint4/comprehensive-update`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/sprint4/comprehensive-update).
- Mốc main trước bản cập nhật: [`faecc05`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/faecc05). Nhánh mới giữ lịch sử của mốc này; không thay đổi main khi bàn giao.
- Theo dõi trên GitHub: [Milestone Sprint 4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/3), issue #24–#28 đã gán assignee.

Sprint 4 là mốc tổng hợp và bàn giao phiên bản hiện tại. Không gán ngày bắt đầu/kết thúc hay Story Point khi nhóm chưa chốt. Phần có mã triển khai được tách khỏi phần còn cần kiểm chứng; issue mở là nhiệm vụ rà soát/hoàn thiện/nghiệm thu, không khẳng định toàn bộ mã còn chưa làm.

## Mục tiêu và thay đổi so với bản cũ

| Hạng mục | Nền tảng Sprint 1–3 | Bản cập nhật Sprint 4 |
| --- | --- | --- |
| Frontend | JavaScript theo `src/features`, shell/route tự quản lý. | React/Vite, router, pages/components/hooks, adapter API và giao diện thống nhất. |
| API | `API/modules` và `API/shared`. | Routes → controllers → services; validators/middlewares/utils riêng, kiểm tra tương thích route và lỗi nghiệp vụ. |
| Database | Service lớn, module chia theo sprint và bản sao thư mục. | `database/modules`, `migrations`, `shared`, một connection/facade dùng chung; bỏ cấu trúc trùng. |
| Thu thập nguồn | Thư mục IU/EDUX/Outlook ở gốc CRWEB. | `CRWEB/modules/{IU,EDUX,OUTLOOK}` và `CRWEB/shared`, có kiểm tra ranh giới kiến trúc. |
| Desktop và đồng bộ | Các bridge riêng ở cấu trúc cũ. | `electron/main.js`, `preload.js`, `bridges/`; kết nối nguồn độc lập, timeout/hủy, job đồng bộ/progress và khôi phục phiên. |
| Học liệu | Upload tài liệu, sổ tay/PDF cơ bản. | Phạm vi môn IU đang học, chương/slide/ảnh EDUX, cache nguồn, viewer và liên kết công cụ học. |
| AI | Chat/quiz/điểm yếu/kế hoạch/đơn của Sprint 3. | Kiểm tra Unicode/context, tóm tắt dài theo job, retry/cancel, pipeline toàn môn A/B có tiến trình SQLite, flashcard và ôn lại. |
| Ghi chép | Sổ/trang văn bản và nháp. | Sổ tay cấu trúc Tiptap/template/trang con/AI block; vở canvas riêng với đối tượng, bảng, công thức, OCR và export. |
| Bàn giao | Nhiều báo cáo theo đợt/người. | README mới, đúng 4 file báo cáo sprint, tài liệu kỹ thuật tập trung và issue theo từng thành viên. |

## Phạm vi kế thừa theo sprint

| Nguồn công việc | Phần được nâng cấp/kiểm tra trong Sprint 4 | Nhóm backlog liên quan |
| --- | --- | --- |
| Sprint 1: chức năng 1, 2, 3, 4, 9, 18 | Luồng kết nối IU/EDUX, lịch/hồ sơ/điểm, refresh lịch, hạn EDUX, checklist, kỳ thi 70 ngày, xung đột và nhắc nhở. | PB-01…PB-07, PB-11…PB-32. |
| Sprint 2: chức năng 5, 6, 8, 10, 11, 12, 17 | Upload/slide/ảnh/PDF, tìm kiếm/tag, Pomodoro/Time Map/tiến độ, email, sổ tay cấu trúc và vở canvas. | PB-33, PB-35…PB-38, PB-41…PB-45. |
| Sprint 3: chức năng 7, 13, 14, 15, 16 | Gia sư/quiz/điểm yếu/kế hoạch/đơn trên React; context dài, hàng đợi AI, tóm tắt toàn môn và flashcard. | PB-20, PB-23, PB-34, PB-39, PB-40, PB-44. |
| Bàn giao toàn hệ thống | Tương thích API, migration/persist, test hồi quy, hướng dẫn chạy, giới hạn bằng chứng và GitHub. | PB-46…PB-51, trong đó đóng gói bộ cài còn mở. |

Chi tiết tiêu chí PB giữ tại [product_backlog.md](product_backlog.md). Bảng trên là ánh xạ phạm vi, không đánh dấu mọi PB đã hoàn thành.

## Phân công trên GitHub

| Thành viên / tài khoản | Kế thừa vai trò cũ | Trách nhiệm Sprint 4 | Issue |
| --- | --- | --- | --- |
| **Văn Tuấn** — [`vtishan`](https://github.com/vtishan) | Nhóm trưởng, nền tảng IU/Electron, AI và tích hợp. | Kiến trúc toàn hệ thống, bridge/kết nối nguồn, Gemini/context, tóm tắt dài/toàn môn, điều phối test và tài liệu bàn giao. | [#24](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/24) |
| **Anh Tuấn** — [`AnhTuancode-25`](https://github.com/AnhTuancode-25) | Thu thập, giải mã và chuẩn hóa IU/EDUX, dữ liệu AI. | Đối soát IU/EDUX/Outlook, môn đang học, lịch thi, deadline, chương/slide/ảnh; fixture và nghiệm thu nguồn thật. | [#25](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/25) |
| **Long Nhật** — [`longnhatdinhviet8-byte`](https://github.com/longnhatdinhviet8-byte) | API, nghiệp vụ, tích hợp nguồn/AI/DB. | Rà soát API nhiều tầng, validation/lỗi, jobs, workspace/học liệu, transaction/chống lặp và kiểm thử HTTP/frontend–API. | [#26](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/26) |
| **Hồng Thắm** — [`Tham2007`](https://github.com/Tham2007) | Schema/migration, CRUD, quan hệ và persist. | Database module/migration, nâng cấp DB cũ, AI/học liệu/flashcard, rollback/chủ sở hữu và kiểm tra lưu/mở lại. | [#27](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/27) |
| **Huyền Trang** — [`kieudu-dlst`](https://github.com/kieudu-dlst) | Frontend 18 chức năng, UI/UX và nối API. | React/Vite, trang học liệu/slide, sổ tay Tiptap/canvas, trạng thái lỗi/nháp, responsive/bàn phím và bằng chứng UI thật. | [#28](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/28) |

Tên frontend thống nhất là Huyền Trang theo phân công gần nhất; báo cáo/issue cũ có tên Kiều Trang, cùng tài khoản `kieudu-dlst`. Mapping tài khoản đã đối chiếu với issue cũ, contributor và danh sách assignee GitHub. Phân công không sửa tác giả hoặc tạo commit thay cho thành viên.

### Văn Tuấn — kiến trúc, AI và tích hợp

- Rà soát hướng phụ thuộc React → API → database/provider; chốt hợp đồng giữa các tầng và startup Electron/headless.
- Kiểm tra phiên nguồn, progress, timeout/hủy và lỗi từng cổng; phối hợp Anh Tuấn kiểm chứng dữ liệu thật.
- Kiểm tra Unicode, ngân sách context, prompt, đầu ra/schema, tóm tắt dài và pipeline toàn môn; lỗi provider phải giữ kết quả tốt đã lưu.
- Tổng hợp hồi quy 18 chức năng, phân biệt mock/live, quản lý lỗi còn lại và bàn giao README/kiến trúc/sprint.
- Phạm vi: `electron/`, `API/utils/gemini-*`, `API/services/trolyai*`, `ai-summary.service.js`, `course-summary.pipeline.js`, `docs/`.

### Anh Tuấn — dữ liệu và kết nối trường

- Đối chiếu trường nguồn → trường chuẩn → API/DB cho hồ sơ, môn, điểm/học lại, lịch, thi, bài tập và thư.
- Kiểm tra lịch thi UTC+7 trong 70 ngày, phản hồi rỗng hợp lệ, lỗi nguồn/thiếu dữ liệu và giữ cache/lịch tự nhập.
- Kiểm tra EDUX: hạn riêng/học phần, môn IU hiện tại, đầy đủ chương/slide/ảnh, nguồn lỗi và phiên hết hạn.
- Chuẩn bị fixture không chứa thông tin cá nhân; ghi rõ phạm vi live khi có tài khoản trường được cấp quyền.
- Phạm vi: `CRWEB/modules/`, `CRWEB/shared/`, `CRWEB/tests/`, `API/utils/{iu-*,edux-*,current-courses.js,course-material-text.js}`.

### Long Nhật — API và nghiệp vụ

- Kiểm tra route/alias cũ sau refactor, validation ID/ngày/giờ, mã lỗi, chủ sở hữu và response không báo thành công giả.
- Kiểm tra job đồng bộ, trạng thái/refresh, upload byte thật, cache ảnh, notes/notebooks và export.
- Kiểm tra chat/quiz/điểm yếu, lịch xem trước/xác nhận, chống gửi lặp và transaction khi lịch đổi giữa chừng.
- Chạy HTTP/API/AI/frontend–API và hồi quy Sprint 2–3; cập nhật `docs/API.md` và lỗi có bước tái hiện.
- Phạm vi: các tầng `API/`, `API/tests/`, `tests/API/`, `tests/frontend-api-integration.cjs`.

### Hồng Thắm — database và tính toàn vẹn

- Đối soát module/facade, schema và migration; nâng cấp DB Sprint 1–3 giữ dữ liệu cũ, dùng một connection dùng chung.
- Kiểm tra task/checklist, lịch/thi, notes, Pomodoro/email, AI, nguồn học liệu/tóm tắt và lịch sử flashcard.
- Kiểm tra quan hệ, rollback, chống trùng, truy vấn đúng hồ sơ, persist/mở lại và thời gian học không cộng trùng.
- Bàn giao kiểm thử migration/persistence và cách sao lưu DB/thư mục file; chạy trên DB thử riêng.
- Phạm vi: `database/`, `API/tests/database.test.cjs`, các ca lưu/mở lại trong test tích hợp.

### Huyền Trang — React/Vite và trải nghiệm học tập

- Rà soát điều hướng và adapter đủ 18 chức năng; kiểm tra loading/rỗng/lỗi/thử lại, form đang sửa và refresh dữ liệu.
- Hoàn thiện tài liệu theo môn, viewer/slide/PDF/ảnh, ghi chú/bookmark và liên kết sang AI/quiz.
- Kiểm tra sổ tay Tiptap, template/trang con, autosave/nháp và AI preview/chèn block; vở canvas có lưu/export/khôi phục riêng.
- Chạy React test/build, kiểm tra desktop/tablet/mobile, bàn phím/focus, reload, mất mạng và submit lặp; ghi bằng chứng UI thật.
- Phạm vi: `Frontend/src/{pages,components,api,hooks,utils,test}`, `docs/FEATURES.md`.

## Phụ thuộc và cách bàn giao

1. Văn Tuấn chốt kiến trúc/context; Anh Tuấn bàn giao mapping/fixture; Hồng Thắm thống nhất schema và hàm DB.
2. Long Nhật kiểm tra hợp đồng HTTP/nghiệp vụ; Huyền Trang nối UI và phản hồi lỗi có bước tái hiện.
3. Thành viên tạo nhánh `sprint4/<github-login>/<noi-dung>` từ `sprint4/comprehensive-update`; PR về nhánh này, dẫn issue phụ trách.
4. PR ghi vấn đề/hành vi sau sửa, lệnh và kết quả test, mock/live, ảnh khi đổi UI và hạn chế còn lại. Review chéo tầng liên quan.
5. Chỉ tick checklist/đóng issue khi có bằng chứng đạt. Không đóng issue cũ hoặc toàn milestone chỉ vì đã push source.

## Kiểm tra bản bàn giao

Môi trường: Windows, Node.js **24.16.0**, npm **11.13.0**; cài dependency bằng hai lockfile. Các bộ tự động dùng dữ liệu tạm/mock khi cần, không đăng nhập tài khoản trường thật.

| Nhóm | Kết quả mới / nơi xem |
| --- | --- |
| API, contract và database | `test:api`: **95/95 đạt**; nhận diện endpoint ảnh học liệu mới và giữ so sánh đủ route cũ. |
| AI, kế hoạch và học liệu toàn môn | `test:ai`: **74/74 đạt**. |
| Electron, IPC, phiên và đăng nhập | `test:electron`: **31/31 đạt** bằng mock, không mở phiên trường thật. |
| Nguồn học liệu và refresh | `test:course-learning`: **48/48 đạt**. |
| React | **332/332 đạt trong 37 file**, tối đa 2 worker. |
| Frontend–API, build và kiểm tra bàn giao | Kết quả cuối cùng ghi tại [TESTING.md](TESTING.md#xác-minh-bản-bàn-giao-sprint-4--02112026). |

Các nhóm có phần giao nhau, không cộng thành một tổng test duy nhất. Báo cáo mốc 27–30/10 nằm riêng trong TESTING; không chuyển các kết quả live cũ thành kết quả live mới.

## Điều kiện nghiệm thu và phần còn mở

- Clone nhánh mới, cài đủ hai bộ dependency, build và mở Electron/headless theo README; kiểm tra cấu hình API và persist DB.
- Kiểm tra liên tục đồng bộ → lịch/task → tài liệu/ghi chú/Pomodoro → quiz/điểm yếu → kế hoạch; thao tác lưu và tải lại khớp DB.
- Nguồn/AI lỗi, hết phiên, hủy, gửi lặp và xung đột mới không được xóa dữ liệu tốt hoặc tạo bản ghi nửa chừng.
- Nghiệm thu IU/EDUX/Outlook bằng tài khoản được cấp quyền, cùng Gemini thật, vẫn cần lượt riêng; chưa có bằng chứng live mới trong lần bàn giao này.
- Sổ tay canvas và bookmark/tiến độ slide còn dữ liệu cục bộ theo origin; chưa có đồng bộ/cộng tác nhiều máy.
- Ứng dụng dùng một hồ sơ cấu hình; chưa có xác thực/phân quyền nhiều người dùng. Chưa có script tạo bộ cài độc lập; PB-49/PB-50 còn mở.
- UI bàn phím/focus, zoom/screen reader, tablet/stylus/camera thật cần nghiệm thu theo phạm vi; test jsdom không thay thế kiểm tra tương tác trên thiết bị.

## Tài liệu bàn giao

Đúng bốn báo cáo sprint: `SPRINT_1.md`, `SPRINT_2.md`, `SPRINT_3.md`, `SPRINT_4.md`. Các báo cáo cũ được tổng hợp vào những file này và dẫn nguồn bằng commit cố định. Tài liệu chuyên môn tiếp tục ở [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [FEATURES.md](FEATURES.md), [TESTING.md](TESTING.md), [product_backlog.md](product_backlog.md); hướng dẫn bắt đầu nằm trong [README](../README.md).
