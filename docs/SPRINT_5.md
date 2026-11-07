# Sprint 5 — Hoàn thiện ứng dụng desktop và vòng đời dữ liệu học tập

**Ngày cập nhật: 07/11/2026 — Asia/Saigon (UTC+7).** Báo cáo tổng hợp những thay đổi đã triển khai và kiểm tra trên bản mã cục bộ sau [Sprint 4](SPRINT_4.md).

**Khung kế hoạch đề xuất:** 06/11–12/11/2026, tiếp nối nhịp sprint hằng tuần; báo cáo dự kiến thứ Năm 12/11/2026. Kết quả dưới đây là tiến độ đến ngày 07/11, chưa phải biên bản kết thúc sprint.

## 1. Bối cảnh và lý do thực hiện

Sprint 4 tập trung củng cố nền tảng sau ba sprint chức năng: chuẩn hóa React/API/database, sửa các lỗi tích hợp và sai lệch dữ liệu học vụ, hoàn thiện công cụ học tập, kiểm thử hồi quy và chuẩn bị bản bàn giao Windows. Đầu ra của giai đoạn này là một hệ thống có cấu trúc rõ hơn, các luồng chính được rà soát và có cơ sở để tiếp tục hoàn thiện trải nghiệm sử dụng.

Khi chuyển sang sử dụng ứng dụng desktop thường xuyên, xuất hiện ba nhu cầu cần giải quyết ở cấp toàn ứng dụng:

1. Người dùng mở app để học, không cần quan tâm địa chỉ localhost, cổng giao diện hay máy chủ dữ liệu đi kèm.
2. Dữ liệu tích lũy qua thời gian cần có công cụ quản lý: chọn loại muốn xóa, biết phạm vi tác động và giữ lại nội dung cần thiết.
3. Khi sang học kỳ mới hoặc IU chưa cung cấp lịch mới, ứng dụng vẫn phải giữ được lịch sử và bản dữ liệu đã lưu để tiếp tục tra cứu.

Vì vậy, Sprint 5 tập trung vào **hoàn thiện cách vận hành desktop và quản lý vòng đời dữ liệu học tập**. Đây là bước tiếp nối từ việc ổn định các chức năng riêng lẻ ở Sprint 4 sang sử dụng ứng dụng liên tục, qua nhiều lần mở app và nhiều học kỳ.

## 2. Mục tiêu sprint

- Bản desktop khởi động và xử lý dữ liệu trong Electron, không mở cổng HTTP localhost cho giao diện hoặc nghiệp vụ.
- Người dùng chủ động chọn từng loại dữ liệu cần xóa, có xác nhận rõ phạm vi trước khi thực hiện.
- Lịch cũ được giữ để xem lại; lịch mới được cập nhật trong phạm vi đã lấy và xác minh.
- Lỗi kết nối, lịch rỗng hoặc dữ liệu sai không làm mất thời khóa biểu đã lưu.
- Bản nháp, canvas và dữ liệu không được chọn xóa tiếp tục được bảo toàn khi đổi origin hoặc khởi động lại.

## 3. Phân biệt phạm vi Sprint 4 và Sprint 5

| Nội dung | Sprint 4 — Củng cố và sửa lỗi | Sprint 5 — Hoàn thiện vận hành và dữ liệu |
| --- | --- | --- |
| Kiến trúc | Chuẩn hóa các tầng React, API, database, crawler và bridge Electron. | Tận dụng các tầng đã chuẩn hóa để chạy nghiệp vụ trong Electron qua transport bộ nhớ. |
| Desktop | Hoàn thiện nhận diện, khởi động, Setup/Portable; bản phát hành 05/11 còn dùng máy chủ loopback bên trong. | Giao diện và dữ liệu dùng `studyhub://app`, bỏ việc mở cổng localhost trong luồng desktop. |
| Quản lý dữ liệu | Có thao tác quản lý/xóa từng bản ghi trong các chức năng. | Bổ sung màn hình chọn loại dữ liệu, xóa toàn bộ, xác nhận và xử lý sau khi khởi động lại. |
| Thời khóa biểu | Chuẩn hóa dữ liệu IU, ngày giờ và luồng làm mới lịch. | Giữ lịch sử qua học kỳ, bảo vệ lịch đã lưu khi nguồn rỗng/lỗi/sai, đối chiếu phạm vi trước khi thay lịch. |
| Lưu trữ trình duyệt | Canvas và bản nháp lưu theo origin; bản đóng gói có origin ổn định. | Chuyển dữ liệu của bản chạy mã nguồn từ origin cũ; xóa đúng cả dữ liệu đã chọn ở origin cũ để tránh khôi phục lại. |
| Kiểm chứng | Hồi quy các chức năng học tập và bản bàn giao tại mốc Sprint 4. | Bổ sung kiểm tra không mở cổng, xóa có lựa chọn, khởi động lại và lịch sử nhiều học kỳ. |

