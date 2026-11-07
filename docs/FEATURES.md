# Hướng dẫn sử dụng

Tài liệu theo cấu trúc React/Vite hiện có; phần quản lý dữ liệu và thời khóa biểu được cập nhật ngày 07/11/2026. Cài đặt và khởi chạy ở [README](../README.md); cấu hình kết nối và hợp đồng ở [API](API.md); bằng chứng và giới hạn xác minh ở [TESTING](TESTING.md).

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

## Quản lý dữ liệu trên máy

Trong ứng dụng desktop, mở **Cài đặt → Dữ liệu** hoặc **Đồng bộ → Xóa dữ liệu**. Chọn từng nhóm: thời khóa biểu; bảng điểm/chương trình học; công việc/checklist; lịch thi/kế hoạch ôn; lịch tự học/Pomodoro; tài liệu/học liệu; ghi chú/sổ tay/canvas; AI; thông báo; email; phiên đăng nhập; cài đặt. Có thể chọn **Xóa toàn bộ dữ liệu**, gồm cả hồ sơ sinh viên.

Hộp xác nhận liệt kê phạm vi và yêu cầu nhập **XÓA**. Ứng dụng khởi động lại rồi xóa dữ liệu đã chọn trước khi khởi chạy các tác vụ nền. Nội dung không chọn được giữ; xóa tài liệu giữ ghi chú nhưng bỏ liên kết đến tệp đã xóa. Xóa email giữ công việc/kỳ thi đã tạo từ thư. Nguồn trường vẫn có thể tải lại dữ liệu nếu giữ phiên đăng nhập; chọn thêm **Phiên đăng nhập** khi cần ngắt các nguồn. Xuất/sao lưu nội dung cần giữ trước khi xác nhận.

## Thời khóa biểu khi chuyển học kỳ

Lịch đã qua được giữ để xem lại bằng tuần/tháng hoặc danh sách tại **Thời khóa biểu**. Khi IU cung cấp lịch hợp lệ, ứng dụng chỉ thay phần lịch sắp tới trong phạm vi đã lấy và các học kỳ đã xác định; lịch học kỳ khác, lịch tự thêm và dữ liệu cá nhân được giữ. Bản cập nhật lặp lại không tạo bản sao lịch sử. Khi dữ liệu chưa xác định được kỳ hoặc phạm vi, ứng dụng ưu tiên bổ sung/cập nhật các buổi có thể đối chiếu thay vì xóa lịch khác.

Nếu mất mạng, hết phiên IU, chưa có lịch học kỳ mới, lịch trả rỗng hoặc sai ngày/giờ, ứng dụng giữ bản đã lưu và thông báo tại **Đồng bộ → Thời khóa biểu & học kỳ**. Có thể thử đồng bộ lại ngay; không phải đợi đủ 24 giờ sau một lượt thất bại. Lịch trống chưa đủ để xác nhận toàn bộ buổi đã hủy, nên muốn bỏ bản lưu cần xóa chủ động. Quy tắc này áp dụng cho thời khóa biểu; lịch thi vẫn theo cửa sổ quét và hợp đồng riêng.

## Kho tài liệu và học liệu EDUX

### Bài giảng theo môn

Chọn môn → chương → slide. Môn hiện tại lấy từ kỳ/năm học IU; với lịch cũ thiếu thông tin kỳ, ứng dụng dùng khoảng ngày giao với tuần hiện tại theo UTC+7. Không suy đoán kỳ học từ bảng điểm. Môn cũ được ẩn khỏi luồng hiện tại nhưng dữ liệu lịch sử được giữ.

**Đồng bộ học liệu EDUX** tải chương, slide và văn bản, chỉ lưu nội dung văn bản trong SQLite. Ảnh EDUX không được lưu vào database, ghi file hoặc hiển thị trong bài giảng. Hàm crawler vẫn hỗ trợ lấy ảnh khi truyền `includeImages: true`, kết quả chỉ tồn tại trong bộ nhớ của lời gọi. Ảnh nhúng trong HTML, Markdown và JSON được lọc trước khi lưu; dữ liệu ảnh cũ trong học liệu được dọn khi khởi động. Slide chỉ có ảnh được ghi rõ là chưa có nội dung văn bản. Văn bản đã tải có thể đọc lại khi không còn phiên EDUX.

