# API và đồng bộ

API mặc định: `http://localhost:3001/api/v1`. Tài liệu mô tả các hợp đồng chính theo mã hiện tại ngày **30/10/2026**; method, thứ tự route và validator chi tiết được giữ trong [routes](../API/routes/index.js), [validators](../API/validators/) và [test hợp đồng](../API/tests/contract.test.cjs).

## Quy ước chung

- JSON thường trả `{ "success": true, "data": ... }`; một số endpoint đồng bộ có `jobId`, trạng thái và kết quả ở cấp ngoài. Không giả định mọi response cùng một envelope.
- Lỗi chung trả `{ "success": false, "message": "..." }`; ngoài production có thể có `stack`. Nhóm AI bổ sung `data: null` và `error: { code, message }`.
- File tải xuống trả nhị phân với `Content-Type`/`Content-Disposition`, không bọc JSON. Một số tài liệu có thể chuyển hướng đến URL nguồn.
- Body JSON tối đa 10 MB. Upload tài liệu dùng `application/octet-stream`, tối đa 25 MB; metadata là JSON mã hóa bằng `encodeURIComponent` trong header `X-Document-Meta`.
- Ngày lịch `YYYY-MM-DD`, giờ `HH:mm`, tính theo UTC+7. Timestamp có offset hoặc `Z`; không dùng chuỗi ngày theo locale để truyền API.
- API dùng `APP_USER_ID`, mặc định 1; không có luồng đăng ký/đăng nhập JWT hay role nội bộ. Phiên IU/EDUX/Outlook chỉ phục vụ kết nối nguồn tương ứng.

| HTTP | Trường hợp điển hình |
| --- | --- |
| `200`, `201` | Đọc/cập nhật thành công hoặc tạo dữ liệu. |
| `202` | Đã nhận job; cần theo dõi trạng thái, chưa phải hoàn tất. |
| `400` | Thiếu/sai input, ID hoặc ngày không hợp lệ. |
| `401` | Thiếu/hết phiên cổng dữ liệu ở những route có yêu cầu phiên. |
| `404` | Route/job/hồ sơ/bản ghi không tồn tại, hoặc bản ghi ngoài hồ sơ đang dùng. |
| `409` | Xung đột lịch/trạng thái ở route có kiểm tra tương ứng. |
| `413` | Nội dung vượt giới hạn kích thước của luồng tương ứng. |
| `429` | Vượt giới hạn xử lý AI. |
| `500`, `503`, `504` | Lỗi nội bộ, database chưa sẵn sàng hoặc timeout ở luồng có hỗ trợ. |

Các mã trên phụ thuộc từng route. Time Map không có middleware JWT hay handler 504 riêng; không gán mọi mã lỗi chung cho mọi endpoint.

## Nhóm nghiệp vụ

Các path dưới đây nằm sau `/api/v1`.

| Nhóm | Endpoint chính | Hành vi |
| --- | --- | --- |
| Hồ sơ | `GET/PUT /student/profile`, `GET /student/grades`, `GET /student/subjects` | Hồ sơ, điểm và môn học của hồ sơ hiện tại. |
| Lịch trường | `GET /schedules`, `/schedules/by-date`, `/schedules/by-week`; `POST /schedules`, `DELETE /schedules/:id` | Đọc/ghi lịch, kiểm tra query/body theo validator. |
| Tự học | `GET/POST /schedules/study`, `PUT/DELETE /schedules/study/:id`, `PATCH /schedules/study/:id/status` | CRUD và trạng thái; các route conflicts/free-slots hỗ trợ kiểm tra giờ trùng/trống. |
| Công việc | `GET/POST /tasks`, `PUT/DELETE /tasks/:id`, `PATCH /tasks/:id/status`, `GET /tasks/upcoming` | Công việc nội bộ. |
| Checklist | `GET/POST /tasks/:taskId/checklist`, `PUT/DELETE /tasks/checklist/:id`, `PATCH /tasks/checklist/:id/done` | Các mục con; registry còn giữ alias `/checklist`. |
| Công việc EDUX | `GET /tasks/edux`, `GET /tasks/edux/:id`, `PATCH /tasks/edux/:id/status` | Dữ liệu EDUX đã lưu; phụ thuộc phạm vi môn IU đang học. |
| Nhắc nhở | `/notifications` | Đọc/tạo/xóa, đánh dấu và truy vấn nhắc sắp đến; xem [router](../API/routes/nhacnho.js). |
| Kỳ thi | `GET/POST /exams`, `PUT/DELETE /exams/:id`, `GET /exams/upcoming` | Kỳ thi thủ công và IU; xóa xử lý dữ liệu phụ thuộc trong transaction. |
| Ôn thi | `GET/POST /exams/study-plans`, `GET /exams/:examId/study-plans`, `PATCH /exams/study-plans/:id/status`, `DELETE /exams/study-plans/:id` | Các giai đoạn ôn thi và trạng thái. |
| Tổng quan | `GET /dashboard` | Tổng hợp hồ sơ, lịch, deadline, kỳ thi và nhắc nhở. |
| Thời gian/tiến độ | `GET /timemap`, `GET /progress` | Xem hợp đồng phía dưới. |
| Workspace | `/documents`, `/notebooks`, `/notes`, `/pomodoro`, `/search`, `/tags`, `/email` | Xem [router workspace](../API/routes/workspace.js) và hướng dẫn bên dưới. |

Fixture [endpoints.before.json](../API/tests/fixtures/endpoints.before.json) là mốc **trước refactor**, dùng để bảo vệ tương thích. Không dùng số route của fixture như inventory hiện hành sau khi thêm chức năng. Các kết quả smoke theo từng mốc nằm trong [TESTING](TESTING.md).

### Giới hạn thời gian khi lập lịch — cập nhật 04/11/2026

