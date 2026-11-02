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
| `GET /ai/status` | Trạng thái provider. |
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

### Tóm tắt văn bản dài

`POST /ai/summarize` nhận `{ text, title? }` (chấp nhận `content` thay `text`). Tới 12.000 UTF-16 code unit xử lý trong request; dài hơn trả `202` với `data.jobId`. Theo dõi `GET /ai/summary-jobs/:id`, hủy bằng `DELETE` cùng path.

Trạng thái job: `queued`, `running`, `completed`, `failed`, `cancelled`. Giữ tối đa 12 job, TTL 30 phút sau lần cập nhật khi không chạy; tối đa bốn tác vụ tóm tắt hoạt động, deadline job 10 phút. Hàng đợi AI chung tối đa năm lời gọi provider. Retry cùng nguồn/tiêu đề dùng lại phần đã xong trong RAM. API restart mất các job này; client cần giữ nguồn để gửi lại. Giới hạn/hành vi chi tiết nằm trong [ai-summary.service.js](../API/services/ai-summary.service.js).

## Học liệu theo môn và workspace

| Endpoint | Hành vi |
| --- | --- |
| `GET /learning/courses`, `/learning/courses/:id` | Môn hiện tại, chương và slide đã tải. |
| `GET /learning/courses/:id/source`, `/learning/courses/:id/summary` | Nguồn đầy đủ và bản tóm tắt đã lưu. |
| `POST /learning/sync`, `POST /learning/courses/:id/summarize`, `GET /learning/jobs/:id` | Đồng bộ/tóm tắt theo job. |
| `GET /learning/images/:file` | Ảnh cache theo hash và định dạng được cho phép. |
| `POST /learning/cards/:id/review` | Đánh giá thẻ, chống ghi trùng bằng `requestId`. |
| `GET/POST /documents`, `PATCH /documents/:id/tags`, `DELETE /documents/:id`, `GET /documents/:id/file` | Upload, danh mục, tag, xóa và byte file. |
| `GET/POST /notebooks`, `PUT/DELETE /notebooks/:id`; tương tự `/notes` | Sổ/ghi chú; trang cấu trúc dùng JSON envelope version 1. |
| `GET /notes/:id/export`, `/notebooks/:id/export` | DOCX cho ghi chú văn bản cũ; trang Tiptap dùng export Markdown/HTML ở frontend. |
| `GET/POST/DELETE /pomodoro`, `GET /search`, `PATCH /tags/tasks/:id`, `/tags/edux/:id` | Phiên tập trung, tìm kiếm và tag công việc. |

Pipeline toàn môn đọc đủ nguồn, chia A/B và các phần nhỏ, lưu kết quả trung gian SQLite để tiếp tục; chỉ tạo flashcard từ bản tóm tắt cuối đã lưu. Lỗi tải nguồn không tạo bản tổng hợp giả; lỗi tạo thẻ vẫn giữ bản tóm tắt.

Cấu hình học liệu: `LEARNING_AI_INPUT_CHARS` mặc định 60.000 (gồm chỉ dẫn/dữ liệu), `LEARNING_AI_PART_CHARS` 4.000, `LEARNING_AI_SUMMARY_CHARS` 8.000; `LEARNING_AI_TIMEOUT_MS` mặc định 120.000 ms. Các biến có giới hạn nội bộ trong [course-summary-ai.js](../API/utils/course-summary-ai.js). Pipeline này khác job tóm tắt văn bản RAM ở trên.

Vở canvas `/textbook` chưa có hợp đồng đồng bộ backend. Cách lưu, export, giới hạn OCR/AI và sổ tay cấu trúc xem [FEATURES](FEATURES.md); mức xác minh live xem [TESTING](TESTING.md).
