# Sprint 4 — Bản cập nhật toàn diện Smart Study Hub

Tổng hợp bản mã và phân công ngày **02/11/2026**, cập nhật triển khai/kiểm thử đến **05/11/2026** (Asia/Saigon). Sprint 4 kế thừa đủ 18 chức năng của [Sprint 1](SPRINT_1.md), [Sprint 2](SPRINT_2.md), [Sprint 3](SPRINT_3.md), đồng thời ghi nhận các thay đổi sau mốc hoàn thiện 28/10.

- Nhánh chính và bản bàn giao mới nhất: [`main`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/main).
- Phiên bản main cũ được lưu ở [`before`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/before), mốc [`faecc05`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/faecc05). Bản cập nhật trên `main` giữ đầy đủ lịch sử của mốc này.
- Theo dõi trên GitHub: [Milestone Sprint 4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/3), issue #24–#28 đã gán assignee.

Sprint 4 là mốc tổng hợp và bàn giao phiên bản hiện tại, diễn ra **30/10–05/11/2026**, báo cáo **thứ Năm 05/11/2026** (UTC+7). Deadline cuối ngày **23:59:59**; không tự gán Story Point. Phần có mã triển khai được tách khỏi phần còn cần kiểm chứng; issue mở là nhiệm vụ rà soát/hoàn thiện/nghiệm thu, không khẳng định toàn bộ mã còn chưa làm.

## Mục tiêu và thay đổi so với bản cũ

| Hạng mục | Nền tảng Sprint 1–3 | Bản cập nhật Sprint 4 |
| --- | --- | --- |
| Frontend | JavaScript theo `src/features`, shell/route tự quản lý. | React/Vite, router, pages/components/hooks, adapter API và giao diện thống nhất. |
| API | `API/modules` và `API/shared`. | Routes → controllers → services; validators/middlewares/utils riêng, kiểm tra tương thích route và lỗi nghiệp vụ. |
| Database | Service lớn, module chia theo sprint và bản sao thư mục. | `database/modules`, `migrations`, `shared`, một connection/facade dùng chung; bỏ cấu trúc trùng. |
| Thu thập nguồn | Thư mục IU/EDUX/Outlook ở gốc CRWEB. | `CRWEB/modules/{IU,EDUX,OUTLOOK}` và `CRWEB/shared`, có kiểm tra ranh giới kiến trúc. |
| Desktop và đồng bộ | Các bridge riêng ở cấu trúc cũ. | `electron/main.js`, `preload.js`, `bridges/`; kết nối nguồn độc lập, timeout/hủy, job đồng bộ/progress và khôi phục phiên. |
| Học liệu | Upload tài liệu, sổ tay/PDF cơ bản. | Phạm vi môn IU đang học, chương/slide/ảnh EDUX, cache nguồn, viewer và liên kết công cụ học. |
| AI | Chat/quiz/điểm yếu/kế hoạch/đơn của Sprint 3. | Kiểm tra Unicode/context; tóm tắt thủ công với n phần song song, hàng đợi từng môn, cache SQLite; flashcard theo lô có thể tạo tiếp và ôn lại. |
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

## Lịch và deadline Sprint 1–4

| Sprint | Thời gian (UTC+7) | Báo cáo thứ Năm / deadline cuối ngày | Milestone |
| --- | --- | --- | --- |
| Sprint 1 | 25/09/2026–15/10/2026 | 15/10/2026, 23:59:59 | [Sprint 1](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/1) |
| Sprint 2 | 16/10/2026–22/10/2026 | 22/10/2026, 23:59:59 | [Sprint 2](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/2) |
| Sprint 3 | 23/10/2026–29/10/2026 | 29/10/2026, 23:59:59 | [Sprint 3](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/4) |
| Sprint 4 | 30/10/2026–05/11/2026 | 05/11/2026, 23:59:59 | [Sprint 4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/3) |

Lịch và deadline được bổ sung theo yêu cầu ngày 05/11/2026. GitHub lưu due date milestone theo ngày (chuẩn hóa 00:00 UTC); giờ chốt cuối ngày UTC+7 được ghi trong từng issue và mô tả milestone. Quy ước cuối ngày 23:59:59 vì chưa có giờ báo cáo cụ thể; không ấn định giờ họp. Đây là lịch kế hoạch, không sửa lùi ngày commit, triển khai, kiểm thử hoặc ngày tổng hợp báo cáo đã ghi nhận. Sprint 1–3 chỉ bổ sung lịch/deadline và liên kết milestone; nhiệm vụ, assignee, checklist và trạng thái issue lịch sử giữ nguyên.

## Phân công trên GitHub

Phân công cập nhật ngày **05/11/2026**, đối chiếu mã hiện tại, `TESTING.md`, `docs/evidence/`, issue gốc và lịch sử `main`. **Mới** là phần bổ sung trong Sprint 4; **nâng cấp** kế thừa Sprint 1–3; **sửa lỗi** có hành vi trước/sau được mô tả; các checklist bên dưới là phần còn phải nghiệm thu. Có mã/test không đồng nghĩa thành viên đã ký nghiệm thu hoặc toàn luồng đã hoàn thành.