- `POST /schedules` phải có `startDate` và `startTime` hợp lệ, sau thời điểm hiện tại theo UTC+7. `POST /schedules/study` áp dụng cùng quy tắc cho `studyDate` và `startTime`; sai ngày/giờ hoặc lịch quá khứ trả HTTP 400.
- `PUT /schedules/study/:id` yêu cầu thời điểm tương lai nếu đổi ngày, giờ bắt đầu hoặc giờ kết thúc. Vẫn cho cập nhật thông tin của lịch sử khi giữ nguyên ngày/giờ, và cập nhật trạng thái qua route riêng.
- `GET /schedules/study/free-slots?date=YYYY-MM-DD&duration=60` từ chối ngày quá khứ. Khi tìm hôm nay, kết quả bắt đầu sớm nhất từ phút kế tiếp và chỉ giữ khoảng còn đủ `duration` phút. Truy vấn lịch sử bằng các route đọc lịch không bị giới hạn này.

## Đồng bộ IU, EDUX và Outlook

### Kết nối và theo dõi tác vụ

Trong Electron, renderer gọi `window.__uniStudySync.connectAll(options)`; `onConnectionProgress(callback)` trả hàm hủy listener. Kiểm tra phiên/đăng nhập các nguồn chạy độc lập. Sau bước kết nối, frontend tạo tác vụ dữ liệu:

```http
POST /api/v1/sync
Content-Type: application/json

{ "sources": ["IU", "EDUX", "OUTLOOK"] }
```

Không truyền `sources` thì mặc định lấy cả ba. Response `202` có `jobId`; theo dõi `GET /sync/status?jobId=...`. Rời trang không hủy tác vụ. Các yêu cầu trùng tập nguồn đang chạy dùng chung job.

| Endpoint | Kết quả |
| --- | --- |
| `GET /sync/sources` | Nguồn, kết nối, đang đồng bộ và lần đồng bộ cuối. |
| `GET /sync/status?jobId=...` | Trạng thái/progress/results; job lạ trả 404; bỏ ID để lấy job gần nhất hoặc `IDLE`. |
| `POST /sync/all` | Luồng tương thích cho caller cần chờ kết quả cuối, dùng cùng hàng đợi. |
| `GET /sync/current-courses` | Phạm vi môn đang học từ IU. |
| `POST /sync/refresh` | Làm mới dữ liệu theo luồng service. |
| `POST/DELETE /sync/iu/session`, `GET /sync/iu/status` | Lưu/ngắt phiên và đọc trạng thái IU. |
| `POST /sync/iu/pull`, `POST /sync/iu/group` | Đồng bộ IU toàn bộ hoặc nhóm. |
| `POST/DELETE /sync/edux/session`, `GET /sync/edux/status`, `POST /sync/edux/pull` | Đăng nhập/ngắt phiên, trạng thái và kéo EDUX. |

Job đi từ `PENDING` → `RUNNING` → `COMPLETED`, `PARTIAL` hoặc `FAILED`; có `progress`, `activeSource`, `results` với khóa `iu`, `edux`, `outlook`. Giữ tối đa 50 job hoàn tất trong RAM; khởi động lại API mất lịch sử job.

IU chạy trước EDUX để xác định môn. Nguồn lỗi không chặn nguồn còn lại; phần dữ liệu lấy chưa đủ có `partial: true`/`warningCount`. Lỗi xác thực yêu cầu đăng nhập lại qua `requiresLogin`; phiên hết hạn không tiếp tục báo đã kết nối.

### Giới hạn thời gian

Kiểm tra phiên tối đa 8 giây; đăng nhập EDUX 45 giây; IU/Outlook 180 giây để hoàn tất Microsoft/MFA. Tải EDUX mặc định 20 giây mỗi lượt, tối đa ba học phần đồng thời và giữ thứ tự kết quả. Timeout của một tác vụ đóng cửa sổ đăng nhập tương ứng, có thể thử lại bằng phiên còn dùng được.

API giữ session hoạt động trong RAM. Thông tin tài khoản EDUX còn được lưu JSON cục bộ để tự đăng nhập lại. `DELETE /sync/edux/session` xóa tài khoản đã nhớ **và bài tập EDUX đã lưu trong DB** của hồ sơ đang dùng; response có số bản ghi `removed`. Xem vị trí và sao lưu trong [kiến trúc](ARCHITECTURE.md).

### Cập nhật tín chỉ trong Hồ sơ — 05/11/2026

`POST /sync/iu/group` với `{ "nhom": "chuongtrinh", "luuDb": true }` tải thông tin chương trình, kết quả cá nhân để đối chiếu mã sinh viên, và danh sách học phần IU. Chỉ lưu chương trình/học phần; giữ bảng điểm, lịch học, lịch thi và thông tin cá nhân hiện có. Yêu cầu đồng thời được gộp.

Response có `persisted: true`, `totalProgramCredits` (có thể `null` khi IU chưa cung cấp), `savedDb`, `thatBai`, `message`. Chỉ báo đã lưu sau khi ghi DB thành công. Mã sinh viên không khớp trả 409; phiên thiếu/hết hạn trả 401, lỗi nguồn giữ dữ liệu cũ. Tổng chương trình chỉ nhận trường nguồn chính thức; không cộng các khối tự chọn hoặc gán một tổng mặc định. Bỏ `luuDb` để chỉ đọc nhóm mới; các nhóm cũ giữ hành vi.

Hồ sơ tự thử cập nhật khi thiếu tổng chính thức và có phiên IU dùng được; khôi phục phiên đã lưu qua Electron, không tự mở đăng nhập. Nút **Đồng bộ tín chỉ IU** cho phép kết nối lại và cập nhật ngay trên trang; nhập tay vẫn là lựa chọn riêng. Có tổng thì hiển thị tín chỉ đã tích lũy/tổng và tỷ lệ hoàn thành.

