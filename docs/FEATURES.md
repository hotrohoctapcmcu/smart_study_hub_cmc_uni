# Hướng dẫn sử dụng

Tài liệu theo cấu trúc React/Vite hiện có ngày 30/10/2026. Cài đặt và khởi chạy ở [README](../README.md); cấu hình kết nối và hợp đồng ở [API](API.md); bằng chứng và giới hạn xác minh ở [TESTING](TESTING.md).

## Bắt đầu

1. Mở **Đồng bộ dữ liệu**, chọn **Đồng bộ tất cả** và hoàn tất đăng nhập IU, EDUX, Outlook khi được yêu cầu. IU cung cấp hồ sơ và phạm vi môn hiện tại để các dữ liệu học tập được gắn đúng sinh viên.
2. Xem lịch, công việc và kỳ thi trên **Tổng quan**; vào **Tài liệu → Bài giảng** để tải học liệu của các môn đang học.
3. Chọn **Sổ tay** để ghi chép bằng bàn phím hoặc **Vở ghi** để viết/vẽ trên canvas. Hai loại này có nơi lưu và cách sao lưu khác nhau.
4. Chỉ xác nhận kế hoạch AI hoặc chuyển email thành công việc/kỳ thi sau khi kiểm tra nội dung.

Ứng dụng hiển thị loading, lỗi, dữ liệu rỗng và nút thử lại theo nguồn; chế độ chạy thật không tự thay lỗi API bằng dữ liệu mẫu. Đăng nhập Microsoft tương tác cần Electron. Chế độ trình duyệt dùng phiên/cấu hình backend theo [API](API.md).

## Điều hướng và công việc hằng ngày

| Khu vực / URL | Thao tác chính |
| --- | --- |
| Tổng quan `/` | Hồ sơ, lịch hôm nay, deadline, công việc trong tuần, kỳ thi và lối tắt tạo mới. |
| Lịch `/schedule` | Tuần/tháng/danh sách; lịch lớp và tự học; thêm/sửa/xóa, kiểm tra trùng giờ, tìm giờ trống, cập nhật hoàn thành buổi tự học. |
| Công việc `/tasks` | CRUD, lọc môn/ưu tiên/trạng thái/deadline, checklist, công việc EDUX và tag. |
| Học tập `/learning` | Môn học, tóm tắt, flashcard, quiz, điểm cần cải thiện và Pomodoro. |
| Tài liệu `/documents` | Bài giảng EDUX, tài liệu tham khảo, tệp tải lên, ghi chú và sổ tay. |
| Sổ tay `/notebooks` | Thư viện sổ và editor bằng bàn phím; `/notebooks/:id` mở sổ cụ thể. |
| Vở ghi `/textbook` | Thư viện vở canvas; `/textbook/:id` mở editor viết/vẽ. |
| Trợ lý `/ai` | Hội thoại, tóm tắt, kiểm tra nội dung, lập kế hoạch, soạn đơn và tư vấn tiến độ. |
| Thống kê `/statistics` | Báo cáo ngày/tuần/tháng, nguồn thời gian và nhật ký Time Map. |
| Kỳ thi `/exams` | CRUD kỳ thi, lịch tháng, giai đoạn ôn tập và trạng thái. |
| Email `/email` | Tìm kiếm, đọc, đồng bộ, tải nội dung đầy đủ, chuyển thư thành công việc/kỳ thi. |
| Đồng bộ `/sync`, Hồ sơ `/profile`, Cài đặt `/settings` | Kết nối nguồn, hồ sơ/điểm/môn, giao diện và thông báo. |

`Ctrl+K` / `⌘+K` tìm trong workspace, hỗ trợ từ khóa và `#tag`. Kết quả mở đúng mục/ngày/ngữ cảnh. Lối tắt `/tasks?action=create` và `/schedule?action=create` mở biểu mẫu tạo mới.

Học tập hỗ trợ `/learning?tab=subjects`, `flashcards`, `quiz`, `weaknesses`, `pomodoro`. Tài liệu mặc định mở **Bài giảng**; các tab trực tiếp là `?tab=reference`, `files`, `notes`, `notebooks`. Trên điện thoại, sidebar chuyển thành drawer; hộp thoại hỗ trợ Escape và điều hướng bàn phím. Cài đặt sáng/tối/hệ thống, màu, font và bo góc lưu tại trình duyệt; hiệu ứng tôn trọng `prefers-reduced-motion`.

## Kho tài liệu và học liệu EDUX

