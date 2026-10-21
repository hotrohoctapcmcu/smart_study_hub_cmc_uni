/**
 * API/shared/nguoiDung.js
 * ===================================================================================
 * NGƯỜI DÙNG MẶC ĐỊNH
 * ===================================================================================
 * Dự án không có đăng nhập / tạo tài khoản. Toàn bộ API làm việc trên một hồ sơ
 * sinh viên duy nhất, được tạo sẵn bởi database/functions/sync.js khi đồng bộ IU.
 *
 * Các module dùng NGUOI_DUNG_ID thay cho userId lấy từ token trước đây.
 * ===================================================================================
 */

const NGUOI_DUNG_ID = Number(process.env.APP_USER_ID) > 0
    ? Number(process.env.APP_USER_ID)
    : 1;

module.exports = { NGUOI_DUNG_ID };
