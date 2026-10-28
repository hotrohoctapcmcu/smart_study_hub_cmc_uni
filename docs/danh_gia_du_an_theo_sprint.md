# Đánh giá dự án theo 3 Sprint

**Cập nhật 28/10/2026:** Sprint 3 đã triển khai đủ 5 luồng và có kiểm thử API, Electron E2E, Gemini thật. Xem [báo cáo hoàn thiện Sprint 3](hoan_thien_sprint3.md). Các nhận xét thiếu UI/lưu trữ Sprint 3 dưới đây là kết quả đánh giá lịch sử ngày 27/10, đã được thay thế bởi báo cáo mới. Luồng sửa kỳ thi và tải lại các mốc ôn thi cũng đã được sửa trong đợt này.

Ngày đánh giá: **27/10/2026**. Phạm vi: working tree hiện tại trên nhánh `main`, gồm các phần tích hợp trước đó và thay đổi hoàn thiện Sprint 2 chưa commit.

Đối chiếu đúng cách chia Sprint trong tệp `sprint.txt` ở thư mục cha repository. Bản đánh giá ban đầu đã được cập nhật sau khi triển khai các luồng Sprint 2; xem `hoan_thien_sprint2.md` để biết thay đổi và bằng chứng kiểm thử.

## 1. Kết luận

Dự án đã có nền Electron + frontend + Express + SQLite hoạt động cùng nhau. Thời khóa biểu, AI đề xuất lịch tự học, công việc/checklist, hồ sơ, chat AI và timer Pomodoro có luồng sử dụng chính. Time Map và báo cáo tiến độ đã được nối API vào giao diện sau đợt tích hợp.

**Chưa đủ cơ sở kết luận cả ba Sprint đã hoàn thành.** Sprint 1 còn lỗi đồng bộ thao tác giao diện và kế hoạch ôn thi; Sprint 2 đã nối kho tệp, ghi chú, Pomodoro, báo cáo và email; kết nối hộp thư trường thật còn cần nghiệm thu; Sprint 3 có nhiều API AI nhưng chưa có giao diện nghiệp vụ tương ứng.

Quy ước đánh giá:

- **Có luồng chính:** có thể dùng luồng chính hiện tại; vẫn có thể còn lỗi, giới hạn hoặc thiếu hạng mục để nghiệm thu toàn bộ chức năng.
- **Một phần:** có mã hoạt động nhưng thiếu một phần thiết yếu của chức năng hoặc chưa nối xuyên suốt.
- **Mới có API:** backend có nghiệp vụ, chưa có luồng sử dụng hoàn chỉnh trên giao diện.
- **Chưa có luồng thực:** chưa có tích hợp nguồn dữ liệu thật cho chức năng được yêu cầu.

Tổng hợp sau cập nhật: các luồng Sprint 2 đã được triển khai và kiểm thử tích hợp. Không dùng kết quả này để tuyên bố nghiệm thu hộp thư Outlook thật hoặc hoàn thành Sprint 1/Sprint 3.

## 2. Sprint 1 — chức năng 1, 2, 3, 4, 9, 18