### Bài giảng theo môn

Chọn môn → chương → slide. Môn hiện tại lấy từ kỳ/năm học IU; với lịch cũ thiếu thông tin kỳ, ứng dụng dùng khoảng ngày giao với tuần hiện tại theo UTC+7. Không suy đoán kỳ học từ bảng điểm. Môn cũ được ẩn khỏi luồng hiện tại nhưng dữ liệu lịch sử được giữ.

**Đồng bộ học liệu EDUX** tải chương, slide, văn bản và ảnh gốc. Văn bản lưu trong SQLite; ảnh lưu cạnh database, mặc định `data/edux-images`. Học liệu đã tải có thể đọc lại khi không còn phiên EDUX. Tài liệu được tải bằng phiên bản cũ chưa giữ ảnh cần đồng bộ lại một lần. Slide thiếu ảnh gốc được ghi rõ, không tự tạo ảnh thay thế.

Tiến độ đọc, bookmark và ghi chú riêng của slide lưu trong localStorage theo sinh viên, chưa đồng bộ giữa thiết bị. Sao lưu SQLite không bao gồm phần dữ liệu trình duyệt này.

Lịch IU được thử làm mới khi mở ứng dụng và sau 24 giờ nếu ứng dụng mở liên tục; kiểm tra lại khi cửa sổ có tiêu điểm hoặc mạng trở lại. Lỗi lấy lịch giữ dữ liệu đã lưu, không coi lỗi là lịch trống. Sau khi cập nhật lịch, ứng dụng thử tải deadline và học liệu các môn hiện tại nếu có phiên EDUX. Tác vụ nền tiếp tục khi chuyển tab; quay lại để theo dõi tiến trình.

Tài khoản EDUX được nhớ trong JSON cục bộ tại `data/edux-accounts/<userId>.json` (hoặc cạnh `DB_PATH`, có thể đổi bằng `EDUX_ACCOUNTS_PATH`) để tự đăng nhập lại. **Ngắt kết nối EDUX xóa tài khoản đã nhớ và bài tập EDUX đã lưu** của hồ sơ hiện tại. Đây là lưu trữ trên máy chạy backend; trạng thái API không trả mật khẩu/cookie. Xem hành vi ngắt nguồn và lưu phiên ở [API](API.md).

### Tóm tắt toàn môn và Flashcard

1. Chờ tải đủ nguồn; **Nội dung gốc toàn môn (.txt)** xuất văn bản theo thứ tự chương/slide, kèm ID và số slide.
2. Ứng dụng chia nguồn toàn môn thành hai phần A/B, tóm tắt từng phần rồi tổng hợp kiến thức toàn môn. Phần quá dài tiếp tục được chia nhỏ; các phần đã hoàn tất được lưu để thử lại. Ảnh base64 không được đưa vào văn bản yêu cầu AI.
3. Bản tóm tắt được lưu trước khi tạo thẻ. Nếu tạo thẻ lỗi, vẫn có thể tải TXT tóm tắt và chọn **Tạo Flashcard từ tóm tắt** để thử lại. Có thể chạy lại **Tóm tắt toàn môn** khi nguồn thay đổi.
4. Vào **Học tập → Flashcard**, chọn môn, ôn thẻ đến hạn hoặc toàn bộ. Xem đáp án trước rồi chọn **Chưa nhớ / Khó / Nhớ / Dễ**. Khi vùng ôn có tiêu điểm: Space lật thẻ, phím 1–4 đánh giá.

Hàng đợi giới hạn tối đa năm yêu cầu AI đồng thời. Mặc định mỗi yêu cầu học liệu tối đa 60.000 ký tự cả chỉ dẫn/dữ liệu, tóm tắt phần 4.000 và bản cuối 8.000; cấu hình kỹ thuật ở [API](API.md). Lỗi tải slide chặn tạo bản tổng hợp mới; dữ liệu và tóm tắt cũ được giữ. Thẻ gắn phiên bản tóm tắt; mỗi lần đánh giá có `requestId` để thử lại không ghi trùng. AI có thể sai kiến thức, cần đối chiếu bài giảng.

### Tệp tải lên và ghi chú cũ

