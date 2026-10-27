================================================================================
PRODUCT BACKLOG — UNISTUDY CMC
Ngày lập: 18/10/2026
Nguồn: 6 báo cáo phân tích + Sprint1-4
================================================================================

BƯỚC 1. MỤC TIÊU DỰ ÁN
--------------------------------------------------------------------------------
UniStudy CMC là hệ thống trợ lý học tập thông minh dành cho sinh viên Trường
Đại học CMC. Hệ thống tự động lấy dữ liệu học tập từ cổng IU, tổ chức lại
thành thời khóa biểu, lịch thi, deadline và kế hoạch ôn thi, đồng thời hỗ trợ
sinh viên lập kế hoạch tự học và theo dõi tiến độ.

Đối tượng phục vụ: sinh viên CMC; phụ huynh/giảng viên không thuộc phạm vi.

BƯỚC 2. DANH SÁCH 18 CHỨC NĂNG
--------------------------------------------------------------------------------
1. Thời khóa biểu thông minh
2. AI xếp lịch tự học và cảnh báo trùng
3. Quản lý Deadline và Checklist
4. Nhắc nhở thông minh đa tầng
5. Kho tài liệu môn học tập trung
6. Tìm kiếm nhanh và gắn thẻ Tag
7. Trợ lý gia sư AI
8. Đồng hồ Pomodoro chống xao lãng
9. Quản lý lịch thi và kế hoạch ôn thi
10. Bản đồ thời gian học tập
11. Phân tích tiến độ học tập
12. Textbook và sổ tay học tập
13. Kiểm tra kiến thức bằng AI
14. Phân tích điểm yếu và đề xuất nội dung học
15. AI tạo kế hoạch ôn thi
16. Hỗ trợ viết đơn xin phép nghỉ học
17. Đồng bộ và phân tích Email trường
18. Hồ sơ học tập cá nhân

BƯỚC 3-4. USER STORY VÀ THÔNG TIN TỪNG CÔNG VIỆC
--------------------------------------------------------------------------------
Quy ước:
- ID: PB-xx
- Priority theo MoSCoW: Must / Should / Could / Won't (Won't = chưa làm trong
  phiên bản này)
- Story Point: 1, 2, 3, 5, 8 (ước lượng tương đối, không phải thời gian)
- Status: Done / In Progress / Backlog
- Sprint: 1, 2, 3, 4

================================================================================
EPIC A. HẠ TẦNG VÀ ĐỒNG BỘ DỮ LIỆU
================================================================================

PB-01 | Epic: Hạ tầng | Sprint 1 | Must | 5 | Done
User Story: Là thành viên phát triển, tôi muốn có khung ứng dụng Electron +
API + SQLite chạy được để các chức năng có nơi hoạt động.
Hiện trạng: electron-main.js, index.js, API Express, SQLite sql.js đã có.
Acceptance Criteria:
  - `npm start` mở được cửa sổ app và nạp Frontend từ cổng 8080.
  - `npm run start:headless` chạy API cổng 3001.
  - data/unistudy.db được tạo và có 12 bảng.
Phụ thuộc: không.

PB-02 | Epic: Hạ tầng | Sprint 1 | Must | 8 | Done
User Story: Là thành viên phát triển, tôi muốn có tầng mã hoá/giải mã cổng IU
để gọi được API của trường.
Hiện trạng: crypto/encode.js, decode.js, endpoint_map.txt 109 endpoint.
Acceptance Criteria:
  - Giải mã được response mẫu của IU.
  - Chọn đúng cụm API theo tiền tố module.
Phụ thuộc: PB-01.

PB-03 | Epic: Đồng bộ | Sprint 1 | Must | 8 | Done
User Story: Là sinh viên, tôi muốn đăng nhập cổng IU bằng tài khoản Microsoft
của trường để hệ thống tự lấy dữ liệu mà tôi không phải nhập tay.
Hiện trạng: loginIU() hoàn chỉnh, đã có dữ liệu thật trong DB (87 tiết TKB,
2 kỳ thi, 10 đầu điểm).
Acceptance Criteria:
  - Đăng nhập xong đọc được cookie và phiên từ portal.
  - Cookie không đi qua renderer.
  - Phiên còn hạn thì lần sau không phải đăng nhập lại.
Phụ thuộc: PB-02.

PB-04 | Epic: Đồng bộ | Sprint 1 | Must | 5 | Done
User Story: Là sinh viên, tôi muốn dữ liệu IU được lưu vào máy để mở app
không cần mạng vẫn xem được.
Hiện trạng: saveIUData ghi vào SQLite, có persist ra file.
Acceptance Criteria:
  - Tắt app, mở lại vẫn còn TKB, lịch thi, bảng điểm.
