# Ứng dụng Windows — Smart Study Hub 1.1.0

Ngày đóng gói và kiểm tra: **07/11/2026, UTC+7**. Hệ điều hành đích: **Windows x64**; lượt kiểm chứng thực tế trên Windows 11 x64. Electron 44.7.0, electron-builder 26.18.0. Bản 1.1.0 gồm các thay đổi [Sprint 5](SPRINT_5.md).

## Tải và sử dụng

Tải từ [Releases chính thức](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/releases/tag/v1.1.0):

| Tệp | Cách dùng |
| --- | --- |
| [Smart-Study-Hub-1.1.0-Portable-x64.exe](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/releases/download/v1.1.0/Smart-Study-Hub-1.1.0-Portable-x64.exe) | Tải về và mở trực tiếp; lần đầu cần thời gian giải nén nội bộ. |
| [Smart-Study-Hub-1.1.0-Setup-x64.exe](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/releases/download/v1.1.0/Smart-Study-Hub-1.1.0-Setup-x64.exe) | Mở để cài cho tài khoản Windows hiện tại; tạo shortcut Desktop và Start menu. |
| SHA256SUMS.txt | Mã SHA-256 để đối chiếu file đã tải bằng `Get-FileHash`. |

Ứng dụng đã chứa Electron/Node runtime, API, giao diện production, SQLite/WASM, schema/migration và module kết nối trường. Người dùng không cần cài môi trường lập trình. Bản phát hành chưa ký bằng chứng thư code signing; Windows có thể thông báo nhà phát hành chưa xác định.

1. Mở app, vào **Đồng bộ dữ liệu** và kết nối nguồn cần sử dụng bằng tài khoản của mình.
2. Đồng bộ IU để có hồ sơ/môn học, sau đó kết nối EDUX/Outlook theo quyền của tài khoản.
3. Sử dụng lịch, công việc, tài liệu, sổ tay và Pomodoro. Kết nối Internet khi gọi AI hoặc nguồn trường; OCR và một số thư viện có thể tải tài nguyên qua mạng.

Không kèm cookie, mật khẩu, `.env`, phiên AI hoặc DB cá nhân. AI hiện dùng phiên Gemini khách theo mã nguồn; không yêu cầu người dùng điền API key. Khả năng phản hồi phụ thuộc dịch vụ, mạng và giới hạn đã công bố trong [báo cáo nghiệm thu](BAO_CAO_NGHIEM_THU_SPRINT_3_4.md).

## Dữ liệu và cập nhật

- Hồ sơ ứng dụng: `%APPDATA%\SmartStudyHubCMC`.
- DB: `data\unistudy.db`; tệp tải lên: `data\documents`; phiên nguồn nằm trong các thư mục tương ứng dưới `data`.
- Vở canvas/bản nháp/cài đặt trình duyệt được giữ trong hồ sơ Chromium tại cùng thư mục. Origin cố định `studyhub://app` giúp dữ liệu này ổn định giữa các lần mở app.
- Setup và Portable dùng chung hồ sơ. Portable có một file chạy nhưng dữ liệu vẫn lưu trong AppData, không nằm cạnh `.exe`.
- Cập nhật thủ công bằng bộ cài mới hoặc thay file Portable sau khi đóng app. Chưa tích hợp tự cập nhật.
- Sao lưu khi đã đóng app: sao chép **toàn bộ** `%APPDATA%\SmartStudyHubCMC` ra nơi khác. Muốn phục hồi, đóng app rồi khôi phục bản sao của chính người dùng. Bản sao này có thể chứa phiên đăng nhập, cần giữ riêng.
- Bản chạy từ mã nguồn vẫn dùng đường dẫn phát triển trước đây. Bản đóng gói không tự nhập DB/phiên của thư mục mã nguồn; đồng bộ lại bằng tài khoản của mình khi bắt đầu dùng bản phát hành.

App dùng `studyhub://app` để đọc giao diện và gọi phần xử lý dữ liệu trong cùng tiến trình Electron, không mở cổng localhost cho API/giao diện. Không cần bật thêm server hoặc chỉnh cổng. Nhấn mở lại khi app đang chạy sẽ đưa cửa sổ hiện tại lên trước.

