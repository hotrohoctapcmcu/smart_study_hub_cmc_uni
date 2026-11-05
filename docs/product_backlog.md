# Product backlog và kế hoạch nhóm

Tra nhanh: [Phân công Sprint 1–3](#phân-công-nhóm-và-3-sprint) · [Sprint 4 và issue từng thành viên](SPRINT_4.md#phân-công-trên-github) · [Product backlog](#backlog-theo-luồng-sử-dụng) · [Cách nghiệm thu](#cách-đóng-một-hạng-mục).

**Cập nhật bàn giao 02/11/2026:** kế hoạch 3 Sprint gốc được giữ làm lịch sử. Bản tái cấu trúc và mở rộng hiện tại là **Sprint 4**, nằm trên nhánh chính `main`; bản main cũ lưu ở `before`. Theo dõi tại [milestone Sprint 4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/3). Phân công đã gán GitHub: Văn Tuấn [#24](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/24), Anh Tuấn [#25](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/25), Long Nhật [#26](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/26), Hồng Thắm [#27](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/27), Huyền Trang [#28](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/28). Mục tiêu/tiêu chí PB bên dưới vẫn cần bằng chứng để đóng, không tự chuyển thành Done khi cập nhật main.

Bốn báo cáo tổng hợp: [Sprint 1](SPRINT_1.md) · [Sprint 2](SPRINT_2.md) · [Sprint 3](SPRINT_3.md) · [Sprint 4](SPRINT_4.md).

Smart Study Hub giúp sinh viên CMC mở một ứng dụng để biết hôm nay học gì, việc nào sắp đến hạn, tài liệu nằm ở đâu và nên ôn gì tiếp theo. Giá trị của sản phẩm nằm ở việc những thông tin đó nối được với nhau và vẫn còn sau khi đóng ứng dụng.

Backlog này được viết lại theo mã đang có ngày **30/10/2026**. Các mã PB-01 đến PB-51 được giữ để nhóm tra lại công việc cũ; cách ưu tiên và tiêu chí đã được chỉnh cho phạm vi hiện tại. Không dùng số Story Point hay Sprint cũ để suy ra tiến độ. Việc có màn hình hoặc API chỉ cho biết đã có phần triển khai, chưa đủ để đánh dấu hoàn thành.

## Nhóm nên tập trung vào đâu?

Ưu tiên trước mắt là dùng ổn những luồng đã có: đồng bộ đúng dữ liệu, không mất việc và ghi chú, lưu lịch không trùng, mở lại vẫn thấy kết quả. Sau đó mới mở rộng cá nhân hóa và các nguồn dữ liệu mới.

- **Must:** thiếu mục này thì luồng chính hoặc việc bàn giao không đáng tin cậy. Cần đạt trước khi nghiệm thu bản tương ứng.
- **Should:** mang lại giá trị rõ ràng, nên hoàn thiện sau các mục Must; có thể dời nếu chưa đủ thời gian.
- **Could:** phần mở rộng, cần chốt phạm vi và nguồn lực trước khi làm. Không phải điều kiện đóng bản chạy một hồ sơ hiện tại.

Đây là ưu tiên đề xuất cho bản dùng một hồ sơ hiện tại, cần chốt khi chọn việc vào Sprint; không phải nhãn mức độ khó hoặc đánh giá công sức đã bỏ ra.

### Phần đang có và phần chưa thể kết luận

| Đã thấy trong mã hiện tại | Việc còn cần xác minh trước khi đóng |
| --- | --- |
| Electron, React/Vite, Express và SQLite; có lệnh chạy ứng dụng, headless và các nhóm test | Bộ cài trên máy sạch, đường dẫn tài nguyên và quyền ghi khi cài vào Program Files. `package.json` gốc chưa có lệnh tạo bộ cài |
| Module IU/EDUX/Outlook, luồng kết nối và job đồng bộ có tiến trình | Tài khoản trường thật, phiên hết hạn/MFA, nguồn trả thiếu dữ liệu hoặc thay đổi cấu trúc; fixture không chứng minh dịch vụ thật hoạt động |
| Trang lịch, task, kỳ thi, hồ sơ, học liệu, thống kê và email; API tương ứng đã được tách thành route/service | Đối chiếu thao tác UI → HTTP → SQLite → tải lại, đặc biệt checklist, hạn EDUX, học lại và nhắc đến hạn khi thời gian trôi qua |
| API và giao diện trợ lý, quiz, điểm yếu, kế hoạch ôn, đơn nghỉ; có bộ kiểm thử riêng | Độ đúng và khả dụng của AI thật, giới hạn context, dữ liệu thiếu, xử lý hủy/lỗi và xác nhận lại lịch trước khi lưu |
| Sổ tay dùng API; vở ghi canvas có sao lưu và lưu cục bộ | Quota, bản nháp chưa đồng bộ, đổi trình duyệt và nhiều tab; vở cục bộ chưa phải dữ liệu đồng bộ tài khoản |

Mô hình hiện tại dùng `APP_USER_ID` hoặc hồ sơ mặc định 1 (`API/utils/nguoiDung.js`). **Chưa có căn cứ coi đăng nhập nhiều người dùng và đồng bộ sang máy khác là đã hoàn thành.** PB-09, PB-10 và phần liên thiết bị của PB-42 được tách thành mở rộng bên dưới. Kết quả kiểm thử và giới hạn bằng chứng xem [TESTING.md](TESTING.md); tài liệu này không ghi nhận một lượt chạy test mới.

## Backlog theo luồng sử dụng

Mỗi dòng nêu một kết quả người dùng cần và cách kiểm tra đủ cụ thể để nhóm bàn giao. Chỉ đánh dấu hoàn thành khi có bằng chứng cho tiêu chí, kể cả trường hợp lỗi. Các hạng mục cùng nhóm không nhất thiết phải thực hiện theo số PB.

### 1. Mở ứng dụng và lấy đúng dữ liệu trường

Sinh viên không nên phải biết từng nguồn dùng giao thức gì. Họ cần kết nối được, biết nguồn nào lỗi và tiếp tục dùng dữ liệu gần nhất mà không mất thông tin tự nhập.

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-01 | Must | Khởi động được bản desktop và headless theo [README](../README.md); frontend gọi đúng API, database được tạo/mở; thiếu cấu hình có thông báo đủ để xử lý |
| PB-02 | Must | Tầng IU đọc được phản hồi hợp lệ và chọn đúng nhóm endpoint; phản hồi sai/không giải mã được báo lỗi có kiểm soát, không biến thành dữ liệu rỗng thành công |
| PB-03 | Must | Đăng nhập IU qua tài khoản trường, dùng lại phiên còn hạn; hết phiên có đường đăng nhập lại; cookie/token không đi qua renderer hoặc xuất hiện trong thông báo lỗi |
| PB-04 | Must | Sau một lần đồng bộ thành công, đóng/mở ứng dụng vẫn xem được hồ sơ, lịch và điểm đã lưu; mất mạng không làm trắng dữ liệu đó |
| PB-05 | Must | Gây lỗi giữa lần ghi đồng bộ không để lại DB nửa cũ nửa mới; trường thiếu không sinh lịch/điểm giả; nguồn lỗi giữ dữ liệu gần nhất và không xóa lịch tự nhập |
| PB-06 | Should | Kết nối EDUX lấy được môn, chương và học liệu trong phạm vi nguồn cung cấp; tài liệu chỉ có metadata được ghi rõ, tệp tải được phải mở lại đúng nội dung |
| PB-07 | Must | Đồng bộ bài tập EDUX đúng môn và hạn thật; phân biệt hạn riêng với hạn học phần; đồng bộ lại không nhân đôi hoặc làm hiện lại bài đã ẩn; lỗi tải hạn không xóa hạn đã lưu |
| PB-08 | Could | Chỉ thêm tiến độ bài học eLearning khi nguồn thực sự có dữ liệu; hiển thị bài đã/chưa học theo tuần và phân biệt chưa có dữ liệu với chưa hoàn thành |

### 2. Tách tài khoản khi sản phẩm cần hỗ trợ nhiều người

Đây là phạm vi mở rộng. Kiểm tra bản ghi đúng hồ sơ hiện tại vẫn là yêu cầu của mọi API đang chạy; việc đó không thay thế xác thực và phân quyền giữa hai tài khoản.

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-09 | Could | Nếu mở bản nhiều tài khoản: đăng nhập sai/thiếu phiên trả 401, không tự dùng hồ sơ 1; logout xóa phiên; hai tài khoản có dữ liệu và bản nháp riêng |
| PB-10 | Could | Khi PB-09 được đưa vào phạm vi, thử đọc/sửa/xóa ID thuộc tài khoản khác phải bị từ chối 403/404, kể cả gọi HTTP trực tiếp; không chỉ ẩn nút trên UI |

### 3. Nhìn lịch là biết hôm nay phải làm gì

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-11 | Must | Lịch ngày/tuần điều hướng đúng, hiển thị môn, giờ, phòng và giảng viên khi nguồn có; lịch lặp được mở thành đúng ngày trong khoảng đang xem |
| PB-12 | Must | Lịch trường và lịch tự học xuất hiện cùng nhau nhưng có nhãn/màu phân biệt; không gán lịch tự nhập thành dữ liệu trường |
| PB-13 | Must | Tạo/sửa/xóa và hoàn thành buổi tự học được ghi thật; tải lại thấy kết quả; lỗi lưu giữ nội dung đang nhập và cho thử lại |
| PB-14 | Must | Đồng bộ xong trang lịch nhận dữ liệu mới mà không cần khởi động lại; một lần tải lỗi không khiến các lần sau mắc lại ở kết quả cũ |
| PB-15 | Should | Lưới tháng hiển thị sự kiện đúng ngày, chuyển tháng và mở chi tiết được; tháng không có sự kiện có trạng thái trống rõ ràng |

### 4. Biết khi nào thi và chia được việc ôn

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-16 | Must | Đồng bộ lịch thi từ ngày hiện tại theo giờ Việt Nam đến 70 ngày sau, gồm hai biên và kỳ tiếp theo khi cần; loại kỳ ngoài cửa sổ; lỗi giữ cache, kết quả rỗng hợp lệ được xử lý riêng |
| PB-17 | Must | Giữ học kỳ/năm học nguồn cung cấp để lọc/đối chiếu; migration mở được DB cũ; trường nguồn không có phải để thiếu có chủ đích, không điền học kỳ giả |
| PB-18 | Must | Sửa ngày, giờ, phòng, hình thức và thời lượng thi lưu bền; kiểm tra dữ liệu sai; không làm mất nguồn hoặc các trường không sửa |
| PB-19 | Must | Tạo/sửa/xóa giai đoạn ôn, hoàn thành rồi mở lại được; tải lại vẫn đúng; xóa hoặc đổi kỳ thi không để kế hoạch mồ côi |
| PB-20 | Should | AI đề xuất giai đoạn và buổi học trước ngày thi, dựa trên khoảng trống thật; người dùng sửa/chọn rồi xác nhận; kiểm tra lại xung đột và ghi cả nhóm trong transaction; gửi lại không tạo bản sao |

### 5. Xếp buổi tự học mà không làm hỏng lịch

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-21 | Must | Cảnh báo đúng cặp lịch giao nhau; hai buổi sát nhau (`A.end = B.start`) không tính trùng; nội dung cảnh báo cho biết lịch nào gây xung đột |
| PB-22 | Must | Server kiểm tra trước lúc ghi, kể cả lịch đã đổi sau khi UI tải; bị trùng thì không lưu một phần, UI giữ đề xuất để chỉnh |
| PB-23 | Should | Gợi ý tự học dùng toàn bộ lịch lớp/thi/tự học, tránh thời gian đã qua; preview không tự ghi DB; bấm áp dụng mới tạo các buổi được chọn |

### 6. Không bỏ sót deadline và việc nhỏ bên trong

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-24 | Must | CRUD task và checklist con có ID/lưu bền; hoàn thành nhanh rồi tải lại không lệch task/checklist; thao tác EDUX dùng đúng route/trạng thái nguồn |
| PB-25 | Must | Với hạn cách 1/3/7 ngày, truy vấn ba ngày trả đúng phạm vi và thứ tự; kiểm tra mốc cuối ngày theo giờ Việt Nam và task đã hoàn thành |
| PB-26 | Must | Nhắc đúng mốc 7 ngày/3 ngày/24 giờ/1 giờ phù hợp với deadline; badge và danh sách nhất quán; để ứng dụng mở qua thời điểm đến hạn vẫn cập nhật, không chỉ kiểm tra lúc mở |
| PB-27 | Must | Đánh dấu tất cả đã đọc không 404; chỉ tác động hồ sơ đang dùng, badge cập nhật và không trở lại sau tải lại |
| PB-28 | Must | Tạo nhắc bằng các luồng khác nhau hoặc đồng bộ lại cùng deadline không nhân đôi cùng một mốc |

### 7. Xem được kết quả học và hiểu số liệu

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-29 | Must | Sau đồng bộ, hồ sơ/bảng điểm thuộc đúng sinh viên; trường thiếu được hiển thị rõ, không lấy thông tin của hồ sơ khác để lấp vào |
| PB-30 | Must | Lưu năm học, học kỳ, điểm thành phần/thi/tổng khi nguồn có; hai lần học một môn không ghi đè nhau; thiếu điểm không biến thành 0 |
| PB-31 | Must | Hồ sơ hiển thị ngành/lớp/khóa, GPA 10/4, tín chỉ và bảng điểm theo học kỳ khi có dữ liệu; công bố cách chọn lần học/tính GPA và không dùng tổng tín chỉ cố định cho mọi hồ sơ |
| PB-32 | Should | Danh sách môn chưa đạt khớp bảng điểm và quy tắc học lại; dữ liệu thiếu điểm không bị coi là trượt |
| PB-33 | Must | Báo cáo task, điểm và thời gian học dùng cùng khoảng đã chọn; bỏ task EDUX đã ẩn, không cộng trùng Pomodoro/tự học; không tự sinh số liệu tháng chưa tải |
| PB-34 | Should | Điểm yếu truy được về quiz đã nộp và môn/chủ đề, phân biệt với nhận xét bảng điểm; có ít nhất hai lần làm mới tính cải thiện theo điểm phần trăm |

### 8. Tìm lại tài liệu và ghi chú mà không lo mất

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-35 | Must | Lọc học liệu theo môn, upload/download đúng byte và tên tiếng Việt; thêm/xóa lưu bền; metadata không có tệp gốc được báo rõ để tải lại |
| PB-36 | Must | Tìm từ khóa trả đúng task, tài liệu, ghi chú và lịch trong phạm vi hỗ trợ; mở kết quả tới đúng đối tượng, không chỉ về trang danh sách |
| PB-37 | Should | Gắn/bỏ tag lưu bền, lọc đúng; chuẩn hóa khoảng trắng và tag trùng, xóa tag không làm mất đối tượng |
| PB-38 | Must | Sổ tay/ghi chú theo môn lưu qua API và phục hồi nháp sau lỗi; nội dung cũ còn đọc được. Vở ghi canvas lưu cục bộ phải nói rõ nơi lưu, có xuất/nhập JSON và cảnh báo quota; không gọi đó là đồng bộ máy chủ |

### 9. Hỏi AI rồi tự kiểm tra lại kiến thức

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-39 | Should | Chat trả lời với context đúng hồ sơ, lưu hội thoại thành công và tải lại được; lỗi provider có thông báo/thử lại; nội dung dài và phần bị giới hạn được xử lý rõ, không giả vờ đã đọc toàn bộ tệp |
| PB-40 | Should | Sinh quiz đúng môn/chủ đề/độ khó; chưa nộp không lộ đáp án; server tự chấm, lưu và xem lại kết quả; gửi lại cùng bài không chấm trùng, đáp án đang làm được giữ khi lưu lỗi |

### 10. Tập trung học và xử lý thông tin liên quan

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-41 | Must | Pomodoro chạy/pause/resume/kết thúc đúng theo thời điểm thực; chỉ lưu focus segments và thời gian tập trung; reload/ẩn tab không cộng thời gian nghỉ |
| PB-42 | Should | Lịch sử Pomodoro được lưu SQLite bằng ID ổn định, lỗi giữ phiên để gửi lại, gửi lại không trùng. Xem trên máy khác là phần Could phụ thuộc PB-09 và cơ chế đồng bộ liên thiết bị chưa có |
| PB-43 | Should | Time Map đúng khoảng ngày và múi giờ, phân loại lớp/thi/tự học/Pomodoro; quy tắc ưu tiên phần giao nhau rõ ràng, tổng không vượt thời gian thực |
| PB-44 | Should | Đơn nghỉ điền thông tin thật và lớp đúng ngày, cho xem/sửa/lưu bản nháp/xuất TXT hoặc DOCX; thiếu thông tin để trống; không tự gửi email hay nộp lên trường |
| PB-45 | Should | Đồng bộ email Outlook có phân trang/nội dung khi nguồn cho phép; đọc/refresh lưu đúng; thiếu ngày giờ không tự đoán; tạo task/thi phải xem lại và xác nhận, không tạo hai lần từ cùng thư |

### 11. Bàn giao bản người khác có thể tự dùng

| Mã | Ưu tiên | Kết quả cần đạt và cách nghiệm thu |
| --- | --- | --- |
| PB-46 | Must | Lỗi nghiệp vụ hiện đúng message; request treo bị hủy theo timeout của từng luồng; lỗi không chứa cookie/token và không khiến UI mất nội dung đang nhập |
| PB-47 | Must | Có điểm chạy kiểm thử rõ ràng cho bản bàn giao, báo đạt/lỗi/bỏ qua và thoát thất bại khi test lỗi; các bộ API/DB/frontend/integration có hướng dẫn chạy, không tuyên bố kiểm thử live bằng mock |
| PB-48 | Must | Chạy 10 kịch bản ở mục dưới trên đúng bản định bàn giao; ghi phiên bản, môi trường, kết quả và lỗi còn lại, có bằng chứng kiểm tra bố cục thật |
| PB-49 | Must | Có lệnh build tạo bộ cài; cài và mở trên máy sạch không cần cài Node.js; không nhầm `npm start` với bản cài độc lập |
| PB-50 | Must | Bản cài tìm được frontend, WASM và `endpoint_map.txt`; tạo/ghi/mở lại DB ở thư mục người dùng, kể cả cài vào Program Files; dữ liệu cũ còn sau nâng cấp theo phạm vi hỗ trợ |
| PB-51 | Must | Người nhận làm theo tài liệu để cài/chạy, cấu hình, kiểm tra và tìm đúng tầng mã; có mô tả API/database, sao lưu, đóng gói và giới hạn đã biết; liên kết nội bộ còn dùng được |

## Cách đóng một hạng mục

Người phụ trách bàn giao luồng chạy được, không chỉ file đã viết. Người nhận kiểm tra đầu vào bình thường, trường hợp rỗng/sai, lỗi nguồn hoặc lỗi lưu; sau đó tải lại hoặc mở lại để kiểm tra dữ liệu. Bằng chứng ghi rõ dùng fixture, provider giả lập, dữ liệu thật đã lưu hay kết nối dịch vụ thật. Nếu một tiêu chí chưa kiểm tra được thì để mở phần đó, không lấy số test đạt của thành phần khác thay thế.

Các phụ thuộc thực tế cần chốt trước khi làm:

- Dữ liệu nguồn và schema thống nhất trước khi nối API/UI; với trường không có ở nguồn, thống nhất cách biểu diễn thiếu thay vì tự điền.
- Hoàn thiện lưu lịch và kiểm tra xung đột trước khi nghiệm thu planner AI; kiểm tra lại lịch ngay lúc xác nhận, ghi giai đoạn và buổi học trong cùng transaction.
- Có kết quả quiz đã nộp trước khi đánh giá điểm yếu/cải thiện; có file thật hoặc văn bản đã trích xuất trước khi nói AI dùng nội dung học liệu.
- PB-09/PB-10 cần thiết kế riêng nếu mở nhiều tài khoản; không buộc việc sửa luồng một hồ sơ phải chờ một hệ thống đăng nhập chưa nằm trong bản hiện tại.
- Setup/Portable Windows x64 1.0.0 đã được bổ sung ngày 05/11, có kiểm chứng runtime/tài nguyên/persist và cài đè trên máy hiện tại; xem [hồ sơ phát hành](WINDOWS_RELEASE.md), [bằng chứng](evidence/windows-release.json). PB-49/PB-50 còn nghiệm thu máy sạch và xác nhận người nhận; chưa tự đánh dấu Done toàn bộ tiêu chí.

### 10 kịch bản trước bàn giao

1. Cài/chạy trên máy sạch, mở API/frontend, đóng/mở lại và kiểm tra DB vẫn ghi được.
2. Kết nối IU/EDUX/Outlook; đồng bộ lại, hết phiên, nguồn lỗi và kết quả rỗng; kiểm tra dữ liệu cũ/tự nhập còn đúng.
3. Xem lịch ngày/tuần/tháng, CRUD tự học, kiểm tra hai buổi sát nhau và hai buổi trùng; tải lại sau lỗi lưu.
4. CRUD task/checklist, trạng thái EDUX, hạn sắp tới, bài đã ẩn; giữ ứng dụng mở qua mốc nhắc và kiểm tra read-all.
5. Đồng bộ/sửa kỳ thi, cửa sổ 70 ngày, giai đoạn ôn; AI preview/xác nhận, gửi lại và phát sinh xung đột trong lúc chờ.
6. Hồ sơ/điểm/học lại/GPA; đối chiếu thiếu điểm, bộ lọc học kỳ và danh sách môn chưa đạt với dữ liệu nguồn.
7. Upload/tải lại/xóa học liệu tiếng Việt, tìm kiếm/tag; sổ tay/vở ghi lưu, phục hồi nháp, quota và xuất/nhập sao lưu.
8. Pomodoro pause/resume/reload/gửi lại; đối chiếu Time Map/progress cùng khoảng ngày và phần thời gian giao nhau.
9. Chat/quiz/điểm yếu/đơn nghỉ: lỗi AI, giữ nội dung nhập, lưu lịch sử, chấm lại và xuất file; tách kết quả mock khỏi AI thật.
10. Email thiếu ngày giờ và thư trùng; xem trước rồi tạo task/thi; kiểm tra desktop/tablet/màn hình hẹp, bàn phím và các trạng thái lỗi/trống.

## Phân công nhóm và 3 Sprint

Phân công là trách nhiệm thực hiện và bàn giao, **không phải xác nhận công việc đã xong**. Tên Frontend theo phân công gốc là Huyền Trang; một số báo cáo cũ ghi Kiều Trang cho vai trò này.

| Thành viên | Phụ trách | Bàn giao và phối hợp |
| --- | --- | --- |
| **Văn Tuấn** | Trưởng nhóm, kiến trúc/tích hợp, cơ chế kết nối IU/Outlook, Gemini/context/prompt/kiểm tra đầu ra | Chốt hợp đồng và phụ thuộc; bàn giao client/lỗi nguồn cho Anh Tuấn và Long Nhật; tổng hợp bằng chứng và hạn chế từng Sprint |
| **Anh Tuấn** | Lấy và làm sạch dữ liệu IU/EDUX/Outlook; mã môn/sinh viên, ngày giờ, điểm, trạng thái và nguồn gốc | Bảng ánh xạ nguồn → trường chuẩn → nơi lưu; ca thiếu/trùng/sai và dữ liệu thử riêng; đối soát cùng Hồng Thắm/Long Nhật |
| **Long Nhật** | API, validation và nghiệp vụ; tích hợp nguồn/AI/database; transaction và chống trùng | Method/request/response/lỗi rõ trước khi Huyền Trang nối UI; test HTTP và bước tái hiện lỗi; không báo thành công khi chưa lưu |
| **Hồng Thắm** | Schema/migration, CRUD/thống kê, khóa/quan hệ, transaction/rollback/persist | Hợp đồng hàm DB, di trú giữ dữ liệu cũ, test lưu/mở lại và đối soát; dùng `database/` gốc, không sửa bản sao lịch sử |
| **Huyền Trang** | React/Vite, UI/UX 18 chức năng, nối API; loading/empty/error/retry, responsive/bàn phím | Luồng thao tác dùng được, giữ dữ liệu nhập khi lỗi, kết quả sau reload và bằng chứng UI thật; phản hồi lỗi có bước tái hiện |

| Sprint | 18 chức năng được giao theo kế hoạch nhóm | Trọng tâm phối hợp |
| --- | --- | --- |
| **1** | **1** TKB; **2** AI xếp tự học/cảnh báo trùng; **3** Deadline/Checklist; **4** Nhắc nhở; **9** Lịch thi/ôn thi; **18** Hồ sơ | Văn Tuấn chốt nền tảng/IU/context; Anh Tuấn ánh xạ dữ liệu; Hồng Thắm lưu an toàn; Long Nhật nối API; Huyền Trang hoàn thiện thao tác và kiểm tra sau mở lại |
| **2** | **5** Kho tài liệu; **6** Tìm kiếm/Tag; **8** Pomodoro; **10** Time Map; **11** Tiến độ; **12** Textbook/sổ tay; **17** Email trường | Phân biệt tệp thật/metadata, sổ tay server/vở cục bộ; chuẩn thời gian; không tính trùng; email có xác nhận. Cả nhóm kiểm thử, sửa lỗi và báo cáo |
| **3** | **7** Gia sư AI; **13** Quiz AI; **14** Điểm yếu; **15** Kế hoạch ôn AI; **16** Đơn nghỉ | Context đúng và đủ trong phạm vi công bố; quiz server chấm; lịch xác nhận có transaction/chống trùng; UI giữ nháp. Tích hợp, kiểm thử tổng thể, sửa lỗi và bàn giao |

Quy ước chung: ngày `YYYY-MM-DD`, giờ `HH:mm`, UTC+7; Thứ Hai = 2 đến Chủ nhật = 8. Lịch sử học lại và dữ liệu thiếu phải giữ đúng ý nghĩa. Bảng Pomodoro chính thức là `PomodoroSessions`. Kiến trúc và vị trí mã hiện tại xem [ARCHITECTURE.md](ARCHITECTURE.md), hợp đồng tích hợp xem [API.md](API.md), giới hạn tính năng xem [FEATURES.md](FEATURES.md).

## Lưu ý khi đối chiếu báo cáo cũ

Backlog 18/10/2026 từng chia **4 Sprint** và gán ưu tiên/trạng thái khác; kế hoạch phân công về sau dùng **3 Sprint** như bảng trên. Không ghép số Sprint của hai bản thành một tiến độ. PB-45 từng là Won't nhưng email đã được đưa vào Sprint 2 và có triển khai; PB-09/PB-10 từng là Must nhưng xác thực nhiều tài khoản chưa phải mô hình hiện tại. Các thay đổi ưu tiên trong bản này được nêu để nhóm biết phạm vi cần chốt.

Báo cáo 27/10 ghi Sprint 2 đã nối 7 chức năng, còn cần nghiệm thu Outlook thật; đánh giá Sprint 3 cùng ngày là trước đợt bổ sung UI/lưu dữ liệu ngày 28/10. Các lượt QA/refactor ngày 29–30/10 có phạm vi riêng. Không giữ nhãn Done/Backlog cũ làm trạng thái hiện hành, không cộng số test từ những snapshot khác nhau, và không coi kết quả provider giả lập là nghiệm thu dịch vụ thật.