| STT | Chức năng | Đánh giá | Đã làm được | Còn thiếu / cần xác minh |
|---|---|---|---|---|
| 1 | Thời khóa biểu thông minh | Có luồng chính | Đồng bộ IU, hiển thị ngày/tuần/tháng, lịch tự học, phát hiện lịch giao nhau, thêm/sửa/xóa qua API. | Cần bổ sung nghiệm thu thao tác giao diện khi API từ chối ghi hoặc mất kết nối; một số thao tác vẫn cập nhật state trước rồi chỉ ghi cảnh báo khi lưu lỗi. |
| 2 | AI xếp lịch tự học và cảnh báo trùng | Có luồng chính | `/ai/plan` dùng khoảng trống thật; lọc lịch quá khứ, lịch lớp, tự học và thi. Có preview, xác nhận, kiểm tra lại xung đột và lưu nhóm buổi học bằng transaction. Đã nối trang Kế hoạch học tập và modal trong Lịch học. | Danh sách/vỏ kế hoạch còn trong state phiên; các buổi đã xác nhận được lưu SQLite. Cần nghiệm thu nhà cung cấp AI thật và kiểm tra việc sửa/xóa kế hoạch so với các buổi đã lưu. |
| 3 | Quản lý Deadline và Checklist | Có luồng chính | CRUD bài tập nội bộ, checklist và trạng thái qua SQLite; đọc bài EDUX; xóa bài EDUX bằng ẩn bền; sửa form checklist có gọi API thêm/sửa/xóa. | Đổi trạng thái bài EDUX đang gọi sai route và bộ giá trị trạng thái. Thao tác hoàn thành nhanh trên bảng chỉ gửi trạng thái task, chưa gửi các thay đổi checklist tương ứng. |
| 4 | Nhắc nhở thông minh đa tầng | Một phần | Có bảng Reminders, sinh mốc nhắc, chống trùng, API lấy nhắc đến hạn và đánh dấu đã đọc/đã gửi; UI danh sách thông báo. | Chưa thấy worker/timer định kỳ phát nhắc đến hạn hoặc thông báo hệ điều hành. Nút đánh dấu tất cả đã đọc không cập nhật server do thứ tự xử lý state. |
| 9 | Quản lý lịch thi và kế hoạch ôn thi | Một phần | Đồng bộ lịch thi trong cửa sổ 70 ngày, khử trùng, CRUD lịch thi; backend có CRUD các giai đoạn ôn tập. | Form sửa gửi lại đối tượng cũ. UI chỉ tạo hai mốc ôn cố định, không gọi API lưu/tải giai đoạn; mapper tải kỳ thi đặt `studyMilestones: []`, nên lộ trình UI không được khôi phục từ DB. |
| 18 | Hồ sơ học tập cá nhân | Có luồng chính | Đồng bộ IU, hiển thị hồ sơ, GPA, tín chỉ, xếp loại và bảng điểm; frontend đã gọi API. | Luồng sync điểm vẫn ghi `academic_year` rỗng, chưa ghi `component_score`/`exam_score` và chưa quản lý riêng đầy đủ lần học lại. UI còn dùng tổng tín chỉ chuẩn cố định 135; chưa có bộ lọc học kỳ/năm học đầy đủ. |

Kết luận Sprint 1: **4/6 có luồng chính, 2/6 một phần; chưa nên đóng Sprint.** Ưu tiên sửa nhắc nhở, trạng thái EDUX, form lịch thi và nối bền kế hoạch ôn thi. Báo cáo Sprint 1 hiện có cần cập nhật vì còn ghi hồ sơ frontend chưa hoàn thiện và lỗi xóa task cũ chưa được sửa, trong khi mã hiện tại đã tiến xa hơn.

Nguồn chính: `Frontend/src/features/schedule/`, `study-planner/`, `tasks/`, `exams/`, `notifications/`, `profile/`; `API/modules/`; `database/functions/sync.js`.

## 3. Sprint 2 — chức năng 5, 6, 8, 10, 11, 12, 17

| STT | Chức năng | Trạng thái cập nhật | Kết quả |
|---|---|---|---|
| 5 | Kho tài liệu tập trung | Đã triển khai, kiểm thử tích hợp | Chọn tệp, upload, lưu byte thật, mở/tải xuống/xóa; metadata, dung lượng thật, tag và textbook; kiểm tra loại tệp, 25 MB và quyền sở hữu. |
| 6 | Tìm kiếm và Tag | Đã triển khai, kiểm thử tích hợp | Topbar gắn vào shell, Ctrl+K; API tìm tài liệu/ghi chú/task nội bộ và EDUX/lịch/thi/email; tìm `#tag`; tag lưu DB cho tài liệu, ghi chú và task. |
| 8 | Pomodoro | Đã triển khai, kiểm thử tích hợp | Giữ timer/chuông/khôi phục; đồng bộ lịch sử SQLite bằng ID ổn định, nhập lịch sử cũ, giữ phiên chưa gửi để thử lại; lưu riêng khoảng tập trung và pause. |
| 10 | Bản đồ thời gian | Đã triển khai, kiểm thử tích hợp | Nhận phiên timer thực từ DB, loại thời gian pause/nghỉ, cắt đúng UTC+7 và nửa đêm; giữ quy tắc ưu tiên lịch thi/lớp/Pomodoro/tự học. |
| 11 | Phân tích tiến độ | Đã triển khai, kiểm thử tích hợp | Thống nhất task nội bộ và EDUX, bỏ bài ẩn; cùng khoảng ngày/tuần/tháng; hoàn thành lịch tự học từ UI; loại trùng tự học/Pomodoro; giữ AI nhận xét. |
| 12 | Textbook và sổ tay | Đã triển khai, kiểm thử tích hợp | CRUD sổ/trang, autosave DB, giữ bản nháp khi lỗi; chương, tag, đánh dấu khó, đính kèm/đọc textbook thật, xuất DOCX. |
| 17 | Email trường | Đã triển khai; chờ nghiệm thu tài khoản thật | Thêm `CRWEB/OUTLOOK`, đăng nhập Electron, Graph/Outlook Web, đồng bộ thư SQLite, lấy nội dung và phân tích ngày giờ thật; xác nhận tạo task/thi chống trùng, trạng thái đọc bền và xử lý hết phiên. |