## 4. Sprint backlog và kết quả triển khai

| Mã | Nhóm backlog | Hạng mục | Kết quả đến 07/11/2026 |
| --- | --- | --- | --- |
| S5-01 | PB-52 | Desktop không mở cổng localhost | Đã tách khởi tạo nghiệp vụ khỏi việc mở máy chủ HTTP; Electron dùng `studyhub://app` cho giao diện và dữ liệu. |
| S5-02 | PB-53 | Xóa dữ liệu theo lựa chọn | Đã có mục Cài đặt → Dữ liệu, lối vào từ Đồng bộ, chọn nhóm hoặc toàn bộ và xác nhận bằng từ khóa XÓA. |
| S5-03 | PB-54 | Giữ lịch sử qua học kỳ | Đã giữ lịch đã qua, bảo vệ lịch học kỳ khác và lịch tự thêm; cập nhật lịch mới trong phạm vi xác minh được. |
| S5-04 | PB-55 | Giữ bản lưu khi IU chưa cung cấp lịch | Đã xử lý lịch rỗng, lỗi và dữ liệu không hợp lệ; lưu trạng thái lần thử/lần thành công và cho thử lại sau thất bại. |
| S5-05 | PB-56 | Chuyển và bảo vệ dữ liệu cục bộ | Đã chuyển canvas/nháp từ origin cũ; giữ giá trị mới; xử lý xóa để nội dung cũ không được nhập lại. |
| S5-06 | PB-57 | Hồi quy và hướng dẫn bàn giao | Build production và các nhóm kiểm tra đã đạt; có kiểm tra Electron thật, Setup/Portable 1.1.0 và biên bản đóng gói cục bộ. Máy sạch, cài/nâng cấp và nguồn trường thật tiếp tục nghiệm thu. |

### S5-01. Chuyển desktop sang xử lý trong tiến trình Electron

**Nhu cầu:** mở ứng dụng desktop mà không phải cấu hình cổng hoặc chạy API riêng.

**Thay đổi:**

- Đăng ký origin `studyhub://app` cho cả bản chạy mã nguồn và bản đóng gói.
- Đọc bản build giao diện và chuyển yêu cầu nghiệp vụ qua stream trong bộ nhớ đến các handler hiện có.
- Tách `API/index.js.initialize()` khỏi `start()`: desktop dùng khởi tạo nghiệp vụ; chế độ web/headless vẫn có điểm chạy HTTP riêng.
- Frontend dùng Fetch adapter của Axios trong desktop; bridge IU/đồng bộ dùng cùng transport nội bộ.
- Giữ hỗ trợ JSON, upload nhị phân, tải tài liệu, byte range, lỗi và hủy yêu cầu.
- Hiển thị trạng thái ứng dụng bằng ngôn ngữ người dùng, giảm các hướng dẫn cấu hình backend trong giao diện desktop.

**Tiêu chí đã kiểm tra:** Electron vẫn mở giao diện, đọc SQLite, lưu ghi chú, xuất DOCX và tải tài liệu khi mọi lệnh mở cổng hoặc kết nối TCP của luồng nội bộ bị chặn trong bài thử.

### S5-02. Bổ sung quản lý và xóa dữ liệu

**Nhu cầu:** người dùng chọn loại dữ liệu muốn làm sạch, có thể giữ các nội dung khác.

**Điểm truy cập:** **Cài đặt → Dữ liệu** hoặc **Đồng bộ → Xóa dữ liệu**. Nút xóa đặt phía trên danh sách, hiển thị số loại đang chọn.