| Thành viên / tài khoản | Trách nhiệm Sprint 4 | Issue | Deadline UTC+7 |
| --- | --- | --- | --- |
| **Văn Tuấn** — [`vtishan`](https://github.com/vtishan) | Kiến trúc React/API/DB/Electron; Gemini/context; tóm tắt n phần song song, Flashcard theo lô; tích hợp AI Tutor, Pomodoro/checklist/quiz/ôn thi; điều phối kiểm thử, tài liệu và bàn giao. | [#24](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/24) | 05/11/2026, 23:59:59 |
| **Anh Tuấn** — [`AnhTuancode-25`](https://github.com/AnhTuancode-25) | Nguồn IU/EDUX/Outlook; môn kỳ hiện tại, lịch/thi/deadline và học liệu; điểm P/NP/học lại; tín chỉ, danh mục/chương trình/khối kiến thức và khóa nhập học; fixture và đối soát nguồn thật. | [#25](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/25) | 05/11/2026, 23:59:59 |
| **Long Nhật** — [`longnhatdinhviet8-byte`](https://github.com/longnhatdinhviet8-byte) | API nhiều tầng; jobs đồng bộ/học liệu; lịch/ngày giờ UTC+7; Pomodoro có mục tiêu; checklist/quiz/ôn thi; chat history, học vụ/refresh tín chỉ; validation, ownership, transaction và kiểm thử HTTP. | [#26](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/26) | 05/11/2026, 23:59:59 |
| **Hồng Thắm** — [`Tham2007`](https://github.com/Tham2007) | Database refactor/migration; Pomodoro/checklist/quiz; cache tóm tắt, checkpoint Flashcard và lịch sử chat; GPA/học lại/P/NP; chương trình/tín chỉ/khối IU, khóa nhập học; persist/rollback/chống trùng. | [#27](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/27) | 05/11/2026, 23:59:59 |
| **Huyền Trang** — [`kieudu-dlst`](https://github.com/kieudu-dlst) | React/Vite 18 chức năng; học liệu và hàng đợi; form lịch/ngày giờ; Pomodoro goals; checklist/quiz/ôn thi/Flashcard; AI Tutor và lịch sử chat; sổ tay/canvas; GPA/tín chỉ/chương trình/khóa; kiểm thử UI và hướng dẫn. | [#28](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/28) | 05/11/2026, 23:59:59 |

Giữ nguyên 5 người và assignee #24–#28. Huyền Trang tương ứng tên Kiều Trang trong báo cáo cũ, cùng `kieudu-dlst`. Lịch sử `main` có dấu vết theo tầng: IU [`b2e04b8`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/b2e04b8), API [`deb4447`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/deb4447), database [`570dd33`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/570dd33)/[`e7a5512`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/e7a5512), frontend [`27ac67c`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/27ac67c). Các commit [`7ba8fcf`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/7ba8fcf), [`a10ea60`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/a10ea60), [`1f0be43`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/commit/1f0be43) là các mốc tập hợp/tích hợp; không dùng người commit tích hợp làm bằng chứng tác giả toàn bộ. Đây là phân công trách nhiệm hoàn thiện/kiểm tra/bàn giao; không tạo hay sửa tác giả commit thay thành viên.

### Văn Tuấn — Kiến trúc, AI và tích hợp

- **[Nâng cấp]** Rà soát React/Vite → Express routes/controllers/services → SQLite modules/migrations/shared, crawler theo module và bridge Electron; thống nhất hợp đồng với #25–#28; kết nối IU/EDUX/Outlook, timeout/hủy, khôi phục phiên và tiến trình đồng bộ.
- **[Mới]** Điều phối AI tóm tắt theo nút bấm: hàng đợi môn FIFO; trong một môn chia n phần, mặc định 4 request đồng thời (cấu hình 1–5), ghép đúng thứ tự và giữ phần/cache đã xong khi retry.
- **[Mới / sửa lỗi]** Flashcard theo lô có checkpoint/transaction, tạo tiếp lô thiếu; parse/repair JSON hữu hạn và giảm lô 4 → 2 → 1; giữ tóm tắt tốt khi bước tạo thẻ lỗi. Bản tóm tắt có thể ở dạng dài/theo phần, không còn ép mọi trường hợp thành bản tổng hợp ngắn.
- **[Nâng cấp / sửa lỗi]** Gemini payload/model, Unicode/context, deadline chung và hủy khi HTTP ngắt; phối hợp AI Tutor/dừng chat/lịch sử, AI goals Pomodoro, checklist, quiz có nguồn, ôn thi xem trước/xác nhận và sổ tay AI. Đưa lịch sử học lực/GPA đúng hệ và phạm vi vào context; không tự nhận gợi ý/lưu lịch thay người học.
- **[Bàn giao]** Tổng hợp hồi quy 18 chức năng, README/kiến trúc/4 báo cáo sprint/TESTING và lỗi còn mở; phân biệt test mock, benchmark độ trễ giả lập và kết quả provider thật. Giữ trách nhiệm từng tầng, không quy toàn bộ sản phẩm cho người commit tích hợp.

**Mã đối chiếu:** [`API/utils/course-summary-ai.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/utils/course-summary-ai.js), [`API/utils/course-cards-ai.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/utils/course-cards-ai.js), [`API/services/course-summary.pipeline.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/course-summary.pipeline.js), [`API/utils/gemini-client.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/utils/gemini-client.js), [`API/utils/trolyai-context.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/utils/trolyai-context.js), [`API/services/pomodoro-goals.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/pomodoro-goals.service.js), [`electron/`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/electron/).

**Bằng chứng đã ghi nhận (không phải nghiệm thu toàn bộ):** [`docs/evidence/learning-parallel-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-parallel-tests.json), [`docs/evidence/learning-parallel-benchmark.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-parallel-benchmark.json), [`docs/evidence/learning-recovery-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-recovery-tests.json), [`docs/evidence/learning-recovery-live.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-recovery-live.json), [`docs/evidence/ai-connection-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/ai-connection-audit.json), [`docs/evidence/gpa-iu-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/gpa-iu-audit.json); [`docs/TESTING.md`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/TESTING.md).

**Còn phải nghiệm thu / điều kiện đóng issue:**

- [ ] Nghiệm thu tóm tắt/Flashcard từ môn học thật sau restart API; live tóm tắt còn GEMINI_TIMEOUT, bước Flashcard phụ thuộc bị bỏ qua. Benchmark 2,11 lần chỉ là mô phỏng, không phải tốc độ Gemini thật.
- [ ] Nghiệm thu AI goals/quiz/ôn thi phức tạp và toàn hành trình trên Electron/thiết bị; live trả lời tiếng Việt và 2 câu hỏi JOIN tổng hợp chỉ chứng minh đúng phạm vi đó.
- [ ] Đối chiếu đủ biên bản bàn giao từng tầng; giữ PB-49/PB-50 (bộ cài/phân quyền) và các giới hạn thiết bị còn mở.

### Anh Tuấn — Dữ liệu IU/EDUX/Outlook và học vụ

- **[Nâng cấp]** Đối soát collector CRWEB/modules/{IU,EDUX,OUTLOOK}, mapping nguồn → API → DB; môn IU kỳ hiện tại cho các form, lịch/thi 70 ngày UTC+7, deadline riêng/học phần EDUX, chương/slide/nội dung học và phân trang thư.
- **[Sửa lỗi]** Phân biệt rỗng hợp lệ/lỗi/partial/hết phiên; không xóa cache tốt hoặc lịch tự nhập; dữ liệu học liệu được lưu theo môn trước khi chờ AI, đồng bộ slide không tự tóm tắt. Chuẩn hóa nguồn thực cho quiz/Flashcard và context AI, không nhận đã trích xuất các định dạng chưa hỗ trợ.
- **[Sửa lỗi học vụ]** Giữ điểm gốc hệ 4, P/NP và lần học/thi; học phần đọc từ rsChiTiet thay danh sách chọn chương trình. Lấy tổng chương trình từ rsDiemTrungBinhChung[].TONGSOTINCHICTDT đúng dòng tổng; phân biệt tín chỉ bảng điểm, tổng chương trình, tổng khối và bắt buộc, không gán cứng 126/129/203.
- **[Mới / nâng cấp]** Đối soát danh mục học phần theo sinh viên/chương trình, provenance tổng tín chỉ, khối kiến thức IU và đồng bộ tín chỉ riêng có kiểm tra mã sinh viên; phối hợp #26–#28 giữ nguyên bảng điểm/lịch/hồ sơ ngoài phạm vi cập nhật.
- **[Sửa lỗi]** Bỏ năm nhập học 2023/học kỳ cố định; mã CMC đúng định dạng lấy YY làm khóa nhập học (ví dụ BSE25… → 2025); mã khác chỉ dùng năm nguồn cung cấp. Không suy đoán khóa từ danh sách môn.
- **[Kiểm thử / bàn giao]** Bàn giao fixture đã loại dữ liệu cá nhân, mapping nguồn và giới hạn live; phối hợp #27 đối soát công thức GPA và #28 hiển thị học vụ. Luồng tín chỉ IU ngày 05/11 đã có bằng chứng phiên thật, Electron và SQLite, chỉ cho hồ sơ/phạm vi đó.

**Mã đối chiếu:** [`CRWEB/modules/IU/data/fetch.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/CRWEB/modules/IU/data/fetch.js), [`CRWEB/modules/IU/data/maps.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/CRWEB/modules/IU/data/maps.js), [`CRWEB/modules/IU/data/program.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/CRWEB/modules/IU/data/program.js), [`CRWEB/modules/EDUX/data/index.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/CRWEB/modules/EDUX/data/index.js), [`API/utils/current-courses.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/utils/current-courses.js), [`API/utils/iu-client.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/utils/iu-client.js), [`database/shared/student-identity.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/shared/student-identity.js).

**Bằng chứng đã ghi nhận (không phải nghiệm thu toàn bộ):** [`docs/evidence/learning-queue-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-queue-tests.json), [`docs/evidence/gpa-iu-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/gpa-iu-audit.json), [`docs/evidence/iu-curriculum-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-curriculum-audit.json), [`docs/evidence/iu-credit-refresh.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-credit-refresh.json); [`docs/TESTING.md`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/TESTING.md).

**Còn phải nghiệm thu / điều kiện đóng issue:**

- [ ] Nghiệm thu lại toàn luồng IU/EDUX/Outlook: hết phiên, mất mạng, nguồn partial, ảnh/slide và quyền tenant; không suy ra tất cả đã đạt từ lần đồng bộ tín chỉ.
- [ ] Đối chiếu GPA/học lại/P/NP/khóa trên các hồ sơ khác sau restart và sync; audit GPA ban đầu không phải đối chiếu portal live đã đăng nhập.
- [ ] Bổ sung biên bản Outlook live và đối chiếu nguồn quiz/PDF/DOCX/PPTX/ảnh; hiện quiz upload mới đọc TXT/Markdown, chưa có trích xuất các định dạng còn lại.

### Long Nhật — API, nghiệp vụ và kiểm thử tích hợp

- **[Nâng cấp]** Rà soát routes/controllers/services/validators/middlewares và tương thích route/alias; API đồng bộ/learning catalog/jobs FIFO, gộp yêu cầu, partial/retry, upload/download và notes/notebooks/export.
- **[Sửa lỗi]** Validation ID/chủ sở hữu, 400/404/409 và response không báo thành công giả; lịch tự học không nhận className/room, chặn tạo/dời lịch quá khứ, tính giờ trống theo UTC+7 và kiểm tra lại xung đột/ngày giờ khi xác nhận kế hoạch.
- **[Mới / nâng cấp]** API Pomodoro có môn/việc/mục tiêu, nhịp 15/25/50, learningContext/checklist, kết quả và học tiếp; xác thực việc thuộc hồ sơ, lưu phiên + hoàn thành việc cùng transaction, idempotent theo ID; AI goals không vượt thời lượng và phân biệt ID EDUX/học vụ.
- **[Mới / nâng cấp]** Checklist AI có bản nháp sửa trước lưu batch với doneWhen/estimatedMinutes; quiz theo nguồn/provenance thực, số câu/độ khó và server chấm; ôn thi cho sửa/xóa buổi trước xác nhận, kiểm tra lại lịch và rollback; điểm trước/sau từ 2 quiz đã nộp gần nhất.
- **[Nâng cấp / sửa lỗi]** AI Tutor nhận ngữ cảnh môn/slide/việc/kỳ thi; GET danh sách/chi tiết hội thoại đúng hồ sơ, chỉ lưu lượt trả lời thành công, truyền cancel/deadline. API profile/progress/context dùng chung GPA; API cập nhật tín chỉ riêng kiểm tra sinh viên, gộp yêu cầu và giữ dữ liệu ngoài phạm vi.
- **[Kiểm thử / bàn giao]** Chạy contract/API/AI/frontend–API, hồi quy Sprint 2–3, HTTP/SQLite tạm, race/cancel/retry/rollback; cập nhật docs/API.md, bước tái hiện và giới hạn nguồn/AI.

**Mã đối chiếu:** [`API/services/workspace.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/workspace.service.js), [`API/services/thoikhoabieu.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/thoikhoabieu.service.js), [`API/services/quiz-source.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/quiz-source.service.js), [`API/services/quiz.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/quiz.service.js), [`API/services/baitap.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/baitap.service.js), [`API/services/trolyai-schedule.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/trolyai-schedule.service.js), [`API/services/hoithoai.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/hoithoai.service.js), [`API/services/progress.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/progress.service.js), [`API/services/dongbo.service.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/services/dongbo.service.js), [`API/tests/`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/tests/), [`tests/frontend-api-integration.cjs`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/tests/frontend-api-integration.cjs).

**Bằng chứng đã ghi nhận (không phải nghiệm thu toàn bộ):** [`docs/evidence/learning-flows-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-flows-tests.json), [`docs/evidence/learning-queue-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-queue-tests.json), [`docs/evidence/ai-connection-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/ai-connection-audit.json), [`docs/evidence/ai-history-ui.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/ai-history-ui.json), [`docs/evidence/iu-credit-refresh.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-credit-refresh.json); [`docs/TESTING.md`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/TESTING.md).

**Còn phải nghiệm thu / điều kiện đóng issue:**

- [ ] Nghiệm thu HTTP → UI → persist trên Electron sau restart với nguồn thật, kiểm tra submit lặp, lịch đổi giữa lúc AI xử lý và lỗi provider; không đóng issue chỉ vì mock pass.
- [ ] Giữ giới hạn quiz PDF/DOCX/PPTX/ảnh tải lên chưa trích xuất, hàng đợi RAM không tồn tại qua restart, đăng nhập/phân quyền nhiều người chưa triển khai.
- [ ] Đối chiếu API.md và biên bản chéo #25/#27/#28; kiểm thử dữ liệu thật ngoài luồng tín chỉ vẫn cần lượt riêng.

### Hồng Thắm — Database, migration, GPA và toàn vẹn

- **[Nâng cấp]** Rà soát database modules/migrations/shared/facade và một connection; migration cộng thêm giữ hồ sơ/lịch/điểm/task/AI Sprint 1–3, index/quan hệ/chủ sở hữu và dữ liệu notes/notebooks/email/học liệu.
- **[Mới]** PomodoroSessions.learning_context giữ mục tiêu, kết quả, checklist microGoals và phần học tiếp; Checklists.estimated_minutes/done_when, AiQuizzes.source_json; lưu phiên/hoàn thành việc và lưu checklist batch bằng transaction, không cộng trùng phút khi gửi lại.
- **[Nâng cấp / sửa lỗi]** Cache summary v3/phần đã xong; LearningCardBatches và thẻ/checkpoint cùng transaction, giữ lô tốt khi lỗi, resume/dedup; lịch sử ôn Flashcard và hội thoại AI sống qua mở lại DB; canvas/bookmark cục bộ không được mô tả là đã đồng bộ SQLite.
- **[Sửa lỗi GPA]** Dùng chung summarizeGrades cho profile/progress/context: phân biệt hệ 10/4 và tổng/tích lũy, giữ điểm hệ 4 gốc, P/NP ngoài GPA, lần học/thi theo thứ tự, chọn kết quả hoàn tất mới nhất; giữ lịch sử, migration/sync lại không tạo trùng.
- **[Mới / sửa lỗi học vụ]** Schema danh mục/chương trình/khối kiến thức theo sinh viên, total_credits và provenance; giữ môn chưa có điểm/0/null tín chỉ; không cộng tổng khối thành tổng chương trình. Migration khóa nhập học sửa năm 2023 theo mã CMC, chạy lại an toàn và giữ ID/hồ sơ.
- **[Kiểm thử / bàn giao]** Kiểm tra rollback, truy vấn đúng hồ sơ, DB cũ → mới, đóng/mở DB, sync lặp và ghi lỗi; hướng dẫn sao lưu DB/thư mục file. Bằng chứng tín chỉ ngày 05/11 có đọc lại SQLite thật, không đại diện toàn bộ migration trên mọi DB.

**Mã đối chiếu:** [`database/migrations/learningMigration.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/migrations/learningMigration.js), [`database/migrations/workspaceMigration.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/migrations/workspaceMigration.js), [`database/migrations/academicMigration.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/migrations/academicMigration.js), [`database/migrations/curriculumMigration.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/migrations/curriculumMigration.js), [`database/migrations/studentIdentityMigration.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/migrations/studentIdentityMigration.js), [`database/shared/academic-results.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/shared/academic-results.js), [`database/shared/student-identity.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/shared/student-identity.js), [`database/modules/iuSync.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/modules/iuSync.js), [`database/modules/profile.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/database/modules/profile.js), [`API/tests/database.test.cjs`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/API/tests/database.test.cjs).

**Bằng chứng đã ghi nhận (không phải nghiệm thu toàn bộ):** [`docs/evidence/learning-recovery-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-recovery-tests.json), [`docs/evidence/learning-parallel-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-parallel-tests.json), [`docs/evidence/gpa-iu-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/gpa-iu-audit.json), [`docs/evidence/iu-curriculum-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-curriculum-audit.json), [`docs/evidence/iu-credit-refresh.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-credit-refresh.json); [`docs/TESTING.md`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/TESTING.md).

**Còn phải nghiệm thu / điều kiện đóng issue:**

- [ ] Nghiệm thu nâng cấp bản sao DB Sprint 1–3, backup/restore và đối chiếu schema/persist trên hồ sơ người dùng; test SQLite tạm không tự chứng minh mọi DB đã được nâng cấp.
- [ ] Đối soát GPA/P/NP/học lại, tín chỉ và khóa nhập học sau restart/sync trên các trường hợp ngoài hồ sơ đã thử; không gán tổng chương trình hoặc điểm cho dữ liệu thiếu.
- [ ] Kiểm tra ghi đồng thời/hai cửa sổ, gián đoạn lưu và phạm vi dữ liệu còn localStorage; đồng bộ/cộng tác nhiều máy và phân quyền nhiều người vẫn mở.

### Huyền Trang — React/Vite và trải nghiệm học tập

- **[Nâng cấp]** React/Vite/router/pages/components/hooks/API adapter và giao diện 18 chức năng; đồng bộ/email/thống kê, loading/rỗng/lỗi/retry. Các form chọn môn kỳ hiện tại, giữ môn cũ khi sửa, hướng dẫn đồng bộ khi chưa có kỳ.
- **[Nâng cấp / sửa lỗi]** Kho tài liệu/slide/PDF/ảnh, tìm/tag/ghi chú/bookmark, metadata học kỳ và chưa phân loại; polling job nền cập nhật số chương/slide, giữ catalog khi mạng lỗi. LearningQueue gọn, chi tiết/thu gọn và tiến trình phần/lô thực, không tự gọi AI khi mở trang/poll/đồng bộ.
- **[Sửa lỗi]** Form lịch tự học gửi đúng trường, nút tab không submit; validation ngày/giờ UTC+7 khi lưu cho lịch/task/thi/ôn thi/AI planning, tìm giờ trống và ngày sinh; giữ sửa thông tin lịch sử khi không đổi ngày/hạn.
- **[Mới / nâng cấp]** Pomodoro có môn/việc/mục tiêu/nhịp học/cảnh báo lịch, pause/nháp/reload, kết quả/học tiếp/ôn lại, chia phút qua nửa đêm; AI goals cho nhận checklist chủ động. Checklist AI sửa trước lưu; quiz chọn nguồn/số câu/độ khó, ôn thi chỉnh từng buổi, điểm cần cải thiện có hành động luyện lại.
- **[Mới / nâng cấp]** Flashcard lọc môn/chương/chủ đề, ưu tiên thẻ đến hạn/again và Ôn 5 phút; AI Tutor nhận ngữ cảnh, chọn kỳ thi, hủy/giữ nháp, vùng đọc và ngăn lịch sử tìm không dấu/khôi phục đúng conversationId, tạo mới không xóa lịch sử.
- **[Nâng cấp]** Sổ tay Tiptap/template/trang con/autosave/nháp/AI preview/chèn block; canvas bút/tẩy/đối tượng/bảng/công thức/OCR/import/export và phục hồi localStorage, ghi rõ giới hạn lưu theo origin.
- **[Sửa lỗi / mới]** Hồ sơ hiển thị riêng GPA tổng/tích lũy hệ 10/4, so sánh kỳ; catalog học phần/chương trình/khối/tín chỉ bắt buộc và nút Đồng bộ tín chỉ IU, refresh sau sync; khóa nhập học từ mã CMC thay 2023. Kiểm thử React/build, desktop/mobile, bàn phím/focus/reload và cập nhật docs/FEATURES.md.

**Mã đối chiếu:** [`Frontend/src/pages/`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/pages/), [`Frontend/src/components/learning/`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/components/learning/), [`Frontend/src/components/schedule/ScheduleEditor.jsx`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/components/schedule/ScheduleEditor.jsx), [`Frontend/src/pages/AITutor/ConversationHistory.jsx`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/pages/AITutor/ConversationHistory.jsx), [`Frontend/src/components/profile/useIuCredits.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/components/profile/useIuCredits.js), [`Frontend/src/utils/studentAdapter.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/utils/studentAdapter.js), [`Frontend/src/utils/planning.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/utils/planning.js), [`Frontend/src/utils/pomodoro.js`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/utils/pomodoro.js), [`Frontend/src/test/`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/Frontend/src/test/).

**Bằng chứng đã ghi nhận (không phải nghiệm thu toàn bộ):** [`docs/evidence/learning-flows-tests.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-flows-tests.json), [`docs/evidence/learning-queue-ui.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/learning-queue-ui.json), [`docs/evidence/ai-tutor-layout.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/ai-tutor-layout.json), [`docs/evidence/ai-history-ui.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/ai-history-ui.json), [`docs/evidence/gpa-iu-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/gpa-iu-audit.json), [`docs/evidence/iu-curriculum-audit.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-curriculum-audit.json), [`docs/evidence/iu-credit-refresh.json`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/evidence/iu-credit-refresh.json); [`docs/TESTING.md`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/blob/main/docs/TESTING.md).

**Còn phải nghiệm thu / điều kiện đóng issue:**

- [ ] Nghiệm thu trực tiếp Pomodoro/form ngày giờ và hành trình đầy đủ sau build trên Electron/thiết bị; UI fixture/jsdom không thay kiểm tra nguồn/provider thật. UI tín chỉ đã có quan sát Electron trong phạm vi riêng ngày 05/11.
- [ ] Tái kiểm bàn phím/focus, zoom 200%, screen reader, tablet/stylus/camera; OCR chữ viết tay/toán và mọi lỗi audit UI cũ chưa được nghiệm thu đủ.
- [ ] Xác nhận giới hạn canvas/bookmark/tiến độ slide còn theo origin, chưa đồng bộ nhiều máy; quiz upload PDF/DOCX/PPTX/ảnh chưa trích xuất. Bàn giao ảnh/biên bản UI và hướng dẫn đúng phạm vi.

### Phạm vi live và Projects

Bằng chứng mới nhất [iu-credit-refresh.json](evidence/iu-credit-refresh.json) xác nhận ngày **05/11/2026** đã đồng bộ tín chỉ với phiên IU thật, nhìn thấy 129 tín chỉ bắt buộc trên Electron và đọc lại SQLite; tổng chương trình 126, tổng khối 203, tích lũy theo khối 28 và bảng điểm 25 là số liệu của hồ sơ thử đó, không phải hằng số sản phẩm. Bằng chứng này cập nhật giới hạn của lượt curriculum trước, không thay ngày/kết quả audit cũ và không nghiệm thu thay toàn bộ IU/EDUX/Outlook hoặc GPA trên mọi hồ sơ. AI thật ngày 04/11 trả lời tiếng Việt và tạo 2 câu hỏi JOIN tổng hợp thành công; tóm tắt dài và chia mục tiêu vẫn timeout, thẻ sau tóm tắt bị bỏ qua.

GitHub Projects: API hiện thiếu scope `read:project`/`project`, nên chưa xác định được Project liên kết và chưa cập nhật trường ngày. Lượt kiểm tra UI bị Computer Use dừng vì trình duyệt Cốc Cốc chưa hỗ trợ kiểm soát URL; không kết luận repository không có Project. Ngày đã được đồng bộ vào milestone và từng issue; phần trường ngày Projects còn cần phiên/quyền hỗ trợ. Biên bản đọc lại GitHub: [github-sprint-sync.json](evidence/github-sprint-sync.json).

## Phụ thuộc và cách bàn giao

1. Văn Tuấn chốt kiến trúc/context; Anh Tuấn bàn giao mapping/fixture; Hồng Thắm thống nhất schema và hàm DB.
2. Long Nhật kiểm tra hợp đồng HTTP/nghiệp vụ; Huyền Trang nối UI và phản hồi lỗi có bước tái hiện.
3. Thành viên tạo nhánh `feature/<github-login>/<noi-dung>` từ `main`; PR về `main`, dẫn issue phụ trách. Nhánh `before` lưu bản cũ để đối chiếu.
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

## Cập nhật chỉnh sửa — 04/11/2026

### Sửa lỗi không lưu được lịch tự học

- **Hiện tượng:** khi thêm hoặc sửa lịch tự học, form báo “Chưa lưu được lịch — Trường className không được hỗ trợ.”
- **Nguyên nhân:** `ScheduleEditor` gửi toàn bộ dữ liệu form, bao gồm `className` và `room` của tiết trên lớp, đến API lịch tự học. Bộ kiểm tra dữ liệu lịch tự học từ chối các trường ngoài hợp đồng.
- **Chỉnh sửa:** chỉ gửi các trường tự học được hỗ trợ khi thêm/sửa; tạo tiết trên lớp gửi riêng môn, lớp, phòng, giờ, khoảng ngày và thứ trong tuần. Nút chuyển tab được đặt `type="button"` để chuyển loại lịch không tự gửi form.
- **Tệp thay đổi:** [ScheduleEditor.jsx](../Frontend/src/components/schedule/ScheduleEditor.jsx), [ui.jsx](../Frontend/src/components/common/ui.jsx); thêm [schedule-editor.test.jsx](../Frontend/src/test/schedule-editor.test.jsx).
- **Xác minh:** 54/54 kiểm thử liên quan trong 4 file đạt; build frontend thành công. Bốn ca hồi quy mới bao phủ thêm lịch chưa phân loại, sửa lịch và loại trừ chính lịch đó khi kiểm tra trùng, chuyển từ tiết trên lớp về tự học, tạo tiết trên lớp vào Chủ Nhật.
- **Phạm vi bằng chứng:** React/Vitest/jsdom với adapter API giả lập; chưa kiểm tra lại trực tiếp trên Electron hoặc nguồn trường thật. Lệnh và kết quả được ghi tại [TESTING.md](TESTING.md#xác-minh-sửa-lỗi-thời-khóa-biểu--04112026).

### Rà soát lỗi ngày/giờ trên giao diện

Rà soát các form nhập ngày/giờ sau phản ánh “ngày đã qua rồi thì xếp lịch làm gì nữa”. Các lỗi dưới đây đã được sửa; thời điểm đối chiếu dùng UTC+7 và được kiểm tra lại khi gửi form, kể cả khi form mở lâu.

| Mã | Màn hình và lỗi trước sửa | Hành vi sau sửa |
| --- | --- | --- |
| TIME-01 | Thời khóa biểu cho thêm/dời lịch tự học hoặc tiết trên lớp vào ngày đã qua, hoặc giờ đã bắt đầu hôm nay. Giờ mặc định 19:00 cũng có thể đã qua. | Giới hạn ngày/giờ và kiểm tra khi lưu; API từ chối tạo/dời lịch quá khứ với HTTP 400. Lịch mới chọn giờ mặc định còn ở tương lai, chuyển sang hôm sau khi hết khung học. |
| TIME-02 | Form công việc cho tạo hạn hoàn thành trong quá khứ. | Tạo mới hoặc đổi hạn phải chọn thời điểm sau hiện tại. Vẫn sửa được mô tả của công việc quá hạn khi giữ nguyên hạn cũ. |
| TIME-03 | Form kỳ thi cho tạo giờ thi quá khứ; mặc định hôm nay 08:00 có thể đã qua. Mục “Sắp tới” chỉ xét ngày nên còn hiện kỳ thi đã bắt đầu hôm nay. | Kiểm tra cả ngày và giờ; ngày mặc định chuyển sang hôm sau nếu 08:00 đã qua. Kỳ thi đã bắt đầu chuyển khỏi “Sắp tới”, vẫn xem được ở “Tất cả”. |
| TIME-04 | Có thể bấm “Lên lịch ôn” cho kỳ thi đã bắt đầu; form thiếu kiểm tra ngày ôn quá khứ và có thể gửi ngày kết thúc sau ngày thi khi bỏ qua kiểm tra HTML. | Khóa thao tác ôn cho kỳ thi đã bắt đầu/chưa có giờ hợp lệ. Khi lưu, kiểm tra lại giờ thi và khoảng ôn: từ hôm nay, kết thúc không trước bắt đầu và không sau ngày thi. |
| TIME-05 | Tìm giờ trống nhận ngày quá khứ, trả cả giờ đã qua hôm nay; kết quả cũ còn hiện khi đổi ngày/thời lượng. | Chặn ngày cũ ở UI/API; cắt khoảng trống hôm nay từ phút kế tiếp và giữ đủ thời lượng yêu cầu. Đổi tiêu chí tìm kiếm sẽ ẩn kết quả cũ. |
| TIME-06 | Tùy chọn lập kế hoạch AI thiếu kiểm tra tại UI: ngày quá khứ, khoảng ngày/giờ đảo ngược, khung giờ hôm nay đã hết hoặc thời lượng không hợp lệ. | Báo lỗi trước khi gọi AI và giữ nội dung để sửa/thử lại; ngày mặc định theo UTC+7. API AI sẵn có vẫn kiểm tra khoảng trống và thời điểm trước khi xác nhận lưu. |
| TIME-07 | Hồ sơ cho chọn và gửi ngày sinh ở tương lai. | Giới hạn đến ngày hiện tại và kiểm tra lại trước khi gửi cập nhật hồ sơ. Ngày sinh là trường tùy chọn. |

Lịch sử lớp học, lịch tự học, kỳ thi và deadline đã lưu vẫn được giữ để tra cứu. Sửa ghi chú/thông tin với ngày giờ cũ không tạo lịch mới; nếu đổi lịch hoặc hạn thì phải chọn thời điểm tương lai. Bộ lọc theo deadline và ngày trong công cụ soạn đơn nghỉ vẫn nhận ngày cũ để phục vụ tra cứu/soạn bổ sung.

**Phạm vi mã:** các form `ScheduleEditor`, `TaskEditor`, `ExamEditor`/`StudyPlanEditor`, `AITutor`, `ProfileEditModal`/`Profile`; trang tìm giờ trống; tiện ích `Frontend/src/utils/planning.js`, `aiAdapter.js`; validator/service thời khóa biểu và `API/utils/planning-time.js`. Chặn phía API được bổ sung cho tạo/dời lịch và tìm giờ trống; các form còn lại kiểm tra tại UI. Không sửa dữ liệu lịch sử hiện có.

**Bằng chứng:** toàn bộ frontend **367/367 đạt trong 40 file**, API **107/107 đạt**, build frontend thành công. Kiểm thử gồm hồi quy form và ranh giới UTC+7; HTTP qua Express và SQLite tạm cho lịch học/giờ trống. Chi tiết lệnh và phạm vi ghi tại [TESTING.md](TESTING.md#rà-soát-ngàygiờ-trên-giao-diện--04112026).

### Pomodoro: sửa bố cục và bảo vệ kết quả học

Sau phản ánh màn hình Pomodoro ngày 04/11, đã tự rà soát bố cục và các luồng bắt đầu, tạm dừng, chuyển trang/reload, hoàn thành, lưu và thử lại khi lỗi.

| Mã | Vấn đề | Chỉnh sửa |
| --- | --- | --- |
| POMO-01 | Ảnh minh họa, đồng hồ và khoảng trống quá lớn; ở cửa sổ thấp, nút bắt đầu/lưu bị đẩy xuống dưới. Xác nhận lưu là một card phía dưới lưới. | Bố cục riêng cho Pomodoro, thu gọn ảnh và cỡ giờ, gom nút điều khiển; chuyển xác nhận lưu thành hộp thoại. Lịch sử có vùng cuộn riêng; bố cục một cột ở màn hình hẹp. |
| POMO-02 | Đổi chế độ hoặc đặt lại xóa ngay phiên chưa lưu. | Tạm dừng và cho chọn giữ phiên, lưu rồi tiếp tục, hoặc chủ động bỏ phiên chưa lưu. |
| POMO-03 | `endTime` lấy lúc bấm xác nhận, kéo dài sang cả thời gian chờ lưu. | Kết thúc tại cuối khoảng tập trung cuối cùng. Giây thực học vẫn loại trừ pause/nghỉ/chờ xác nhận. Lưu lỗi giữ phiên và ID để thử lại. |
| POMO-04 | Thống kê hôm nay lấy ngày bắt đầu và cộng toàn bộ phiên, sai với phiên qua nửa đêm. | Cắt từng khoảng tập trung theo ngày UTC+7; chỉ cộng phần thuộc hôm nay. Hiển thị rõ số phiên đã lưu và phút thực học. |
| POMO-05 | Bản nháp lưu trong trình duyệt không kiểm tra đầy đủ các khoảng thời gian; bản nháp lỗi có thể làm phiên không lưu được. | Kiểm tra thời điểm/khoảng tập trung khi phục hồi; bản nháp hỏng bị bỏ qua. Phiên đã hết giờ khi rời trang chỉ ghi đến hạn kết thúc, không cộng thời gian vắng mặt sau đó. |
| POMO-06 | Lưu/xóa lịch sử không thông báo cho các vùng dữ liệu workspace cần làm mới; trạng thái rỗng chưa hướng dẫn bước tiếp theo. | Phát `workspace-updated` sau lưu/xóa; bổ sung trạng thái phiên và hướng dẫn bắt đầu/lưu ở lịch sử trống. |

Phạm vi lượt sửa bố cục ban đầu: `Frontend/src/components/learning/PomodoroTimer.jsx`, stylesheet riêng `PomodoroTimer.css`, tiện ích `Frontend/src/utils/pomodoro.js`. Lượt này chưa đổi schema; lần nâng cấp có mục tiêu bên dưới bổ sung dữ liệu và giữ lịch sử cũ.

Xác minh: **376/376 kiểm thử frontend**, **19/19 kiểm thử tích hợp HTTP**, build thành công. Đã thấy lỗi bố cục ở Electron trước sửa; kiểm tra trực tiếp bản build mới dừng theo phím Escape của người dùng, nên chưa có xác nhận trực quan sau sửa. Chi tiết tại [TESTING.md](TESTING.md#pomodoro-bố-cục-và-phiên-tập-trung--04112026).

### Pomodoro có mục tiêu — đã triển khai

Sau khi người dùng chấp thuận, đã triển khai cả ba nhóm nâng cấp ngày 04/11/2026. Luồng sử dụng: **chọn môn/công việc → đặt mục tiêu nhỏ → chọn nhịp học → tập trung → ghi nhận kết quả → ôn lại hoặc học tiếp**. Vẫn có thể bắt đầu phiên tự học khi chưa chọn môn/công việc.

| Hạng mục | Hành vi hiện tại | Công dụng cho người dùng |
| --- | --- | --- |
| Môn/công việc và mục tiêu | Chọn môn, việc cá nhân hoặc bài tập EDUX chưa hoàn thành; gợi ý tối đa 3 việc gần hạn, nhập mục tiêu tối đa 300 ký tự. Mục tiêu được khóa trong phiên và phục hồi cùng đồng hồ khi chuyển trang/reload. | Bắt đầu từ một việc rõ ràng, ví dụ “Hoàn thành 3 bài JOIN”; không phải tìm lại việc đang làm sau khi đổi trang. |
| Nhịp học và lịch | Các nhịp tập trung/nghỉ 15/3, 25/5, 50/10 phút. Trước khi bắt đầu/tiếp tục, đối chiếu giờ hiện tại UTC+7 với lịch lớp và lịch thi trong hai ngày; dữ liệu quá 60 giây được tải lại. Nếu trùng, hiển thị lịch và nhịp ngắn hơn phù hợp khi có; người dùng quyết định quay lại hoặc vẫn bắt đầu. Không tự chạy phiên tiếp theo. | Chọn độ dài theo việc nhỏ/học sâu và tránh bắt đầu phiên sát giờ học/thi. Thiếu lịch được thông báo rõ; EDUX tải chậm không chặn đồng hồ. |
| Kết quả và công việc hoàn thành | Khi lưu, chọn chưa đánh giá/đã đạt mục tiêu/cần học tiếp, ghi kết quả và bước tiếp theo. Chỉ hiện lựa chọn hoàn thành công việc khi đã đạt mục tiêu và có việc liên kết; checkbox mặc định không chọn. | Phân biệt thời gian đã học với kết quả tự xác nhận. Chỉ cập nhật việc hoàn thành khi người dùng chủ động chọn. |
| Lịch sử, học tiếp và thống kê | Lịch sử có mục tiêu, môn, tên việc, kết quả, ghi chú và phần còn lại; lọc theo môn. Tổng thực học và số mục tiêu đạt theo môn trong tuần hiện tại (thứ Hai–Chủ Nhật, UTC+7). Có nút lấy phần còn lại làm mục tiêu phiên sau; không nhắc lại mục tiêu/bước tiếp theo mà phiên mới hơn đã ghi đạt. Một mục tiêu khác trên cùng công việc không tự xóa phần chưa xong. | Biết đã học gì, môn nào đang được dành thời gian và bước cụ thể để tiếp tục. Không suy diễn mức độ hiểu bài từ số phút. |
| Ôn lại sau phiên | Nút ôn flashcard chuyển sang thẻ đúng tên môn; nếu chưa có thẻ thì báo rỗng. Nút quiz điền sẵn môn và mục tiêu vào form tạo quiz. Người dùng vẫn bấm tạo quiz/xác nhận thao tác học. | Chuyển từ tập trung sang tự kiểm tra kiến thức mà không nhập lại ngữ cảnh; không tự gọi AI hoặc tự tạo kết quả quiz. |

**Lưu trữ và toàn vẹn:** migration cộng thêm `PomodoroSessions.learning_context` dạng JSON với giá trị mặc định `{}`; dữ liệu cũ vẫn đọc được. API kiểm tra độ dài/kết quả, xác nhận chủ sở hữu công việc và lấy tên môn/việc chuẩn từ DB. Lưu phiên và thao tác hoàn thành việc nằm trong cùng transaction; lỗi sẽ rollback cả hai. Gửi lại cùng `id` trả bản ghi đầu tiên, không tạo phiên trùng hoặc ghi đè kết quả cũ. Trạng thái EDUX ở đây là theo dõi trong Smart Study Hub, không thực hiện nộp bài lên trường.

**Mã liên quan:** `PomodoroTimer.jsx`/`.css`, `usePomodoroPlan.js`, `utils/pomodoro.js`, `Learning.jsx`, `QuizPanel.jsx`; `workspace.service.js`, `workspace.validator.js`, `workspaceMigration.js`. Hợp đồng bổ sung và lệnh kiểm chứng được ghi tại [API.md](API.md#pomodoro-có-mục-tiêu--04112026) và [TESTING.md](TESTING.md#nâng-cấp-pomodoro-có-mục-tiêu--04112026).

**Xác minh bản nâng cấp:** **116/116 API**, **391/391 frontend trong 43 file**; kiểm tra lại **38/38 ca liên quan** sau các điều chỉnh cuối và build production thành công. Chưa nghiệm thu trực tiếp bản nâng cấp trên Electron/thiết bị thật. Cần khởi động lại ứng dụng để nạp API mới và chạy migration; dữ liệu cũ được giữ.

### Pomodoro: môn kỳ hiện tại và AI chia nhỏ mục tiêu

Bổ sung theo phản hồi tiếp theo ngày 04/11/2026 về danh sách môn và ô **Mục tiêu nhỏ của phiên**.

| Hạng mục | Hành vi đã triển khai |
| --- | --- |
| Chỉ hiện môn kỳ này | Pomodoro đọc `GET /sync/current-courses`, lấy phạm vi môn từ thời khóa biểu IU hiện tại; không dùng danh sách môn toàn bộ lịch sử ở `/student/subjects`. Lọc cả việc cá nhân/EDUX gợi ý theo phạm vi này. Khi chưa xác định được kỳ, giữ lựa chọn tự học và hướng dẫn đồng bộ IU; không lấy môn cũ làm dự phòng. Lịch sử các phiên đã lưu vẫn được giữ nguyên. |
| AI tự phân tích khi nhập | Sau khi người dùng dừng nhập mục tiêu đủ rõ (từ 5 ký tự) khoảng 1,2 giây, AI gợi ý 2–5 bước nhỏ theo môn/công việc và nhịp 15/25/50 phút. Mỗi bước có tên, thời gian ước tính và dấu hiệu hoàn thành; tổng thời gian không vượt phiên. Có nút phân tích/thử lại thủ công. |
| Nhận và theo dõi các bước | Chỉ khi chọn **Dùng các bước này**, gợi ý trở thành checklist của phiên. Đánh dấu từng bước khi học; không tự đổi mục tiêu gốc, không tự đánh dấu công việc hoàn thành. Lưu checklist và tiến độ trong `learningContext.microGoals`; phục hồi cùng bản nháp, hiển thị số bước đã xong trong lịch sử. Khi chọn cần học tiếp, gợi ý các bước chưa xong vào phần tiếp theo, vẫn cho chỉnh sửa. |
| Giữ đúng ngữ cảnh | Sửa mục tiêu, đổi môn/công việc/thời lượng sẽ bỏ gợi ý không còn khớp. Hủy yêu cầu đang chờ và bỏ phản hồi cũ sau khi sửa hoặc bắt đầu phiên. API xác nhận môn thuộc kỳ hiện tại và công việc thuộc hồ sơ; phân biệt user ID của EDUX với ID học vụ nội bộ. |
| Lỗi AI và thời gian chờ | AI lỗi không xóa mục tiêu và không chặn bắt đầu tự học. Có cache kết quả hợp lệ trong 5 phút và giới hạn số mục cache. Đầu ra sai cấu trúc, bước trùng, thời gian âm/không nguyên hoặc vượt thời lượng bị từ chối; không thay bằng gợi ý giả khi provider lỗi. Chế độ mock ghi rõ dữ liệu mẫu. |

**Phạm vi mã:** thêm `pomodoro-goals.service.js`, controller/route `POST /ai/pomodoro-goals`, `PomodoroGoalSuggestions.jsx`; cập nhật hook phạm vi môn, form/checklist, tiện ích phục hồi và validator lưu phiên. Dùng lại cột JSON `learning_context`, không thêm bảng/cột trong lượt này. Hợp đồng tại [API.md](API.md#ai-chia-nhỏ-mục-tiêu-pomodoro--04112026); bằng chứng tại [TESTING.md](TESTING.md#môn-kỳ-hiện-tại-và-ai-chia-nhỏ-mục-tiêu--04112026).

**Xác minh:** **400/400 frontend trong 44 file**, **126/126 API**, build production đạt. Kiểm thử AI dùng model giả lập; chưa nghiệm thu provider thật hoặc Electron trực tiếp. Khởi động lại ứng dụng để nạp route AI mới. Nếu chưa có phạm vi kỳ hiện tại thì đồng bộ thời khóa biểu IU; chức năng tự học chưa phân loại vẫn dùng được.

## Cải thiện các luồng học tập — 04/11/2026

Lượt này ưu tiên chọn môn, flashcard và tài liệu trước, sau đó nối checklist, quiz, ôn thi, điểm cần cải thiện và AI Tutor. Dùng lại `GET /sync/current-courses` và quy tắc IU trong `getCurrentCourseScope`; không thêm cách suy đoán học kỳ khác. Giữ các thay đổi có sẵn về lịch, hồ sơ và Pomodoro.

| Luồng | Hành vi sau sửa |
| --- | --- |
| Chọn môn | Công việc, lịch học, kỳ thi và sổ tay mới dùng môn kỳ hiện tại như Pomodoro. Khi sửa, giữ riêng môn đã lưu dù thuộc kỳ cũ. Chưa xác định/tải được kỳ thì hướng dẫn đồng bộ IU và có thử lại; không dùng toàn bộ lịch sử làm phương án thay thế. Sổ tay cũ vẫn xem/lọc được. |
| Flashcard | Lọc đồng thời môn và metadata chương/chủ đề, có đối chiếu hậu tố khóa EDUX. Pomodoro có ô chương/chủ đề ôn lại, lưu cùng phiên và truyền khi chuyển màn hình. Xếp thẻ đến hạn trước, sau đó ưu tiên số lần chọn `again` thực tế. Có **Ôn 5 phút**, dừng/tiếp tục tự do, trạng thái thiếu thẻ và lỗi từng bộ; hết thời gian không tự ghi mức nhớ. |
| Tài liệu | Sửa điều kiện học kỳ/trạng thái từng loại mọi file tải lên. Lọc học kỳ theo metadata đã lưu, trạng thái theo tiến độ trang thật trên thiết bị. Upload chọn môn IU, API lưu mã/tên môn chuẩn và học kỳ/năm học; thiếu thông tin hiển thị **Chưa phân loại**, không gán kỳ hiện tại cho file lịch sử. Có thể tải file chưa phân loại khi IU chưa sẵn sàng. |
| Checklist | **AI chia nhỏ công việc** đọc tên, mô tả và deadline của công việc cá nhân đã lưu. Bản nháp 2–5 bước có đầu ra và phút ước tính, sửa/bỏ trước khi xác nhận. Lưu batch trong transaction; lỗi giữa chừng rollback. Bước thủ công cũng nhập/sửa được đầu ra và thời lượng. Nút Pomodoro mang theo bước/đầu ra; không tự bắt đầu đồng hồ hoặc hoàn thành việc. |
| Quiz | Chọn môn kỳ hiện tại, chương/chủ đề, nguồn, 5/10/15 câu và độ khó. API đọc lại nguồn thuộc hồ sơ/môn đã chọn, lưu provenance thực trong quiz; nguồn lỗi không được chuyển ngầm sang kiến thức chung. Hiển thị nguồn và gợi ý luyện lại các chủ đề trả lời sai. Không chấp nhận phản hồi nộp bài thiếu kết quả chấm. |
| Ôn thi | Nhập nội dung, AI đề xuất từng buổi có mục tiêu, giờ học, thời lượng và bài tự kiểm tra. Sửa/bỏ từng buổi trước khi xác nhận; API dùng lại giờ trống và kiểm tra lại thời điểm tương lai, trước giờ thi, xung đột, chủ sở hữu và transaction khi lưu. Kế hoạch thủ công vẫn dùng được khi AI lỗi. |
| Điểm cần cải thiện | Thêm **Luyện 5 câu**, **Học lại 15 phút**, **Mở tài liệu**. Điểm trước/sau và mức thay đổi lấy từ hai lượt quiz đã nộp gần nhất của chủ đề; thiếu lượt đo hiển thị thiếu dữ liệu, không suy diễn mức cải thiện. |
| AI Tutor | Chọn từ danh sách kỳ thi sắp tới, không nhập ID. Chọn môn kỳ hiện tại; nhận sẵn môn/chủ đề/nội dung từ slide hoặc công việc rồi cho sửa câu hỏi trước khi gửi. Các buổi trong bản xem trước sửa được; chỉ báo đã lưu khi API trả `persisted: true`. |

Các yêu cầu AI có trạng thái xử lý/lỗi, giữ thao tác thủ công, khóa hoặc bỏ phản hồi khi ngữ cảnh đổi/rời màn hình. Không tự nhận checklist, lưu lịch hoặc đánh dấu hoàn thành. Phiên Pomodoro đang có được giữ khi mở mục tiêu mới; người học phải lưu/đặt lại phiên trước rồi chọn dùng mục tiêu vừa mở.

**Xác minh:** frontend **420/420, 46 file**; API **137/137**; bộ AI với provider giả lập **74/74**; tích hợp HTTP/SQLite và môn hiện tại **27/27**. Build production và giới hạn kiểm chứng ghi tại [TESTING](TESTING.md#các-luồng-học-tập--04112026). Các bộ có phần giao nhau, không cộng thành tổng duy nhất.

**AI thật:** gọi chia nhỏ công việc với dữ liệu tổng hợp lúc **20:12 ngày 04/11/2026 (UTC+7)** trả `GEMINI_TIMEOUT`, **0/1 đạt**; không ghi database ứng dụng. [Bằng chứng](evidence/learning-flows-live.json). Chưa nghiệm thu thành công provider thật hoặc UI Electron/thiết bị trong lượt này. Quiz hiện đọc nguồn bài giảng có văn bản và file TXT/Markdown; PDF/DOCX/PPTX/ảnh tải lên chưa trích xuất cho quiz, phải báo rõ và chọn nguồn khác. Chưa thêm đồng bộ tiến độ file giữa các máy.

Khởi động lại API/ứng dụng để nạp migration bổ sung `Checklists.estimated_minutes`, `Checklists.done_when`, `AiQuizzes.source_json`; các bản ghi cũ được giữ. Chi tiết hợp đồng ở [API](API.md#bổ-sung-hợp-đồng-luồng-học-tập--04112026), thao tác ở [FEATURES](FEATURES.md#các-luồng-học-tập-liên-kết).

## Quét slide, tóm tắt thủ công và hàng đợi — 04/11/2026

Theo phản hồi màn hình luôn hiện “0 chương / 0 flashcard”, đã đọc API đang chạy và xác nhận backend có **4 môn, 45 chương, 1.869 slide** trong lúc job nền chờ AI; môn Giải tích có thông báo chưa được cấp học liệu EDUX. Màn hình Học tập chỉ giữ snapshot ban đầu và không theo dõi job nền, nên số chương không cập nhật kịp. Đây là quan sát read-only trước sửa, không phải nghiệm thu UI sau sửa.

Theo yêu cầu mới, đã bỏ tự động tóm tắt khỏi toàn bộ luồng đồng bộ slide, kể cả đồng bộ nền và cờ `summarize` cũ. Chỉ nút **Tạo / cập nhật tóm tắt** trong môn gửi yêu cầu AI. Bản tóm tắt cũ được giữ, không gọi lại AI khi mở trang hoặc khởi động ứng dụng.

Đồng bộ và tóm tắt dùng hàng đợi FIFO, một yêu cầu chạy tại một thời điểm; xử lý hoàn tất môn trước rồi mới sang môn sau. Yêu cầu trùng được gộp; lỗi không chặn phần còn lại. Có vị trí chờ, tên môn, trạng thái đang chạy/thiếu dữ liệu/lỗi. Quét slide lưu ngay từng môn; giao diện Học tập/Tài liệu theo dõi cả job nền, cập nhật số chương/slide trước khi toàn bộ job hoàn tất, giữ catalog tốt khi mạng lỗi. Môn chưa có nguồn được ghi rõ; không gợi ý rằng chưa có flashcard là lỗi quét slide.

Xác minh cuối: **426/426 frontend (47 file)**, **139/139 API**, **75/75 AI giả lập**, **8/8 nguồn EDUX/làm mới lịch**; build production đạt. Test 6 môn xác minh toàn bộ A/B/tổng hợp/tạo thẻ của từng môn chạy xong trước môn kế tiếp; test riêng kiểm tra nhiều đồng bộ scoped, gộp yêu cầu, tiếp tục sau lỗi và lưu môn trước khi lấy môn sau. Chi tiết tại [TESTING](TESTING.md#tóm-tắt-theo-nút-bấm-và-hàng-đợi--04112026).

Không gọi provider AI thật trong lượt này. Các kiểm tra ghi dùng SQLite tạm/provider giả lập, không thay dữ liệu thật để tạo bằng chứng. Cần khởi động lại API/ứng dụng để nạp code mới và dừng cơ chế tự tóm tắt của tiến trình cũ. Hàng đợi RAM không sống qua restart; slide và kết quả AI đã lưu vẫn được giữ, người dùng bấm lại nếu muốn tiếp tục tóm tắt.

## Sửa lỗi độ dài tóm tắt và JSON Flashcard — 04/11/2026

Quan sát read-only API trước sửa: môn Cấu trúc dữ liệu và giải thuật có bản tóm tắt hợp lệ **5.386 ký tự**, không stale; lỗi ở bước **cards**, không phải quét slide hoặc tóm tắt. Các môn Công nghệ phần mềm, Pháp lý và Đạo đức nghề nghiệp, Phát triển ứng dụng web bị chặn ở giới hạn độ dài đầu ra. Không sửa database thật để xóa lỗi hoặc tạo bằng chứng thành công.

Nguyên nhân: pipeline coi mục tiêu 4.000 ký tự/phần và 8.000 ký tự/toàn môn là điều kiện loại bỏ kết quả. Chia nhỏ nguồn rồi tổng hợp lại vẫn có thể vượt mục tiêu; lần thử lại không đưa bản nháp dài vào để rút gọn. Flashcard yêu cầu tới 30 thẻ trong một JSON, tắt retry JSON lỗi và chỉ lưu sau khi có cả bộ. Parser stream còn chọn snapshot dài nhất, có thể lấy bản nháp lỗi thay vì câu trả lời cuối ngắn hơn.

Bản sửa tách mục tiêu trình bày khỏi giới hạn lưu trữ: thử ngân sách ngắn hơn và rút gọn **chính bản nháp AI đã nhận**, có số lần thử hữu hạn. Nội dung hợp lệ còn dài được lưu với nhãn `expanded`; nếu không tổng hợp được do giới hạn kích thước thì giữ các phần AI đã hoàn tất, nhãn `sections` và thông báo **chưa có bản tổng hợp ngắn**. Không cắt ngang kiến thức, không lấy slide thô giả làm kết quả AI. Mặc định trần lưu trữ 120.000 ký tự vẫn được kiểm tra; lỗi mạng/provider vẫn là lỗi, các phần tốt đã lưu được giữ. Cache A/B của pipeline v3 tiếp tục dùng được.

Flashcard chia phần bản tóm tắt **đã lưu** thành lô tối đa 3.500 ký tự, yêu cầu tối đa 4 thẻ/lần. Khi JSON/schema/kích thước lỗi, giảm 4 → 2 → 1, chỉ lô 1 thẻ được thêm một lần sửa JSON từ bản nháp lỗi thật. Validate lại đầu ra trước khi ghi; thẻ và checkpoint mỗi lô nằm cùng transaction. Khởi động lại rồi bấm **Tạo tiếp Flashcard** sẽ dùng lại tóm tắt và các lô đã xong. Thẻ đã có vẫn ôn được; UI phân biệt lỗi tạo thẻ, bản tóm tắt dạng dài/theo phần và số lô còn thiếu. Parser dùng snapshot cuối có nội dung.

Đã đối chiếu [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [giới hạn token](https://ai.google.dev/gemini-api/docs/tokens) và [cấu hình sinh văn bản](https://ai.google.dev/gemini-api/docs/text-generation) của Google. App hiện dùng transport **web-guest**, không dùng Gemini API chính thức: `maxOutputTokens`/JSON schema native không được transport này thực thi. Vì vậy sửa trực tiếp cách chia lô, validate và khôi phục; không giả nhận đã bật ràng buộc của API chính thức.

**Xác minh:** **89/89 AI giả lập**, **139/139 API**, **427/427 frontend (47 file)**; build production đạt **10,26 giây**. Các ca bao gồm JSON lỗi, snapshot cuối ngắn hơn, giữ đủ Unicode/nguồn, rewrite lỗi, giới hạn lưu thật, khôi phục từng lô sau mở lại SQLite và rollback checkpoint. Chi tiết tại [TESTING](TESTING.md#khôi-phục-tóm-tắt-dài-và-json-flashcard--04112026).

**AI thật:** dữ liệu tổng hợp, không mở DB ứng dụng; yêu cầu tóm tắt timeout sau **25.562 ms** (`GEMINI_TIMEOUT`), chưa chạy bước thẻ vì chưa có tóm tắt thật. [Bằng chứng](evidence/learning-recovery-live.json). Không coi mock là bằng chứng provider đã hoạt động ổn định hoặc đã nghiệm thu các môn 500+ slide. Chưa nghiệm thu UI Electron trực tiếp. Cần khởi động lại API/ứng dụng để áp dụng migration thêm metadata tóm tắt/trạng thái thẻ và bảng `LearningCardBatches`; dữ liệu cũ được giữ. Chế độ bấm mới chạy AI và hàng đợi FIFO vẫn giữ nguyên.

## Tóm tắt n phần bằng AI song song — 04/11/2026

Theo yêu cầu tiếp theo, chuyển xử lý các phần của **cùng một môn** sang song song. Hàng đợi môn vẫn FIFO và AI vẫn chỉ chạy sau nút bấm. Mặc định chia nguồn thành n phần tối đa 12.000 ký tự, tối đa 4 request AI đồng thời; cấu hình `LEARNING_AI_CONCURRENCY` 1–5, `LEARNING_AI_CHUNK_CHARS` theo ngân sách input. Đây là nhiều lượt gọi độc lập tới provider hiện có, không chia sẻ lịch sử chat giữa các phần.

Nguồn đầy đủ được chia trước khi gửi; kết quả xếp theo thứ tự nguồn dù hoàn tất khác thứ tự. Khi vừa ngân sách, chỉ gọi tổng hợp một lần sau n phần; chỉ thêm tầng tổng hợp nhóm song song nếu các kết quả quá lớn. Bỏ các lượt tổng hợp nhị phân không cần thiết sau mỗi cặp nguồn. Cache v3 và các phần đã xong vẫn dùng lại; một phần lỗi không làm mất kết quả của phần khác. Chờ toàn bộ phần đang chạy kết thúc trước khi kết thúc job/chuyển môn, không có request còn chạy lẫn vào môn sau. Học tập/Tài liệu hiển thị số phần đã lưu, lượt AI đang chạy và pha tổng hợp.

Kiểm thử HTTP provider localhost đã xác nhận **4 POST đồng thời trước khi trả bất kỳ câu trả lời nào**, ngữ cảnh chat độc lập; test riêng xác minh n phần đủ nguồn/đuôi/Unicode, ghép đúng thứ tự, giới hạn worker và retry chỉ phần lỗi. Ca 6 môn FIFO được cập nhật: mỗi môn nhỏ có A/B chạy đồng thời, các môn vẫn lần lượt; mức đồng thời trong fixture là 2, không còn yêu cầu cũ “mọi lời gọi AI đều tuần tự”. Kết quả cuối: **94/94 AI giả lập**, **139/139 API**, **428/428 frontend (47 file)**, build production đạt **27,61 giây**. Chi tiết tại [TESTING](TESTING.md#ai-song-song-trong-một-môn--04112026).

Benchmark có độ trễ giả lập 50 ms/request, 67.215 ký tự chia 8 phần: một worker **575 ms**, bốn worker **272 ms**, cùng 9 request và đủ nguồn; nhanh **2,11 lần** trong lượt đo này. [Bằng chứng](evidence/learning-parallel-benchmark.json). Đây là mô phỏng latency, không đo tốc độ/chất lượng Gemini thật. Không gọi lại provider thật trong lượt này; kết quả timeout ở lượt trước vẫn giữ nguyên. Cần restart API/ứng dụng để nạp worker song song; không có migration mới trong lượt này.

## Thu gọn giao diện hàng đợi học liệu — 04/11/2026

Theo yêu cầu chỉ chỉnh khối trong ảnh, thay giao diện `LearningQueue` bằng danh sách gọn trên nền trung tính, phân cách nhẹ. Tên môn, loại yêu cầu và trạng thái tách rõ; chỉ trạng thái đang xử lý có điểm nhấn màu nhỏ. Bỏ các thẻ tím lớn và đoạn hướng dẫn dài, ẩn mô tả chờ lặp lại. Tiến trình phần/lô được hiển thị ngắn từ metadata thực; **Xem chi tiết** giữ đầy đủ thông báo máy chủ. Có thu gọn/mở rộng toàn khối và lịch sử gần đây; kết quả cần kiểm tra tự mở để đọc lỗi. Màn hình Học tập/Tài liệu dùng cùng component, CSS chỉ nằm trong `.learning-queue`; không đổi bố cục phần khác, API, dữ liệu hoặc cách chạy AI/hàng đợi.

Xác minh: **23/23** kiểm thử frontend liên quan, build production đạt **14,41 giây**; **9/9** kiểm tra Chromium/Electron với hàng đợi giả lập. Khối 3 yêu cầu cao **246 px** ở desktop, thu gọn còn **56 px**. Kiểm tra viewport nhỏ, dark mode, xem chi tiết, làm mới lỗi giữ dữ liệu và các nút không gửi POST/AI. Ảnh/báo cáo cục bộ tại `tests/artifacts/learning-queue-ui/`; chi tiết và giới hạn tại [TESTING](TESTING.md#giao-diện-hàng-đợi-gọn--04112026). Không chạy lại provider thật hoặc thay DB ứng dụng đang mở trong lượt giao diện này.

## Chốt báo cáo học tập và dọn log — 04/11/2026

Luồng sau cập nhật: **đồng bộ slide → người học yêu cầu tóm tắt → chia n phần và chạy song song → tổng hợp đúng thứ tự → lưu tóm tắt → tạo/lưu từng lô Flashcard**. Các môn xử lý lần lượt trong hàng đợi FIFO; trong một môn mặc định có tối đa 4 lượt AI đồng thời. Mở trang, polling hoặc đồng bộ slide không tự gửi yêu cầu tóm tắt.

| Phần việc | Kết quả bàn giao |
| --- | --- |
| Phạm vi môn và nguồn học | Các form dùng môn IU kỳ hiện tại, giữ môn cũ khi sửa; thiếu kỳ có hướng dẫn đồng bộ. Sửa lọc tài liệu tải lên, lưu môn/học kỳ và trạng thái chưa phân loại. Flashcard/Pomodoro/quiz giữ ngữ cảnh môn và chương/chủ đề. |
| AI tóm tắt | Chia nguồn trước khi gửi, mặc định tối đa 12.000 ký tự/phần; concurrency cấu hình 1–5, mặc định 4. Thường một lượt tổng hợp cuối; dùng nhóm trung gian khi cần. Cache v3 giữ tương thích, phần hoàn tất sống qua lỗi/retry; chờ các phần đang chạy kết thúc trước khi chuyển môn. |
| Độ dài và JSON | Rút gọn từ bản nháp thật; kết quả hợp lệ còn dài được ghi rõ dạng dài/theo phần. Thẻ thử lô 4 → 2 → 1, parse/validate và repair hữu hạn; thẻ/checkpoint lưu cùng transaction. Lỗi thẻ giữ tóm tắt, tạo tiếp từ lô thiếu. |
| Các công cụ học | Checklist có bản nháp AI sửa trước khi lưu, bắt đầu Pomodoro từ bước; quiz có số câu/độ khó/nguồn thực; kế hoạch ôn chỉ xếp giờ hợp lệ trước thi và cho chỉnh; điểm trước/sau từ lượt luyện thật; Tutor chọn kỳ thi sắp tới và nhận ngữ cảnh nguồn. |
| Giao diện hàng đợi | Chỉ chỉnh khối hàng đợi dùng chung: danh sách gọn, nền trung tính, tách tên môn/trạng thái/tiến trình, xem chi tiết và thu gọn. Ba yêu cầu cao 246 px ở desktop; thu gọn 56 px, không tràn ngang ở các viewport nhỏ đã kiểm tra. |

### Kết quả kiểm chứng được giữ lại

Đã đọc lại log gốc và đối chiếu các báo cáo JSON trước khi dọn. Đây là kết quả các lượt chạy đã hoàn tất; lượt dọn log/tổng hợp báo cáo **không chạy lại test, build hoặc AI**. Không cộng các nhóm có ca giao nhau.

| Phạm vi / mốc | Kết quả thực tế | Bằng chứng giữ trong dự án |
| --- | --- | --- |
| Backend sau nâng cấp AI song song | **139/139 API**, **94/94 AI**; AI dùng provider giả lập và có kiểm tra HTTP client/SQLite tạm | [learning-parallel-tests.json](evidence/learning-parallel-tests.json) |
| Frontend toàn bộ trước lượt chỉnh riêng giao diện hàng đợi | **428/428, 47 file** | [learning-parallel-tests.json](evidence/learning-parallel-tests.json) |
| Frontend sau chỉnh riêng giao diện hàng đợi | **23/23** ca liên quan, **9/9** kiểm tra Chromium/Electron với fixture; chưa chạy lại toàn bộ 428 ca sau lượt UI | [learning-queue-ui.json](evidence/learning-queue-ui.json) |
| Build production sau chỉnh giao diện | **Thành công, 14,41 giây**; còn cảnh báo MathJax `eval` và chunk lớn | [learning-queue-ui.json](evidence/learning-queue-ui.json) |
| Tốc độ song song với độ trễ giả lập | 8 phần, cùng 9 request: 1 worker **575 ms**, 4 worker **272 ms**, nhanh **2,11 lần** trong lượt đo | [learning-parallel-benchmark.json](evidence/learning-parallel-benchmark.json) |
| Provider thật với nguồn tổng hợp | Tóm tắt **timeout sau 25.562 ms**, bước tạo thẻ bỏ qua vì chưa nhận được tóm tắt thật | [learning-recovery-live.json](evidence/learning-recovery-live.json) |

Benchmark giả lập không phải cam kết tốc độ AI thật; kiểm thử mock không chứng minh các môn thực tế 500+ slide đã nghiệm thu thành công. Chưa có lượt AI thật thành công mới cho luồng này. Nghiệm thu kết nối IU/EDUX/Outlook, chất lượng AI và UI trên hồ sơ/thiết bị người dùng vẫn cần kiểm tra riêng. Giới hạn quiz đối với PDF/DOCX/PPTX/ảnh tải lên được giữ như phần báo cáo phía trên.

### Sắp xếp lại log kiểm thử

Đã gom **43 file `.log`**, tổng **1.131.766 byte (~1,08 MiB)**, vào `tests/artifacts/logs/2026-11-04/`: **35** file trước đây nằm ở gốc dự án chuyển vào `root/`, **8** file trong `tests/artifacts` chuyển vào `artifacts/`. Thư mục gốc hiện **không còn file `.log`**. Đây là lưu trữ có thể khôi phục; **không xóa vĩnh viễn** do thao tác xóa bị bộ xét duyệt tự động chặn (`blocked by policy`).

Giữ báo cáo JSON trong `docs/evidence/`, ảnh và báo cáo UI trong `tests/artifacts/`, mã nguồn/test và dữ liệu ứng dụng. `.gitignore` đã bỏ qua `*.log` và `tests/artifacts/`, không cần thêm quy tắc trùng. Các tên log trong những mục lịch sử ở trên hoặc `TESTING.md` là tên tại thời điểm chạy; tra vị trí mới qua [log-cleanup.json](evidence/log-cleanup.json). Log mới nên lưu thẳng vào `tests/artifacts/logs/` để không làm rối thư mục gốc.

## Tín chỉ hồ sơ và khối kiến thức IU — 05/11/2026

Sửa lỗi hồ sơ chỉ hiện số tín chỉ đã tích lũy, còn tổng chương trình và tín chỉ bắt buộc bị bỏ sót. Đã đối chiếu [trang Tra cứu điểm IU](https://iu.cmcu.edu.vn/congthongtin/Index.aspx#diemhoc) và mã `diemhoc.js` đang được cổng trường phục vụ: tổng chương trình nằm trong `rsDiemTrungBinhChung[].TONGSOTINCHICTDT`, không nằm ở bản ghi thông tin sinh viên. Các cột khối dùng `TONGSOTINCHICUAKHOI`, `SOBATBUOC`, `SODATICHLUY`.

Hồ sơ hiển thị riêng tổng chương trình, tổng bắt buộc và số liệu theo khối. Các giá trị trong ảnh đối chiếu là **126** tín chỉ chương trình, **129** bắt buộc, **203** tổng các khối; tích lũy theo khối **28** khác tín chỉ tích lũy bảng điểm **25**. Không gán cứng các số này vào mã sản phẩm.

Thêm nút **Đồng bộ tín chỉ IU** ngay trong Hồ sơ và tự thử cập nhật dữ liệu thiếu khi có phiên dùng được. Đăng nhập chỉ mở sau thao tác người dùng. Luồng cập nhật riêng kiểm tra mã sinh viên, gộp yêu cầu trùng và chỉ lưu chương trình/học phần; giữ nguyên bảng điểm, lịch và thông tin cá nhân. Nguồn lỗi/hết phiên hoặc thiếu trường có thông báo; không tự điền tổng giả.

Xác minh: **23/23** ca backend liên quan, **13/13** frontend và **12/12** kiểm tra Chromium/Electron với fixture; build production thành công. Fixture dùng tên trường/quy tắc chọn đã xác minh từ mã IU, không chứa cookie/token hay phản hồi hồ sơ thật. Hợp đồng ở [API.md](API.md#cập-nhật-tín-chỉ-trong-hồ-sơ--05112026).

Đã nghiệm thu lượt này với phiên IU thật: luồng cập nhật riêng lưu tổng chương trình **126**, bắt buộc **129**, tổng các khối **203**, tích lũy theo khối **28**; tích lũy bảng điểm **25** và GPA **2,52/4** được giữ. Đã thấy trực tiếp **129 tín chỉ** trong mục Tín chỉ theo khối IU trên Electron và đọc lại file SQLite xác nhận đã persist. [Bằng chứng phạm vi](evidence/iu-credit-refresh.json); không lưu cookie/token hay phản hồi cá nhân thô.

## Điều kiện nghiệm thu và phần còn mở

- Clone nhánh mới, cài đủ hai bộ dependency, build và mở Electron/headless theo README; kiểm tra cấu hình API và persist DB.
- Kiểm tra liên tục đồng bộ → lịch/task → tài liệu/ghi chú/Pomodoro → quiz/điểm yếu → kế hoạch; thao tác lưu và tải lại khớp DB.
- Nguồn/AI lỗi, hết phiên, hủy, gửi lặp và xung đột mới không được xóa dữ liệu tốt hoặc tạo bản ghi nửa chừng.
- Luồng tín chỉ IU ngày 05/11 đã có bằng chứng phiên thật, UI Electron và đọc lại SQLite trong phạm vi hồ sơ đã thử. Toàn luồng IU/EDUX/Outlook và AI phức tạp vẫn cần nghiệm thu riêng; các lượt live/timeout lịch sử được giữ nguyên, không suy rộng kết quả tín chỉ hoặc chat tổng hợp.
- Sổ tay canvas và bookmark/tiến độ slide còn dữ liệu cục bộ theo origin; chưa có đồng bộ/cộng tác nhiều máy.
- Ứng dụng dùng một hồ sơ cấu hình; chưa có xác thực/phân quyền nhiều người dùng. Chưa có script tạo bộ cài độc lập; PB-49/PB-50 còn mở.
- UI bàn phím/focus, zoom/screen reader, tablet/stylus/camera thật cần nghiệm thu theo phạm vi; test jsdom không thay thế kiểm tra tương tác trên thiết bị.

## Xác minh trước push ngày 05/11/2026

Đã chạy lại API **152/152**, AI **96/96**, Electron mock **31/31**, học liệu **63/63**, frontend–API **10/10**, React **455/455 trong 50 file**; build production đạt **13,70 giây**. Các nhóm có ca giao nhau, không cộng tổng. Không chạy lại live hoặc restart ứng dụng trong lượt này. Chi tiết và giới hạn tại [TESTING.md](TESTING.md#xác-minh-trước-push-và-đồng-bộ-github--05112026), [biên bản kiểm tra](evidence/sprint4-publish-verification.json) và [biên bản GitHub](evidence/github-sprint-sync.json).

## Tài liệu bàn giao

Đúng bốn báo cáo sprint: `SPRINT_1.md`, `SPRINT_2.md`, `SPRINT_3.md`, `SPRINT_4.md`. Các báo cáo cũ được tổng hợp vào những file này và dẫn nguồn bằng commit cố định. Tài liệu chuyên môn tiếp tục ở [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [FEATURES.md](FEATURES.md), [TESTING.md](TESTING.md), [product_backlog.md](product_backlog.md); hướng dẫn bắt đầu nằm trong [README](../README.md).