- Trong tab **File**, tải tệp nhị phân tối đa 25 MB; có tìm/lọc loại tệp, tag, mở/tải xuống/xóa. Hỗ trợ PDF, Word, PowerPoint, TXT, Markdown và ảnh theo API; viewer trực tiếp dành cho PDF/ảnh. Định dạng khác có thể cần tải về để mở.
- Chọn **Dùng làm Textbook** cho giáo trình đính kèm; đây là cờ tài liệu, độc lập với vở canvas ở `/textbook`.
- Metadata lưu SQLite, byte tệp nằm trong `documents` cạnh database hoặc `DOCUMENTS_PATH`. Bản metadata nhập từ ứng dụng cũ không có byte sẽ yêu cầu tải tệp gốc.
- Ghi chú văn bản có môn/chương/tag/đánh dấu khó, liên kết tài liệu và sổ tay. Ghi chú thường có thể xuất DOCX qua API. Trang có cấu trúc dùng cách xuất bên dưới để tránh đưa JSON vào Word hoặc textarea cũ.

## Sổ tay bằng bàn phím

Dashboard **Sổ tay** có số sổ/trang/từ/môn, trang gần đây, tiếp tục trang vừa sửa, tìm/lọc/sắp xếp và lưới/danh sách. Tạo sổ từ bảy mẫu; đổi tên/màu, đánh dấu, nhân bản, chuyển môn, xuất hoặc xóa.

Editor Tiptap/ProseMirror hỗ trợ cây trang/trang con, kéo đổi thứ tự, ghim, mục lục H1–H3, tìm trong trang `Ctrl+F`, Focus Mode và undo/redo. Dùng toolbar hoặc gõ `/` để chèn tiêu đề, danh sách/checklist, bảng, code có highlight, công thức KaTeX, callout, Cornell, flashcard, bình luận và phác thảo. Ảnh có thể nhập từ file, URL, clipboard hoặc kéo thả; có căn chỉnh, đổi kích thước và chú thích.

**Chèn từ bài giảng** chọn môn → chương → slide, dùng ảnh EDUX gốc hoặc trang PDF raster hóa bằng PDF.js. Blob ảnh được chuyển sang data URL trước khi lưu trang. AI áp dụng cho đoạn được chọn hoặc toàn trang, cho xem kết quả trước khi chèn; thẻ được chèn là block trong trang, không tự trở thành bộ ôn toàn môn. Hiện menu AI sổ tay gửi tối đa 26.000 ký tự đầu của ngữ cảnh; với trang dài hãy chọn đoạn cần xử lý hoặc dùng công cụ tóm tắt trên trang Trợ lý AI.

### Lưu, phục hồi và xuất

- Sổ tay dùng API `/notebooks`, `/notes`, lưu nội dung chính ở SQLite. Metadata sổ và tài liệu Tiptap được đóng gói JSON với `format: "ssh-notebook"`, `version: 1` trong các trường hiện có.
- Ghi nháp vào localStorage theo `student_id` trước debounce khoảng 650 ms; gửi tuần tự và chỉ xóa revision được máy chủ xác nhận. Theo dõi **Đang lưu / Đã lưu / Chưa đồng bộ**; lỗi mạng giữ bản nháp để thử lại.
- Nếu trình duyệt chặn/đầy bộ nhớ, giữ trang mở và xuất bản sao. Reload hoàn toàn offline khi chưa xác minh được hồ sơ không mở cache của tài khoản chưa xác minh; nháp được phục hồi sau khi hồ sơ tải lại.
- Giới hạn API là 1.000.000 ký tự/trang, tính cả ảnh nhúng/JSON; ảnh được nén và kiểm tra dung lượng trước chèn. Trang vượt giới hạn vẫn giữ nháp nhưng chưa đồng bộ được; chia trang hoặc giảm ảnh.
- Xuất sổ thành **Markdown**, xuất trang thành **HTML**; tab Ghi chú xuất nội dung trang có cấu trúc thành **TXT** dễ đọc. Không gửi JSON envelope của trang tới endpoint DOCX văn bản cũ.

## Vở ghi canvas

Vở ghi là thư viện canvas độc lập tại `/textbook`, có bìa vở, trang gần đây, tìm nội dung và mười mẫu với đối tượng tiếp tục chỉnh sửa được. Nội dung SVG gồm nét viết, chữ, hình, ảnh, bảng, công thức, tệp, thước/ê-ke/thước đo góc, trục tọa độ/trục số và compa. Chọn/lasso để di chuyển, resize, xoay, nhóm, khóa/ẩn hoặc đổi lớp; mở khóa trước khi sửa/xóa.

Nhấp đúp để sửa văn bản. Bảng hỗ trợ gõ trực tiếp, dán hàng/cột, gộp/tách ô. Bút có lực nhấn khi thiết bị cung cấp Pointer Events và bám cạnh thước/ê-ke đã xoay; có thể tắt bám. Chế độ chỉ viết bằng bút bỏ qua chạm tay khi viết, phụ thuộc khả năng thiết bị.