| Nhóm có thể chọn | Phạm vi |
| --- | --- |
| Thời khóa biểu | Lịch IU và lịch lớp tự thêm, gồm lịch cũ. |
| Bảng điểm & chương trình học | Điểm, môn đăng ký và chương trình đào tạo. |
| Công việc & checklist | Công việc cá nhân, checklist và bài tập EDUX. |
| Lịch thi & kế hoạch ôn thi | Kỳ thi và kế hoạch liên quan. |
| Lịch tự học & Pomodoro | Buổi tự học, phiên tập trung và tiến độ đọc cục bộ. |
| Tài liệu & học liệu | Tệp tải lên, học liệu, tóm tắt và flashcard. |
| Ghi chú, sổ tay & vở canvas | Nội dung ghi chép, bản nháp và vở viết/vẽ. |
| Lịch sử & kết quả AI | Hội thoại, quiz, phân tích điểm yếu và bản nháp đơn. |
| Thông báo & nhắc nhở | Thông báo và mốc nhắc đã lưu. |
| Email đã đồng bộ | Bản email lưu trên máy. |
| Phiên đăng nhập | Phiên IU/EDUX/Outlook và tài khoản EDUX đã nhớ trên máy. |
| Cài đặt cá nhân | Giao diện, mục tiêu cá nhân và tùy chỉnh công cụ. |

Ngoài từng nhóm, có lựa chọn **Xóa toàn bộ dữ liệu**, bao gồm hồ sơ sinh viên.

**Luồng thực hiện:**

1. Mặc định chưa chọn loại dữ liệu nào; nút xóa chưa được kích hoạt.
2. Người dùng chọn nhóm hoặc toàn bộ; hộp xác nhận liệt kê phạm vi cần xóa.
3. Nhập **XÓA** rồi chọn **Xóa & khởi động lại**.
4. App ghi yêu cầu, khởi động lại và thực hiện trước khi các tác vụ đồng bộ/AI của phiên mới bắt đầu.
5. Xử lý SQLite trong transaction, bảo đảm khóa ngoại; tệp tài liệu được kiểm tra tên và phạm vi thư mục trước khi xóa.
6. Dọn phần localStorage tương ứng, kể cả origin cũ; xác nhận hoàn tất trước khi bỏ yêu cầu đang chờ.

Nội dung không được chọn được giữ lại. Xóa tài liệu giữ nội dung ghi chú và bỏ liên kết đến tệp đã xóa; xóa email giữ công việc/kỳ thi đã tạo từ thư. Nếu vẫn giữ phiên đăng nhập, dữ liệu trường có thể được tải lại ở lần đồng bộ tiếp theo; màn hình giải thích việc chọn thêm nhóm Phiên đăng nhập khi cần ngắt các nguồn.

**Tiêu chí đã kiểm tra:** xác nhận thiếu/sai không tạo yêu cầu; nguồn IPC không hợp lệ bị từ chối; chỉ xóa nhóm đã chọn; dữ liệu còn lại và khóa ngoại hợp lệ; yêu cầu có thể xử lý lại sau gián đoạn; tải lại trang không xóa tiếp nội dung vừa tạo mới.

### S5-03. Giữ lịch sử và cập nhật học kỳ mới

**Nhu cầu:** sau khi chuyển học kỳ, sinh viên vẫn xem được các buổi đã học và các nội dung cá nhân đã lưu.

- Giữ lịch đã qua thay vì xóa toàn bộ lịch IU khi nhận bản cập nhật mới.
- Với bản dữ liệu hợp lệ và có phạm vi rõ ràng, chỉ thay phần lịch sắp tới trong khoảng đã lấy và học kỳ có thể đối chiếu.
- Giữ dữ liệu thuộc học kỳ khác, lịch ngoài phạm vi và lịch lớp tự thêm. Lịch lớp mới do người dùng tạo được ghi nguồn riêng để phân biệt với IU.
- Khi lịch lặp giao với phạm vi cập nhật, giữ các đoạn nằm ngoài phạm vi đó.
- Khi nguồn thiếu thông tin kỳ/phạm vi, ưu tiên đối chiếu và bổ sung; không xóa lịch của các môn/học kỳ chưa xác định được.
- Đồng bộ lặp không nhân đôi lịch sử. Người dùng xem lại bằng tuần, tháng hoặc danh sách trong Thời khóa biểu.

**Ví dụ:** IU trả lịch học kỳ 2; các buổi học kỳ 1 đã qua vẫn được giữ. Lịch học kỳ 2 được cập nhật trong phạm vi đã xác minh, còn lịch tự nhập và dữ liệu ngoài phạm vi tiếp tục tồn tại.

### S5-04. Xử lý khi chưa lấy được lịch mới