Kiểm thử mới: `npm run test:sprint2-complete` **11/11 đạt**; `npm run test:sprint2-complete:e2e` đạt với Electron ẩn, API và SQLite thật. Phía Microsoft được giả lập trong kiểm thử tự động; chưa đăng nhập hộp thư trường thật. Không đánh dấu nghiệm thu live bằng dữ liệu seed hoặc kết quả giả lập.

Migration giữ dữ liệu cũ. Ghi chú và lịch sử Pomodoro cục bộ được nhập khi kết nối; tài liệu cũ chỉ có metadata cần tải lại tệp gốc. Bộ trích xuất email không tự suy ra ngày giờ thiếu. Xem [báo cáo hoàn thiện Sprint 2](hoan_thien_sprint2.md) cho cách dùng, API và giới hạn.

Nguồn chính: `CRWEB/OUTLOOK/`, `API/modules/workspace*`, `API/shared/study-time.js`, `database/sprint2/workspaceMigration.js`, các feature frontend tương ứng và hai bộ test Sprint 2 mới.

## 4. Sprint 3 — chức năng 7, 13, 14, 15, 16 và tích hợp

| STT | Chức năng | Đánh giá | Đã làm được | Còn thiếu / cần xác minh |
|---|---|---|---|---|
| 7 | Trợ lý gia sư AI | Có luồng chính | Chat qua `/ai/ask`, ngữ cảnh học tập thật, conversation ID, trạng thái chờ/lỗi/thử lại và escape nội dung. Có trang và panel chat. | Hội thoại chỉ RAM, chưa lưu lịch sử DB; Gemini hiện dùng phiên web khách, còn phụ thuộc khả dụng của dịch vụ ngoài. Lượt đánh giá này không gọi lại Gemini thật. |
| 13 | Kiểm tra kiến thức bằng AI | Mới có API | `/ai/check` nhận câu hỏi/câu trả lời và trả nhận xét, sửa sai, gợi ý ôn; đã có kiểm thử API. | Chưa có luồng sinh đề/bộ câu hỏi, làm bài, chấm/lưu kết quả trên UI. Route `quiz` còn `isImplemented: false`; wrapper `checkAnswer()` chưa được dùng bởi giao diện. |
| 14 | Phân tích điểm yếu và đề xuất nội dung học | Một phần | AI phân tích ghi chú được đánh dấu khó và nhận xét số liệu tiến độ; có nút trên giao diện Sổ tay/Tiến độ. | Chưa có mô hình điểm yếu theo từng chủ đề nối từ lịch sử làm bài, sai sót và điểm; chưa theo dõi mức cải thiện. Không thể đồng nhất nhận xét ghi chú với toàn bộ chức năng chẩn đoán điểm yếu. |
| 15 | AI tạo kế hoạch ôn thi | Mới có API | `/ai/exam-plan` dùng kỳ thi, điểm và ghi chú thật; kiểm tra ngày không vượt ngày thi; trả preview. | `generateExamPlan()` chưa có caller UI; API trả `persisted: false`. Chưa có luồng xem/chỉnh/xác nhận/lưu kế hoạch AI vào ExamStudyPlans và lịch học. |
| 16 | Hỗ trợ viết đơn xin phép nghỉ học | Mới có API | `/ai/draft-leave` dùng ngày nghỉ/lý do, đối chiếu lịch đúng ngày, soạn nội dung và để trống thông tin thiếu. | `draftLeave()` chưa có caller UI; chưa có form xem/sửa/copy/xuất bản nháp cho người dùng. Không có luồng gửi đơn; việc gửi không được coi là bắt buộc nếu phạm vi chỉ yêu cầu hỗ trợ soạn. |

Kết luận Sprint 3: **1/5 có luồng chính, 1/5 một phần, 3/5 mới có API.** Phần tích hợp đã có kết quả cho planner, chat, ghi chú khó và báo cáo tiến độ. Chưa thấy báo cáo nghiệm thu Sprint 3 riêng theo đúng phạm vi người dùng đưa ra; tài liệu/API AI hiện có là bằng chứng thành phần, chưa thay cho kiểm thử tổng thể các chức năng còn thiếu UI.

