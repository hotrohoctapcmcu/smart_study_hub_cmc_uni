# Kiểm thử và bằng chứng

Tài liệu gồm kết quả lịch sử đến **30/10/2026** và [lượt xác minh bàn giao Sprint 4 ngày 02/11/2026](#xác-minh-bản-bàn-giao-sprint-4--02112026) (Asia/Saigon). Mỗi số liệu gắn với phạm vi và phiên bản tại thời điểm chạy; không cộng các bộ có giao nhau và không suy ra mọi dịch vụ ngoài đã được nghiệm thu.

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

Nhánh `sprint4/comprehensive-update`, nền lịch sử main `faecc05`. Môi trường Windows, Node.js **24.16.0**, npm **11.13.0**; dependency cài bằng `npm ci` và `npm --prefix Frontend ci` từ hai lockfile. Kết quả dưới đây là lượt chạy mới trên mã chuẩn bị push, khác các snapshot lịch sử phía trên.

| Lệnh | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm run test:api` | **95/95 đạt** | Contract, hướng phụ thuộc, database, HTTP regression, EDUX/AI giả lập và nghiệp vụ học tập. |
| `npm run test:ai` | **74/74 đạt** | Context/Unicode, kế hoạch, summary jobs, retry/cancel, pipeline toàn môn và nghiệp vụ Sprint 3. |
| `npm run test:electron` | **31/31 đạt** | Entry/preload/IPC, khôi phục IU, lịch thi, timeout, phiên nguồn; mock Electron/provider. |
| `npm run test:course-learning` | **48/48 đạt** | Phạm vi môn IU, EDUX/học liệu/ảnh/tài khoản, tóm tắt/flashcard và refresh/khôi phục. |
| `npm run test:frontend-api` | **8/8 đạt** | Wrapper Axios thực gọi HTTP API và SQLite tạm, upload tiếng Việt, task/checklist, lịch, ghi chú/export/Pomodoro và lỗi validation. |
| `npm --prefix Frontend test -- --maxWorkers=2` | **332/332 đạt, 37 file** | React/Vitest/jsdom với fixture; không thay cho kiểm tra browser/thiết bị thật. |
| `npm --prefix Frontend run build` | **Đạt** | Vite production, chạy sau bộ test frontend; còn cảnh báo MathJax dùng `eval` và chunk lớn. |

Đã cập nhật bài kiểm tra inventory API để xác nhận riêng endpoint mới `GET /api/v1/learning/images/:file`, bên cạnh unified sync và summary jobs, rồi so sánh đủ 150 endpoint của fixture cũ đúng thứ tự. Không bỏ kiểm tra tương thích các route có sẵn. Test lịch thi trong bộ Electron hiện đã chạy trên `electron/bridges/iu.js` và đạt; lỗi import frontend cũ nêu ở mốc refactor là thông tin lịch sử.

`npm ci` gốc báo 0 lỗ hổng; lần cài frontend báo 4 mức low. Không áp dụng nâng cấp dependency phá vỡ tương thích trong đợt tổng hợp này. Các nhóm test có giao nhau, không cộng thành một tổng duy nhất.

Chưa chạy lại browser smoke/offscreen E2E, Gemini live, đăng nhập/đồng bộ IU/EDUX/Outlook bằng tài khoản thật, kiểm thử thiết bị tablet/stylus/camera hoặc bộ cài máy sạch. Kết quả `test:frontend-api` cũng không nghiệm thu toàn bộ từng chức năng AI; mock/fallback và HTTP 404 được chủ động kiểm tra theo phạm vi script. Chi tiết công việc cần nghiệm thu nằm ở [Sprint 4](SPRINT_4.md) và issue #24–#28.

Log của lượt bàn giao lưu trong thư mục tạm hệ điều hành với tiền tố `smart-study-`, không commit log hoặc thông tin phiên. Bản source bàn giao chỉ chứa cấu hình mẫu, mã nguồn, test/fixture và tài liệu.