| Tình huống | Hành vi |
| --- | --- |
| Mất mạng, IU lỗi hoặc hết phiên | Giữ thời khóa biểu đã lưu, ghi trạng thái chưa lấy được lịch; hướng dẫn kết nối/thử lại theo lỗi nguồn. |
| IU trả danh sách rỗng | Giữ bản đã lưu; thông báo IU chưa cung cấp lịch trong khoảng đã chọn. |
| Thiếu/sai ngày, giờ hoặc dữ liệu ngoài phạm vi | Giữ lịch cũ và báo dữ liệu chưa hợp lệ. |
| Lấy được lịch hợp lệ | Cập nhật phần đối chiếu được, giữ lịch sử và ghi thời điểm thành công. |
| Người dùng thử lại sau một lượt lỗi/rỗng | Cho thử lại ngay, không áp thời gian chờ 24 giờ của lượt cập nhật thành công. |

Trạng thái được lưu để hiển thị tại **Đồng bộ → Thời khóa biểu & học kỳ**; lần thử thất bại không thay thời điểm thành công gần nhất. Lịch rỗng chưa đủ để kết luận toàn bộ buổi đã hủy, nên việc bỏ bản lưu thuộc thao tác xóa chủ động của người dùng. Lịch thi tiếp tục theo hợp đồng quét riêng đã có.

### S5-05. Chuyển origin và bảo vệ bản nháp

Khi bản chạy mã nguồn chuyển từ `http://localhost:8080` sang `studyhub://app`, app đọc localStorage của origin cũ bằng cơ chế intercept trong Electron, không cần mở cổng. Canvas/nháp được chuyển sang origin mới và các giá trị mới đã tồn tại được giữ.

Lượt chuyển và lượt xóa có marker riêng. Nếu người dùng đã chọn xóa ghi chú/canvas, dữ liệu tương ứng ở origin cũ cũng được xử lý để lần mở sau không nhập trở lại. Những nhóm không được chọn tiếp tục tồn tại.

## 5. Phân công rà soát và nghiệm thu đề xuất

Bảng kế thừa vai trò của năm thành viên trong Sprint 4, dùng làm kế hoạch rà soát/bàn giao Sprint 5. Kết quả triển khai được đối chiếu bằng mã và kiểm thử bên dưới.

| Thành viên | Trọng tâm rà soát/bàn giao Sprint 5 |
| --- | --- |
| Văn Tuấn — `vtishan` | Runtime Electron, custom protocol, transport nội bộ, tích hợp và điều phối kiểm chứng. |
| Anh Tuấn — `AnhTuancode-25` | Dữ liệu IU theo kỳ/phạm vi, dữ liệu rỗng/lỗi, hết phiên và đối soát nguồn trường. |
| Long Nhật — `longnhatdinhviet8-byte` | Khởi tạo nghiệp vụ, trạng thái đồng bộ, retry, IPC và quy trình yêu cầu xóa/khởi động lại. |
| Hồng Thắm — `Tham2007` | Transaction, khóa ngoại, xóa theo nhóm, giữ lịch sử, đối chiếu phạm vi và chống trùng. |
| Huyền Trang — `kieudu-dlst` | Cài đặt/Dữ liệu, chọn nhóm, xác nhận xóa, trạng thái học kỳ, điều hướng và kiểm tra giao diện. |

## 6. Mã và tài liệu bàn giao