Phụ thuộc: PB-03.

PB-05 | Epic: Đồng bộ | Sprint 2 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn dữ liệu đồng bộ không bị mất khi có lỗi
giữa chừng để tôi không phải đồng bộ lại từ đầu.
Hiện trạng: saveIUData chạy nhiều lệnh rời rạc, không transaction; có nhiều
giá trị fallback cứng.
Acceptance Criteria:
  - Lỗi giữa chừng -> DB giữ nguyên trạng thái trước.
  - Không sinh kỳ thi/tiết học giả khi thiếu field.
Phụ thuộc: PB-16, PB-17.

PB-06 | Epic: Đồng bộ | Sprint 3 | Should | 8 | Backlog
User Story: Là sinh viên, tôi muốn lấy tài liệu môn học từ EDUX để có slide
và chương bài giảng ngay trong app.
Hiện trạng: KHÔNG CÓ CODE. Chỉ có metadata nguồn EDUX trong dongBo.js.
Acceptance Criteria:
  - Đăng nhập EDUX, lấy được danh sách môn và chương.
Phụ thuộc: PB-09, PB-20.

PB-07 | Epic: Đồng bộ | Sprint 3 | Should | 5 | Backlog
User Story: Là sinh viên, tôi muốn bài tập và deadline từ LMS được tự động
đưa vào danh sách công việc.
Hiện trạng: KHÔNG CÓ CODE. báo_báo.txt có liệt kê dữ liệu cần nhưng chưa làm.
Acceptance Criteria:
  - Đồng bộ LMS tạo Assignments với deadline thật.
Phụ thuộc: PB-23.

PB-08 | Epic: Đồng bộ | Sprint 3 | Could | 5 | Backlog
User Story: Là sinh viên, tôi muốn xem tiến độ bài học theo tuần từ eLearning.
Hiện trạng: KHÔNG CÓ CODE.
Acceptance Criteria:
  - Hiển thị bài đã học / chưa học theo tuần.
Phụ thuộc: PB-09.

================================================================================
EPIC B. TÀI KHOẢN VÀ PHIÊN NGƯỜI DÙNG
================================================================================

PB-09 | Epic: Tài khoản | Sprint 2 | Must | 8 | Backlog
User Story: Là sinh viên, tôi muốn đăng nhập vào ứng dụng bằng tài khoản của
mình để dữ liệu của tôi không lẫn với người khác.
Hiện trạng: không có màn hình đăng nhập; API mặc định req.user.id = 1 khi
thiếu token (auth.js:21-24); tài khoản trong DB có password_hash rỗng.
Acceptance Criteria:
  - Đăng nhập sai -> 401 có message.
  - Không token -> 401, không tự dùng user id 1.
  - Hai tài khoản thấy dữ liệu khác nhau.
  - Đăng xuất xoá token và quay về màn hình đăng nhập.
Phụ thuộc: không. Chặn PB-10, PB-23, PB-24, PB-25, PB-26, PB-27.

PB-10 | Epic: Tài khoản | Sprint 2 | Must | 3 | Backlog
User Story: Là sinh viên, tôi muốn chỉ sửa/xoá được dữ liệu của chính mình
để an toàn khi dùng chung máy.
Hiện trạng: các hàm xoá/sửa chỉ nhận id, không nhận userId.
Acceptance Criteria:
  - Dùng token sinh viên A xoá bản ghi của B -> 403/404.
Phụ thuộc: PB-09.

================================================================================
EPIC C. THỜI KHÓA BIỂU (CHỨC NĂNG 1)
================================================================================

PB-11 | Epic: TKB | Sprint 1 | Must | 5 | Done
User Story: Là sinh viên, tôi muốn xem thời khóa biểu theo ngày và theo tuần
để chủ động sắp xếp thời gian.
Hiện trạng: schedule.view.js có 3 chế độ; dữ liệu 87 tiết từ IU.
Acceptance Criteria:
  - Chuyển Ngày/Tuần đúng; điều hướng trước/sau đúng.
  - Hiển thị môn, giờ, phòng, giảng viên.
Phụ thuộc: PB-03.

PB-12 | Epic: TKB | Sprint 1 | Should | 3 | Done
User Story: Là sinh viên, tôi muốn thấy lịch trường và lịch tự học trên cùng
một màn hình để không bỏ sót buổi nào.
Hiện trạng: state.schoolEvents + state.studyEvents gộp khi render.
Acceptance Criteria:
  - Hai loại lịch phân biệt bằng nhãn và màu.
