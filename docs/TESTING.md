# Kiểm thử và bằng chứng

Tài liệu gồm kết quả lịch sử đến **30/10/2026** và [lượt xác minh bàn giao Sprint 4 ngày 02/11/2026](#xác-minh-bản-bàn-giao-sprint-4--02112026) (Asia/Saigon). Mỗi số liệu gắn với phạm vi và phiên bản tại thời điểm chạy; không cộng các bộ có giao nhau và không suy ra mọi dịch vụ ngoài đã được nghiệm thu.

**Dọn log ngày 04/11/2026:** đã đối chiếu kết quả trước khi chuyển 43 log kiểm thử vào `tests/artifacts/logs/2026-11-04/` (`root/` chứa 35 log cũ ở gốc, `artifacts/` chứa 8 log cũ trong thư mục artifact). Các tên `.log` ở phần lịch sử bên dưới giữ nguyên để nhận diện lượt chạy; vị trí mới tra trong [log-cleanup.json](evidence/log-cleanup.json). Báo cáo JSON/ảnh được giữ, không chạy lại test trong lượt sắp xếp file. Báo cáo chốt tại [SPRINT_4.md](SPRINT_4.md#chốt-báo-cáo-học-tập-và-dọn-log--04112026). Log mới nên ghi vào `tests/artifacts/logs/` thay vì thư mục gốc.

## Chạy kiểm thử

Chạy từ thư mục gốc, sau khi cài dependency ở gốc và trong `Frontend`. Trên PowerShell có thể dùng `npm.cmd` nếu execution policy chặn `npm.ps1`.

| Lệnh | Phạm vi |
|---|---|
| `npm run test:api` | Hợp đồng route, database, smoke/regression HTTP, AI/EDUX giả lập và nghiệp vụ học tập |
| `npm run test:database` | Module database, migration và lưu trữ |
| `npm run test:electron` | Entry Electron, preload, bridge IPC, khôi phục phiên, timeout đăng nhập và chuyển tham số đồng bộ; dùng mock và dữ liệu thử riêng |
| `npm run test:ai` | Ngữ cảnh, Unicode, job tóm tắt, retry/cancel, kế hoạch, quiz và học liệu |
| `npm run test:course-learning` | Môn hiện tại, ảnh/tài khoản EDUX, toàn bộ nguồn, tóm tắt, flashcard, refresh và khôi phục IU |
| `npm run test:learning-apis` | Lịch tự học, lịch thi, Time Map, Progress, thông báo và task/checklist |
| `npm --prefix Frontend test -- --maxWorkers=2` | Unit/integration React; giới hạn worker để giảm timeout khi máy bận |
| `npm --prefix Frontend run build` | Build production; chạy riêng với bộ test frontend |
| `npm run test:course-learning:e2e` | Electron + API + SQLite, provider giả lập |
| `npm run test:sprint2-complete:e2e` | Tệp, ghi chú, Pomodoro, tìm kiếm và email |
| `npm run test:sprint3:e2e` | Chat, quiz, điểm yếu, kế hoạch thi và đơn nghỉ |

Browser smoke chạy bằng `node tests/ai-browser-smoke.cjs`, `node tests/documents-browser-smoke.cjs`, `node tests/notebook-browser-smoke.cjs` và `node tests/structured-notebook-browser-smoke.cjs`. Mỗi script dùng profile riêng. Smoke trang Tài liệu cần API thật tại `localhost:3001`, tự mở Vite cổng 5177; sổ tay cấu trúc dùng Vite 5182 và adapter API giả lập. Đọc cấu hình script trước khi chạy cùng server khác.

Các bộ tích hợp chủ yếu dùng SQLite/thư mục tạm và mock provider. Những lệnh có hậu tố `:live`, crawler đăng nhập hoặc tài khoản thật có thể gọi dịch vụ ngoài; chạy riêng khi cần nghiệm thu kết nối. Artifact được lưu trong [tests/artifacts](../tests/artifacts/), không đặt báo cáo tự sinh vào `docs/`.

## Kết quả đã ghi nhận theo phạm vi

| Ngày / đợt | Kết quả | Ý nghĩa và giới hạn |
|---|---|---|
| Tái cấu trúc tầng API, trước đợt mở rộng 30/10 | 106/106 test, gồm 8 contract; nghiệp vụ 48/48; fixture 150/150 endpoint; 208 phép đối chiếu trên 52 khai báo route | So sánh method/path/thứ tự, status/body và tham số DB với bản chụp trước refactor; dùng provider localhost và SQLite tạm. Phân tích cú pháp, import/hướng phụ thuộc và whitespace API đạt. |
| 30/10, khắc phục báo cáo API | Regression 78/78; contract 8/8; EDUX mock 44/44; AI mock 21/21; nghiệp vụ 48/48; regression mở rộng 158/158 | Các nhóm giao nhau. Smoke lúc này 151/151 route phản hồi, không 5xx/timeout; không đồng nghĩa nghiệp vụ live đều đúng. |
| 30/10, củng cố AI | `test:ai` 74/74; `test:api` 89/89, gồm smoke 153/153 route; frontend 278/278 trong 30 tệp; AI browser 13/13 | Thêm hai route job tóm tắt so với mốc 151; Unicode, nguồn dài, hủy/retry, lưu SQLite và renderer Markdown. Không gọi AI live trong đợt này. |
| 30/10, trang Tài liệu | Frontend 289/289 trong 31 tệp; học liệu 48/48; EDUX HTTP 48/48; browser 21/21 | API danh mục/điều hướng thật; ảnh base64 và PDF là fixture. Desktop 1440px, tablet 834px, mobile 390px không tràn ngang. Phiên EDUX live đang ngắt kết nối. |
| 30/10, sổ tay canvas | Frontend 266/266 trong 29 tệp; browser 30/30 | Đây là mốc trước mở rộng AI. Kiểm tra vẽ/tẩy/thước, đối tượng, nhóm, clipboard, bảng/công thức, autosave, phục hồi, Undo/Redo, xuất SVG/PNG/JPEG/PDF. OCR chữ in nhận đúng `Smart Study Hub 2026`; không chứng minh OCR chữ viết tay/toán. |
| 30/10, sổ tay cấu trúc | Browser 26/26, không lỗi renderer | Dashboard, Cornell, autosave/reload, bản nháp khi mạng lỗi, trang con, định dạng, slash command, AI preview/chèn block và responsive. Toàn bộ request qua fixture/localStorage; backend 3001 không khả dụng; ảnh slide và AI đều giả lập có nhãn. |
| 28/10, Sprint 3 | Backend 14/14; Electron E2E đạt cả 5 luồng; Gemini live đạt | Đợt live tạo 3 câu quiz và kế hoạch thi 1 giai đoạn/4 buổi hợp lệ trên database tạm. Không thay thế nghiệm thu IU/EDUX/Outlook thật. |
| 27/10, Sprint 2 và AI | Sprint 2 complete 11/11; learning APIs 48/48; AI live HTTP 10/10; Electron AI 6/6 | AI dùng dữ liệu CMC đã đồng bộ: 87 buổi học, 10 điểm, 2 kỳ thi đã qua, 97 bản ghi EDUX. Kế hoạch xác nhận lưu và tải lại trên bản sao DB; dữ liệu gốc giữ nguyên. Không có kỳ thi tương lai/Pomodoro thật để nghiệm thu các tình huống đó. |

Build production đã đạt ở các đợt React trên; còn cảnh báo MathJax dùng `eval` và bundle công thức lớn. Chạy đồng thời build và toàn bộ test từng gây timeout; lượt xác minh Tài liệu với tối đa 2 worker đạt. Các số frontend khác nhau phản ánh các lần bổ sung chức năng, không phải một kết quả tổng hợp duy nhất.

## Những lỗi đã được khắc phục và việc cần xác minh lại

Đợt API 30/10 đã xử lý cập nhật/xóa báo thành công với bản ghi không tồn tại hoặc khác chủ sở hữu: trả 404, ID sai trả 400, kiểm tra bằng kết quả câu SQL; xóa kỳ thi giữ transaction cho dữ liệu phụ thuộc. `GET /progress` mặc định chỉ tính số liệu, `advice: null`; chỉ gọi AI khi `?advice=true`. Test EDUX cũ được cập nhật: chưa có phạm vi môn IU thì danh sách bài tập rỗng. Không tiếp tục coi các phát hiện cũ này là lỗi mở.

Audit UI **29/10 trên frontend cũ** kết luận chưa đạt, ghi nhận 10 lỗi: Escape của drawer mobile, tab workspace không focus được, task cho phép hạn bằng giờ bắt đầu, stored XSS từ tiêu đề task/lịch tự học/tên hồ sơ, `forceSave` không được backend hỗ trợ khiến lịch mất sau reload, modal không bẫy/trả focus và thiếu ARIA cho nhóm lọc. Chưa có biên bản tái kiểm đủ các lỗi này trên React hiện tại; không tự suy ra đã sửa hay vẫn tái hiện. Bằng chứng gốc: `tests/artifacts/qa-ui-audit-result.json`.

Đợt refactor API ghi nhận `test:exam-sync` **8/9 đạt**: một test import file frontend cũ đã bị xóa (`Frontend/src/features/sync/sync.service.js`). Tài liệu lịch thi trước đó từng ghi 9/9; kết quả refactor mới hơn cho thấy test cần cập nhật, không phải bằng chứng crawler live lỗi. Cần xác minh lại sau khi sửa test.

Trước nghiệm thu vẫn cần kiểm tra IU/EDUX/Outlook bằng tài khoản được cấp quyền (SSO, hết phiên, mất mạng, quyền tenant), ảnh EDUX sau đồng bộ lại, validation biên Task/Exam/Upload, double-click/submit lặp, hai cửa sổ sửa đồng thời, lỗi Dashboard/Progress/Search và refresh giữa form/timer. Zoom 200%, screen reader và phần cứng tablet/stylus/camera thật chưa có đủ bằng chứng.

## Giới hạn cần giữ khi đọc kết quả

- Outlook trường chưa nghiệm thu live. Graph có thể không được tenant cấp quyền; Outlook Web có thể chỉ có preview. Không tự suy ra ngày/giờ mơ hồ từ thư hoặc tự gửi email/tạo lịch chưa xác nhận.
- Ảnh EDUX/PDF trong browser smoke là fixture được ghi rõ. Dữ liệu thật từng trả 5 môn, 45 chương, 1.869 slide; cache cũ thiếu ảnh cần đăng nhập và đồng bộ lại, không kết luận EDUX không có ảnh.
- Sổ tay canvas lưu localStorage, chưa đồng bộ/cộng tác hoặc giải quyết xung đột nhiều tab; ảnh/tệp lớn có thể hết quota. Sổ tay cấu trúc có luồng API ghi chú nhưng kiểm thử trình duyệt nêu trên giả lập API. Tiến độ/bookmark/ghi chú slide Tài liệu vẫn lưu trên trình duyệt, tách theo sinh viên; chưa đồng bộ giữa thiết bị.
- OCR cần tải engine/ngôn ngữ lần đầu; viết tay, ảnh mờ và toán phức tạp cần sửa thủ công. Touch/pointer giả lập không xác nhận trải nghiệm lực nhấn thật; PDF xuất từ canvas được raster hóa.
- Gemini live từng đạt tại ngày chạy nhưng có thể thay đổi giao thức, lỗi mạng hoặc giới hạn. AI có thể sai kiến thức; mock chỉ xác minh xử lý dữ liệu/lỗi. Quiz tự chấm theo đáp án AI đã lưu, không thay thế đánh giá của giảng viên.
- Dự án dùng một hồ sơ cấu hình; không có role nội bộ để nghiệm thu phân quyền nhiều tài khoản. Kiểm thử quyền sở hữu dữ liệu không đồng nghĩa đã có hệ thống xác thực production.

## Bằng chứng lưu lại

Các đường dẫn dưới đây là vị trí artifact cục bộ được báo cáo ở các đợt trước, không phải tệp đi kèm repository. Một số ảnh/JSON lịch sử không có trong bản checkout hiện tại; chạy lại script tương ứng để tạo bằng chứng mới. Git bỏ qua `tests/artifacts/`.

| Nhóm | Báo cáo máy đọc được / ảnh |
|---|---|
| AI 30/10 | `tests/artifacts/ai-qa/browser-smoke.json` · `tests/artifacts/ai-qa/ai-desktop.png` · `tests/artifacts/ai-qa/ai-mobile.png` · `tests/artifacts/ai-qa/ai-notebook.png` |
| Tài liệu 30/10 | `tests/artifacts/documents-qa/browser-smoke.json` · `tests/artifacts/documents-qa/viewer-desktop.png` · `tests/artifacts/documents-qa/viewer-edux-base64-fixture.png` · `tests/artifacts/documents-qa/viewer-pdf.png` |
| Sổ tay canvas 30/10 | `tests/artifacts/notebook-qa/browser-smoke.json` · `tests/artifacts/notebook-qa/notebook-desktop.png` · `tests/artifacts/notebook-qa/notebook-narrow.png` |
| Sổ tay cấu trúc 30/10 | `tests/artifacts/structured-notebook-qa/browser-smoke.json` · `tests/artifacts/structured-notebook-qa/dashboard-desktop.png` · `tests/artifacts/structured-notebook-qa/editor-mobile.png` · `tests/artifacts/structured-notebook-qa/editor-focus-mobile.png` |
| AI 27/10 | `tests/artifacts/ai_live_result.json` · `tests/artifacts/ai_e2e_result.json` |

Các artifact ghi lại môi trường tại thời điểm chạy. Khi chạy lại, ghi rõ ngày, revision, mock/live, dữ liệu thử nghiệm và các ca chưa chạy; không thay `BLOCKED` hoặc `NOT TESTED` bằng `PASS` chỉ vì build thành công.

## Xác minh bản bàn giao Sprint 4 — 02/11/2026

Bản mã đã kiểm tra tại commit `1f0be43` hiện được đưa lên nhánh chính `main`; nền main cũ `faecc05` lưu ở nhánh `before`. Môi trường Windows, Node.js **24.16.0**, npm **11.13.0**; dependency cài bằng `npm ci` và `npm --prefix Frontend ci` từ hai lockfile. Kết quả dưới đây thuộc lượt xác minh bản bàn giao, khác các snapshot lịch sử phía trên. Việc chuyển nhánh sau đó chỉ sửa tài liệu/tham chiếu GitHub, không thay đổi mã ứng dụng đã kiểm tra.

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm run test:api` | **95/95 đạt** | Contract, hướng phụ thuộc, database, HTTP regression, EDUX/AI giả lập và nghiệp vụ học tập. |
| `npm run test:ai` | **74/74 đạt** | Context/Unicode, kế hoạch, summary jobs, retry/cancel, pipeline toàn môn và nghiệp vụ Sprint 3. |
| `npm run test:electron` | **31/31 đạt** | Entry/preload/IPC, khôi phục IU, lịch thi, timeout, phiên nguồn; mock Electron/provider. |
| `npm run test:course-learning` | **48/48 đạt** | Phạm vi môn IU, EDUX/học liệu/ảnh/tài khoản, tóm tắt/flashcard và refresh/khôi phục. |
| `npm run test:frontend-api` | **8/8 đạt** | Wrapper Axios thực gọi HTTP API và SQLite tạm, upload tiếng Việt, task/checklist, lịch, ghi chú/export/Pomodoro và lỗi validation. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **332/332 đạt, 37 file** | React/Vitest/jsdom với fixture; không thay cho kiểm tra browser/thiết bị thật. |
| `npm --prefix Frontend run build` | **Đạt** | Vite production, chạy sau bộ test frontend; còn cảnh báo MathJax dùng `eval` và chunk lớn. |

Inventory API xác nhận route cache ảnh đã được gỡ, đồng thời giữ kiểm tra unified sync, summary jobs và đủ 150 endpoint của fixture cũ đúng thứ tự. `tests/API/test-edux-content.js` kiểm tra lọc ảnh nhúng, không ghi cache khi đồng bộ và dọn ảnh EDUX cũ trong SQLite; `test-edux-materials.js` xác nhận crawler vẫn lấy được ảnh khi yêu cầu tường minh. Test lịch thi trong bộ Electron hiện đã chạy trên `electron/bridges/iu.js` và đạt; lỗi import frontend cũ nêu ở mốc refactor là thông tin lịch sử.

`npm ci` gốc báo 0 lỗ hổng; lần cài frontend báo 4 mức low. Không áp dụng nâng cấp dependency phá vỡ tương thích trong đợt tổng hợp này. Các nhóm test có giao nhau, không cộng thành một tổng duy nhất.

Chưa chạy lại browser smoke/offscreen E2E, Gemini live, đăng nhập/đồng bộ IU/EDUX/Outlook bằng tài khoản thật, kiểm thử thiết bị tablet/stylus/camera hoặc bộ cài máy sạch. Kết quả `test:frontend-api` cũng không nghiệm thu toàn bộ từng chức năng AI; mock/fallback và HTTP 404 được chủ động kiểm tra theo phạm vi script. Chi tiết công việc cần nghiệm thu nằm ở [Sprint 4](SPRINT_4.md) và issue #24–#28.

Log của lượt bàn giao lưu trong thư mục tạm hệ điều hành với tiền tố `smart-study-`, không commit log hoặc thông tin phiên. Bản source bàn giao chỉ chứa cấu hình mẫu, mã nguồn, test/fixture và tài liệu.

## Xác minh sửa lỗi thời khóa biểu — 04/11/2026

Kết quả thuộc bản chỉnh sửa cục bộ chưa commit trong phiên này. Lỗi đầu vào là form thêm/sửa lịch tự học gửi thừa `className` và `room`, khiến API trả “Trường className không được hỗ trợ.” Bản sửa tách dữ liệu theo loại lịch và ngăn nút chuyển tab tự gửi form.

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm --prefix Frontend test -- src/test/schedule-editor.test.jsx src/test/schedule-recurrence.test.js src/test/contracts.test.jsx src/test/routes.test.jsx` | **54/54 đạt, 4 file** | React/Vitest/jsdom, adapter API giả lập; form lịch, lịch lặp, hợp đồng dữ liệu và route. |
| `npm --prefix Frontend run build` | **Đạt** | Vite production; còn cảnh báo MathJax dùng `eval` và chunk lớn. |

Tại lượt sửa `className`, file mới `Frontend/src/test/schedule-editor.test.jsx` có 4 ca hồi quy (sau đó được bổ sung các ca ngày/giờ ở lượt rà soát bên dưới):

1. Thêm lịch tự học chưa phân loại: gửi `subjectId: null`, không gửi trường lớp/phòng.
2. Sửa lịch tự học có môn: dùng `PUT`, không gửi trường lớp/phòng, truyền đúng `excludeScheduleId` khi kiểm tra trùng lịch.
3. Chuyển từ tiết trên lớp về tự học: không gửi giá trị lớp/phòng còn lưu trong form; chuyển tab không kích hoạt yêu cầu lưu.
4. Thêm tiết trên lớp vào Chủ Nhật: giữ môn/lớp/phòng và đổi ngày sang `dayOfWeek: 8` theo hợp đồng backend.

Chưa chạy lại Electron/browser E2E hoặc kết nối nguồn trường thật cho bản sửa này. Kết quả trên không cập nhật lại các tổng kiểm thử lịch sử ngày 02/11.

## Rà soát ngày/giờ trên giao diện — 04/11/2026

Đối chiếu các ô ngày/giờ trong thời khóa biểu, công việc, kỳ thi/ôn thi, AI, hồ sơ và các bộ lọc. Danh sách lỗi và hành vi sau sửa nằm trong [báo cáo Sprint 4](SPRINT_4.md#rà-soát-lỗi-ngàygiờ-trên-giao-diện). Các kiểm thử thời gian cố định hiện tại ở **16:30 ngày 04/11/2026, UTC+7** và có ca qua nửa đêm Việt Nam để không phụ thuộc múi giờ máy chạy.

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `node --test API/tests/schedule-planning.test.cjs` | **12/12 đạt** | HTTP Express thật và SQLite tạm: từ chối lịch cũ, nhận lịch tương lai, giữ ghi chú/trạng thái lịch sử, không đổi ngày khi cập nhật bị từ chối, cắt giờ trống và biên nửa đêm UTC+7. |
| `npm run test:api` | **107/107 đạt** | Toàn bộ bộ kiểm thử API hiện có, bao gồm kiểm thử thời gian mới đã thêm vào script. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **367/367 đạt, 40 file** | Toàn bộ kiểm thử frontend sau tất cả chỉnh sửa, gồm các ca ngày sinh và ẩn kết quả giờ trống cũ. |
| `npm --prefix Frontend run build` | **Đạt** | Vite production trên bản sửa cuối; còn cảnh báo MathJax dùng `eval` và chunk lớn. |

Các ca mới bao gồm ngày hôm qua, giờ đã qua hôm nay, đúng phút hiện tại, form mở lâu rồi mới lưu, đổi lịch cũ sang một thời điểm quá khứ khác, sửa thông tin lịch sử mà giữ ngày giờ, ngày/giờ không hợp lệ, khoảng ôn đảo ngược/vượt ngày thi, kỳ thi đã bắt đầu hôm nay, khung AI đã hết, ngày sinh tương lai, kết quả giờ trống cũ và mặc định sau khung giờ học. Các ca hợp lệ kiểm tra vẫn lưu được lịch, hạn công việc và kế hoạch ôn tương lai.

Phần UI dùng React/Vitest/jsdom với adapter API giả lập. Phần HTTP mới dùng database tạm, không ghi vào dữ liệu người dùng hoặc đăng nhập nguồn trường. Chưa chạy lại Electron/browser E2E và chưa nghiệm thu IU/EDUX/Outlook hay Gemini thật trong lượt này. Các tổng kiểm thử lịch sử vẫn giữ theo từng mốc; không cộng các lượt có ca trùng nhau.

## Pomodoro: bố cục và phiên tập trung — 04/11/2026

Rà soát màn hình Pomodoro theo ảnh người dùng và các luồng đồng hồ/lưu phiên. Đây là lượt sửa lỗi ban đầu; ba nhóm nâng cấp được triển khai sau đó và ghi ở mục tiếp theo. Chi tiết nằm trong [báo cáo Sprint 4](SPRINT_4.md#pomodoro-sửa-bố-cục-và-bảo-vệ-kết-quả-học).

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm --prefix Frontend test -- src/test/pomodoro-flows.test.jsx src/test/pomodoro-data.test.js src/test/contracts.test.jsx src/test/learning-flows.test.jsx --maxWorkers=2` | **23/23 đạt, 4 file** | Luồng phiên học, pause/resume, lưu/thử lại, phục hồi, bảo vệ khi đổi chế độ/reset và thống kê qua nửa đêm. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **376/376 đạt, 42 file** | Toàn bộ frontend sau chỉnh sửa Pomodoro. |
| `node --test tests/API/test-sprint2-complete.js tests/frontend-api-integration.cjs` | **19/19 đạt** | HTTP và SQLite tạm; hợp đồng lưu Pomodoro, chống ghi lặp, khoảng tập trung, Time Map/tiến độ, lưu/mở lại database và wrapper Axios. |
| `npm --prefix Frontend run build` | **Đạt** | Vite production; còn cảnh báo MathJax dùng `eval` và chunk lớn. |

Hai file hồi quy mới: `pomodoro-flows.test.jsx` có 6 ca và `pomodoro-data.test.js` có 3 ca. Kiểm tra lưu loại trừ pause và thời gian chờ hộp thoại; phát sự kiện làm mới workspace; phiên lỗi mạng giữ nguyên ID/nội dung để thử lại; đổi chế độ/reset phải có lựa chọn giữ/lưu/bỏ; phiên hết giờ khi rời trang chỉ cộng tối đa 25 phút; nghỉ ngắn không được lưu thành học; thống kê UTC+7 tách đúng phần qua nửa đêm và không lỗi khi dữ liệu cũ thiếu timestamp; bản nháp hỏng/chồng khoảng bị bỏ qua.

Đã quan sát màn hình Electron trước sửa tại cửa sổ khoảng 1280 × 700 và xác nhận các nút bị đẩy xuống dưới vùng nhìn ban đầu. Khi chuẩn bị kiểm tra bản build mới, người dùng dừng Computer Use bằng phím Escape; không tiếp tục thao tác cửa sổ. Vì vậy **chưa xác nhận trực tiếp bố cục sau sửa trên Electron hoặc thiết bị di động**. Không tạo/xóa phiên trong dữ liệu thật qua giao diện; các thao tác lưu/xóa tự động được kiểm tra trên dữ liệu giả lập hoặc SQLite tạm.

## Nâng cấp Pomodoro có mục tiêu — 04/11/2026

Thực hiện cả ba nhóm nâng cấp sau khi người dùng chấp thuận; mô tả hiện tại nằm trong [Sprint 4](SPRINT_4.md#pomodoro-có-mục-tiêu--đã-triển-khai) và [hướng dẫn tính năng](FEATURES.md#pomodoro-thống-kê-và-email). Kết quả lượt sửa bố cục trước đó được giữ như một mốc riêng.

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `node --test API/tests/pomodoro-learning.test.cjs` | **9/9 đạt** | Express + SQLite tạm: nâng cấp schema cũ và chạy migration lặp, giữ lịch sử; lưu mục tiêu/tên môn chuẩn; chỉ hoàn thành việc khi chọn rõ; liên kết EDUX; từ chối việc ngoài hồ sơ/đã xóa; kiểm tra độ dài/kết quả; rollback khi cập nhật việc lỗi; gửi lại cùng ID và mở lại DB. |
| `npm run test:api` | **116/116 đạt** | Toàn bộ API, bao gồm kiểm thử Pomodoro có mục tiêu đã thêm vào script. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **391/391 đạt, 43 file** | Lượt hồi quy sạch, không chạy đồng thời với build. |
| `npm --prefix Frontend test -- src/test/pomodoro-flows.test.jsx src/test/pomodoro-data.test.js src/test/pomodoro-review.test.jsx src/test/learning-flows.test.jsx src/test/contracts.test.jsx --maxWorkers=2` | **38/38 đạt, 5 file** | Xác minh lại sau các điều chỉnh cuối: văn bản dài chuyển sang mục tiêu/quiz, bỏ lịch thi đã hủy, đồng hồ không bị chặn bởi EDUX và các luồng lưu/ôn lại. |
| `npm --prefix Frontend run build` | **Đạt** | Build production cuối sau khi hoàn thiện form kết quả; giữ các cảnh báo sẵn có về MathJax dùng `eval` và chunk lớn. |

Phía frontend bổ sung kiểm tra nhịp học/nghỉ 15/3 và 50/10, khóa nhịp/mục tiêu trong phiên, lưu mục tiêu gắn công việc có/không chọn hoàn thành, phần cần học tiếp, gợi ý nhịp ngắn hơn trước lịch lớp, xử lý lịch thiếu, EDUX tải chậm không chặn đồng hồ, khôi phục nhịp 50 phút và mục tiêu, tổng hợp tuần theo môn, kỳ thi qua nửa đêm/đã hủy, bỏ nhắc mục tiêu cũ đã đạt nhưng giữ mục tiêu khác còn dở trên cùng công việc, flashcard đúng môn và quiz điền sẵn chủ đề không tự gọi AI. Phần cần làm tiếp dài vẫn được giữ đầy đủ trong lịch sử; khi lấy làm mục tiêu mới giới hạn 300 ký tự, khi điền quiz giữ giới hạn môn/chủ đề 120/180 của API.

Lượt hồi quy chạy cùng build ban đầu có hai timeout ở các bài vở ghi (30 giây và 5 giây), không phải lỗi assertion nghiệp vụ. Lượt tiếp theo phát hiện ca bước tiếp theo dài; đã giới hạn mục tiêu mới và xác minh riêng ca này. Lượt hồi quy sạch cuối đạt đủ 391 ca; sau đó 38 ca liên quan được chạy lại cho các điều chỉnh cuối. Không sửa mã vở ghi hoặc tăng timeout để đạt kết quả. Các lượt có ca giao nhau, không cộng tổng.

Các thử nghiệm cập nhật/xóa dùng dữ liệu giả lập hoặc SQLite tạm, không thực hiện trên dữ liệu người dùng. Chưa nghiệm thu trực tiếp bản nâng cấp trên Electron/thiết bị thật, chưa đăng nhập nguồn trường hoặc gọi Gemini thật. Lựa chọn hoàn thành EDUX chỉ đổi tiến độ trong database ứng dụng, không nộp bài lên cổng trường.

## Môn kỳ hiện tại và AI chia nhỏ mục tiêu — 04/11/2026

Rà soát và triển khai theo phản hồi về danh sách môn trong Pomodoro và yêu cầu AI phân tích ô **Mục tiêu nhỏ của phiên**. Phạm vi môn dùng lại quy tắc IU hiện có trong `getCurrentCourseScope`; API AI mới phân tích bản xem trước, checklist chỉ được nhận khi người dùng chọn.

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm --prefix Frontend test -- src/test/pomodoro-goals.test.jsx src/test/pomodoro-flows.test.jsx src/test/pomodoro-data.test.js src/test/learning-flows.test.jsx src/test/contracts.test.jsx --maxWorkers=2` | **45/45 đạt, 5 file** | Chỉ môn/việc kỳ hiện tại, không fallback môn cũ, phân biệt khóa EDUX; nhập có khoảng chờ, nhận gợi ý có xác nhận, hủy/bỏ kết quả cũ, lỗi/thử lại, cache, checklist/tiến độ và phần cần làm tiếp. |
| `node --test API/tests/pomodoro-goals.test.cjs API/tests/pomodoro-learning.test.cjs tests/API/test-current-courses.js` | **25/25 đạt** | Lượt kiểm tra tập trung ban đầu: đầu ra AI có giới hạn, cache/hủy, phạm vi kỳ và công việc, lưu checklist/mở lại DB và quy tắc xác định môn hiện tại. Sau đó bổ sung ca phân biệt owner EDUX/ID học vụ và xác minh bằng bộ API đầy đủ. |
| `npm run test:api` | **126/126 đạt** | Toàn bộ API sau chỉnh sửa cuối; gồm route AI mới, kiểm tra chủ sở hữu và giữ các hợp đồng/route cũ. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **400/400 đạt, 44 file** | Toàn bộ frontend sau phần môn hiện tại và AI mục tiêu. |
| `npm --prefix Frontend run build` | **Đạt** | Vite production; giữ cảnh báo sẵn có về MathJax dùng `eval` và chunk lớn. |

`pomodoro-goals.test.jsx` mới có 9 ca: kiểm tra khoảng chờ sau nhập; phản hồi cũ không ghi đè mục tiêu mới; hủy khi đổi/bắt đầu; lỗi AI không chặn tự học và có thử lại; dùng đúng nhịp/cache; lọc môn hiện tại và không gọi danh sách môn lịch sử; trạng thái chưa xác định kỳ; không lẫn các khóa EDUX khác nhau; nhận checklist, tick và lưu tiến độ cùng bước cần làm tiếp. Kiểm thử phục hồi cũ được mở rộng để giữ checklist.

`API/tests/pomodoro-goals.test.cjs` dùng model giả lập có schema, kiểm tra qua HTTP: input/ngữ cảnh sai bị từ chối trước model, tên môn chuẩn, tổng phút không vượt phiên, cache kết quả hợp lệ, từ chối bước rỗng/trùng/quá thời lượng, self-study khi chưa xác định kỳ, owner EDUX độc lập ID học vụ và kết quả bị hủy không đi vào cache. Bộ lưu phiên kiểm tra thêm checklist được giữ sau mở lại database và từ chối checklist vượt thời lượng.

Lượt API ban đầu phát hiện fixture tổng giờ tuần tạo lịch 18:00 vào hôm nay, nên bị chặn đúng khi chạy sau 18:00. Đã chuyển fixture lịch sử hoàn thành sang DB tạm; ca tạo lịch mới hợp lệ vẫn đi qua HTTP. Không nới quy tắc cấm lập lịch quá khứ để cho test qua.

Các bộ trên dùng React/jsdom, model giả lập và/hoặc SQLite tạm. **Chưa chạy provider AI thật hoặc nghiệm thu trực tiếp trên Electron/thiết bị trong lượt này.** Chế độ mock hiển thị rõ dữ liệu mẫu; lỗi provider ở chế độ thật không được biến thành gợi ý thành công giả. Các tổng theo từng lượt có ca trùng nhau, không cộng lại.

## Các luồng học tập — 04/11/2026

Đây là lượt cải thiện 8 luồng sau mốc Pomodoro ở trên; các kết quả lịch sử được giữ nguyên theo từng lượt. Môi trường Windows, Node **24.16.0**, npm **11.13.0**, múi giờ nghiệp vụ UTC+7.

| Lệnh đã chạy | Kết quả thực tế | Loại kiểm thử |
| --- | --- | --- |
| `npm --prefix Frontend test -- --reporter=dot` | **420/420 đạt, 46 file** | React/Vitest/jsdom, API/provider giả lập; lượt cuối không chạy đồng thời với build. |
| `npm run test:api` | **137/137 đạt** | Contract/HTTP và database SQLite tạm; gồm `API/tests/learning-flows.test.cjs` mới. Không dùng dữ liệu người học thật. |
| `npm run test:ai` | **74/74 đạt** | Provider HTTP giả lập, API/SQLite, validation và lỗi/khôi phục; đây không phải Gemini thật. |
| `node --test tests/frontend-api-integration.cjs tests/API/test-sprint2-complete.js tests/API/test-current-courses.js` | **27/27 đạt** | Axios frontend → HTTP API thật, SQLite tạm; môn IU theo fixture, không đăng nhập trường. |
| `node tests/API/test-learning-flows-live.cjs` | **0/1 đạt: `GEMINI_TIMEOUT`** | Provider thật, dữ liệu công việc tổng hợp, không ghi DB ứng dụng. Báo cáo ở [learning-flows-live.json](evidence/learning-flows-live.json). Có thể chạy lại bằng `npm run test:learning-flows:live`. |
| `npm --prefix Frontend run build` | **Đạt, 10,46 giây** | Vite production sau lượt frontend cuối; còn cảnh báo MathJax dùng `eval` và chunk lớn. |
| `git diff --check` | **Đạt** | Không có lỗi whitespace trong diff. |

Bản tổng hợp số liệu đã đọc từ log thực tế: [learning-flows-tests.json](evidence/learning-flows-tests.json). Các bộ có ca giao nhau, không cộng tổng. Log chi tiết `frontend-final-tests.log`, `api-final-tests.log`, `ai-final-tests.log`, `learning-integration-tests.log`, `frontend-final-build.log` ở workspace được bỏ qua bởi `.gitignore`.

Các ca frontend mới nằm trong `learning-workflows.test.jsx` và `learning-flow-data.test.js`; giữ lại toàn bộ các ca cũ trong `learning-flows.test.jsx`. Mở rộng `pomodoro-flows.test.jsx` kiểm tra chủ đề ôn riêng với mục tiêu và khởi chạy 15 phút. Các fixture kiểm tra ngày/form trước đó được chuyển sang API môn kỳ hiện tại; không nới quy tắc cấm lịch quá khứ để test qua.

Phạm vi đã xác minh:

- Chỉ chọn môn IU hiện tại khi tạo; giữ môn kỳ cũ khi sửa; không gọi danh sách lịch sử khi chưa có kỳ. Sổ tay kỳ cũ vẫn có trong danh sách, form tạo mới chỉ gợi ý môn hiện tại.
- Flashcard đúng môn/chủ đề, phân biệt Chương 2 với Chương 20 và các khóa EDUX; ưu tiên đến hạn/từng quên từ dữ liệu thực; hết 5 phút không ghi kết quả tự động; thiếu thẻ có thông báo.
- File upload lưu mã/tên môn chuẩn, học kỳ/năm học thật và phân loại rỗng; bộ lọc giữ file đúng kỳ/trạng thái. Trạng thái học dựa vào các trang đã mở/đánh dấu thật, không tự coi file là hoàn thành.
- Checklist AI có bản nháp sửa trước khi xác nhận, lỗi AI vẫn thêm bước thủ công; phản hồi cũ và schema lỗi bị bỏ. Batch lưu đầu ra/thời lượng, giữ việc chưa hoàn thành, chặn dữ liệu ngoài hồ sơ và rollback khi có lỗi giữa chừng.
- Quiz chọn chương/tài liệu, 15 câu/độ khó; backend đọc văn bản thật của nguồn, từ chối nguồn khác môn/thiếu/không hỗ trợ và không ghi quiz khi AI trả sai schema. Khóa đáp án trước nộp; không hiện thành công khi phản hồi chấm thiếu điểm. Điểm trước/sau tính từ đáp án đã nộp, bỏ qua điểm client gửi.
- Ôn thi sửa mục tiêu trước khi xác nhận, không báo đã lưu nếu `persisted` sai. Bộ Sprint 3 xác minh mục tiêu/bài tự kiểm tra được giữ trong lịch, không ghi trước xác nhận, từ chối lịch trùng/sau giờ thi, rollback và gửi lại cùng mã xác nhận.
- AI Tutor nhận ngữ cảnh nguồn, danh sách chỉ còn kỳ thi tương lai; kết quả không tự gửi/lưu và không đổi công cụ giữa lúc xử lý.
- Migration thêm cột, chạy lặp và mở lại database giữ phân loại tài liệu, provenance quiz, đầu ra/thời lượng checklist và lịch sử.

Lượt frontend đầu còn 23 ca dùng hợp đồng/fixture cũ (ô nhập tự do, nhập mã kỳ thi và flashcard chưa có metadata chủ đề); đã sửa fixture tương ứng. Một lượt tiếp theo có một expected string bị sai mã tiếng Việt trong test; đã sửa và chạy lại đủ bộ. Không xóa test cũ để đạt tổng mới.

Giới hạn: kiểm thử tích hợp Axios có log Vite dependency scan lúc đóng server (`Request is outdated`), nhưng các assertion HTTP đều qua. Frontend có cảnh báo Recharts do jsdom không có kích thước thật. Chưa xác minh giao diện sau sửa trực tiếp trên Electron/browser/thiết bị, chưa đồng bộ IU/EDUX/Outlook thật. AI thật chỉ thử chia nhỏ công việc và timeout; chưa có bằng chứng live thành công cho quiz hoặc chia buổi ôn. Không dùng kết quả mock để kết luận chất lượng AI thật. PDF/DOCX/PPTX/ảnh tải lên hiện chưa được trích xuất làm nguồn quiz; API trả lỗi rõ, không giả nhận đã dùng chúng.

## Tóm tắt theo nút bấm và hàng đợi — 04/11/2026

Sửa sau yêu cầu bỏ AI tự tóm tắt khi quét slide. Mốc 420 ca ở trên được giữ như lịch sử; kết quả mới dưới đây dùng code hàng đợi FIFO và chế độ AI thủ công.

| Lệnh đã chạy | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm --prefix Frontend test -- --reporter=dot` | **426/426 đạt, 47 file** | Toàn bộ React/Vitest/jsdom; 6 ca hàng đợi mới trong `learning-queue.test.jsx`. |
| `npm run test:api` | **139/139 đạt** | HTTP/contract và SQLite tạm; thêm 2 ca FIFO/partial trong `API/tests/learning-queue.test.cjs`. |
| `npm run test:ai` | **75/75 đạt** | Provider giả lập; mở rộng `test-course-learning.js` để chỉ tóm tắt khi yêu cầu riêng và kiểm tra 6 môn chạy tuần tự toàn pipeline. |
| `node --test tests/API/test-edux-materials.js tests/API/test-schedule-refresh.js` | **8/8 đạt** | EDUX/HTTP fixture, callback lưu từng môn trước khi chuyển môn và tương thích sync nền. |
| `npm --prefix Frontend run build` | **Đạt, 9,61 giây** | Vite production sau test cuối; giữ cảnh báo MathJax `eval` và chunk lớn. |
| `git diff --check` | **Đạt** | Không có lỗi whitespace. |

Các ca frontend kiểm tra: tự nhận job nền chữ thường; cập nhật số chương/slide trước khi job kết thúc; mở môn không gọi AI; nút tóm tắt mới enqueue; chọn tiếp môn khác vẫn enqueue được, vị trí chờ 2; nút đồng bộ không gửi tóm tắt; thiếu học liệu là `partial`; môn chưa có nguồn có lý do; focus làm mới trang đang mở; lỗi mạng giữ catalog cũ. Các lần poll chỉ GET, không POST tự động.

Phía backend kiểm tra: đồng bộ mặc định/nền, kể cả cờ `summarize: true` cũ, không gọi AI; các yêu cầu scoped đồng bộ lần lượt và gộp yêu cầu trùng; 6 yêu cầu tóm tắt theo đúng thứ tự, số lời gọi AI đồng thời giữa các môn là **1**; đầu vào/tóm tắt/thẻ không lẫn môn. Một job lỗi vẫn chạy job tiếp theo; thiếu nguồn trả `partial`. Callback collector được kiểm tra đã giao dữ liệu môn trước trước khi gọi API chương môn sau. Các kiểm thử timeout, giữ tóm tắt cũ, rollback, đánh giá thẻ và mở lại DB vẫn được giữ.

Lượt API đầu phát hiện helper cleanup của `test-edux-api.js` chỉ nhận `completed/failed`; trạng thái `partial` mới khiến nó chờ hết hạn. Đã bổ sung `partial` là kết thúc và chạy lại toàn bộ API đạt 139 ca. Không nới quy tắc nguồn hoặc bỏ kiểm thử để đạt kết quả.

Quan sát live trước sửa chỉ đọc `GET /learning/courses`: có 4 môn/45 chương/1.869 slide và job đang ở pha AI, trong khi ảnh giao diện vẫn 0 chương. Không kích hoạt đồng bộ/AI thật để nghiệm thu bản mới, không khởi động lại tiến trình Electron đang dùng trong lượt này. Chưa xác minh trực tiếp UI sau build trên Electron/thiết bị. Kết quả provider thật timeout ở mốc trước vẫn giữ nguyên, không được thay bằng kết quả mock. Các bộ có ca giao nhau, không cộng tổng; báo cáo gọn tại [learning-queue-tests.json](evidence/learning-queue-tests.json).

## Khôi phục tóm tắt dài và JSON Flashcard — 04/11/2026

Mốc mới sau phản hồi “vượt độ dài yêu cầu” và JSON không hợp lệ. Các mốc ở trên là lịch sử trước sửa. Chạy bằng dữ liệu thử riêng; không cập nhật DB ứng dụng đang mở.

| Lệnh đã chạy | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm run test:ai` | **89/89 đạt** | HTTP provider giả lập/SQLite tạm. Thêm bộ `test-course-cards-ai.js`; giữ các ca safety/idempotency cũ. |
| `npm run test:api` | **139/139 đạt** | Toàn bộ contract/nghiệp vụ/HTTP và DB tạm. |
| `npm --prefix Frontend test -- --maxWorkers=2 --reporter=dot` | **427/427 đạt, 47 file** | Toàn bộ Vitest/jsdom; gồm thông báo bản dài, lỗi chỉ ở thẻ, số lô còn thiếu và chỉ retry khi bấm. |
| `npm --prefix Frontend run build` | **Đạt, 10,26 giây** | Production; còn cảnh báo MathJax `eval` và chunk lớn. |
| `npm run test:learning-recovery:live` | **0/1 đạt, 1 bước bỏ qua** | Provider thật, văn bản tổng hợp, không mở DB ứng dụng. Tóm tắt timeout `GEMINI_TIMEOUT` sau 25.562 ms; không tạo thẻ từ nguồn giả để thay cho tóm tắt chưa nhận. |
| `git diff --check` | **Đạt** | Không lỗi whitespace. |

Ca hồi quy trọng tâm:

- AI liên tục viết dài: rút gọn từ bản nháp thật; nếu vẫn dài thì giữ nguyên với `expanded`, không chia nguồn vô hạn hoặc cắt ngang. Draft sống qua lỗi rewrite; retry chỉ rewrite. Trần lưu trữ vẫn từ chối đầu ra quá lớn.
- Không gộp được do input/output quá lớn: dùng các bản tóm tắt AI A/B đã hoàn tất, giữ đúng thứ tự, ghi `sections` và chưa có bản tổng hợp ngắn. Lỗi mạng/schema/provider không biến thành thành công. Cache A/B cũ v3 không bị mất khi thêm trần lưu trữ.
- JSON lỗi/sai schema/response quá lớn: giảm lô 4/2/1, một repair hữu hạn ở lô nhỏ nhất. Repair chứa bản nháp lỗi thật; vẫn parse/validate nghiêm ngặt, giữ dấu ngoặc kép/code/path và không sửa JSON bằng regex/eval.
- Stream có bản nháp dài lỗi rồi bản cuối ngắn hợp lệ: dùng bản cuối có nội dung, không lấy snapshot dài nhất.
- Bản tóm tắt trên 8.000 ký tự được persist và đọc lại không stale. Một lô thẻ thành công, lô sau lỗi: giữ thẻ/lô tốt; đóng/mở SQLite rồi retry chỉ làm lô thiếu, không gọi lại tóm tắt. Checkpoint vẫn có hiệu lực nếu metadata hiển thị bị reset; các thẻ trùng được gộp.
- Lỗi lưu thẻ rollback cả thẻ và checkpoint của lô, giữ tóm tắt. Kiểm thử cũ vẫn xác minh nguồn thay đổi, cross-user, review idempotency, sync không gọi AI và 6 môn FIFO không chạy đồng thời.

Đối chiếu tài liệu Google: [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [tokens](https://ai.google.dev/gemini-api/docs/tokens), [text generation](https://ai.google.dev/gemini-api/docs/text-generation). Schema native và `maxOutputTokens` thuộc API chính thức; code hiện là web-guest nên không thể chỉ thêm các option này rồi coi đã giải quyết. Cần kiểm tra schema/độ dài tại app và giữ kết quả hợp lệ từng phần.

Báo cáo: [learning-recovery-tests.json](evidence/learning-recovery-tests.json), [learning-recovery-live.json](evidence/learning-recovery-live.json). Log trong workspace (ignored): `learning-length-ai-final.log`, `learning-length-api-final.log`, `learning-length-frontend-final.log`, `learning-length-build.log`, `learning-length-live.log`. Các bộ giao nhau, không cộng tổng. Lượt targeted đầu phát hiện assertion chưa tính `.trim()` của cache và fixture tạo nội dung lô giống nhau bị dedup; đã sửa fixture/assertion, chạy lại đủ bộ đạt. Không bỏ kiểm thử để tăng số đạt.

Chưa restart Electron/API đang dùng; backend cũ chưa nạp bản sửa. Chưa nghiệm thu UI sau build trực tiếp trên Electron/browser/thiết bị, chưa chạy thành công provider thật với môn học thực. Có thể chạy lại lệnh live riêng khi provider phản hồi; lệnh này chỉ dùng dữ liệu tổng hợp và session tạm.

## AI song song trong một môn — 04/11/2026

Đáp ứng yêu cầu chia n phần và chạy nhiều lượt AI đồng thời để giảm thời gian tóm tắt. Hàng đợi môn vẫn FIFO; sự tuần tự giữa các lời gọi AI trong cùng môn ở mốc trước được thay bằng pool worker có giới hạn.

| Lệnh đã chạy | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm run test:ai` | **94/94 đạt** | Provider/HTTP giả lập và SQLite tạm; gồm n phần/4 worker, lỗi một phần, nguồn/Unicode, nhóm tổng hợp song song và 6 môn FIFO. |
| `npm run test:api` | **139/139 đạt** | Contract/HTTP/nghiệp vụ và SQLite tạm. |
| `npm --prefix Frontend test -- --maxWorkers=2 --reporter=dot` | **428/428 đạt, 47 file** | Toàn bộ Vitest/jsdom; hiển thị số phần đã lưu/lượt AI đang chạy, mở trang vẫn chỉ GET. |
| `npm --prefix Frontend run build` | **Đạt, 27,61 giây** | Production; còn cảnh báo MathJax `eval` và chunk lớn. |
| `node tests/API/benchmark-summary-workers.cjs` | **Đạt; mock nhanh 2,11 lần trong lượt đo** | 67.215 ký tự/8 phần, độ trễ giả lập 50 ms/request; 1 worker 575 ms, 4 worker 272 ms, cùng 9 request và đủ nguồn. |
| `git diff --check` | **Đạt** | Không lỗi whitespace. |

Bốn kiểm tra mới trong `test-course-summary-ai.js` xác minh n phần chạy đồng thời có trần; phản hồi thực sự về khác thứ tự nhưng ghép đúng nguồn; chỉ một merge khi vừa input; không cắt mất đuôi/Unicode. Một phần lỗi chờ các phần khác lưu xong trước khi trả thất bại; retry chỉ tạo lại phần lỗi. Trường hợp kết quả trung gian quá lớn gộp nhóm song song và vẫn giữ ngân sách request. Kiểm tra cấu hình xác nhận concurrency bị chặn trong 1–5 và chunk tự giảm theo input, không thay cache key v3.

`test-ai-sprint2.js` dùng client Gemini và HTTP server localhost thật: giữ mọi response lại, quan sát **4 POST đã tới server đồng thời**, rồi mới trả kết quả. Các request có conversation rỗng độc lập; tổng số request bằng n phần + 1 tổng hợp. Đây là kiểm thử transport thực với provider giả lập, không phải Gemini thật. `test-course-learning.js` tiếp tục xác minh các môn không chồng nhau; fixture môn nhỏ chạy A/B đồng thời (mức đồng thời 2) rồi tổng hợp/thẻ, sau đó mới đến môn tiếp theo.

Báo cáo [learning-parallel-tests.json](evidence/learning-parallel-tests.json), benchmark [learning-parallel-benchmark.json](evidence/learning-parallel-benchmark.json). Log ignored trong workspace: `learning-parallel-ai-final.log`, `learning-parallel-api-final.log`, `learning-parallel-frontend-final.log`, `learning-parallel-build.log`, `learning-parallel-benchmark.log`. Lượt targeted đầu có một assertion cũ yêu cầu mọi AI tuần tự; đã đổi sang kiểm tra song song trong môn nhưng FIFO giữa môn, chạy lại đầy đủ đạt. Không bỏ ca kiểm thử.

Không gọi lại provider thật trong lượt này. Benchmark chỉ mô phỏng độ trễ, không chứng minh Gemini thật nhanh 2,11 lần hoặc tránh được rate limit/timeout. Lượt live trước vẫn timeout, xem [learning-recovery-live.json](evidence/learning-recovery-live.json). Chưa nghiệm thu UI Electron/thiết bị; cần restart app/API để nạp backend song song. Không có migration bổ sung trong lượt song song, không ghi DB ứng dụng đang mở. Các bộ test có ca giao nhau, không cộng tổng.

## Giao diện hàng đợi gọn — 04/11/2026

Chỉ thay giao diện component `LearningQueue` dùng chung ở Học tập/Tài liệu và CSS được giới hạn trong component; không đổi backend hoặc thuật toán AI. Không diễn giải các số liệu toàn bộ frontend/API ở mốc trước là đã chạy lại trong lượt này.

| Kiểm tra đã chạy | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm --prefix Frontend test -- --run src/test/learning-queue.test.jsx src/test/learning-workflows.test.jsx --maxWorkers=2 --reporter=dot` | **23/23 đạt, 2 file** | Vitest/jsdom; trạng thái, chi tiết/thu gọn, nhiều môn enqueue, sync thủ công, lỗi/partial, màn hình Tài liệu. |
| Chromium/Electron qua harness cục bộ `tests/artifacts/learning-queue-ui/preview.cjs` | **9/9 đạt** | Profile riêng, Vite source, hàng đợi mock; ảnh desktop, thu gọn, màn hình nhỏ, dark mode và lỗi làm mới. |
| `npm --prefix Frontend run build` | **Đạt, 14,41 giây** | Vite production; còn cảnh báo MathJax `eval` và chunk lớn. |
| `git diff --check` | **Đạt** | Không lỗi whitespace. |

Đo trên Chromium: 3 yêu cầu trong khối cao **246 px**, thu gọn **56 px**. Không tràn ngang ở viewport thực **392 px** và **322 px** (kích thước được Chromium báo sau khi đặt cửa sổ 390/320, có làm tròn DPI Windows). **Xem chi tiết** hiện lại thông báo server đầy đủ; các dòng chờ không lặp thông báo. Khi làm mới lỗi, cả ba dòng được giữ. Các thao tác điều khiển chỉ GET, không gửi yêu cầu ghi hoặc AI; không lỗi renderer. Đã xem trực tiếp ảnh desktop, mobile và dark mode.

Báo cáo gọn [learning-queue-ui.json](evidence/learning-queue-ui.json); ảnh và harness cục bộ ở `tests/artifacts/learning-queue-ui/` (ignored). Log ignored: `learning-queue-design-tests.log`, `learning-queue-design-visual.log`, `learning-queue-design-build.log`. Không mở hoặc sửa DB ứng dụng thật, không restart cửa sổ người dùng đang mở, không gọi AI/IU/EDUX thật. Kết quả xác minh layout/tương tác UI với fixture, không phải nghiệm thu kết nối provider.

## Rà soát kết nối và các chức năng AI — 04/11/2026

Đã sửa payload StreamGenerate và header chọn model theo model mặc định công bố trên trang phiên khách. Thiếu header này có thể tạo luồng HTTP 200 nhưng không có câu trả lời. Ngân sách timeout hiện bao gồm cả mở phiên, gọi và thử lại; trạng thái `/ai/status` dựa trên yêu cầu thực tế gần nhất. Chat và các công cụ AI hỗ trợ hủy khi HTTP ngắt kết nối; AI Tutor có nút dừng, cảnh báo phản hồi chậm, deadline giao diện và giữ bản nháp. Phần chọn môn và bộ đếm ký tự được căn lại.

| Kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| Backend: `test-ai-sprint2`, `test-ai-hardening`, `test-ai-api`, `test-course-summary-ai`, `test-course-cards-ai`, `test-course-learning`, `test-sprint3`, cùng các test API về goals/flows/queue/planning/contract | 140 đạt | HTTP provider cục bộ, service stub và SQLite tạm; gồm payload/model header, timeout, hủy socket provider, bảo toàn dữ liệu và lỗi JSON. |
| Frontend: 10 file về AI Tutor, nội dung AI, luồng học tập, hàng đợi, goals, planning, tài liệu, block AI và contracts | 104 đạt | Vitest/jsdom; thêm hủy chat, bỏ qua phản hồi muộn, rời trang, trạng thái chưa kiểm tra và deadline. |
| `node --test tests/frontend-api-integration.cjs` | 9 đạt | Frontend Axios kết nối backend HTTP/SQLite tạm; quiz/weakness đi đúng route ngay lần đầu. |
| `node tests/ai-browser-smoke.cjs` | 13 đạt | Chromium thật, AI mock, profile riêng; đã xem ảnh desktop/mobile; Markdown, công thức, bảng, tóm tắt/hủy/lỗi và xuất nội dung sổ tay. |
| `npm --prefix Frontend run build` | Đạt, 14,97 giây | Production build được cập nhật. |

Gemini thật đã trả lời tiếng Việt về công nghệ phần mềm (18,489 giây) và tạo đúng hai câu hỏi JSON từ nguồn JOIN tổng hợp (41,430 giây). Các bài live tóm tắt và chia nhỏ mục tiêu với ngân sách 25 giây vẫn timeout; bài flashcard tiếp theo bị bỏ qua do chưa có summary. Không suy ra mọi yêu cầu phức tạp đã thành công từ các test mock. Chỉ dùng prompt tổng hợp và thư mục phiên tạm; không ghi DB ứng dụng đang mở. Cần restart Electron/API đang chạy để nạp mã backend mới.

Báo cáo: [ai-connection-audit.json](evidence/ai-connection-audit.json). Ảnh Chromium và báo cáo smoke nằm trong `tests/artifacts/ai-qa/` (ignored).

## Không gian đọc AI Tutor — 04/11/2026

Gom môn học/chế độ thành một thanh công cụ, giảm chiều cao tiêu đề và ô nhập; câu trả lời AI sử dụng toàn bộ vùng nội dung. Nút **Chế độ đọc** ẩn các điều khiển và ô nhập, giữ câu trả lời, môn đã chọn và bản nháp; **Tiếp tục hỏi** hoặc Esc mở lại. Lỗi và nút dừng vẫn hiển thị trong vùng hội thoại khi đang đọc.

Ba file Vitest về workspace/nội dung AI/luồng học tập đạt **40 test**. `node tests/ai-browser-smoke.cjs` đạt **20 kiểm tra** với AI mock trên Chromium thật; đã xem ảnh laptop và mobile. Đo tại khung laptop 1280×720: log chat cao 421 px, tăng lên 590 px khi đọc; câu trả lời rộng 986 px và composer cao 94 px. Desktop/mobile cũng không tràn trang; bảng và mã cuộn bên trong câu trả lời. Production build đạt. Số đo Chromium có làm tròn theo DPI Windows.

Báo cáo [ai-tutor-layout.json](evidence/ai-tutor-layout.json). Thay đổi này chỉ ở frontend, không gọi Gemini hay sửa DB ứng dụng. Tải lại giao diện để dùng bản build mới.

## Lịch sử trò chuyện AI — 05/11/2026

Thêm nút **Lịch sử** và ngăn bên phải trong AI Tutor, đọc lại các endpoint `/ai/conversations` và `/ai/conversations/:id` hiện có. Có tìm tiêu đề không dấu, thời gian cập nhật, đánh dấu hội thoại đang mở, làm mới và xử lý lỗi/rỗng. Chọn một mục khôi phục các tin nhắn, giữ câu hỏi chưa gửi và tiếp tục bằng đúng conversationId; tạo mới không xóa lịch sử đã lưu. Đóng ngăn hủy GET đang chờ và bỏ qua kết quả muộn. Chỉ các cuộc trò chuyện đã được backend ghi sau lần trả lời thành công có trong lịch sử; các công cụ khác giữ hợp đồng lưu trữ hiện có.

Vitest: **46 test đạt** trên bốn file history/workspace/content/learning-workflows. HTTP + SQLite tạm: **24 test đạt**, gồm đọc lịch sử qua Axios thật và hội thoại còn nguyên sau khi mở lại database. Chromium mock: **25 kiểm tra đạt**; đã xem ảnh lịch sử desktop/mobile, kiểm tra tìm kiếm, khôi phục hội thoại, giữ bản nháp và lịch sử còn nguyên sau tạo mới. Production build đạt (12,24 giây); không sửa DB ứng dụng hay gọi Gemini thật trong lượt này.

Báo cáo [ai-history-ui.json](evidence/ai-history-ui.json); ảnh ở `tests/artifacts/ai-qa/ai-history-desktop.png` và `ai-history-mobile.png` (ignored).

## GPA IU và đối chiếu học lực qua các kỳ — 05/11/2026

Đối chiếu ảnh IU do người dùng cung cấp với bản đọc SQLite trong bộ nhớ, không mở kết nối ghi tới DB ứng dụng. Bộ tính mới trả đúng tổng trung bình 5,95/10 và 2,25/4; tích lũy 6,66/10 và 2,52/4. Recap kỳ 2: 4,96/10, 0,81/4, tích lũy 1,30/4; kỳ 3: 6,82/10, 2,23/4, tích lũy 2,62/4. Fixture dùng tên/owner tổng hợp, có cả môn P và học lại; đảo thứ tự đầu vào không đổi kết quả. Frontend dùng tổng kết backend, hiển thị đủ hai hệ và hai phạm vi, không thay tổng GPA khi lọc một kỳ.

`npm run test:api`: **143 test đạt**; `npm run test:ai`: **96 test đạt**. Bộ mục tiêu 7 file frontend về GPA/hồ sơ/API contracts/AI/history/learning: **53 test đạt**. Test sync/restore/current-courses: **10 test đạt**. Sau các sửa cuối về lịch sử server và dấu thập phân tiếng Việt, `academic-results.test.cjs` + `test-ai-sprint2.js`: **32 test đạt**. Các nhóm có giao nhau, không cộng thành tổng.

`node tests/profile-gpa-browser-smoke.cjs`: **6 kiểm tra đạt** trên Chromium với HTTP fixture cục bộ; đã xem ảnh desktop/mobile. Xác minh 4 chỉ số, GPA tích lũy hệ 4, không tràn trang và tổng không đổi khi lọc kỳ. Build production đạt (19,95 giây). Các test tính/mapping/migration/AI dùng SQL và provider giả lập trong thư mục tạm; không gửi bảng điểm cá nhân tới Gemini. Kiểm thử prompt xác minh lịch sử các kỳ và học lại vẫn có khi ngữ cảnh khác quá dài, dữ liệu giả từ client không thay được tổng server, và số 2,52 viết bằng dấu phẩy không bị bộ lọc nhận xét loại bỏ.

Migration hỗ trợ P/NP, điểm hệ 4 và lần thi mà giữ bản ghi/index cũ; chạy lại migration và đồng bộ không tạo trùng. Cần mở lại ứng dụng/API rồi đồng bộ IU để phục hồi môn P đã bị loại trong các lần sync cũ. Bản sửa chưa được hot-load vào backend Electron đang chạy, không chỉnh trực tiếp file DB của tiến trình này.

Báo cáo [gpa-iu-audit.json](evidence/gpa-iu-audit.json). Ảnh ở `tests/artifacts/profile-gpa/` (ignored).

## Tổng tín chỉ và danh mục học phần IU — 05/11/2026

Sửa collector lấy học phần từ `rsChiTiet` thay vì danh sách chọn chương trình. Tổng chương trình được đọc riêng, lưu kèm đường dẫn trường nguồn; không cộng khối kiến thức hoặc gán cố định 126. Catalog gắn sinh viên/chương trình, giữ môn chưa có điểm và tín chỉ 0/null. Nhóm lỗi giữ dữ liệu cũ; danh sách rỗng đã xác minh chỉ thay catalog của đúng chương trình. Danh mục không tạo điểm hoặc mở rộng phạm vi môn kỳ hiện tại. Hồ sơ tự cập nhật sau sự kiện đồng bộ; tổng chính thức ưu tiên hơn số tự nhập và không sửa qua mục tiêu GPA.

- `npm run test:api`: **149 đạt**. Bộ mới `API/tests/iu-curriculum.test.cjs` kiểm tra collector → adapter → SQLite → profile, GPA, chủ sở hữu, đổi chương trình, đồng bộ lặp/lỗi/rỗng, tín chỉ thiếu và mã môn trùng tên. Fixture được tổng hợp, không phải response IU đã xác thực.
- AI sprint2/hardening + sync-all/jobs/current-courses/IU restore/auth-expiry: **56 đạt**, có giao nhau với các nhóm khác.
- Toàn bộ frontend: **447 đạt / 49 file**. Hồ sơ/contracts riêng: **15 đạt**, gồm tự tải lại sau đồng bộ, 25/126, 20%, tìm/lọc môn chưa có điểm và khóa tổng lấy từ IU. Cập nhật hai selector kiểm thử ghi chú theo nhãn đã đổi; cố định ngày Pomodoro trước khi tải lịch để fixture không phụ thuộc ngày chạy.
- `node tests/profile-curriculum-browser-smoke.cjs`: **10 kiểm tra đạt** với HTTP fixture và Chromium riêng. Hiển thị 63 học phần tương lai cùng 13 môn trong bảng điểm, không điểm giả, GPA 2.52; desktop/mobile không tràn ngang. Đã xem cả hai ảnh ở `tests/artifacts/profile-curriculum/`.
- Build production đạt **32,14 giây**, còn cảnh báo MathJax/chunk lớn đã có trước.

**Giới hạn live:** API cấu hình cổng 3001 không phản hồi; kiểm tra phiên IU lưu trong partition ứng dụng báo không có cookie. Chưa xác minh tên trường tổng tín chỉ trên response IU thật của lần đồng bộ người dùng vừa thực hiện. Không ghi lại cookie/token hoặc response cá nhân; không sửa DB thật. Có thể dùng `tests/API/test-cmc-session-live.cjs --inspect-curriculum` qua Electron khi phiên khả dụng để in tên trường, số lượng và chỉ số tín chỉ, không in thông tin xác thực. Giá trị 126/203/129 trong fixture mô phỏng ảnh người dùng, không chứng minh đã lấy thành công từ portal.

## Khóa nhập học theo mã sinh viên CMC — 05/11/2026

Đã bỏ `enrollment_year = 2023` và mốc học kỳ cố định trong đồng bộ IU. Năm nhập học của mã CMC đúng định dạng lấy từ hai số sau chữ ngành (`BSE250047` → 2025); mã khác chỉ dùng năm được cung cấp. Migration sửa các bản ghi cũ khi khởi động; đọc/lưu hồ sơ, tiến độ và ngữ cảnh AI dùng cùng quy tắc. Frontend xử lý được cả response cũ vẫn ghi 2023. Kiểm thử xác minh migration chạy lại an toàn, giữ ID/tên, sync lại và chỉnh hồ sơ không khôi phục năm sai.

`npm run test:api`: **145 test đạt**. Ba file frontend GPA/hồ sơ/contracts: **14 test đạt**. Hai bộ AI sprint2/hardening và sync/restore/current-courses: **49 test đạt**. Các nhóm có giao nhau, không cộng thành tổng. Chromium với hồ sơ tổng hợp có mã CMC và năm cũ 2023: **11 kiểm tra đạt**, gồm khóa 2025, GPA giữ nguyên, tín chỉ, desktop/mobile và lưu tổng tín chỉ qua reload. Đã xem ảnh desktop; report/ảnh/harness ở `tests/artifacts/profile-cohort/` (ignored). Build production đạt **13,94 giây**; còn cảnh báo MathJax/chunk lớn đã có từ trước. Các lần ghi dữ liệu kiểm thử dùng SQLite tạm; chưa khởi động lại backend ứng dụng đang mở để áp dụng migration vào hồ sơ thật.


## Xác minh trước push và đồng bộ GitHub — 05/11/2026

Lượt chạy mới trên toàn bộ mã hiện tại trước khi push `main`; không thay ngày hoặc kết quả triển khai/kiểm thử 02/11, 04/11, 05/11 đã ghi ở các mục lịch sử. Frontend được cài lại bằng `npm --prefix Frontend ci --no-audit --no-fund` từ lockfile hiện có để khôi phục dependency; không thay phiên bản khóa.

| Lệnh | Kết quả mới | Phạm vi |
| --- | --- | --- |
| `npm run test:api` | **152/152 đạt** | Contract/API, HTTP, SQLite tạm, provider giả lập. |
| `npm run test:ai` | **96/96 đạt** | Context/GPA, học tập, tóm tắt song song, Flashcard, provider localhost/mock. |
| `npm run test:electron` | **31/31 đạt** | Entry, preload/IPC, restore/timeout/luồng nguồn giả lập; không phải UI Electron live. |
| `npm run test:course-learning` | **63/63 đạt** | Môn hiện tại, học liệu, khôi phục, tóm tắt và refresh. |
| `npm run test:frontend-api` | **10/10 đạt** | Wrapper Axios gọi HTTP thật, SQLite tạm. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **455/455 đạt trong 50 file** | React/Vitest/jsdom. |
| `npm --prefix Frontend run build` | **Đạt, 13,70 giây** | Vite production; còn cảnh báo MathJax `eval` và chunk lớn đã có. |

Các bộ có phần giao nhau, không cộng thành một tổng duy nhất. Không restart ứng dụng người dùng hoặc chạy lại IU/EDUX/Outlook/Gemini live trong lượt này. Kết quả tín chỉ IU live ngày 05/11 ở [iu-credit-refresh.json](evidence/iu-credit-refresh.json) chỉ được dẫn lại đúng phạm vi, không gán cho lượt chạy mới. Timeout AI dài, giới hạn quiz upload, thiết bị, canvas local và các phần chưa nghiệm thu vẫn giữ trong Sprint 4/issues.

Đã bổ sung deadline cho 27 issue và 4 milestone, gồm milestone Sprint 3 mới vì trước đó chưa có; Sprint 1–3 giữ nguyên nội dung nhiệm vụ gốc, assignee, checklist và trạng thái. Sprint 4 cập nhật trực tiếp #24–#28 theo vai trò 5 người, phân biệt mới/nâng cấp/sửa lỗi/còn nghiệm thu; không tạo issue trùng hoặc đóng issue. REST đọc lại xác nhận thay đổi và lưu hash nội dung trước/sau. GitHub chuẩn hóa due date milestone theo ngày; deadline 23:59:59 UTC+7 là quy ước cuối ngày trong issue/mô tả, không phải giờ họp.

Projects chưa cập nhật: token hiện thiếu `read:project`/`project`, chưa xác định được Project hoặc trường ngày liên kết. Computer Use dừng vì kiểm soát URL chưa hỗ trợ cho Cốc Cốc hiện tại. Không kết luận không có Project và không thay quyền truy cập.

Biên bản: [github-sprint-sync.json](evidence/github-sprint-sync.json), [sprint4-publish-verification.json](evidence/sprint4-publish-verification.json). Log giữ trong thư mục tạm hệ điều hành `codex-smart-study-sprint-audit`, không commit. Các tệp `.env`, dữ liệu người dùng/DB, dependency/build và artifact/log vẫn theo `.gitignore`.