| Phím | Tác dụng |
| --- | --- |
| `V`, `Shift+L`, `H` | Chọn, lasso, bàn tay. |
| `P`, `B`, `E`; `T`, `R`, `L` | Bút mực/chì/tẩy; chữ/chữ nhật/đường thẳng. |
| Space + kéo hoặc chuột giữa; Ctrl + cuộn | Pan; zoom. |
| Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y | Undo / redo. |
| Ctrl+C / X / V / D | Sao chép / cắt / dán / nhân bản đối tượng. |
| Ctrl+A, Delete / Backspace | Chọn đối tượng sửa được; xóa. |
| Ctrl+S, Escape | Thử lưu ngay; thoát thao tác/focus. |

Phím công cụ không chạy khi đang gõ input/textarea. Focus Mode ẩn giao diện ứng dụng; không bắt buộc fullscreen hệ điều hành.

### Lưu cục bộ và sao lưu

- Vở chỉ lưu **localStorage trên trình duyệt/địa chỉ hiện tại**, chưa đồng bộ tài khoản, cộng tác hay xử lý xung đột nhiều tab. Đổi origin/port/trình duyệt hoặc xóa dữ liệu website có thể làm mất khả năng truy cập vở cũ.
- Autosave sau khoảng 800 ms không chỉnh sửa, thử lưu khi trang ẩn/đóng. Lỗi lưu giữ nội dung trong phiên và cho tải bản sao; điều hướng có bảo vệ khi chưa lưu được.
- Tối đa năm mốc phiên bản cục bộ, khoảng hai phút một lần khi lưu hoặc theo yêu cầu. Undo/redo chỉ thuộc phiên mở hiện tại.
- **Sao lưu thư viện** tải JSON toàn bộ vở; **Chia sẻ** tải `.studybook.json` của một vở. Nhập JSON tối đa 10 MB, có xem trước/kiểm tra và tạo ID mới, không ghi đè vở hiện có. JSON giữ mô hình chỉnh sửa, nên sao lưu định kỳ.
- Xuất PDF/PNG/JPEG/SVG để đọc/chia sẻ. PDF raster hóa từng trang nên không giữ chữ/vector gốc có thể tìm kiếm; SVG văn bản phụ thuộc font của máy đọc.

### OCR, AI và giới hạn

OCR Tesseract Việt/Anh chạy worker trên máy; lần đầu cần mạng tải engine/WASM/ngôn ngữ. Ảnh OCR không gửi trực tiếp đến API AI. Người dùng sửa kết quả trước khi tạo bản sao hoặc thay vùng chọn. Chuyển OCR sang LaTeX gửi văn bản nhận dạng tới AI; nếu thất bại vẫn giữ văn bản OCR để sửa.

AI tóm tắt/ý chính dùng pipeline tóm tắt và job nền cho nguồn dài; công cụ văn bản khác chia phần theo ngân sách chat hiện hành **32.000 codepoint/câu hỏi**, chờ xem trước rồi mới áp dụng. Flashcard/quiz tạo trong vở là nội dung canvas, không tự tạo đề/bộ thẻ trong Học tập.

LocalStorage thường chỉ vài MB; ảnh/PDF có thể làm đầy nhanh. Ảnh nguồn tối đa 12 MB được thu nhỏ; tệp đính kèm tối đa 6 MB vẫn có thể vượt quota còn lại. PDF nhập tối đa 60 trang/lần và chuyển thành ảnh nền. Trang mở rộng bắt đầu 1.800 × 1.800, tối đa 16.000 × 16.000 px. Crop chỉnh bằng tỷ lệ; compa dùng tâm/bán kính. Chưa có service worker đảm bảo toàn bộ ứng dụng hoạt động sau reload offline. OCR chữ viết tay/toán, stylus, camera và nhận chạm tay cần kiểm tra trên thiết bị thực tế.

## AI, quiz và kế hoạch

Trợ lý có hội thoại lưu SQLite, mở lại hội thoại, tạo mới và gửi lại khi lỗi. Các công cụ gồm hỏi đáp, tóm tắt, kiểm tra nội dung, kế hoạch tự học/ôn thi, soạn đơn nghỉ, tư vấn tiến độ và phần khó. Câu hỏi chat tối đa 32.000 codepoint; tóm tắt nhận tới 500.000 codepoint, nguồn dài xử lý theo job và xem tiến trình. Ngân sách này thay cho giới hạn 4.000 ký tự trong hướng dẫn cũ.