Phụ thuộc: PB-11.

PB-13 | Epic: TKB | Sprint 2 | Must | 3 | Backlog
User Story: Là sinh viên, tôi muốn lịch tự học được lưu lại để mở app lần sau
vẫn còn.
Hiện trạng: createSelfStudy/updateSelfStudy/deleteSelfStudy chỉ ghi state.
Acceptance Criteria:
  - Thêm/sửa/xoá buổi tự học -> tải lại trang vẫn còn.
Phụ thuộc: PB-09, PB-10.

PB-14 | Epic: TKB | Sprint 2 | Should | 2 | Backlog
User Story: Là sinh viên, tôi muốn thời khóa biểu tự cập nhật ngay sau khi
đồng bộ để không phải khởi động lại app.
Hiện trạng: schedule.js:10 giữ promise ở phạm vi module; lần đầu lỗi thì không
thử lại.
Acceptance Criteria:
  - Đồng bộ xong mở Lịch thấy dữ liệu mới.
Phụ thuộc: PB-04.

PB-15 | Epic: TKB | Sprint 2 | Could | 2 | Backlog
User Story: Là sinh viên, tôi muốn xem lịch theo tháng dạng lưới để nhìn tổng
quan.
Hiện trạng: renderMonthView chỉ in câu mô tả, không có lưới.
Acceptance Criteria:
  - Có lưới tháng hiển thị sự kiện.
Phụ thuộc: PB-11.

================================================================================
EPIC D. LỊCH THI VÀ KẾ HOẠCH ÔN THI (CHỨC NĂNG 9, 15)
================================================================================

PB-16 | Epic: Lịch thi | Sprint 2 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn chỉ thấy lịch thi của học kỳ đang học để
không bị nhầm với kỳ cũ.
Hiện trạng: CRWEB luôn lấy hkThi[0]; DB không có cột semester; DB còn 2 kỳ thi
tháng 9/2026.
Acceptance Criteria:
  - App chọn đúng học kỳ đang diễn ra.
  - Màn hình mặc định không có kỳ thi đã qua.
  - Đồng bộ lỗi không xoá dữ liệu cũ.
Phụ thuộc: PB-17.

PB-17 | Epic: Lịch thi | Sprint 2 | Must | 3 | Backlog
User Story: Là sinh viên, tôi muốn mỗi kỳ thi biết nó thuộc học kỳ nào để lọc
và đối chiếu.
Hiện trạng: bảng Exams không có semester / academic_year.
Acceptance Criteria:
  - DB cũ mở được sau khi thêm cột, không mất dữ liệu.
  - Mọi dòng source='IU' có semester khác rỗng.
Phụ thuộc: không.

PB-18 | Epic: Lịch thi | Sprint 2 | Should | 3 | Backlog
User Story: Là sinh viên, tôi muốn sửa thông tin kỳ thi khi trường thay đổi
phòng hoặc giờ.
Hiện trạng: không có PUT /exams/:id; FE chỉ sửa trong state.
Acceptance Criteria:
  - Sửa ngày/giờ/phòng/hình thức lưu bền.
Phụ thuộc: PB-09, PB-17.

PB-19 | Epic: Ôn thi | Sprint 2 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn lập kế hoạch ôn thi theo từng giai đoạn và
lưu lại để theo dõi tiến độ.
Hiện trạng: backend có ExamStudyPlans và 5 endpoint nhưng FE chỉ sinh 2 mốc
cứng cùng ngày thi; bảng 0 dòng.
Acceptance Criteria:
  - Tạo/sửa/xoá giai đoạn, đổi trạng thái; dữ liệu còn sau khi tải lại.
Phụ thuộc: PB-16, PB-18.

PB-20 | Epic: Ôn thi | Sprint 3 | Should | 8 | Backlog
User Story: Là sinh viên, tôi muốn hệ thống tự đề xuất lịch ôn thi từ ngày thi
và phạm vi kiến thức để không phải tự chia.
Hiện trạng: chưa có.
Acceptance Criteria:
  - Sinh giai đoạn ôn có ngày bắt đầu/kết thúc hợp lý, không trùng lịch học.
Phụ thuộc: PB-19, PB-21.

================================================================================
EPIC E. LỊCH TỰ HỌC VÀ CẢNH BÁO TRÙNG (CHỨC NĂNG 2)
================================================================================