Nguồn chính: `API/modules/troLyAI.js`, `API/shared/study-context.js`, `gemini-client.js`; `Frontend/src/features/ai-tutor/`, `documents/`, `progress/`; `Frontend/src/app/routes.js`.

## 5. Lỗi và khoảng trống cần xử lý trước nghiệm thu

### Đã tái hiện bằng chạy mã trong môi trường cô lập

| Vấn đề | Kết quả quan sát | Vị trí |
|---|---|---|
| Sửa lịch thi gửi dữ liệu cũ | Form đổi ngày `2030-01-01` → `2030-01-02`, phòng `Old room` → `New room`; request PUT vẫn chứa `2030-01-01` và `Old room`. | `Frontend/src/features/exams/exams.events.js:58` gọi `updateExamApi(initialData)` sau khi state đã được thay bằng object mới. |
| Đánh dấu tất cả thông báo đã đọc không lưu server | Đã sửa trong đợt Sprint 2: gọi API cho thông báo và email trước khi đổi state local. | `Frontend/src/features/notifications/notifications.events.js`. |
| Đổi trạng thái bài EDUX gọi route task thường | Đã sửa trong đợt Sprint 2: phân nhánh nguồn EDUX, gọi `/tasks/edux/:id/status` với trạng thái tiếng Việt. | `Frontend/src/features/tasks/tasks.service.js`; `API/modules/baiTap.js`. |

Ba kiểm tra trên dùng state/fetch/FormData giả lập trong tiến trình riêng, không ghi database cá nhân hoặc gọi API đang chạy của người dùng. Chúng chứng minh dữ liệu/request do frontend tạo; không được mô tả là ba ca E2E Electron.

### Xác định qua đọc mã và lần theo các nơi sử dụng

1. Nút hoàn thành nhanh task thay checklist local nhưng chỉ gửi trạng thái task; cần thêm regression test sau reload.
2. Đã nối UI Pomodoro/ghi chú/tài liệu sang API và các bảng Sprint 2; có kiểm thử mở lại DB.
3. Đã thay upload metadata bằng file picker và lưu/đọc byte thật; có kiểm thử loại tệp, dung lượng và quyền sở hữu.
4. Giai đoạn ôn thi trên UI chưa nối CRUD ExamStudyPlans; số liệu đọc lại bị bỏ trống trong mapper kỳ thi.
5. Hệ nhắc nhở chưa có cơ chế kiểm tra/phát nhắc định kỳ khi thời gian trôi qua; lấy danh sách trong bootstrap không thay cho cơ chế này.
6. Đồng bộ điểm còn bỏ trống năm học/điểm thành phần/lần học lại; chỉ có cột trong schema không chứng minh dữ liệu đã được ghi đầy đủ.
7. Một số metadata hiển thị nguồn chưa chính xác: mapper kỳ thi gán `source: "Trường"` cho mọi bản ghi, kể cả kỳ thi thủ công đọc từ DB.

## 6. Tester, sửa lỗi và báo cáo

Đã chạy lại trên working tree hiện tại:

| Lệnh | Kết quả | Phạm vi chứng minh |
|---|---|---|
| `npm run test:frontend` | Đạt | Logic frontend, state, view, request/mocking và các regression hiện có |
| `npm run test:learning-apis` | 48/48 đạt | API lịch, tự học, thi, tiến độ, Time Map, task/checklist, quyền sở hữu và nhắc nhở |
| `npm run test:sprint2-integration` | 8/8 đạt | Migration DB cũ, idempotency, Pomodoro, AI context, rollback EDUX và mở lại DB |
| `npm run test:ai` | 20/20 đạt | Ngữ cảnh, kế hoạch/xác nhận và các lỗi AI; provider HTTP giả lập |
| `npm run test:exam-sync` | 9/9 đạt | Cửa sổ lịch thi, khử trùng, phiên lỗi, dữ liệu rỗng và giữ kỳ thi thủ công |
| `npm run test:sprint2:e2e` | Đạt 3 kiểm tra | Electron + frontend + API + SQLite thật trong môi trường tạm: báo cáo, checklist, xóa task |
| `npm run test:sprint2-complete` | 11/11 đạt | Tệp thật, notes/textbook/DOCX, tag/tìm kiếm, Pomodoro/pause/nửa đêm, thống nhất báo cáo, email/idempotency, quyền sở hữu và mở lại DB |
| `npm run test:sprint2-complete:e2e` | Đạt | File picker, autosave qua đổi tab/reload, lỗi lưu và thử lại, tìm kiếm mở note, timer → DB, email → task trên Electron thật |
| `node Frontend/tests/check-imports.mjs` | Đạt | Đường dẫn import frontend |
| `node Frontend/tests/check-html-refs.mjs` | Đạt | Tệp JS/CSS được HTML tham chiếu |