Tiến độ đọc, bookmark và ghi chú riêng của slide lưu trong localStorage theo sinh viên, chưa đồng bộ giữa thiết bị. Sao lưu SQLite không bao gồm phần dữ liệu trình duyệt này.

Lịch IU được thử làm mới khi mở ứng dụng và sau 24 giờ nếu ứng dụng mở liên tục; kiểm tra lại khi cửa sổ có tiêu điểm hoặc mạng trở lại. Lỗi lấy lịch giữ dữ liệu đã lưu, không coi lỗi là lịch trống. Sau khi cập nhật lịch, ứng dụng thử tải deadline và học liệu các môn hiện tại nếu có phiên EDUX. Tác vụ nền tiếp tục khi chuyển tab; quay lại để theo dõi tiến trình.

Tài khoản EDUX được nhớ trong JSON cục bộ tại `data/edux-accounts/<userId>.json` (hoặc cạnh `DB_PATH`, có thể đổi bằng `EDUX_ACCOUNTS_PATH`) để tự đăng nhập lại. **Ngắt kết nối EDUX xóa tài khoản đã nhớ và bài tập EDUX đã lưu** của hồ sơ hiện tại. Đây là lưu trữ trên máy chạy backend; trạng thái API không trả mật khẩu/cookie. Xem hành vi ngắt nguồn và lưu phiên ở [API](API.md).

### Tóm tắt toàn môn và Flashcard

1. Chờ tải đủ nguồn; **Nội dung gốc toàn môn (.txt)** xuất văn bản theo thứ tự chương/slide, kèm ID và số slide.
2. Mở môn rồi bấm **Tạo / cập nhật tóm tắt** khi muốn dùng AI. Đồng bộ slide và đồng bộ nền từ IU/EDUX không tự tóm tắt. Sau nút bấm, ứng dụng chia nguồn toàn môn thành **n phần nhỏ**, mặc định mỗi phần tối đa 12.000 ký tự, chạy tối đa **4 lượt AI đồng thời** rồi tổng hợp kết quả đúng thứ tự. Chỉ tổng hợp qua nhiều tầng khi các kết quả trung gian quá lớn. Các phần đã hoàn tất được lưu để thử lại; ảnh base64 không được đưa vào văn bản yêu cầu AI.
3. Bản tóm tắt được lưu trước khi tạo thẻ. Nếu tạo thẻ lỗi, vẫn có thể tải TXT tóm tắt và chọn **Tạo Flashcard từ tóm tắt** để thử lại. Có thể chạy lại **Tóm tắt toàn môn** khi nguồn thay đổi.
4. Vào **Học tập → Flashcard**, chọn môn, ôn thẻ đến hạn hoặc toàn bộ. Xem đáp án trước rồi chọn **Chưa nhớ / Khó / Nhớ / Dễ**. Khi vùng ôn có tiêu điểm: Space lật thẻ, phím 1–4 đánh giá.

Đồng bộ slide và tóm tắt toàn môn dùng chung một hàng đợi FIFO: hoàn tất yêu cầu đang chạy rồi mới đến yêu cầu tiếp theo. Quét nhiều môn cũng lưu xong từng môn trước khi chuyển môn khác. Yêu cầu trùng đang chạy/chờ được gộp; lỗi một yêu cầu không chặn các yêu cầu còn lại. Màn hình Học tập/Tài liệu hiển thị môn, vị trí chờ, tiến trình và lỗi; số chương/slide tự cập nhật khi quét xong từng môn. Môn IU chưa có nguồn EDUX hiển thị lý do thay vì chỉ hiện “0 chương”.