Job tóm tắt văn bản thông thường nằm trong RAM; khởi động lại backend cần gửi lại nguồn, khác pipeline toàn môn có tiến trình lưu SQLite. Có thể sửa Markdown câu trả lời/bản tóm tắt đang xem; bản sửa hiện chỉ áp dụng trên màn hình, chưa ghi đè kết quả đã lưu bằng API.

Kế hoạch AI chỉ là đề xuất cho đến khi người dùng kiểm tra/chọn/chỉnh và xác nhận. Máy chủ kiểm tra lại xung đột lịch lớp/tự học/thi khi ghi, lưu bằng transaction và chống xác nhận trùng. Preview ôn thi xét tối đa 31 ngày, 30 buổi, mỗi buổi 30–240 phút; nếu không có giờ phù hợp vẫn có thể lưu giai đoạn để xếp lịch sau.

Quiz tạo 3–15 câu theo môn/chủ đề/độ khó, làm bài rồi nộp để xem đáp án và giải thích. Máy chủ tự chấm, không lấy điểm từ trình duyệt; đề chưa nộp không trả đáp án. Đã nộp không đổi lựa chọn; tạo đề mới để kiểm tra lại. Điểm yếu chỉ tính bài đã nộp theo môn/chủ đề; chênh lệch hai lần là điểm phần trăm. AI không thay thế đánh giá giảng viên.

Công cụ soạn đơn dùng ngày/môn/buổi/người nhận/lý do, cho xem/sửa nội dung trước khi sao chép hoặc xuất. API có lưu bản nháp và xuất DOCX; khả năng xuất tùy công cụ đang mở. Ứng dụng không tự gửi thư hoặc nộp đơn vào cổng trường.

## Pomodoro, thống kê và email

Pomodoro hỗ trợ bắt đầu, tạm dừng, reset, nghỉ ngắn và chuông. Phiên đang chạy phục hồi trong cùng tab bằng sessionStorage khi chuyển trang/reload; trình duyệt chặn sessionStorage thì không phục hồi được. Chọn **Lưu phiên học** để ghi lịch sử backend, gồm thời gian bắt đầu/kết thúc, giây tập trung thực tế và các khoảng tập trung; thời gian pause/nghỉ không cộng thành giờ học.

Thống kê lấy báo cáo database theo khoảng ngày/tuần/tháng đã chọn, gồm công việc nội bộ/EDUX, tự học và Pomodoro; tránh cộng trùng thời gian. Time Map cắt ngày theo UTC+7, ưu tiên lịch thi/lớp/Pomodoro/tự học. Bộ lọc nhật ký chỉ lọc hoạt động; không suy diễn số liệu tháng chưa tải. Thiếu dữ liệu hiển thị dấu “—” hoặc trạng thái rỗng. Mở thống kê dùng `advice=false` để không tự gọi AI.

Email hỗ trợ tất cả/chưa đọc/đã đọc, tìm tiêu đề/người gửi, đọc, đánh dấu, đồng bộ/làm mới và ngắt phiên. Nguồn Outlook Web đôi khi chỉ có preview; thử **Tải nội dung đầy đủ** hoặc mở thư gốc. Bộ trích xuất nhận ngày rõ `DD/MM/YYYY` (cả `.`/`-`) và giờ `HH:mm`/`HHhmm`; không tự suy ra deadline từ mô tả mơ hồ. Kiểm tra thông tin rồi xác nhận tạo công việc/kỳ thi; tác vụ có chống tạo trùng.

## Sao lưu và giới hạn vận hành

Sao lưu database **kèm thư mục tệp** cạnh nó (documents/ảnh EDUX và cấu hình lưu cục bộ cần thiết). Vở canvas cần xuất JSON riêng từ trình duyệt; bản nháp sổ tay và phiên Pomodoro chưa gửi có thể vẫn chỉ nằm trên thiết bị. Nội dung JSON/Markdown/HTML xuất có mục đích khác nhau, không thay thế bản sao database đầy đủ.

Kết nối IU/EDUX/Outlook, khả dụng Gemini và quyền tenant trường phụ thuộc dịch vụ bên ngoài. Kết quả kiểm thử giả lập hoặc ảnh QA không chứng minh tài khoản thật luôn kết nối được; xem từng phạm vi tại [TESTING](TESTING.md).
