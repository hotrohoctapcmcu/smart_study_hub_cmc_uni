const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { loi } = require('../utils/error');
const validate = require('../validators/sinhvien.validator');
let db;

async function getProfile() {
    const data = await db.layHoSo(NGUOI_DUNG_ID);
    if (!data) throw loi('Chưa có hồ sơ. Vui lòng đồng bộ dữ liệu từ cổng trường.', 404);
    return data;
}

function updateProfile(body) {
    validate.profile(body);
    return db.luuHoSo(NGUOI_DUNG_ID, body);
}

module.exports = {
    setDb: instance => { db = instance; },
    getProfile,
    updateProfile,
    getGrades: hocKy => db.layBangDiem(NGUOI_DUNG_ID, hocKy),
    getSubjects: () => db.layDanhSachMonHoc(NGUOI_DUNG_ID)
};
