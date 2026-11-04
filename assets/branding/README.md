# Logo Smart Study Hub

Biểu tượng cáo kết hợp cuốn sách và ngôi sao, dùng tông tím của giao diện hiện có. Thiết kế không chứa chữ để giữ khả năng nhận diện trên thanh tác vụ và favicon.

## Tệp sử dụng

| Tệp | Mục đích |
| --- | --- |
| [smart-study-hub.png](smart-study-hub.png) | PNG gốc 1254 × 1254, có alpha transparency. |
| [smart-study-hub.ico](smart-study-hub.ico) | Icon Windows chứa các cỡ 16, 20, 24, 32, 40, 48, 64, 128 và 256 px. |
| [app-icon.png](../../Frontend/public/brand/app-icon.png) | PNG 512 px cho sidebar. |
| [favicon-32.png](../../Frontend/public/brand/favicon-32.png) | Favicon 32 px. |
| [apple-touch-icon.png](../../Frontend/public/brand/apple-touch-icon.png) | Biểu tượng 180 px khi lưu trang trên thiết bị hỗ trợ. |

Electron dùng ICO trên Windows và PNG trên các nền tảng khác. AppUserModelID là vn.cmcu.smartstudyhub; cửa sổ Windows khai báo icon và tên relaunch riêng theo [API BrowserWindow của Electron](https://www.electronjs.org/docs/latest/api/browser-window#winsetappdetailsoptions-windows). Việc thêm nhận diện không đổi tên package, thư mục userData, dữ liệu ứng dụng hoặc phiên đăng nhập.

Sau khi cập nhật cần đóng/mở lại ứng dụng để nạp main process mới. Shortcut đã ghim cũ có thể cần bỏ ghim rồi ghim lại từ cửa sổ mới. Icon của chính file electron.exe trong node_modules vẫn thuộc bộ Electron phát triển; bộ cài tương lai cần nhúng ICO này vào executable khi đóng gói.

## Xuất lại các kích thước

Trên Windows sau khi cài dependency ở thư mục gốc, chạy:

~~~powershell
node scripts/build-app-icons.cjs
~~~

Script dùng nativeImage của Electron để đổi kích thước/định dạng từ PNG gốc, giữ alpha và tạo ICO nhiều cỡ; không tạo lại hoặc thay đổi nội dung thiết kế. PNG gốc phải tồn tại trước khi chạy. Các tệp xuất cùng tên được cập nhật từ bản gốc.

## Nguồn và prompt thiết kế

Ngày tạo: 05/11/2026. Công cụ: image_gen tích hợp, thông qua kỹ năng imagegen; không dùng CLI/API fallback. PNG được sao chép vào dự án từ kết quả công cụ, bản sinh gốc được giữ nguyên.

Prompt cuối cùng:

> Use case: logo-brand. Asset type: production desktop app icon for Smart Study Hub, a Vietnamese university study-planning app. Create ONE finished square app icon, not a presentation or mockup. Existing app identity uses vivid violet (#6340DF / #7557FF), off-white surfaces and a friendly fox study mascot. Design a distinctive, highly simplified white fox-face/open-book hybrid mark: two gently pointed fox ears at the top, a clean central book fold, two broad page/cheek shapes, and one small four-point learning spark. The silhouette should read first as a smart study/book symbol and second as a fox. Place this bold white mark centered on one rich violet rounded-square tile, with a very subtle violet-to-indigo gradient and restrained polish. Large simple shapes, generous negative space, exceptionally clean edges and strong legibility at 16, 32 and 48 pixels. Modern, confident, friendly desktop software branding, not a cartoon illustration. The tile should occupy about 90% of the square canvas with equal margins, true transparent exterior corners/background, no exterior drop shadow. No words, letters, initials, numbers, school crest, Electron atom, thin circuit lines, tiny details, additional symbols, border, watermark, surrounding scene or app interface. Keep the complete icon fully visible and centered. Output a high-resolution square PNG with actual alpha transparency.

## Điểm tích hợp

- [Electron main](../../electron/main.js): icon cửa sổ, định danh và thông tin thanh tác vụ Windows.
- [Sidebar](../../Frontend/src/components/layout/Sidebar.jsx): logo ứng dụng.
- [HTML entry](../../Frontend/index.html): favicon và touch icon.
- [Script xuất icon](../../scripts/build-app-icons.cjs): xuất tài nguyên từ PNG gốc.
- [Startup regression](../../tests/electron-startup.cjs): xác nhận icon tồn tại và cấu hình nhận diện đúng.