**Các test hiện có đạt không đồng nghĩa 18 chức năng đều đã hoàn thành.** Lỗi sửa lịch thi và các khoảng trống Sprint 1/3 vẫn nằm ngoài đợt hoàn thiện Sprint 2 này. Chưa đo độ phủ mã và không suy ra tỷ lệ phần trăm từ số test.

Kiểm tra tệp đích phát hiện các script cũ hiện không thể sử dụng nguyên trạng:

- `test:api` → thiếu `tests/API/test-api.js`.
- `test:sprint1` → thiếu `tests/API/test-database-sprint1.js`.
- `test:diemhoc` → thiếu `tests/CRWEB/test-diemhoc.js`.
- `test:giaima` → thiếu `tests/CRWEB/test-giaima.js`.
- `test:iu-sync` → thiếu `tests/API/test-iu-sync.js`.
- `start:iu` → thiếu `tests/CRWEB/test-iu.js`.

Không chạy các script thiếu tệp chỉ để tạo lại lỗi đã biết. Các lệnh kiểm thử ở bảng trên được thực thi bằng Node với đúng tệp/đối số tương ứng trong package.json; test Electron dùng wrapper hiện có. Log của lượt đánh giá được lưu tạm tại `C:/Users/tuan1/AppData/Local/Temp/unistudy-sprint-audit-QZzy7y/`.

Kho mã có báo cáo AI live và Electron trước đó (`docs/ai_live_result.json`, `docs/ai_e2e_result.json`, ngày 27/10/2026) ghi kết quả đạt với dữ liệu đã đồng bộ. Đây là bằng chứng lịch sử được đọc lại; lượt đánh giá này không đăng nhập lại IU/EDUX, không gọi Gemini thật và không kiểm tra lại dữ liệu cá nhân.

| Sprint | Tester | Sửa lỗi | Báo cáo |
|---|---|---|---|
| 1 | Có bộ kiểm thử thành phần/API và một số luồng giao diện; chưa bao phủ hết lỗi mới phát hiện. | Còn lỗi nhắc nhở, EDUX, lịch thi và khôi phục kế hoạch. | `bao_cao_sprin1.md` có sẵn nhưng một số trạng thái đã lỗi thời. |
| 2 | Có kiểm thử mới cho UI/API/SQLite/tệp thật và hồi quy. Provider Microsoft được giả lập trong test. | Đã nối các luồng và xử lý lỗi lưu/bản nháp. Chờ nghiệm thu tài khoản Outlook thật. | `hoan_thien_sprint2.md` là báo cáo cập nhật; báo cáo cũ được đánh dấu lịch sử. |
| 3 | Có kiểm thử API AI; chưa có E2E cho các màn Quiz/ôn thi AI/đơn nghỉ còn thiếu. | Cần hoàn thiện UI, lưu dữ liệu và nghiệm thu tích hợp tổng thể. | Có tài liệu AI và log thành phần; chưa thấy báo cáo nghiệm thu riêng đầy đủ cho Sprint 3. |

## 7. Thứ tự hoàn thiện đề xuất

1. **Chốt Sprint 1:** sửa lỗi form lịch thi còn lại; hoàn thành nhanh task/checklist phải bền sau reload; nối kế hoạch ôn thi và nhắc đến hạn; bổ sung test thao tác UI, sửa script hỏng và cập nhật báo cáo.
2. **Nguồn dữ liệu Sprint 2 đã triển khai:** timer, sổ tay, tệp thật, Time Map, tiến độ, tìm kiếm và tags đã nối UI/API/DB; giữ bộ kiểm thử tích hợp và hồi quy.
3. **Nghiệm thu Outlook Sprint 2:** mã đồng bộ và phân tích đã triển khai; đăng nhập tài khoản trường và xác minh tenant/Graph hoặc Outlook Web trên hộp thư thật.
4. **Hoàn thiện Sprint 3:** xây các màn kiểm tra kiến thức, tạo/xác nhận/lưu kế hoạch ôn thi AI và soạn đơn; nối kết quả kiểm tra vào phân tích điểm yếu; bổ sung E2E và báo cáo tổng thể.

Không nên chuyển toàn bộ backlog sang Done hoặc công bố Sprint nào đạt 100% chỉ dựa vào việc các bộ test hiện tại trả kết quả đạt.
