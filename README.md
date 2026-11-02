# Smart Study Hub — CMC University

Ứng dụng hỗ trợ sinh viên CMC quản lý lịch học, deadline, lịch thi, học liệu, ghi chú và hoạt động tự học trong cùng một không gian. Dữ liệu IU, EDUX và Outlook được kết nối với lịch cá nhân, Pomodoro và các công cụ AI.

**Bản cập nhật Sprint 4:** nhánh chính `main`, tổng hợp đến **02/11/2026**, chứa bản tái cấu trúc và mở rộng toàn diện sau Sprint 1–3. Phiên bản `main` cũ được lưu tại nhánh [`before`](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/before).

[Mã nguồn mới nhất — main](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/tree/main) · [Milestone Sprint 4](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/milestone/3) · [Phân công và nghiệm thu](docs/SPRINT_4.md)

## Chức năng

| Nhóm | Nội dung |
| --- | --- |
| Lịch và hồ sơ | Thời khóa biểu, lịch tự học, phát hiện xung đột, lịch thi/ôn thi, hồ sơ và bảng điểm IU. |
| Công việc | Deadline, checklist, bài tập EDUX, tag, tìm kiếm và nhắc nhở nhiều mốc. |
| Học liệu | Tài liệu theo môn, chương/slide EDUX, ảnh/PDF, upload/download, tóm tắt toàn môn và flashcard. |
| Không gian ghi chép | Sổ tay có cấu trúc với Tiptap, template, trang con, autosave/nháp; vở canvas có vẽ, bảng, công thức, OCR và export. |
| Theo dõi học tập | Pomodoro, Time Map, thống kê tiến độ và nhận xét AI theo dữ liệu có thật. |
| AI và email | Gia sư, quiz, điểm yếu, kế hoạch tự học/ôn thi, tóm tắt dài, soạn đơn nghỉ và đọc email Outlook. |

Chi tiết thao tác và giới hạn: [FEATURES.md](docs/FEATURES.md). Các đề xuất lịch và thông tin trích từ email cần người dùng xem lại, xác nhận trước khi lưu.

## Công nghệ và cấu trúc

| Thành phần | Công nghệ / vị trí |
| --- | --- |
| Desktop | Electron, `electron/main.js`, `electron/preload.js`, `electron/bridges/`. |
| Frontend | React 18, Vite 6, React Router, Axios; `Frontend/src/`. |
| API | Node.js, Express 4; `API/routes`, `controllers`, `services`, `validators`, `middlewares`, `utils`. |
| Database | SQLite qua `sql.js`; `database/connection`, `schema`, `migrations`, `modules`, `shared`. |
| Kết nối trường | `CRWEB/modules/IU`, `EDUX`, `OUTLOOK`; helper chung trong `CRWEB/shared`. |
| Kiểm thử | Node test runner, Vitest, React Testing Library và các script tích hợp/Electron. |

```text
smart_study_hub_cmc_uni/
├── API/                  # HTTP API và nghiệp vụ
├── CRWEB/                # Đăng nhập, lấy và chuẩn hóa dữ liệu nguồn
├── database/             # SQLite, migration và module lưu trữ
├── electron/             # Desktop, preload và IPC bridges
├── Frontend/             # Ứng dụng React/Vite
├── tests/                # Hồi quy, tích hợp và smoke scripts
├── docs/                 # Tài liệu kỹ thuật và 4 báo cáo sprint
├── .env.example          # Cấu hình backend mẫu
└── index.js              # Chạy API và phục vụ frontend đã build
```

Luồng chính: **React → HTTP API → service → SQLite / nguồn trường / AI**. Electron cung cấp cửa sổ đăng nhập và IPC cho các nguồn cần phiên desktop. Xem [kiến trúc và sao lưu](docs/ARCHITECTURE.md).

## Cài đặt và chạy

Môi trường đã kiểm tra cho bản cập nhật: **Windows, Node.js 24.16.0, npm 11.13.0**. Máy cần truy cập mạng để cài dependency và kết nối các dịch vụ ngoài.

```powershell
git clone --branch main https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni.git
cd smart_study_hub_cmc_uni
npm ci
npm --prefix Frontend ci

if (-not (Test-Path -LiteralPath '.env')) { Copy-Item .env.example .env }
if (-not (Test-Path -LiteralPath 'Frontend/.env')) { Copy-Item Frontend/.env.example Frontend/.env }

npm start
```

`npm start` tự build React rồi mở Electron. Frontend được phục vụ tại `http://localhost:8080`, API mặc định tại `http://localhost:3001/api/v1`. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` cho các lệnh tương ứng.

Để phát triển, chạy hai terminal riêng:

```powershell
# Terminal 1: backend
npm run dev:api

# Terminal 2: frontend tại http://127.0.0.1:5173
npm --prefix Frontend run dev
```

Chạy giao diện độc lập với dữ liệu giả lập: `npm --prefix Frontend run dev:mock`. Chạy bản build trong trình duyệt: `npm run start:headless`. Luồng đăng nhập Microsoft qua IPC cần Electron; headless cần phiên/token được cung cấp cho backend. Kho localStorage riêng theo origin nên Vite và cổng 8080 có dữ liệu cục bộ riêng.

## Cấu hình và dữ liệu

| Biến | Giá trị mặc định / mục đích |
| --- | --- |
| `DB_PATH` | `./data/unistudy.db`, database cục bộ. |
| `API_PORT` | `3001`, cổng Express. |
| `API_BASE` | `http://localhost:3001`, URL backend của bridge Electron, không kèm `/api/v1`. |
| `APP_USER_ID` | `1`, hồ sơ đang dùng trong ứng dụng. |
| `VITE_API_URL` | `http://localhost:3001/api/v1`, đặt tại `Frontend/.env`. |
| `VITE_USE_MOCK` | `false`; chỉ bật khi phát triển với dữ liệu giả lập. |
| `DOCUMENTS_PATH` | Thư mục file tải lên; mặc định cạnh database trong `documents/`. |
| `EDUX_ACCOUNTS_PATH`, `EDUX_IMAGES_PATH` | Nơi lưu tài khoản EDUX và cache ảnh, mặc định cạnh database. |
| `GEMINI_TIMEOUT_MS` | `45000`; provider hiện dùng phiên web khách. |
| `OUTLOOK_ACCESS_TOKEN` | Tùy chọn cho headless, token Graph có quyền `Mail.Read`. |