PB-21 | Epic: Tự học | Sprint 1 | Must | 5 | Done
User Story: Là sinh viên, tôi muốn được cảnh báo khi lịch tự học trùng với
lịch học chính khóa để không bị bỏ buổi.
Hiện trạng: findScheduleConflicts chạy phía client; banner đỏ + modal giải
quyết 3 lựa chọn.
Acceptance Criteria:
  - Phát hiện đúng cặp trùng; A.end == B.start không tính là trùng.
Phụ thuộc: PB-12.

PB-22 | Epic: Tự học | Sprint 2 | Should | 3 | Backlog
User Story: Là sinh viên, tôi muốn server xác nhận trùng lịch thay vì chỉ tin
vào trình duyệt.
Hiện trạng: FE không gọi POST /schedules/conflicts/check dù API đã có.
Acceptance Criteria:
  - Lưu buổi tự học trùng -> server báo trùng, UI hiện modal.
Phụ thuộc: PB-13.

PB-23 | Epic: Tự học | Sprint 3 | Should | 5 | Backlog
User Story: Là sinh viên, tôi muốn hệ thống gợi ý lịch tự học dựa trên khoảng
trống thật của tôi.
Hiện trạng: generateMockSessions chia theo khung giờ cố định, không dùng dữ
liệu thật; backend đã có free-slots.
Acceptance Criteria:
  - Kế hoạch sinh ra không trùng lịch chính khóa.
  - Bấm 'Áp dụng' tạo được buổi học thật.
Phụ thuộc: PB-13, PB-22.

================================================================================
EPIC F. DEADLINE, CHECKLIST VÀ NHẮC NHỞ (CHỨC NĂNG 3, 4)
================================================================================

PB-24 | Epic: Deadline | Sprint 2 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn công việc và checklist được lưu lại để
không mất khi đóng app.
Hiện trạng: tasks.events.js dùng state; tasks.service.js có 10 hàm nhưng
không được import; bảng Assignments/Checklists 0 dòng.
Acceptance Criteria:
  - Thêm/sửa/xoá công việc lưu bền.
  - Checklist con có id và lưu bền.
  - Tab 'Sắp đến hạn' có dữ liệu.
Phụ thuộc: PB-09, PB-10, PB-25.

PB-25 | Epic: Deadline | Sprint 2 | Must | 2 | Backlog
User Story: Là sinh viên, tôi muốn danh sách deadline sắp tới hiển thị đúng
để không bỏ lỡ việc gần hạn.
Hiện trạng: layDeadlineSapToi dùng date('now', '+ 3 days') trả NULL nên luôn
rỗng (sprint1Service.js:705).
Acceptance Criteria:
  - Với deadline cách 1/3/7 ngày, gọi n=3 trả đúng bản ghi trong 3 ngày.
Phụ thuộc: không.

PB-26 | Epic: Nhắc nhở | Sprint 2 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn nhận nhắc nhở theo nhiều mốc (7 ngày,
3 ngày, 24 giờ, 1 giờ) để không bị động.
Hiện trạng: backend sinh được nhắc nhở nhưng FE không đọc bảng Reminders;
notifications.service.js không được import.
Acceptance Criteria:
  - Tạo deadline 3 ngày -> thấy nhắc nhở tương ứng.
  - Đánh dấu tất cả đã đọc không còn 404.
  - Badge cập nhật đúng.
Phụ thuộc: PB-09, PB-10, PB-27.

PB-27 | Epic: Nhắc nhở | Sprint 2 | Must | 3 | Backlog
User Story: Là sinh viên, tôi muốn có nút đánh dấu tất cả thông báo đã đọc
để dọn danh sách nhanh.
Hiện trạng: FE khai báo PATCH /notifications/read-all nhưng API không có.
Acceptance Criteria:
  - Gọi endpoint -> tất cả is_sent = 1 của đúng sinh viên.
Phụ thuộc: PB-09.

PB-28 | Epic: Nhắc nhở | Sprint 2 | Should | 2 | Backlog
User Story: Là sinh viên, tôi muốn không nhận trùng một nhắc nhở hai lần.
Hiện trạng: themBaiTap sinh 3 mốc, taoNhacNhoDaTang sinh 4 mốc; không UNIQUE.
Acceptance Criteria:
  - Gọi cả hai hàm cho cùng deadline -> số nhắc nhở không nhân đôi.
Phụ thuộc: PB-17.

================================================================================
EPIC G. HỒ SƠ VÀ KẾT QUẢ HỌC TẬP (CHỨC NĂNG 18, 11, 14)
================================================================================

