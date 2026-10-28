# API AI Sprint 2 – phần việc Văn Tuấn

**Cập nhật Sprint 3 (28/10/2026):** `/ask` đã lưu hội thoại, `/exam-plan` có buổi học và API xác nhận ghi bền; bổ sung Quiz, điểm yếu và lưu/xuất đơn. Hợp đồng mới và kết quả kiểm thử nằm trong [hoan_thien_sprint3.md](hoan_thien_sprint3.md). Các mô tả chỉ lưu RAM/preview trong tài liệu lịch sử này đã được thay thế.

Ngày cập nhật: 27/10/2026. Base URL: `http://localhost:3001/api/v1/ai`.

## Cấu hình và hợp đồng chung

```dotenv
GEMINI_TIMEOUT_MS=45000
```

Theo yêu cầu cập nhật, ứng dụng dùng [Gemini web](https://gemini.google.com/app) ở trạng thái **chưa đăng nhập**, tự mở phiên khách khi cần. Không cần cấu hình API key, model hay cookie tài khoản Google. `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_COOKIES` và cờ fallback cũ không còn được client sử dụng.

Client lấy phiên/build từ trang `/app`, gửi yêu cầu tới `StreamGenerate` và đọc phản hồi văn bản. JSON được yêu cầu qua prompt, sau đó kiểm tra cú pháp, schema và nghiệp vụ ở backend. Chỉ cookie khách trong danh sách cho phép được lưu ở `data/gemini/guest-session.json`; không đọc lại `session.json` cũ và không gửi cookie đăng nhập Google. Khi phiên khách lỗi, client mở lại phiên tối đa một lần. Nếu Gemini từ chối truy cập thì API trả lỗi rõ ràng. Cơ chế web phụ thuộc phiên bản giao diện Gemini, không có cam kết ổn định như API chính thức.

Thành công: `{ "success": true, "data": { ... } }`.

Lỗi trong module AI:

```json
{
  "success": false,
  "data": null,
  "message": "Gemini không phản hồi kịp.",
  "error": { "code": "GEMINI_TIMEOUT", "message": "Gemini không phản hồi kịp." }
}
```

Các mã HTTP: 400 input sai; 404 không có kỳ thi; 409 kế hoạch không còn hợp lệ hoặc chưa có hồ sơ để lưu; 502 lỗi kết nối/provider/JSON/schema; 503 phiên khách chưa truy cập được hoặc bị giới hạn yêu cầu; 504 quá thời gian. JSON/schema sai được tạo lại tối đa một lần. Mỗi request đến provider có deadline và giới hạn phản hồi 2 MiB. Frontend chờ tối đa 180 giây cho các thao tác AI. Lỗi parse HTTP body xảy ra trước router được middleware Express chung xử lý.

Ứng dụng hiện sử dụng **một hồ sơ**, lấy `APP_USER_ID` hoặc mặc định 1, theo `API/shared/nguoiDung.js`. Không lấy studentId từ request để chọn dữ liệu của người khác. Đây chưa phải hợp đồng phân quyền cho hệ thống nhiều tài khoản.

## Ngữ cảnh học tập

`API/shared/study-context.js` export `setDb(db)`, `buildStudyContext(studentId, options?)`, `normalizeDate`, `normalizeTime`, `normalizeDateTime`.

| Trường | Nguồn |
| --- | --- |
| `profile` | `layHoSo` |
| `timetable` | `layThoiKhoaBieu` |
| `studySchedules` | `layLichTuHoc`, bỏ lịch hủy |
| `assignments` | Deadline nội bộ + bài EDUX chưa hoàn thành, sắp theo hạn |
| `exams` | `layLichThi` |
| `grades` | `layBangDiem`, giữ điểm thiếu là null |
| `documents` | Bảng `Documents`/`StudyDocuments` nếu có, hoặc snapshot từ trình duyệt |
| `notes` | Bảng `Notes`/`NotebookPages`/`Notebooks` nếu có, hoặc snapshot từ trình duyệt |

Ngày chuẩn `YYYY-MM-DD`, giờ `HH:mm`, datetime có `+07:00`; timestamp UTC được đổi sang giờ Việt Nam. `generatedAt` là ISO UTC và `timezone` là `Asia/Ho_Chi_Minh`. Ngày không tồn tại bị loại. Quy ước thứ: 2 = Thứ Hai, …, 8 = Chủ nhật.

Mặc định lấy tối đa 40 tiết học, 30 lịch tự học, 30 bài chưa hoàn thành, 20 lịch thi, 30 điểm, 15 tài liệu, 20 ghi chú. Nội dung mỗi ghi chú tối đa 1.200 ký tự; tài liệu 1.000 ký tự. Tổng JSON context tối đa 48.000 ký tự. `sources` báo `available`, `total`, `included`, `truncated`, `origin` và lý do nguồn thiếu. Dữ liệu thiếu không được thay bằng dữ liệu mẫu. Tên/chỉ số bị giới hạn không được hiểu là toàn bộ dữ liệu của sinh viên.

Frontend hiện lưu tài liệu và sổ tay trong localStorage, nên các request AI có thể gửi:

```json
{
  "studyData": {
    "documents": [{ "id": "doc-x", "title": "CSDL", "subject": "CSDL", "content": "Nội dung đã có" }],
    "notes": [{ "id": "note-x", "title": "Chuẩn hóa", "subject": "CSDL", "content": "Phụ thuộc hàm", "isDifficult": true, "tags": ["cần ôn"] }]
  }
}
```

Mỗi mảng tối đa 500 phần tử. Mảng truyền lên thay nguồn DB tương ứng trong request đó; không truyền thì dùng DB. Snapshot chỉ phục vụ yêu cầu AI, không ghi tài liệu/ghi chú xuống DB. Chỉ gửi metadata/văn bản hiện có, không đọc nội dung PDF khi chưa có bộ trích xuất. Các bảng tùy chọn phải có cột chủ sở hữu (`student_id`, `user_id` hoặc `owner_id`); truy vấn lọc theo hồ sơ đã được backend xác định.

## Các endpoint

| Method / path | Input chính | `data` trả về |
| --- | --- | --- |
| GET `/status` | Không | `ready:true`, `mode:"web-guest"`, `guest:true`, `authenticated:false`, `officialApi:false`, `message` |
| POST `/ask` | `question` (1–4.000 ký tự), `conversationId?`, `studyData?` | `answer`, `conversationId` |
| POST `/plan` | Xem dưới | `preview:true`, `persisted:false`, `sessions`, `rejected` |
| POST `/plan/confirm` | `confirmed:true`, `sessions` | `persisted:true`, `sessions` chứa ID lịch đã lưu |
| POST `/exam-plan` | `examId?`, `studyData?` | `preview:true`, `persisted:false`, `phases` |
| POST `/progress-advice` | `progress` object | `overview`, `comments`, `revisionSuggestions`, `unavailableMetrics`, `basedOnFields` |
| POST `/difficult-notes` | `studyData?` | `available`, `difficultNotesCount`, `topics`, `suggestions`, `source?` |
| POST `/check` | `question`, `answer`, `studyData?` | `verdict`, `feedback`, `corrections`, `revisionSuggestions` |
| POST `/summarize` | `text` hoặc `content` (tối đa 30.000 ký tự), `title?` | `title`, `summary` |
| POST `/draft-leave` | `date`, `reason`, `session?`/`period?`, `subject?`, `recipient?` | `draft`, `matchedClasses` |

`ask` gửi hồ sơ cùng ngữ cảnh thực và giữ ID hội thoại do Gemini trả về để tiếp tục lượt hỏi sau; tối đa 100 hội thoại trong RAM. Khi phải tạo lại phiên khách, các ID cũ được xóa để tránh tham chiếu sai phiên. `ready` phản ánh luồng khách đã sẵn sàng nhận yêu cầu, không thay thế kiểm tra kết nối thật. `draft-leave` chỉ soạn văn bản, không gửi email; lớp của ngày xin nghỉ được lọc trước khi giới hạn context để không bỏ sót khi lịch sử dài. Dữ liệu cá nhân thiếu dùng chỗ trống. `plan` và `exam-plan` lọc kỳ thi sắp tới trước khi giới hạn dữ liệu; lộ trình ôn thi không tự lưu.

### PB-23: lập kế hoạch và xác nhận

```json
{
  "startDate": "2026-11-02",
  "endDate": "2026-11-08",
  "freeStartTime": "19:00",
  "freeEndTime": "22:00",
  "durationMinutes": 120,
  "targetHours": 8,
  "subject": "Cơ sở dữ liệu",
  "daysOfWeek": [2, 4, 6, 8]
}
```

`startDate`, `endDate` bắt buộc; khoảng ngày tối đa 31 ngày. Khung giờ mặc định 07:00–22:00, có thể truyền alias `freeStartHour`/`freeEndHour`. `durationMinutes` mặc định 60, hoặc truyền `durationHours`; phạm vi 30–240 phút. `targetHours` tùy chọn, lớn hơn 0 và tối đa 50, là tổng mục tiêu trong khoảng ngày được chọn. `daysOfWeek` tùy chọn, dùng quy ước thứ của dự án.

Backend lấy khoảng trống từ thời khóa biểu và lịch tự học thực tế, rồi trừ **toàn bộ** lịch thi, kể cả kỳ thi nằm ngoài context đã cắt ngắn. Ngày thi thiếu giờ/thời lượng sẽ không được tự động xếp học. Lịch quá khứ bị loại. Sau khi Gemini phản hồi, backend đọc lại khoảng trống và kiểm tra từng buổi:

- Có ngày/giờ/tiêu đề/môn hợp lệ; nằm trong phạm vi ngày và khoảng trống thật.
- Thời lượng 30–240 phút, không trùng với các buổi đề xuất đã chấp nhận.
- ID bài tập/kỳ thi tham chiếu phải nằm trong dữ liệu được cung cấp.
- Tối đa 30 buổi; tổng thời lượng không vượt `targetHours` nếu có.

```json
{
  "success": true,
  "data": {
    "preview": true,
    "persisted": false,
    "sessions": [{ "id": "ai-preview-1", "date": "2026-11-02", "start": "19:00", "end": "21:00", "title": "Ôn chuẩn hóa", "subject": "CSDL", "reason": "Chuẩn bị bài tập", "assignmentId": null, "examId": null, "durationMinutes": 120, "preview": true }],
    "rejected": [{ "index": 1, "reason": "not-in-free-slot" }],
    "availableFreeSlots": 5
  }
}
```

Frontend hiển thị preview và chỉ gọi `/plan/confirm` khi người học bấm **Xác nhận & lưu lịch** hoặc **Áp dụng vào lịch học**. Truyền `sessions` đã chọn và `confirmed:true`. Backend kiểm tra lại lịch hiện tại, lưu cả nhóm bằng transaction và đánh dấu `is_ai_suggested=1`. Một buổi không hợp lệ thì cả nhóm không được lưu. Gửi lại lịch đã lưu bị từ chối do trùng lịch. Endpoint xác nhận không gọi Gemini và không ép ghi đè xung đột. Lịch chỉ dùng `subject` dạng chữ trong preview; chưa tự ánh xạ môn tự do sang khóa ngoại `subject_id`.

Trang Kế hoạch học tập dùng phạm vi 7 ngày tới và khung giờ người học chọn. Modal Gợi ý AI trong Thời khóa biểu cho chọn khoảng ngày cụ thể. Thẻ kế hoạch trong bộ nhớ phiên là bản preview; các buổi đã xác nhận được lưu trong `StudySchedules` và tải lại qua API lịch. Sửa/xóa thẻ kế hoạch chỉ tác động thẻ; chỉnh sửa/xóa buổi đã lưu thực hiện ở Thời khóa biểu.

### PB-33, PB-34: nhận xét tiến độ

```json
{
  "progress": {
    "studyTimeMinutes": 120,
    "completedSessions": 3,
    "tasks": { "total": 8, "completed": 2, "completionRate": 25 },
    "subjects": [{ "name": "CSDL", "totalTasks": 4, "completedTasks": 1 }]
  }
}
```

`generateProgressAdvice(progress)` chỉ nhận số liệu caller cung cấp, không tự suy ra giờ học từ lịch dự kiến. Frontend gửi số liệu Pomodoro/công việc thực tế, bỏ hẳn nhóm số liệu không có dữ liệu. Object rỗng, chỉ có metadata hoặc toàn null trả thông báo chưa đủ dữ liệu và không gọi Gemini. Giá trị số 0 có thật vẫn được giữ. `unavailableMetrics` cho biết nhóm chưa có dữ liệu. Backend bỏ các nhận xét chứa số dạng chữ số không xuất hiện trong input; đây là bước lọc bổ sung, không đảm bảo phát hiện mọi suy luận sai bằng ngôn ngữ của mô hình. Kết quả nhận xét không được dùng để cập nhật số liệu thống kê.

### PB-38: ghi chú khó hiểu

`analyzeDifficultNotes(studentId, options?)` chọn ghi chú có `isDifficult`/`is_difficult`/`needs_review` hoặc tag `khó`, `khó hiểu`, `cần ôn`, `difficult`, `hard`, `needs review`. Lọc ghi chú khó trước khi giới hạn 50 ghi chú và giới hạn tổng context. Chỉ các ghi chú này được gửi Gemini. Không có nguồn/không có ghi chú khó thì không gọi Gemini. Mỗi chủ đề kết quả phải tham chiếu ít nhất một ID ghi chú có thật; ID lạ và chủ đề không có tham chiếu bị loại.

Giao diện Sổ tay có checkbox **Đánh dấu khó hiểu / cần ôn** và nút **AI gợi ý ôn ghi chú khó**. Phần Tiến độ có nút **AI nhận xét & gợi ý ôn tập**. Nội dung kết quả được hiển thị dưới dạng văn bản; preview lịch escape HTML.

Trạng thái đang phân tích và kết quả được giữ ngoài DOM trong `ai-analysis.store.js`, nên không mất khi shell dựng lại trang trong lúc chờ Gemini. Nhận xét tiến độ được gắn với đúng chu kỳ/ngày đang xem. Yêu cầu trùng khi đang chờ bị chặn; kết quả được escape trước khi render.

## Kiểm thử

```powershell
npm run test:ai
node tests/API/test-ai-api.js
npm run test:frontend
node Frontend/tests/check-imports.mjs
node Frontend/tests/check-html-refs.mjs
npm run test:ai:live
npm run test:ai:e2e
```

`test:ai` chạy HTTP Gemini khách giả lập, Express và SQLite thật trong thư mục tạm; kiểm tra context, timezone, giới hạn payload, quyền sở hữu nguồn tùy chọn, xung đột, lịch thay đổi trong lúc chờ, xác nhận/transaction, thiếu số liệu, ghi chú khó, JSON/schema, lỗi provider và timeout. Test cũng kiểm tra không gửi API key hoặc cookie đăng nhập dù cấu hình cũ vẫn còn. `test-ai-api.js` kiểm tra luồng khách mặc định, cũng dùng DB/session tạm.

`test:ai:live` tạo bản sao database đã đồng bộ, kiểm tra context và 10 tình huống với Gemini thật: hỏi đáp, tiến độ/điểm, lập kế hoạch đối chiếu toàn bộ lịch IU/thi, xác nhận và đọc lại file SQLite, chặn lưu lặp, xử lý kỳ thi thực tế, nguồn ghi chú thiếu, tóm tắt EDUX, kiểm tra đáp án và soạn đơn khớp ngày. Kết quả được ghi vào `docs/ai_live_result.json` bằng số lượng/trạng thái, không chứa thông tin cá nhân. Không sửa database gốc.

`test:ai:e2e` dùng Electron ẩn, Gemini thật, bản sao SQLite và browser storage riêng. Kiểm tra giao diện nạp dữ liệu CMC, preview chưa lưu, xác nhận lưu, tải lại lịch, ghi chú khó từ trích đoạn EDUX thật và nhận xét tiến độ. Test chủ động dựng lại shell khi đang chờ để kiểm tra kết quả không bị mất. Ghi chú kiểm thử nằm trong storage riêng, không phải ghi chú của người dùng. Báo cáo nằm ở `docs/ai_e2e_result.json`. Trên môi trường đặt `ELECTRON_RUN_AS_NODE`, bỏ biến này khỏi tiến trình trước khi chạy Electron. Helper chỉ xóa thư mục test đã xác định bên trong thư mục tạm sau khi Electron thoát và nhả file Chromium.

`npx electron tests/API/test-cmc-session-live.cjs` là kiểm tra bổ sung phiên IU trong đúng partition cục bộ của ứng dụng, chỉ đọc hồ sơ khi phiên còn hiệu lực; không tự mở cửa sổ đăng nhập. Không cần kiểm tra phiên này để dùng dữ liệu đã đồng bộ trong SQLite. Kết quả nghiệm thu hiện tại nằm trong `docs/ket_qua_kiem_thu_ai_sprint2.md`.