Khối hàng đợi hiển thị dạng danh sách gọn, tách tên môn, loại yêu cầu và trạng thái. Có **Thu gọn hàng đợi**, **Xem chi tiết** để đọc thông báo đầy đủ và **Làm mới**; kết quả gần đây nằm trong mục riêng, lỗi được mở sẵn để kiểm tra. Thu gọn hoặc xem chi tiết không dừng/chạy lại AI.

Hàng đợi nhận tối đa 50 yêu cầu hoạt động. Nó nằm trong RAM: khởi động lại backend sẽ mất các yêu cầu đang chờ; dữ liệu slide và kết quả AI đã lưu trong SQLite vẫn được giữ, muốn tóm tắt tiếp cần bấm lại. Giới hạn pool provider chung của ứng dụng không khiến nhiều môn trong hàng đợi học liệu chạy đồng thời.

Mặc định mỗi yêu cầu học liệu tối đa 60.000 ký tự cả chỉ dẫn/dữ liệu; 4.000 ký tự/phần và 8.000 ký tự/toàn môn là mục tiêu trình bày. Bản hợp lệ còn dài được ghi rõ dạng dài hoặc theo phần, không bị loại chỉ vì vượt mục tiêu; trần lưu mặc định 120.000 ký tự. Cấu hình kỹ thuật ở [API](API.md). Lỗi tải slide chặn tạo bản tổng hợp mới; dữ liệu và tóm tắt cũ được giữ. Thẻ gắn phiên bản tóm tắt; mỗi lần đánh giá có `requestId` để thử lại không ghi trùng. AI có thể sai kiến thức, cần đối chiếu bài giảng.

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

Xác nhận lưu mở trong hộp thoại; nếu lỗi kết nối, phiên vẫn được giữ để thử lại. Đổi chế độ hoặc đặt lại khi có thời gian chưa lưu sẽ hỏi giữ, lưu hay bỏ phiên. Thống kê hôm nay chỉ tính phần tập trung thuộc ngày hiện tại theo UTC+7, kể cả phiên qua nửa đêm. Lịch sử phân biệt phiên hoàn thành và kết thúc sớm.

Trước phiên, chọn môn/công việc cá nhân hoặc bài tập EDUX, đặt một mục tiêu nhỏ và chọn nhịp 15/3, 25/5 hoặc 50/10 phút tập trung/nghỉ. Danh sách chỉ có môn kỳ hiện tại theo thời khóa biểu IU; chưa xác định kỳ thì cần đồng bộ IU và vẫn có thể tự học chưa phân loại. Việc gợi ý cũng được lọc theo các môn hiện tại. Có gợi ý việc gần hạn và cảnh báo trùng giờ lớp/thi; lịch thiếu được thông báo để người dùng quyết định. EDUX tải chậm không cản phiên tự học. Mục tiêu và nhịp học được giữ cùng bản nháp trong tab.

Khi nhập mục tiêu đủ rõ và dừng một chút, AI tự chia thành 2–5 bước vừa với thời lượng phiên, kèm thời gian ước tính và dấu hiệu hoàn thành. Chọn **Dùng các bước này** để nhận checklist rồi đánh dấu khi học. Sửa mục tiêu/môn/thời lượng sẽ làm mới gợi ý; phản hồi cũ không thay vào nội dung mới. Nếu AI chưa sẵn sàng, vẫn giữ mục tiêu để tự học hoặc thử lại. Checklist và tiến độ được lưu cùng phiên; các bước chưa xong có thể đưa vào phần cần làm tiếp.

Khi lưu, ghi điều đã làm được, chọn đã đạt mục tiêu/cần học tiếp/chưa đánh giá và ghi phần còn lại. Checkbox hoàn thành công việc chỉ xuất hiện khi đã đạt mục tiêu, mặc định không chọn. Việc đánh dấu EDUX chỉ theo dõi trong ứng dụng; vẫn cần nộp bài trên EDUX. Lưu phiên và cập nhật công việc được thực hiện cùng transaction; thử lại không tạo bản ghi trùng.