PB-29 | Epic: Hồ sơ | Sprint 1 | Must | 5 | Done
User Story: Là sinh viên, tôi muốn hồ sơ và bảng điểm được lấy tự động từ
cổng trường.
Hiện trạng: DB có student_code='BSE250047', 14 môn, 10 đầu điểm.
Acceptance Criteria:
  - Hồ sơ và bảng điểm xuất hiện sau khi đồng bộ.
Phụ thuộc: PB-03.

PB-30 | Epic: Hồ sơ | Sprint 2 | Must | 3 | Backlog
User Story: Là sinh viên, tôi muốn bảng điểm lưu đúng năm học và điểm thành
phần để tính GPA chính xác.
Hiện trạng: academic_year rỗng cho cả 10 dòng; component_score/exam_score
không bao giờ được ghi; semester dạng '3_2025_2026'.
Acceptance Criteria:
  - academic_year khác rỗng.
  - Một môn học 2 lần có 2 dòng.
Phụ thuộc: không.

PB-31 | Epic: Hồ sơ | Sprint 2 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn xem hồ sơ đầy đủ và bảng điểm trên giao
diện thay vì chỉ 3 trường.
Hiện trạng: profile.view.js chỉ có name / studentId / email;
profile.service.js không được import.
Acceptance Criteria:
  - Hiển thị ngành, lớp, khoá, GPA hệ 10 và hệ 4, tín chỉ, môn đạt/chưa đạt.
  - Bảng điểm lọc theo học kỳ.
Phụ thuộc: PB-09, PB-30.

PB-32 | Epic: Hồ sơ | Sprint 2 | Should | 2 | Backlog
User Story: Là sinh viên, tôi muốn xem danh sách môn nợ để biết môn cần học
lại.
Hiện trạng: service có layMonHocChuaDat/layMonHocDaDat nhưng không có endpoint.
Acceptance Criteria:
  - GET /student/grades/failed trả đúng danh sách.
Phụ thuộc: PB-31.

PB-33 | Epic: Tiến độ | Sprint 3 | Should | 5 | Backlog
User Story: Là sinh viên, tôi muốn xem tiến độ học tập tổng hợp để biết mình
đang ở đâu.
Hiện trạng: API backend `GET /api/v1/progress` đã có; route giao diện `progress` vẫn chưa được đánh dấu triển khai. Lịch sử Pomodoro hiện lưu cục bộ nên chưa được tính vào số giờ từ API.
Acceptance Criteria:
  - Hiển thị tiến độ công việc, điểm số, thời gian học từ dữ liệu thật.
Phụ thuộc: PB-24, PB-31.

PB-34 | Epic: Tiến độ | Sprint 3 | Could | 5 | Backlog
User Story: Là sinh viên, tôi muốn được chỉ ra môn yếu và gợi ý nội dung cần
ôn.
Hiện trạng: chưa có.
Acceptance Criteria:
  - Chỉ ra môn yếu dựa trên điểm thật và đề xuất nội dung ôn.
Phụ thuộc: PB-30, PB-39.

================================================================================
EPIC H. TÀI LIỆU, TÌM KIẾM VÀ SỔ TAY (CHỨC NĂNG 5, 6, 12)
================================================================================

PB-35 | Epic: Tài liệu | Sprint 3 | Should | 8 | Backlog
User Story: Là sinh viên, tôi muốn có một kho tài liệu theo môn để không phải
tìm lại slide rải rác.
Hiện trạng: route 'documents' isImplemented: false; không có view, service,
bảng hay API.
Acceptance Criteria:
  - Xem danh sách tài liệu theo môn; thêm/xoá lưu bền.
Phụ thuộc: PB-09, PB-06.

PB-36 | Epic: Tìm kiếm | Sprint 3 | Should | 5 | Backlog
User Story: Là sinh viên, tôi muốn tìm nhanh công việc, lịch và tài liệu bằng
một ô tìm kiếm.
Hiện trạng: state.searchQuery có nhưng topbar.js không được import ở shell.js.
Acceptance Criteria:
  - Gõ từ khóa tìm được công việc, tài liệu, lịch.
Phụ thuộc: PB-24, PB-35.

PB-37 | Epic: Tìm kiếm | Sprint 3 | Could | 3 | Backlog
User Story: Là sinh viên, tôi muốn gắn thẻ cho công việc và tài liệu để nhóm
chúng theo chủ đề.
Hiện trạng: chưa có mô hình tag.
Acceptance Criteria:
  - Gắn/bỏ tag lưu bền; lọc theo tag.
Phụ thuộc: PB-36.