Đổi `API_PORT` cần đổi cùng `API_BASE` và `VITE_API_URL`. `JWT_SECRET` và `ALLOWED_ORIGINS` còn trong file mẫu nhưng hiện chưa được áp dụng cho xác thực nội bộ hay giới hạn CORS; cấu hình thực tế ở `API/config/index.js`.

Ứng dụng hiện dùng **một hồ sơ cấu hình**, chưa có đăng nhập/phân quyền nhiều tài khoản hay đồng bộ liên thiết bị. EDUX có lưu email/mật khẩu trong JSON cục bộ để khôi phục kết nối. `.env`, database, dữ liệu người dùng, cookie và artifact sinh tự động được Git bỏ qua. Chỉ đưa cấu hình mẫu vào repository.

Khi sao lưu, dừng ứng dụng rồi sao chép database cùng thư mục tài liệu cần giữ. Vở canvas lưu trên trình duyệt cần xuất JSON riêng; các bản PDF/ảnh không thay cho dữ liệu chỉnh sửa. Xem [vị trí lưu trữ](docs/ARCHITECTURE.md#nơi-lưu-dữ-liệu-và-sao-lưu).

## Kiểm tra bản cập nhật

```powershell
npm run test:api
npm run test:ai
npm run test:electron
npm run test:frontend-api
npm --prefix Frontend test -- --maxWorkers=2
npm --prefix Frontend run build
```

Chạy build riêng sau bộ test frontend. Các test tự động chủ yếu dùng database tạm và provider giả lập; chúng không xác nhận kết nối IU/EDUX/Outlook hoặc Gemini thật tại thời điểm hiện tại. Kết quả của bản bàn giao và các ca chưa chạy được ghi trong [TESTING.md](docs/TESTING.md).

## Bốn sprint và tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [Sprint 1](docs/SPRINT_1.md) | Nền tảng, thời khóa biểu, tự học, deadline/checklist, nhắc nhở, lịch thi và hồ sơ. |
| [Sprint 2](docs/SPRINT_2.md) | Học liệu, tìm kiếm/tag, Pomodoro, Time Map, tiến độ, sổ tay và email. |
| [Sprint 3](docs/SPRINT_3.md) | Gia sư, quiz, điểm yếu, kế hoạch ôn AI và đơn nghỉ. |
| [Sprint 4](docs/SPRINT_4.md) | Bản cập nhật toàn diện, thay đổi kiến trúc, tính năng mới, phân công GitHub và nghiệm thu. |
| [Kiến trúc](docs/ARCHITECTURE.md) / [API](docs/API.md) | Luồng hệ thống, lưu trữ, migration, hợp đồng HTTP và đồng bộ. |
| [Tính năng](docs/FEATURES.md) / [Backlog](docs/product_backlog.md) / [Kiểm thử](docs/TESTING.md) | Hướng dẫn sử dụng, PB-01…PB-51, tiêu chí và bằng chứng. |

Sprint 1–3 là tổng hợp lịch sử, có dẫn mốc nguồn; Sprint 4 ghi nhận bản mã hiện tại. Trạng thái báo cáo, trạng thái issue và kết quả test được ghi riêng để theo dõi đúng phần còn cần nghiệm thu.

## Thành viên và công việc Sprint 4

| Thành viên | GitHub | Trách nhiệm chính | Issue |
| --- | --- | --- | --- |
| Văn Tuấn | [vtishan](https://github.com/vtishan) | Nhóm trưởng, kiến trúc, Electron, AI và tích hợp. | [#24](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/24) |
| Anh Tuấn | [AnhTuancode-25](https://github.com/AnhTuancode-25) | Thu thập, chuẩn hóa và đối soát IU/EDUX/Outlook, học liệu. | [#25](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/25) |
| Long Nhật | [longnhatdinhviet8-byte](https://github.com/longnhatdinhviet8-byte) | API, validation, nghiệp vụ và kiểm thử tích hợp. | [#26](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/26) |
| Hồng Thắm | [Tham2007](https://github.com/Tham2007) | Database, migration, transaction và lưu bền. | [#27](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/27) |
| Huyền Trang | [kieudu-dlst](https://github.com/kieudu-dlst) | React/Vite, UI/UX, học liệu, sổ tay và kiểm tra giao diện. | [#28](https://github.com/hotrohoctapcmcu/smart_study_hub_cmc_uni/issues/28) |

Một số báo cáo/issue cũ dùng tên **Kiều Trang** cho vai trò frontend; bảng này thống nhất theo tên **Huyền Trang** trong phân công gần nhất, cùng tài khoản `kieudu-dlst`. Phân công Sprint 4 kế thừa vai trò cũ và giao trách nhiệm rà soát, hoàn thiện, bàn giao; lịch sử Git giữ nguyên tác giả thực tế.

Thành viên tạo nhánh `feature/<github-login>/<noi-dung>` từ `main`, mở PR về `main` và dẫn issue tương ứng. Mỗi PR cần nêu thay đổi, cách kiểm tra, kết quả và giới hạn còn lại. Nhánh `before` lưu phiên bản trước bản cập nhật.