| Thành phần | Vị trí |
| --- | --- |
| Khởi động desktop | [electron/main.js](../electron/main.js), [electron/desktop.js](../electron/desktop.js) |
| Giao tiếp không mở cổng | [local-transport.js](../electron/local-transport.js), [apiClient.js](../Frontend/src/api/apiClient.js) |
| Chọn và xử lý xóa dữ liệu | [data-management.js](../electron/data-management.js), [preload.js](../electron/preload.js), [DataManagement.jsx](../Frontend/src/components/settings/DataManagement.jsx) |
| Giữ lịch sử và trạng thái | [timetable-sync.js](../database/shared/timetable-sync.js), [iuSync.js](../database/modules/iuSync.js), [schedule.js](../database/modules/schedule.js) |
| Mapping, đồng bộ và retry | [iu-client.js](../API/utils/iu-client.js), [dongbo.service.js](../API/services/dongbo.service.js) |
| Chuyển dữ liệu origin cũ | [storage-migration.js](../electron/storage-migration.js) |
| Hướng dẫn | [FEATURES.md](FEATURES.md#quản-lý-dữ-liệu-trên-máy), [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md) |

## 7. Kết quả kiểm chứng đã ghi nhận

| Nhóm kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| Frontend: `npm --prefix Frontend test -- --maxWorkers=1` | **457/457 đạt, 51 file** | Giao diện, hợp đồng dữ liệu, chọn nhóm/xác nhận/lỗi khi xóa; các luồng học tập kế thừa. |
| Backend: `npm run test:api` | **152/152 đạt** | API, database, nghiệp vụ và provider giả lập; dữ liệu thử được tách khỏi dữ liệu người dùng. |
| Bridge: `npm run test:electron` | **31/31 đạt** | Entry, preload, nguồn gọi IPC, restore và timeout/luồng đồng bộ giả lập. |
| Nhóm xóa dữ liệu và lịch sử học kỳ | **2/2 đạt** | SQLite/thư mục tạm; dữ liệu không chọn, liên kết, tệp, đồng bộ rỗng/lỗi/sai, phạm vi và chống trùng. |
| Electron thật: `node --test tests/desktop-electron.cjs tests/electron-startup.cjs` | **2/2 đạt** | Chặn mở cổng/TCP nội bộ, đọc/ghi, upload/download/DOCX, UI quản lý dữ liệu và hai lần khởi động với hồ sơ tạm. |
| Build: `npm --prefix Frontend run build` | **Đạt; lượt cuối 9,88 giây** | Build production, giữ cảnh báo kích thước một số chunk đã có. |
| Windows 1.1.0: bản thư mục và Portable | **19/19 mỗi bản** | Executable thật, giữ dữ liệu, xóa theo lựa chọn và tự mở lại; Setup được kiểm tra toàn vẹn/payload trùng bản thư mục. Chưa chạy lại trình cài hoặc máy sạch. |

Các nhóm có ca giao nhau nên không cộng thành tổng duy nhất. Hai bài thử Pomodoro phụ thuộc giờ chạy đã được cố định thời điểm trước khi tải lịch mẫu; lượt toàn bộ frontend cuối đạt 457/457.

Các phép thử xóa chỉ tác động dữ liệu tổng hợp/thư mục tạm. Lượt Electron khởi động lại xác nhận ghi chú/canvas được chọn đã xóa, hồ sơ/tài liệu khác còn nguyên và nội dung cũ không được nhập trở lại. Nút xóa được kiểm tra nằm trong vùng nhìn thấy trước khi cuộn danh sách.

Log cục bộ nằm trong `tests/artifacts/data-management-api.log`, `data-management-frontend.log`, `data-management-build.log`; ảnh trong `tests/artifacts/desktop-data-management.png`. Thư mục artifact theo `.gitignore`; mã kiểm thử được giữ trong repository. Báo cáo chi tiết tại [TESTING.md](TESTING.md#sprint-5--desktop-và-vòng-đời-dữ-liệu--07112026).

## 8. Điều kiện tiếp tục bàn giao

- [x] Triển khai desktop không mở cổng, xóa dữ liệu có lựa chọn, giữ lịch sử học kỳ và chuyển dữ liệu origin.
- [x] Kiểm tra cục bộ các luồng chính, trường hợp lỗi và khởi động lại bằng dữ liệu thử.
- [x] Cập nhật hướng dẫn chức năng, kiến trúc, backlog và báo cáo Sprint 5.
- [ ] Đối soát lịch học kỳ mới, lịch chưa được công bố và phiên hết hạn bằng tài khoản IU/EDUX/Outlook thật.
- [x] Build Setup/Portable 1.1.0 từ runtime Sprint 5; kiểm tra bản thư mục/Portable, khởi động lại và giữ/xóa dữ liệu bằng profile tạm; đối chiếu payload Setup.
- [ ] Kiểm tra bản cài 1.1.0 trên máy sạch, gồm cài/nâng cấp và giữ/xóa dữ liệu đúng lựa chọn.
- [ ] Nhóm và người nhận xác nhận kết quả nghiệm thu, lịch bàn giao và các phần còn mở.

Bản phát hành Windows 1.0.0 ngày 05/11 thuộc mốc Sprint 4 và được giữ làm lịch sử. Runtime Sprint 5 được đóng gói thành 1.1.0; phạm vi kiểm chứng và SHA-256 tại [biên bản Windows 1.1.0](evidence/windows-release-v1.1.0.json), cách tải/cập nhật trong [WINDOWS_RELEASE.md](WINDOWS_RELEASE.md). Bản Portable khởi động lại qua launcher gốc và giữ tham số chạy. Mô hình hiện tại vẫn là một hồ sơ trên máy, còn đồng bộ nhiều thiết bị và nhiều tài khoản thuộc phạm vi mở rộng của backlog.