PB-38 | Epic: Textbook | Sprint 3 | Could | 8 | Backlog
User Story: Là sinh viên, tôi muốn có sổ tay học tập theo môn để ghi chú gắn
với từng chương.
Hiện trạng: chưa có code. nhiệm_vụ.txt có nhắc 'phần Textbook' nhưng không có
mã nguồn.
Acceptance Criteria:
  - Tạo sổ tay theo môn; ghi chú lưu bền.
Phụ thuộc: PB-35.

================================================================================
EPIC I. CÔNG CỤ AI (CHỨC NĂNG 7, 13)
================================================================================

PB-39 | Epic: AI | Sprint 3 | Could | 8 | Backlog
User Story: Là sinh viên, tôi muốn hỏi trợ lý AI về nội dung môn học để được
giải thích ngay.
Hiện trạng: route 'ai-tutor' isImplemented: false; panel chat có khung nhưng
input disabled.
Acceptance Criteria:
  - Gửi câu hỏi nhận trả lời; lịch sử hội thoại còn sau khi tải lại.
Phụ thuộc: PB-09.

PB-40 | Epic: AI | Sprint 3 | Could | 8 | Backlog
User Story: Là sinh viên, tôi muốn tự tạo bài trắc nghiệm từ nội dung môn để
tự kiểm tra.
Hiện trạng: route 'quiz' isImplemented: false; không có code.
Acceptance Criteria:
  - Tạo bộ câu hỏi từ nội dung môn; làm bài và lưu kết quả.
Phụ thuộc: PB-38, PB-39.

================================================================================
EPIC J. CÔNG CỤ HỖ TRỢ KHÁC (CHỨC NĂNG 8, 10, 16, 17)
================================================================================

PB-41 | Epic: Pomodoro | Sprint 1 | Should | 3 | Done
User Story: Là sinh viên, tôi muốn có đồng hồ Pomodoro để tập trung học.
Hiện trạng: pomodoro.service.js dựa trên timestamp, lưu localStorage, có
lịch sử phiên.
Acceptance Criteria:
  - Chạy/tạm dừng/kết thúc đúng; lịch sử ghi nhận.
Phụ thuộc: không.

PB-42 | Epic: Pomodoro | Sprint 3 | Could | 3 | Backlog
User Story: Là sinh viên, tôi muốn lịch sử Pomodoro theo người dùng để xem
trên máy khác.
Hiện trạng: chỉ lưu localStorage trên máy hiện tại.
Acceptance Criteria:
  - Đăng nhập ở máy khác vẫn xem được lịch sử.
Phụ thuộc: PB-09.

PB-43 | Epic: Thời gian | Sprint 3 | Could | 5 | Backlog
User Story: Là sinh viên, tôi muốn thấy bản đồ thời gian học tập để biết mình
phân bổ thời gian thế nào.
Hiện trạng: chưa có.
Acceptance Criteria:
  - Hiển thị mật độ học tập theo thời gian từ dữ liệu thật.
Phụ thuộc: PB-13, PB-42.

PB-44 | Epic: Hành chính | Sprint 4 | Could | 5 | Backlog
User Story: Là sinh viên, tôi muốn tạo đơn xin phép nghỉ học có sẵn thông tin
của mình.
Hiện trạng: chưa có.
Acceptance Criteria:
  - Tạo được đơn có thông tin điền sẵn và xuất được file.
Phụ thuộc: PB-09, PB-31.

PB-45 | Epic: Email | Sprint 4 | Won't | 8 | Backlog
User Story: Là sinh viên, tôi muốn thông báo từ email trường được tổng hợp
vào app.
Hiện trạng: chưa có code, không có module email trong CRWEB.
Ghi chú: chưa nằm trong phạm vi phiên bản hiện tại; cần quyết định của chủ dự
án trước khi đưa vào.
Acceptance Criteria: (chưa xác định vì chưa thuộc phạm vi)
Phụ thuộc: PB-09.

================================================================================
EPIC K. CHẤT LƯỢNG VÀ BÀN GIAO
================================================================================

PB-46 | Epic: Chất lượng | Sprint 2 | Must | 3 | Backlog
User Story: Là người dùng, tôi muốn thấy đúng thông báo lỗi khi thao tác thất
bại để biết cách sửa.
Hiện trạng: api-client.js:64-66 bỏ qua body lỗi của server; timeout bị đảo
điều kiện ở :46-49.
Acceptance Criteria:
  - Lỗi nghiệp vụ hiển thị đúng message; request treo bị huỷ sau khoảng 20s.
Phụ thuộc: không.