Mapping đã đối chiếu [diemhoc.js của IU](https://iu.cmcu.edu.vn/congthongtin/ApisCongSinhVien/Modules/hoctap/script/diemhoc.js): tổng chương trình lấy `rsDiemTrungBinhChung[].TONGSOTINCHICTDT` ở bản ghi toàn khóa hệ 10, loại `TRUNGBINHCHUNG`, lần tính 0. Khối kiến thức đọc `TONGSOTINCHICUAKHOI`, `SOBATBUOC`, `SODATICHLUY`; API hồ sơ trả thêm `available_block_credits`, `required_program_credits`, `block_earned_credits`. Các tổng này tách khỏi `total_program_credits` và `total_passed_credits`; không đổi 126 thành 129 hoặc 25 thành 28 khi khác phạm vi. Ô rỗng của cột đã có trên IU được cộng như 0 đúng quy tắc footer của trường; thiếu cả trường thì tổng vẫn là `null`.

### Lịch thi IU

- Khoảng lấy lịch thi là ngày đồng bộ theo Việt Nam đến **70 ngày sau**, gồm hai biên, độc lập khoảng thời khóa biểu.
- `soNgayLichThi` nhận số nguyên 1–70 ở `/sync/iu/pull` hoặc `/sync/iu/group` với `nhom: "lichthi"`; mặc định 70. `ngayBatDau`/`ngayKetThuc` của TKB không thay khoảng này.
- Quét theo tuần và các học kỳ giao khoảng; chuẩn hóa, gộp trùng, loại ngày ngoài khoảng. Giới hạn 70 ngày là quy tắc ứng dụng.
- Kết quả rỗng đã xác minh sẽ xóa cache lịch thi IU cũ; dữ liệu nguồn lỗi/không đủ phải giữ cache và báo lỗi. Kỳ thi tự nhập luôn được giữ.

### Deadline EDUX và thư Outlook

EDUX lấy lớp qua `GET /groups?subject_id=...`, rồi `POST /groups/get_subject_deadlines` với `{ model_ids, group_ids }` để đọc `start_time_subject`/`max_deadline`. Hạn bài kiểm tra lấy riêng từ `GET /exam/deadline/check/:modelId`, không tạo lượt làm bài. Nếu dùng hạn chung, giao diện ghi **Hạn học phần**; lỗi tạm thời giữ hạn gần nhất và báo kết quả một phần.

Outlook đọc Inbox qua Graph/OWA, lưu vào `SchoolEmails`. Các route `/email/status`, `/email/sync`, `/email/:id/refresh`, `/email/read`, `/email/:id/read`, `/email/:id/task`, `/email/:id/exam` hỗ trợ trạng thái, đồng bộ, nội dung, đánh dấu và chuyển đổi sau xác nhận. Bộ trích xuất chỉ lấy ngày/giờ có thật; thao tác tạo task/thi có chống trùng. Ứng dụng không gửi hoặc trả lời thư.

Electron giữ phiên Microsoft ở main process, hỗ trợ `outlook.office.com` và `outlook.cloud.microsoft`. Với headless, dùng `OUTLOOK_ACCESS_TOKEN` có quyền `Mail.Read`; quyền tenant và nội dung thư đầy đủ vẫn phụ thuộc tài khoản. Tham khảo [Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0).

## Time Map và Progress

`GET /timemap?from=2026-10-30&to=2026-11-05` bắt buộc hai ngày hợp lệ, `from <= to`, lấy cả hai đầu theo UTC+7. Response:

```json
{
  "success": true,
  "data": {
    "2026-10-30": [
      {
        "id": "class:12:2026-10-30",
        "type": "class",
        "startTime": "2026-10-30T08:00:00+07:00",
        "endTime": "2026-10-30T09:30:00+07:00",
        "title": "Lập trình Web",
        "isRequired": true
      }
    ]
  },
  "meta": { "sources": {}, "warnings": [] }
}
```

Đây là mẫu một block; response thực có các khoảng bận/trống và metadata nguồn. Các type: `exam`, `class`, `pomodoro`, `self-study`, `free-time`; khi overlap, ưu tiên theo thứ tự này. Lớp/thi có `isRequired: true`. Block bị tách nhiều phần có thể có hậu tố `:part-N`; ngày không bận có khoảng `free-time` cả ngày.

Nguồn gồm `Timetables`, `Exams`, `StudySchedules` và `PomodoroSessions`. Đọc `meta.sources`/`meta.warnings` để biết nguồn nào có sẵn; không dùng cảnh báo thiếu bảng `Pomodoros` trong báo cáo 24/10 làm trạng thái hiện tại.

`GET /progress?from=...&to=...` trả `{ success, data: { metrics, advice } }`. Metrics gồm công việc, giờ học, GPA theo học kỳ và kỳ thi tiếp theo. Mặc định `advice: null`; chỉ `?advice=true` mới gọi AI. Giờ học tính tập trung thực và loại thời gian Pomodoro/tự học chồng nhau. Khi AI thất bại, nhận xét dự phòng cần được hiểu đúng là fallback, còn metrics lấy từ DB.

Hiện `from`/`to` chỉ lọc phần giờ học; task metrics tính toàn bộ, GPA theo học kỳ và kỳ thi tiếp theo tính từ hôm nay. Không hiểu khoảng query này là bộ lọc cho tất cả metrics.

## AI và kế hoạch

| Endpoint | Mục đích |
| --- | --- |
| `GET /ai/status` | Kết quả kết nối gần nhất: `connection` là `unchecked`, `online` hoặc `unavailable`; `available` là `null` trước lần gọi thực tế, `ready` chỉ `true` sau khi provider trả lời. Có `checkedAt` và lỗi gần nhất, không tự gửi câu hỏi thử. |
| `POST /ai/ask` | `{ question, conversationId? }`; trả câu trả lời và thông tin hội thoại. |
| `GET /ai/conversations`, `GET /ai/conversations/:id` | Lịch sử đã lưu. |
| `POST /ai/plan`, `POST /ai/plan/confirm` | Xem trước rồi xác nhận kế hoạch tự học. |
| `POST /ai/exam-plan`, `POST /ai/exam-plan/confirm` | Xem trước rồi lưu giai đoạn/buổi ôn thi. |
| `POST /ai/check`, `/ai/summarize`, `/ai/draft-leave` | Kiểm tra nội dung, tóm tắt, soạn đơn. |
| `POST /ai/progress-advice`, `/ai/difficult-notes` | Nhận xét số liệu và ghi chú khó. |
| `GET/POST /ai/quizzes`, `GET /ai/quizzes/:id`, `POST /ai/quizzes/:id/submit` | Tạo/làm/nộp quiz; backend chấm điểm, không nhận điểm do client tự gửi. |
| `GET /ai/weaknesses`, `POST /ai/weaknesses/analyze` | Phân tích kết quả quiz đã nộp. |
| `GET/POST /ai/leave-drafts`, `PUT /ai/leave-drafts/:id`, `GET /ai/leave-drafts/:id/docx` | Lưu/sửa/xuất bản nháp đơn. |

Chat tối đa **32.000 Unicode codepoint**, văn bản tóm tắt **500.000 codepoint**, ngân sách prompt dùng chung 60.000. Ngữ cảnh và validator nằm trong [services](../API/services/trolyai.service.js) và [config AI](../API/utils/trolyai-config.js).

Kế hoạch tối đa 31 ngày, 30 buổi, tối thiểu 30 phút/buổi. Preview không ghi dữ liệu. Lúc xác nhận, service tải lại lịch đầy đủ, kiểm tra xung đột và ghi transaction. Xác nhận ôn thi dùng `requestId` để nhận lại kết quả khi gửi lặp; xác nhận tự học dùng hàng đợi và kiểm tra lịch, nên gửi lại sau khi đã lưu thường nhận `409` do xung đột. Ngữ cảnh đã rút gọn cho AI không thay nguồn lịch dùng khi xác nhận.

Client Gemini dùng payload web hiện tại và model mặc định công bố trên trang phiên khách. `GEMINI_TIMEOUT_MS` (mặc định 45 giây) giới hạn cả lần tạo câu trả lời, gồm mở phiên và thử lại; không cấp lại toàn bộ thời gian cho mỗi bước. Các công cụ trả JSON có thể tạo lại một lần khi JSON sai. Ngắt kết nối HTTP hủy lời gọi provider của chat, kế hoạch, kiểm tra, tư vấn, quiz và phân tích điểm yếu. AI Tutor có nút dừng, giữ câu hỏi khi hủy/lỗi và bỏ qua phản hồi đến muộn; kế hoạch vẫn chỉ được ghi khi xác nhận riêng.

### Tóm tắt văn bản dài

`POST /ai/summarize` nhận `{ text, title? }` (chấp nhận `content` thay `text`). Tới 12.000 UTF-16 code unit xử lý trong request; dài hơn trả `202` với `data.jobId`. Theo dõi `GET /ai/summary-jobs/:id`, hủy bằng `DELETE` cùng path.

Trạng thái job: `queued`, `running`, `completed`, `failed`, `cancelled`. Giữ tối đa 12 job, TTL 30 phút sau lần cập nhật khi không chạy; tối đa bốn tác vụ tóm tắt hoạt động, deadline job 10 phút. Hàng đợi AI chung tối đa năm lời gọi provider. Retry cùng nguồn/tiêu đề dùng lại phần đã xong trong RAM. API restart mất các job này; client cần giữ nguồn để gửi lại. Giới hạn/hành vi chi tiết nằm trong [ai-summary.service.js](../API/services/ai-summary.service.js).

## Học liệu theo môn và workspace

### Bảng điểm IU và ngữ cảnh học lực — 05/11/2026

Đồng bộ toàn bộ IU lấy danh sách học phần từ `LayKetQuaTichLuyTheoKhoi.rsChiTiet`; `LayThongTinChuongTrinhHoc` chỉ là danh sách chọn chương trình. Học phần chưa có điểm được lưu riêng trong `CurriculumSubjects`, gắn sinh viên/chương trình; không tạo `Grades`, không đưa vào GPA hoặc phạm vi môn đang học từ thời khóa biểu. `rsTongHop` được lưu riêng làm thông tin khối kiến thức, không cộng để suy ra tổng tín chỉ chương trình.

`GET /student/profile` trả thêm `program_id`, `program_name`, `total_program_credits`, `program_credits_source` (đường dẫn trường tổng trong response IU), `curriculum_synced_at`, `knowledge_blocks`. Tổng tín chỉ chỉ nhận từ trường tổng chương trình nhận diện được; không gán cố định 126. Nếu nguồn thiếu hoặc có các tổng cùng mức ưu tiên mâu thuẫn, không ghi đè tổng đã lưu của chính chương trình đó. Chuyển chương trình không mượn tổng của chương trình cũ. Phiên bản portal có tên trường khác cần đối chiếu response xác thực trước khi bổ sung alias.

`GET /student/subjects` giới hạn theo học phần thuộc chương trình hiện tại hoặc dữ liệu của sinh viên (điểm, lịch, bài tập, đăng ký). Mỗi học phần có `block_code`, `block_name`, `portal_status`, `curriculum_source`; tín chỉ riêng của chương trình có thể bằng 0 hoặc null. Danh sách chương trình được thay thế chỉ khi nhóm đã lấy thành công; nhóm lỗi/không được lấy giữ dữ liệu trước. `savedDb.curriculumCount` và kết quả job IU phản ánh số học phần chương trình. Hồ sơ tự tải lại sau sự kiện `workspace-updated`; tổng chính thức ưu tiên hơn tổng tự nhập.

Năm nhập học của mã CMC đúng dạng `B` + hai chữ ngành + hai số năm + bốn số thứ tự được lấy từ mã sinh viên: `BSE250047` → `enrollment_year: 2025`. Đồng bộ và lưu hồ sơ không gán cố định năm 2023; migration khi khởi động sửa các năm cũ không khớp mã. Mã ngoài định dạng này giữ năm được cung cấp, không suy đoán từ một cặp số bất kỳ. Giao diện ưu tiên cùng quy tắc khi còn nhận dữ liệu backend cũ; ngữ cảnh AI có thêm `profile.enrollmentYear`.

`GET /student/profile` có thêm `academic_summary`, gồm `overall`, `semesters`, `comparison`, `retakes`, `needsReview` và `gradeCount`. Nguồn `calculated_from_synced_iu_grades` là kết quả tính lại từ các dòng điểm đã đồng bộ, không phải bản sao một trường tổng kết gốc của portal. Mỗi phần tách `average10`, `average4`, `cumulative10`, `cumulative4`; tổng hồ sơ chọn kết quả hoàn tất mới nhất theo năm/kỳ/lần học của mỗi môn, còn bảng chi tiết vẫn giữ các lần học. Phần đối chiếu dùng đúng phạm vi tín chỉ hiển thị ở IU: tổng trung bình bao gồm môn có điểm chưa đạt, tích lũy dùng tín chỉ đã đạt; recap hệ 10 theo kỳ dùng tín chỉ đã đạt. Không đánh đồng hệ 10 với GPA hệ 4.

`GET /student/grades` giữ `score_4` gốc và `exam_attempt`. Đồng bộ IU giữ `P/NP` để hiển thị nhưng không đưa các môn này vào GPA; điểm thiếu không chuyển thành 0 hoặc tự gán điểm chữ B. Với bản ghi cũ chưa có điểm hệ 4 gốc, phép đổi điểm chữ là fallback; số gốc của IU được ưu tiên sau đồng bộ. Migration mở rộng bảng Grades có transaction, giữ grade_id, dữ liệu, index và ràng buộc chủ sở hữu. Không dùng tổng tín chỉ đã tải để giả làm tổng tín chỉ chương trình.

Ngữ cảnh AI có `academicHistory`, tổng hợp từ toàn bộ bảng điểm trước khi giới hạn các dòng chi tiết. Chat giữ tổng hợp theo kỳ và học lại khi rút gọn prompt; tư vấn tiến độ dùng lịch sử ở server và không nhận bản lịch sử thay thế do client gửi. Kế hoạch học/ôn thi cũng nhận phần đối chiếu. Lịch sử quá dài được giới hạn có cờ `truncated`; không suy ra điểm của môn chưa có kết quả hoặc quy kết năng lực cố định từ một vài điểm số.

| Endpoint | Hành vi |
| --- | --- |
| `GET /learning/courses`, `/learning/courses/:id` | Môn hiện tại, chương và slide đã tải. |
| `GET /learning/courses/:id/source`, `/learning/courses/:id/summary` | Nguồn đầy đủ và bản tóm tắt đã lưu. |
| `POST /learning/sync`, `POST /learning/courses/:id/summarize`, `GET /learning/jobs/:id` | Đồng bộ/tóm tắt theo job. |
| `POST /learning/cards/:id/review` | Đánh giá thẻ, chống ghi trùng bằng `requestId`. |
| `GET/POST /documents`, `PATCH /documents/:id/tags`, `DELETE /documents/:id`, `GET /documents/:id/file` | Upload, danh mục, tag, xóa và byte file. |
| `GET/POST /notebooks`, `PUT/DELETE /notebooks/:id`; tương tự `/notes` | Sổ/ghi chú; trang cấu trúc dùng JSON envelope version 1. |
| `GET /notes/:id/export`, `/notebooks/:id/export` | DOCX cho ghi chú văn bản cũ; trang Tiptap dùng export Markdown/HTML ở frontend. |
| `GET/POST/DELETE /pomodoro`, `GET /search`, `PATCH /tags/tasks/:id`, `/tags/edux/:id` | Phiên tập trung, tìm kiếm và tag công việc. |

Pipeline toàn môn đọc đủ nguồn, chia thành n phần nhỏ (giữ nhãn A/B và nhánh con để dùng lại cache), tóm tắt song song có giới hạn rồi tổng hợp đúng thứ tự, lưu kết quả trung gian SQLite để tiếp tục. Chỉ tạo flashcard từ bản tóm tắt cuối đã lưu. Lỗi tải nguồn không tạo bản tổng hợp giả; lỗi tạo thẻ vẫn giữ bản tóm tắt.

Học liệu EDUX chỉ lưu và trả nội dung văn bản, không cache ảnh hoặc cung cấp endpoint ảnh. Crawler `layNoiDungSlide(id, { includeImages: true })` vẫn có thể trả ảnh tạm trong bộ nhớ; luồng đồng bộ không bật tùy chọn này và lọc ảnh nhúng trước khi ghi SQLite.

**Chế độ tóm tắt thủ công và hàng đợi (04/11/2026):** `POST /learning/sync` chỉ quét/lưu slide, kể cả đồng bộ nền hoặc client cũ gửi `summarize: true`. Muốn chạy AI phải gửi riêng `POST /learning/courses/:id/summarize` từ nút người dùng. Các endpoint GET chỉ đọc dữ liệu/tiến trình, không tự khởi tạo đồng bộ hoặc AI.

Đồng bộ và tóm tắt chia sẻ hàng đợi FIFO trong runtime học liệu: một job đang chạy, các job khác `queued`. Cùng loại yêu cầu và cùng môn đang chạy/chờ trả lại job cũ; đồng bộ toàn bộ đang hoạt động bao phủ yêu cầu đồng bộ một môn. Tối đa 50 job hoạt động; đầy hàng đợi trả 429. `subjectId` tùy chọn của `/learning/sync` là ID học phần EDUX để đồng bộ một môn. Job kiểm tra lại scope IU/phiên EDUX khi đến lượt chạy; lỗi một job không ngăn job tiếp theo.

`GET /learning/courses` trả `jobs[]` đang chạy/chờ với `{ jobId, kind: "sync"|"summary", courseId, subject, status, queuePosition, phase, message, progress, currentSubject?, materialsUpdatedAt? }`. `queuePosition` bắt đầu từ 1, gồm yêu cầu đang chạy. `GET /learning/jobs/:id` trả thêm kết quả/lỗi khi kết thúc; trạng thái gồm `queued`, `running`, `completed`, `partial`, `failed`. Đồng bộ thiếu môn/slide là `partial`, không báo hoàn tất đầy đủ. Collector gọi lưu và cập nhật `materialsUpdatedAt` sau từng môn trước khi quét môn kế tiếp, nên client không phải đợi toàn bộ danh sách hay AI để đọc slide.

Job tóm tắt bổ sung `summaryStage: "parts"|"merge"`, `completedParts`, `totalParts`, `activeWorkers`, `parallelism`. Các trường này xuất hiện ở cả job chi tiết lẫn job trong catalog; `message` có tiến trình để client cũ vẫn hiển thị. `totalParts` có thể tăng khi provider yêu cầu chia nhỏ thêm. Metadata của bản tóm tắt mới lưu `totalParts`, `parallelism` của lượt đã tạo kết quả.

Hàng đợi nằm trong RAM, không tự chạy lại AI khi khởi động backend. Job đã kết thúc được giữ tối đa một giờ trong runtime; nguồn và kết quả AI đã ghi SQLite không bị xóa khi restart. Client mất job sau restart phải đọc lại catalog, hiển thị trạng thái chưa theo dõi được và để người dùng yêu cầu lại nếu cần.

Cấu hình học liệu: `LEARNING_AI_INPUT_CHARS` mặc định 60.000 (gồm chỉ dẫn/dữ liệu), mục tiêu `LEARNING_AI_PART_CHARS` 4.000 và `LEARNING_AI_SUMMARY_CHARS` 8.000, trần lưu `LEARNING_AI_STORED_CHARS` 120.000; `LEARNING_AI_TIMEOUT_MS` mặc định 120.000 ms. Các biến có giới hạn nội bộ trong [course-summary-ai.js](../API/utils/course-summary-ai.js). Pipeline này khác job tóm tắt văn bản RAM ở trên.

`LEARNING_AI_CONCURRENCY` mặc định **4**, giới hạn **1–5** lượt AI đồng thời/môn; vẫn chịu pool provider chung tối đa 5 của app. `LEARNING_AI_CHUNK_CHARS` mặc định **12.000**, giới hạn 512–30.000 và tự giảm theo ngân sách input. Nguồn được chia trước khi gọi AI, không chờ một yêu cầu lớn thất bại mới chia. N phần được dispatch độc lập, ghép theo thứ tự nguồn dù phản hồi về khác thứ tự; thường chỉ một yêu cầu tổng hợp cuối. Nếu tổng kết quả không vừa input, gộp các nhóm song song rồi tổng hợp tiếp. Mỗi request dùng ngữ cảnh độc lập, không chung lịch sử chat.

Một phần lỗi vẫn chờ các phần đang xử lý hoàn tất/lưu cache trước khi job thất bại và chuyển môn kế tiếp; không ghép kết quả thiếu thành thành công. Bấm lại chỉ xử lý phần thiếu rồi tổng hợp, cache v3 cũ giữ tương thích. Số worker và kích thước chunk không làm stale bản tóm tắt tốt đã lưu. Luồng AI Tutor tóm tắt văn bản cũng dùng cơ chế chia phần song song này, giữ hủy và giới hạn job hiện có.

Vở canvas `/textbook` chưa có hợp đồng đồng bộ backend. Cách lưu, export, giới hạn OCR/AI và sổ tay cấu trúc xem [FEATURES](FEATURES.md); mức xác minh live xem [TESTING](TESTING.md).

### Pomodoro có mục tiêu — 04/11/2026

`POST /pomodoro` giữ các trường thời gian cũ và nhận thêm `learningContext` tùy chọn cùng `completeTask` (boolean, mặc định false). Ví dụ phiên 15 phút:

```json
{
  "id": "client-generated-uuid",
  "startTime": "2026-11-04T09:00:00Z",
  "endTime": "2026-11-04T09:15:00Z",
  "actualStudySeconds": 900,
  "workDurationMinutes": 15,
  "status": "Hoàn thành",
  "focusSegments": [{ "start": "2026-11-04T09:00:00Z", "end": "2026-11-04T09:15:00Z" }],
  "learningContext": {
    "subjectId": 1,
    "taskId": "12",
    "taskSource": "PERSONAL",
    "goal": "Hoàn thành 3 bài JOIN",
    "outcome": "CONTINUE",
    "reflection": "Đã xong hai bài",
    "nextStep": "Làm tiếp bài LEFT JOIN"
  },
  "completeTask": false
}
```

- `subjectId`: số nguyên dương hoặc null. `taskId`: chuỗi tối đa 200 ký tự; khi có ID thì `taskSource` là `PERSONAL` (ID bài tập nội bộ) hoặc `EDUX` (external ID).
- `goal` tối đa 300, `reflection` tối đa 1.000, `nextStep` tối đa 500 ký tự. `outcome`: `UNRECORDED`, `DONE` hoặc `CONTINUE`. Đạt mục tiêu là tự xác nhận kết quả học, độc lập việc đồng hồ chạy đủ hay kết thúc sớm.
- Tên môn/việc của công việc liên kết được API lấy từ DB; không tin tên do client gửi. Công việc phải thuộc hồ sơ đang dùng và chưa bị ẩn/xóa; sai liên kết trả 404. Thiếu/sai giá trị trả 400.
- `completeTask: true` chỉ hợp lệ khi có công việc liên kết và `outcome: "DONE"`. Lưu phiên và đổi trạng thái công việc nằm trong cùng transaction. Với EDUX, chỉ cập nhật tiến độ được lưu trong ứng dụng, không gửi/nộp bài lên cổng trường.
- Gửi lại cùng `id` trong cùng hồ sơ trả bản ghi lần đầu, không ghi đè mục tiêu/kết quả và không tạo phiên trùng. Caller muốn thử lại cần giữ ID ban đầu.
- `GET /pomodoro` trả thêm `learningContext` và tên môn/việc chuẩn. Migration thêm `PomodoroSessions.learning_context` với mặc định `{}`, giữ tương thích lịch sử và caller cũ. Khởi động lại API/ứng dụng để áp dụng migration.

### AI chia nhỏ mục tiêu Pomodoro — 04/11/2026

`POST /ai/pomodoro-goals` nhận `{ goal, durationMinutes, subjectId?, taskId?, taskSource? }`. Mục tiêu bắt buộc, tối đa 300 ký tự; `durationMinutes` nhận 15, 25 hoặc 50. Khi có công việc, ID và nguồn theo cùng quy ước `PERSONAL`/`EDUX` của Pomodoro.

API lấy phạm vi kỳ hiện tại từ thời khóa biểu IU và xác minh công việc thuộc hồ sơ. Môn/công việc ngoài phạm vi hiện tại hoặc chưa xác định được kỳ trả 409; liên kết việc không tồn tại/không thuộc hồ sơ trả 404. Không chọn môn/việc thì vẫn có thể phân tích mục tiêu tự học. Phân tích chỉ dùng mục tiêu, môn và mô tả công việc liên quan; không gửi toàn bộ hồ sơ/lịch sử học cho provider.

Kết quả ở `data`: `{ goal, durationMinutes, subjectId, persisted: false, steps, note, cached? }`. `steps` có 2–5 mục `{ id, title, minutes, doneWhen }`; `minutes` là ước tính nguyên dương, tổng không vượt phiên, tên bước không trùng. Mỗi `title` tối đa 180, `doneWhen` tối đa 250, `note` tối đa 300 ký tự. Đầu ra không hợp lệ trả 502; lỗi provider được giữ như lỗi, không tạo nội dung thành công giả. Yêu cầu có thể bị hủy khi client sửa nội dung/rời form. Cache hợp lệ tối đa 5 phút, có giới hạn số mục.

Khi người dùng nhận checklist, `POST /pomodoro` có thể gửi `learningContext.microGoals`: tối đa 5 mục `{ id, title, minutes, doneWhen, completed }`. API kiểm tra độ dài, boolean hoàn thành và tổng thời gian, chuẩn hóa ID theo thứ tự, lưu trong JSON hiện có. Chỉ đánh dấu bước không tự hoàn thành công việc hoặc tạo lịch. Caller cũ không gửi trường này vẫn hoạt động.

### Bổ sung hợp đồng luồng học tập — 04/11/2026

Các form tạo môn dùng lại `GET /sync/current-courses`. `resolved !== true` không có nghĩa là được chuyển sang toàn bộ môn lịch sử. Khi sửa, frontend chỉ bổ sung lựa chọn đã lưu ngoài phạm vi hiện tại, giữ nguyên ID.

**Tài liệu:** `POST /documents` vẫn gửi byte tệp với header `X-Document-Meta` chứa JSON URI-encoded. Metadata thêm `subjectId` tùy chọn; API kiểm tra môn IU hiện tại, lấy tên/mã môn chuẩn và tự gắn `semester`, `academicYear` từ scope. Môn ngoài kỳ/chưa xác định kỳ trả 409 khi có chọn ID. Không chọn môn vẫn upload được với dữ liệu rỗng. `GET /documents` trả thêm `{ subjectId, semester, academicYear }`; `subject` rỗng khi thiếu phân loại để UI hiện “Chưa phân loại”. Metadata/tệp cũ không bị tự gán học kỳ hiện tại.

**Flashcard:** `GET /learning/courses/:id` thêm `cards[].forgottenCount`, là số lượt review `rating: "again"` của đúng user/thẻ trong `LearningReviews`. Giữ `dueAt`, `chapter`, `intervalDays`, `reviews`. Không thêm API ghi tự động khi hết chế độ 5 phút. `POST /pomodoro` nhận thêm `learningContext.topic` tùy chọn, tối đa 200 ký tự; mục tiêu `goal` vẫn độc lập với chương/chủ đề dùng để ôn.

**Checklist:** dùng lại `POST /ai/pomodoro-goals` với `{ kind: "task", goal, taskId, taskSource: "PERSONAL", durationMinutes: 240 }`. Phải có công việc đã lưu; API đọc tên/mô tả/deadline thuộc hồ sơ và môn kỳ này. Chế độ task cho ngân sách 15–480 phút (mặc định 240), trả bản nháp `persisted: false`, không tạo checklist. Các trường/giới hạn bước giữ như hợp đồng Pomodoro.

Sau khi sửa và xác nhận, `POST /tasks/:taskId/checklist` nhận `{ steps: [{ title, doneWhen, minutes }] }`, từ 1 đến 5 bước, kiểm tra chủ sở hữu công việc và lưu toàn bộ trong transaction. Lỗi một bước không lưu phần còn lại. Endpoint cũ `{ title, ... }` vẫn dùng được. Thêm/sửa một bước nhận `minutes` nguyên 1–480 và `doneWhen` không rỗng tối đa 250 ký tự nếu gửi. `GET /tasks/:taskId/checklist` trả thêm `estimated_minutes`, `done_when`. Không đổi trạng thái công việc/checklist khi tạo các bước.

**Quiz:** `POST /ai/quizzes` giữ `{ subject, topic, count, difficulty, sourceText? }`, thêm `source` tùy chọn:

```json
{ "subject": "SQL", "topic": "JOIN", "count": 5, "difficulty": "medium", "source": { "courseId": "edux-course-id", "chapterId": "chapter-id", "documentId": "slide-id" } }
```

Hoặc `source: { uploadId: "document-id" }`. API đọc lại nguồn thuộc user/môn hiện tại. Nguồn bài giảng có thể chọn toàn môn/chương/một tài liệu; từ chối nguồn lỗi/cached/không có văn bản. File upload chỉ đọc TXT/Markdown lưu cục bộ; định dạng khác trả 422 để người học chọn nguồn khác. Nội dung tối đa 15.000 ký tự, không cắt ngầm. Có `source` thì dùng nội dung đọc từ DB/tệp, không tin nhãn nguồn hoặc `sourceText` client tự gắn.

Quiz chi tiết trả `source` với `kind`, `id`, `title`, `chars` và danh sách `{ id, title, chapter }` của tài liệu bài giảng đã thực sự đọc. Lưu trong `AiQuizzes.source_json`. Không chọn nguồn là `kind: "general"` / “Kiến thức chung; không dùng tài liệu nguồn”; `sourceText` cũ là `provided-text`; quiz cũ chưa có provenance là `unspecified`, không khẳng định đã dùng tài liệu. Nguồn lỗi/sai schema AI không ghi quiz. Chấm bài và số liệu trước/sau vẫn do server tính từ đáp án đã nộp; không lấy điểm client gửi.

**Ôn thi:** `POST /ai/exam-plan` thêm `content` tùy chọn (nội dung ôn tối đa 8.000 ký tự). Session AI có thêm `objective` tối đa 500 và `selfTest` tối đa 1.000 ký tự, kèm `durationMinutes` tính từ `start/end`. API tạo mới từ chối session AI thiếu mục tiêu/bài tự kiểm tra. Preview không ghi database. `POST /ai/exam-plan/confirm` vẫn cần `confirmed`, `requestId`, `phases`, `sessions`; giữ mục tiêu/tự kiểm tra trong `StudySchedules.notes`. Hợp đồng xác nhận cũ vẫn tương thích, đồng thời kiểm tra lại lịch tương lai, trước giờ thi, trùng lịch và chủ sở hữu trong transaction.

Migration bổ sung cột checklist và provenance quiz, không xóa dữ liệu. Khởi động lại API/ứng dụng để áp dụng. Kết quả kiểm thử và giới hạn provider thật tại [TESTING](TESTING.md#các-luồng-học-tập--04112026).

### Khôi phục tóm tắt dài và từng lô Flashcard — 04/11/2026

Giữ endpoint thủ công `POST /learning/courses/:id/summarize` và FIFO hiện có; sync không tự gọi AI. `GET /learning/courses` và `GET /learning/courses/:id` bổ sung trong `summary`:

```json
{
  "format": "expanded",
  "targetChars": 8000,
  "actualChars": 9500,
  "notice": "AI trả bản tóm tắt dài hơn mục tiêu trình bày. Nội dung hợp lệ được giữ đầy đủ, không cắt bỏ.",
  "cardsState": { "status": "partial", "completedBatches": 1, "totalBatches": 4 }
}
```

`format` là `merged` (bản tổng hợp trong mục tiêu), `expanded` (bản AI hợp lệ dài hơn mục tiêu), `sections` (các phần AI đã hoàn tất; chưa có bản tổng hợp ngắn). Bản cũ có thể thiếu metadata này. `cardsState.status` là `pending`, `partial`, `complete`; bản cũ chưa có metadata trả `{}`. Đây là trạng thái tạo thẻ, độc lập trạng thái job đang chạy/chờ/lỗi. Thẻ từng lô đã persist được trả để ôn ngay; không coi `cardCount > 0` là toàn bộ lô đã hoàn tất. Lỗi job tạo thẻ vẫn có `stage: "cards"`, giữ tóm tắt hiện tại.

Mặc định `LEARNING_AI_PART_CHARS=4000`, `LEARNING_AI_SUMMARY_CHARS=8000` là mục tiêu prompt/trình bày. `LEARNING_AI_STORED_CHARS=120000` là trần lưu hợp lệ, giới hạn cấu hình 16.000–500.000 ký tự; catalog và pipeline dùng cùng trần này. `LEARNING_AI_INPUT_CHARS` vẫn kiểm tra kích thước request, nguồn cần thiết được chia theo ranh giới Unicode. Không cắt nguồn im lặng. Đầu ra vượt trần không được lưu thành công; chỉ có thể dùng các phần AI hợp lệ đã hoàn tất và ghi rõ định dạng theo phần.

Flashcard đọc các phần của bản tóm tắt đã persist; tối đa 3.500 ký tự/phần, tự giảm thêm nếu cấu hình input nhỏ. Mỗi lô thử tối đa 4/2/1 thẻ; JSON repair ở lô nhỏ nhất thêm tối đa một yêu cầu. Mỗi request vẫn có tối đa một retry lỗi mạng/timeout tạm thời. Schema được validate trước khi ghi. Migration thêm `LearningSummaries.format_json`, `cards_state_json`, bảng `LearningCardBatches`; thẻ và checkpoint lưu cùng transaction, gắn user/course/source/summary/batch. Chỉ bấm lại mới tiếp tục sau lỗi/restart; không tự phát lại AI. Cache summary v3 và bộ thẻ cũ hợp lệ giữ tương thích.

`GET /learning/courses/:id/summary` vẫn tải TXT, không đổi sang JSON. Metadata hiển thị lấy từ danh mục/chi tiết môn. Nội dung TXT dạng `sections` có lời ghi rõ chưa có bản tổng hợp ngắn. Dịch vụ tóm tắt văn bản của AI Tutor cũng trả thêm `format`, `targetChars`, `actualChars`, `notice` bên cạnh `title`, `summary` khi có metadata.