Lịch sử có lọc theo môn, ghi chú/kết quả và nút học tiếp. Thống kê tuần hiện tại (thứ Hai–Chủ Nhật, UTC+7) tổng hợp phút thực học và mục tiêu đã đạt theo môn. Sau lưu có thể chuyển sang flashcard đúng môn hoặc quiz điền sẵn môn/chủ đề; không tự gọi AI hay tự đánh giá đã hiểu bài.

Thống kê lấy báo cáo database theo khoảng ngày/tuần/tháng đã chọn, gồm công việc nội bộ/EDUX, tự học và Pomodoro; tránh cộng trùng thời gian. Time Map cắt ngày theo UTC+7, ưu tiên lịch thi/lớp/Pomodoro/tự học. Bộ lọc nhật ký chỉ lọc hoạt động; không suy diễn số liệu tháng chưa tải. Thiếu dữ liệu hiển thị dấu “—” hoặc trạng thái rỗng. Mở thống kê dùng `advice=false` để không tự gọi AI.

Email hỗ trợ tất cả/chưa đọc/đã đọc, tìm tiêu đề/người gửi, đọc, đánh dấu, đồng bộ/làm mới và ngắt phiên. Nguồn Outlook Web đôi khi chỉ có preview; thử **Tải nội dung đầy đủ** hoặc mở thư gốc. Bộ trích xuất nhận ngày rõ `DD/MM/YYYY` (cả `.`/`-`) và giờ `HH:mm`/`HHhmm`; không tự suy ra deadline từ mô tả mơ hồ. Kiểm tra thông tin rồi xác nhận tạo công việc/kỳ thi; tác vụ có chống tạo trùng.

## Các luồng học tập liên kết

Khi tạo công việc, lịch học, kỳ thi hoặc sổ tay, danh sách môn mặc định là môn kỳ hiện tại từ IU, cùng nguồn với Pomodoro. Khi sửa bản ghi cũ, môn đã lưu vẫn có trong lựa chọn. Chưa xác định được kỳ thì dùng **Tải lại môn học** hoặc đồng bộ thời khóa biểu IU; ứng dụng không lấy toàn bộ môn lịch sử thay thế. Sổ tay các kỳ trước vẫn xem/lọc được trong danh sách.

Trong Pomodoro, nhập **Chương/chủ đề ôn lại** để giữ đúng phạm vi khi mở flashcard/quiz sau phiên; nếu bỏ trống sẽ dùng mục tiêu phiên. Flashcard lọc theo môn và tên chương/chủ đề thực trên thẻ; không có thẻ phù hợp thì báo rõ để cập nhật bộ thẻ. Thẻ đến hạn và thẻ từng chọn học lại được ưu tiên. **Ôn 5 phút** có đồng hồ và nút dừng; chỉ khi bạn chọn mức ghi nhớ mới lưu một lượt ôn.

Upload tài liệu có danh sách chọn môn, hiển thị học kỳ từ IU và cho tải file **Chưa phân loại**. Bộ lọc học kỳ dùng metadata của file, không tự gán kỳ cho tài liệu cũ. Trạng thái học file dùng những trang đã mở/đánh dấu trên thiết bị hiện tại; không đọc hoặc không đánh dấu thì không tự coi là hoàn thành.

Mở chi tiết công việc cá nhân đã lưu và chọn **AI chia nhỏ công việc**. AI đọc tên, mô tả và deadline, trả các bước có đầu ra/thời lượng. Sửa/bỏ từng bước rồi chọn **Xác nhận thêm các bước**. Bạn cũng có thể nhập bước, đầu ra và thời lượng thủ công khi AI lỗi. Nút **Pomodoro** trên từng bước điền sẵn mục tiêu/thời lượng; cần bấm bắt đầu phiên và tự xác nhận kết quả. Phiên đang học trước đó được giữ để bạn xử lý trước.