PB-47 | Epic: Chất lượng | Sprint 4 | Must | 5 | Backlog
User Story: Là thành viên nhóm, tôi muốn có bộ test tự động chạy một lệnh để
biết hệ thống còn đúng không sau mỗi thay đổi.
Hiện trạng: có 16 bộ test nhưng chưa có test đăng nhập, phân quyền, CRUD qua
HTTP; chưa có lệnh chạy tất cả.
Acceptance Criteria:
  - Một lệnh chạy toàn bộ test; báo cáo pass/fail rõ ràng.
Phụ thuộc: Sprint 2, Sprint 3.

PB-48 | Epic: Chất lượng | Sprint 4 | Must | 3 | Backlog
User Story: Là thành viên nhóm, tôi muốn có kịch bản kiểm thử thủ công để
kiểm tra trước khi bàn giao.
Hiện trạng: KeHoachSprint2.txt có 8 kịch bản; Sprint4.txt mở rộng thành 10.
Acceptance Criteria:
  - 10 kịch bản đạt trên bản đóng gói.
Phụ thuộc: PB-47.

PB-49 | Epic: Đóng gói | Sprint 4 | Must | 8 | Backlog
User Story: Là sinh viên, tôi muốn cài app như một phần mềm bình thường mà
không cần cài Node.js.
Hiện trạng: KHÔNG CÓ cấu hình đóng gói (không electron-builder/forge/packager,
không icon, không script build).
Acceptance Criteria:
  - Lệnh build sinh tệp cài; cài trên máy sạch mở được app.
Phụ thuộc: PB-48.

PB-50 | Epic: Đóng gói | Sprint 4 | Must | 5 | Backlog
User Story: Là sinh viên, tôi muốn app chạy đúng sau khi cài, không lỗi do
thiếu tài nguyên hoặc không ghi được dữ liệu.
Hiện trạng: index.js trỏ tới Frontend/; db.js:49-55 tìm wasm ở đường dẫn sai
('../../../node_modules/...'); DB nằm trong thư mục dự án.
Acceptance Criteria:
  - Bản cài tạo được DB, đọc được endpoint_map.txt, tải được Frontend.
  - Cài vào Program Files vẫn ghi được DB.
Phụ thuộc: PB-49.

PB-51 | Epic: Bàn giao | Sprint 4 | Must | 3 | Backlog
User Story: Là người tiếp nhận, tôi muốn có tài liệu để tự chạy và hiểu dự án.
Hiện trạng: chỉ có README của bản demo UI, không có tài liệu dự án.
Acceptance Criteria:
  - Có hướng dẫn cài đặt, kiến trúc, endpoint, database, đóng gói.
Phụ thuộc: PB-50.

BƯỚC 5. SẮP XẾP THỨ TỰ ƯU TIÊN (MoSCoW)
--------------------------------------------------------------------------------
MUST HAVE (bắt buộc để sản phẩm dùng được)
  PB-01, PB-02, PB-03, PB-04, PB-05, PB-09, PB-10, PB-11, PB-13, PB-16,
  PB-17, PB-19, PB-21, PB-24, PB-25, PB-26, PB-27, PB-29, PB-30, PB-31,
  PB-46, PB-47, PB-48, PB-49, PB-50, PB-51

SHOULD HAVE (nên có)
  PB-06, PB-07, PB-12, PB-14, PB-18, PB-20, PB-22, PB-28, PB-32, PB-33,
  PB-35, PB-36, PB-41

COULD HAVE (có thì tốt)
  PB-08, PB-15, PB-23, PB-34, PB-37, PB-38, PB-39, PB-40, PB-42, PB-43, PB-44

WON'T HAVE (chưa thực hiện trong phiên bản này)
  PB-45

BƯỚC 6. CHIA CÔNG VIỆC VÀO SPRINT
--------------------------------------------------------------------------------
Sprint 1 — Đã hoàn thành (9 việc)
  PB-01, PB-02, PB-03, PB-04, PB-11, PB-12, PB-21, PB-29, PB-41

Sprint 2 — Hoàn thiện (20 việc)
  PB-05, PB-09, PB-10, PB-13, PB-14, PB-15, PB-16, PB-17, PB-18, PB-19,
  PB-22, PB-24, PB-25, PB-26, PB-27, PB-28, PB-30, PB-31, PB-32, PB-46

Sprint 3 — Chức năng mới (15 việc)
  PB-06, PB-07, PB-08, PB-20, PB-23, PB-33, PB-34, PB-35, PB-36, PB-37,
  PB-38, PB-39, PB-40, PB-42, PB-43

