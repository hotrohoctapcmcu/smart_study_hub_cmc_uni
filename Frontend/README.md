# UniStudy CMC — Bản demo tải về

Bản xuất từ phiên bản 24 của giao diện demo đang dùng:
https://unistudy-cmc-prototype.kieuhuyentrang2007.chatgpt.site/

## Mở trên máy tính

1. Giải nén toàn bộ ZIP, giữ nguyên thư mục assets cạnh index.html.
2. Mở index.html bằng Chrome hoặc Edge.
3. Bấm Trải nghiệm để vào workspace; chọn Đồng bộ dữ liệu để xem phần dữ liệu minh họa của bản demo.

Nếu trình duyệt hạn chế file cục bộ hoặc localStorage, mở thư mục bằng VS Code và chạy index.html bằng Live Server. Không cần npm install hoặc backend.

## Nội dung

- index.html: trang và các thành phần giao diện.
- styles.css: bố cục, font, responsive và theme.
- app.js: thao tác của bản mô phỏng.
- assets/: toàn bộ ảnh nền, avatar và sticker cáo CMC đi kèm.

## Phạm vi của bản demo

Đây là bản mô phỏng UI hiện có, không phải dự án frontend mới triển khai theo bộ Sprint. Nút đồng bộ và AI chưa gọi backend thật; dữ liệu minh họa trong bản demo không phải dữ liệu sinh viên lấy trực tiếp từ CMC.

Những tùy chọn được lưu trong trình duyệt chỉ áp dụng trên máy và trình duyệt đó. Bản tải về không mang theo dữ liệu cá nhân hoặc trạng thái tab của phiên trên website.

Roboto được tải từ Google Fonts khi có Internet; khi offline trình duyệt dùng font dự phòng. Video giới thiệu cần Internet. Các ảnh nền và sticker trong assets được đóng gói sẵn.

## Kiểm tra bản xuất

Mã ứng dụng giữ nguyên từ bản demo đã lưu. Đã kiểm tra cú pháp JavaScript, các đường dẫn ảnh cục bộ và tính toàn vẹn của ZIP. Không bao gồm thông tin tài khoản, cấu hình triển khai hoặc lịch sử Git.