Quiz cho chọn môn kỳ hiện tại, chương/chủ đề, tài liệu nguồn, **5/10/15 câu** và độ khó. Không chọn tài liệu thì giao diện ghi kiến thức chung. Nguồn bài giảng phải có văn bản đầy đủ; file tải lên hiện hỗ trợ TXT/Markdown làm nguồn quiz, còn PDF/DOCX/PPTX/ảnh cần chuyển sang văn bản hoặc chọn nguồn khác. Nguồn không đọc được sẽ báo lỗi thay vì giả nhận đã sử dụng. Khi làm xong có **Luyện lại phần sai**; các chủ đề cần cải thiện có **Luyện 5 câu**, **Học lại 15 phút**, **Mở tài liệu**. Điểm trước/sau lấy từ hai lượt nộp quiz thật gần nhất; thiếu lượt đo được ghi rõ.

Trong kỳ thi sắp tới, **Lên lịch ôn → AI chia buổi ôn thi** dùng nội dung bạn nhập để đề xuất các buổi có mục tiêu, thời lượng và bài tự kiểm tra. Sửa/bỏ từng buổi trước khi xác nhận; lịch được kiểm tra lại để chỉ lưu giờ tương lai, trước giờ thi và không trùng. Kế hoạch thủ công vẫn có bên dưới khi AI lỗi. AI Tutor cũng chọn kỳ thi từ danh sách sắp tới; có nút mở Tutor kèm ngữ cảnh tại slide/công việc và cho sửa câu hỏi trước khi gửi.

Các bản nháp AI không tự nhận vào checklist/lịch hoặc tự đánh dấu công việc hoàn thành. Lỗi provider giữ như lỗi, có thể thử lại hoặc tiếp tục thao tác thủ công. Kiểm thử mock và AI thật được tách riêng ở [TESTING](TESTING.md#các-luồng-học-tập--04112026); lần thử provider thật ngày 04/11 bị timeout, chưa nghiệm thu chất lượng đầu ra live.

## Tóm tắt dài và tạo tiếp Flashcard

Quét slide chỉ đồng bộ học liệu. Vào môn và bấm **Tạo / cập nhật tóm tắt** để yêu cầu AI; nhiều môn xếp hàng, xong môn trước mới đến môn sau. Trong một môn, nhiều phần được tóm tắt song song, có số phần đã lưu và số lượt AI đang chạy. Bản tóm tắt hợp lệ dài hơn mục tiêu được giữ và ghi rõ **dạng dài**. Nếu AI chưa gộp được, hiển thị các phần đã tóm tắt và thông báo chưa có bản tổng hợp ngắn; không cắt mất nội dung để ép đạt độ dài.

Tạo thẻ lỗi không có nghĩa là mất bản tóm tắt. Ứng dụng tạo/lưu từng lô nhỏ, hiển thị số lô đã xong; có thể ôn thẻ đã có. Bấm **Tạo tiếp Flashcard** để thử phần còn thiếu, kể cả sau khi mở lại ứng dụng. Kết quả chưa hợp lệ không được lưu thành thẻ. Mạng/provider lỗi vẫn báo lỗi và giữ kết quả đã tạo được.

Sau cập nhật cần khởi động lại ứng dụng để nạp backend/migration. Hàng đợi chờ không sống qua restart; slide, tóm tắt và checkpoint thẻ đã lưu được giữ. Lần gọi AI thật mới nhất vẫn timeout; kết quả kiểm thử và giới hạn tại [TESTING](TESTING.md#khôi-phục-tóm-tắt-dài-và-json-flashcard--04112026).

## Sao lưu và giới hạn vận hành

Sao lưu database **kèm thư mục tệp** cạnh nó (documents/ảnh EDUX và cấu hình lưu cục bộ cần thiết). Vở canvas cần xuất JSON riêng từ trình duyệt; bản nháp sổ tay và phiên Pomodoro chưa gửi có thể vẫn chỉ nằm trên thiết bị. Nội dung JSON/Markdown/HTML xuất có mục đích khác nhau, không thay thế bản sao database đầy đủ.

Kết nối IU/EDUX/Outlook, khả dụng Gemini và quyền tenant trường phụ thuộc dịch vụ bên ngoài. Kết quả kiểm thử giả lập hoặc ảnh QA không chứng minh tài khoản thật luôn kết nối được; xem từng phạm vi tại [TESTING](TESTING.md).