Sprint 4 — Tích hợp và bàn giao (7 việc)
  PB-44, PB-45 (Won't), PB-47, PB-48, PB-49, PB-50, PB-51

BẢNG TỔNG HỢP THEO SPRINT
--------------------------------------------------------------------------------
Sprint 1 (Done):   PB-01, 02, 03, 04, 11, 12, 21, 29, 41           9 việc
Sprint 2:          PB-05, 09, 10, 13, 14, 15, 16, 17, 18, 19, 22,
                   24, 25, 26, 27, 28, 30, 31, 32, 46               20 việc
Sprint 3:          PB-06, 07, 08, 20, 23, 33, 34, 35, 36, 37, 38,
                   39, 40, 42, 43                                   15 việc
Sprint 4:          PB-44, 45, 47, 48, 49, 50, 51                    7 việc
Tổng: 51 việc, trong đó 1 việc Won't (PB-45) -> 50 việc trong phạm vi cam kết.

ĐỐI CHIẾU 18 CHỨC NĂNG VỚI PRODUCT BACKLOG
--------------------------------------------------------------------------------
CN  Tên chức năng                          PB liên quan
--  -------------------------------------  --------------------------------
1   Thời khóa biểu thông minh              PB-11, 12, 13, 14, 15
2   AI xếp lịch tự học, cảnh báo trùng     PB-21, 22, 23
3   Quản lý Deadline và Checklist          PB-24, 25, 07
4   Nhắc nhở thông minh đa tầng            PB-26, 27, 28
5   Kho tài liệu môn học                   PB-35, 06
6   Tìm kiếm nhanh và gắn thẻ Tag          PB-36, 37
7   Trợ lý gia sư AI                       PB-39
8   Đồng hồ Pomodoro                       PB-41, 42
9   Lịch thi và kế hoạch ôn thi            PB-16, 17, 18, 19
10  Bản đồ thời gian học tập               PB-43
11  Phân tích tiến độ học tập              PB-33
12  Textbook và sổ tay học tập             PB-38
13  Kiểm tra kiến thức bằng AI             PB-40
14  Phân tích điểm yếu, đề xuất nội dung   PB-34
15  AI tạo kế hoạch ôn thi                 PB-20
16  Hỗ trợ viết đơn xin nghỉ học           PB-44
17  Đồng bộ và phân tích Email trường      PB-45 (Won't)
18  Hồ sơ học tập cá nhân                  PB-29, 30, 31, 32

Mọi chức năng 1-18 đều có ít nhất một PB tương ứng. Không bỏ sót chức năng nào.

BẢNG PHỤ THUỘC
--------------------------------------------------------------------------------
PB-01 -> PB-02 -> PB-03 -> PB-04
PB-04 -> PB-05
PB-09 -> PB-10, PB-13, PB-18, PB-24, PB-26, PB-27, PB-31, PB-35, PB-39,
         PB-42, PB-44
PB-10 -> PB-13, PB-18, PB-24, PB-26
PB-13 -> PB-22 -> PB-23
PB-16 -> PB-19 -> PB-20
PB-17 -> PB-18, PB-28
PB-19 -> PB-20
PB-21 -> PB-22
PB-24 -> PB-36
PB-25 -> PB-24
PB-30 -> PB-31 -> PB-32, PB-34
PB-31 -> PB-33, PB-44
PB-35 -> PB-36, PB-38
PB-36 -> PB-37
PB-38 -> PB-40
PB-39 -> PB-40
PB-41 -> PB-42 -> PB-43
PB-47 -> PB-48
PB-49 -> PB-50 -> PB-51

ĐƯỜNG GĂNG
--------------------------------------------------------------------------------
PB-09 (đăng nhập) -> PB-16/PB-17 (học kỳ lịch thi) -> PB-19 (kế hoạch ôn thi)
-> PB-24 (deadline) -> PB-31 (hồ sơ) -> PB-47 (test) -> PB-49 (đóng gói)
-> PB-50 -> PB-51.

GHI CHÚ VỀ ĐỘ TIN CẬY CỦA TRẠNG THÁI
--------------------------------------------------------------------------------
- 'Done' chỉ dùng cho PB có bằng chứng dữ liệu thật (PB-01, 03, 04, 11, 29)
  hoặc bằng chứng code hoàn chỉnh và đã được đối chiếu nhiều tầng (PB-02,
  PB-12, PB-21, PB-41).
- Các PB 'Done' về code nhưng chưa chạy lại trong lần rà soát này được ghi rõ
  trong Sprint1.txt với nhãn [ĐÃ XONG - CÓ CODE, CHƯA CHẠY LẠI].
- Không có PB nào được đánh 'Done' chỉ vì tồn tại file.