**Cài đặt → Dữ liệu** cho chọn từng nhóm hoặc toàn bộ; nhập **XÓA** để xác nhận. App khởi động lại để xóa đúng phạm vi. Bản Portable khởi động lại qua tệp launcher gốc và giữ tham số chạy, để bộ giải nén cũ có thể đóng/dọn thư mục của nó. Lịch học kỳ cũ được giữ; IU lỗi/lịch rỗng/sai ngày giờ giữ bản đã lưu.

## Build dành cho người phát triển

```powershell
npm ci
npm --prefix Frontend ci
npm run dist:win
```

Kết quả ở `release/`: Setup, Portable và `win-unpacked/`. Thư mục này được gitignore; đưa các `.exe` lên GitHub Releases, không commit binary vào lịch sử Git. `npm run dist:dir` tạo bản thư mục để kiểm tra nhanh.

Script [package-app.cjs](../scripts/package-app.cjs) build frontend với mock tắt và địa chỉ dữ liệu nhận lúc chạy, sao chép mã vào `release/.build/<phiên bản>`, cài dependency riêng rồi chạy electron-builder. Cấu hình [electron-builder.config.cjs](../electron-builder.config.cjs) chọn tài nguyên cần thiết và loại dữ liệu cá nhân. Quá trình build cần mạng để tải dependency/Electron/NSIS khi chưa có cache.

```powershell
npm run test:packaging
node scripts/smoke-packaged.cjs
node scripts/smoke-packaged.cjs release/Smart-Study-Hub-1.1.0-Portable-x64.exe
```

Smoke dùng profile tạm, bỏ Node.js khỏi PATH của tiến trình app, gọi nghiệp vụ thật trong gói và ghi dữ liệu fixture để kiểm tra đóng/mở lại, xóa ghi chú/canvas và giữ dữ liệu không chọn; không đăng nhập nguồn thật. Cổng DevTools do bài thử chủ động yêu cầu được phân biệt với cổng API/giao diện: app không mở các cổng nghiệp vụ này. Ảnh và báo cáo chi tiết ở `tests/artifacts/release/v1.1.0/`, không có trong clone GitHub mới. Tóm tắt và SHA-256: [windows-release-v1.1.0.json](evidence/windows-release-v1.1.0.json).

## Phạm vi kiểm chứng và bàn giao

Đã kiểm chứng bản thư mục và Portable thực tế trên máy hiện tại: giao diện/logo, nghiệp vụ trong tiến trình, DB mới không chứa sinh viên, ghi chú/tài liệu/localStorage qua nhiều lần mở; chọn xóa ghi chú/canvas rồi tự khởi động lại, giữ hồ sơ/tệp/cài đặt không chọn. Setup được kiểm tra toàn vẹn archive và đối chiếu payload với bản thư mục đã chạy thử. Không dùng việc đóng gói để nghiệm thu thay các luồng nguồn trường/AI, UI thiết bị hoặc toàn hành trình học tập còn mở.

Bản 1.0.0 ngày 05/11 đã có lượt kiểm tra cài và cài đè cục bộ trong [biên bản cũ](evidence/windows-release.json). Bản 1.1.0 chưa chạy lại trình cài trên hệ thống người dùng hoặc máy sạch; việc kiểm tra payload ở trên không thay cho lượt cài/nâng cấp đó. Giữ nguyên App ID và thư mục dữ liệu ngoài nơi cài đặt để tiếp tục hỗ trợ dữ liệu đã có.

Chưa có lượt trên máy ảo sạch không cài Node.js, chưa thử Windows 10/ARM64/macOS/Linux hoặc cài cho toàn máy trong Program Files. Cấu hình phát hành hiện cài theo người dùng, không yêu cầu quyền quản trị. Phân biệt kiểm chứng khi Node.js không nằm trong PATH của app với việc đã thử trên máy không có Node.js.

Trợ lý thực hiện đóng gói theo yêu cầu người dùng. **Văn Tuấn** nhận rà soát Electron/build/release; **Long Nhật** startup/API; **Hồng Thắm** DB/đường dẫn ghi/persist; **Huyền Trang** frontend/icon/shortcut; **Anh Tuấn** tài nguyên module nguồn/endpoint map. Đây là trách nhiệm rà soát và bàn giao theo phân công, không thay xác nhận đóng góp cá nhân hoặc chữ ký nghiệm thu.
