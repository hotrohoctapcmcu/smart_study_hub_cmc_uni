const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { loi } = require('../utils/error');
const validate = require('../validators/thoikhoabieu.validator');
let db;

function getByDate(date) {
    validate.date(date);
    return db.layThoiKhoaBieuTheoNgay(NGUOI_DUNG_ID, date);
}

function getByWeek(from, to) {
    validate.week(from, to);
    return db.layThoiKhoaBieuTheoTuan(NGUOI_DUNG_ID, from, to);
}

function create(body) {
    validate.create(body);
    return db.themTietHoc(NGUOI_DUNG_ID, body);
}

async function remove(id) {
    validate.id(id);
    const deleted = await db.xoaTietHoc(id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy tiết học.', 404);
}

function checkConflicts(studyDate, startTime, endTime, excludeScheduleId = null) {
    validate.conflicts(studyDate, startTime, endTime);
    return db.kiemTraXungDotLichTuHoc(NGUOI_DUNG_ID, studyDate, startTime, endTime, excludeScheduleId);
}

function createStudy(body) {
    validate.study(body);
    return db.xepLichTuHoc(NGUOI_DUNG_ID, body);
}

async function updateStudyStatus(id, body) {
    const status = validate.studyStatus(body);
    const updated = await db.capNhatTrangThaiLichTuHoc(id, status, NGUOI_DUNG_ID);
    if (!updated) throw loi('Không tìm thấy lịch tự học.', 404);
}

async function updateStudy(id, body) {
    const data = await db.capNhatLichTuHoc(NGUOI_DUNG_ID, id, body);
    if (!data) throw loi('Không tìm thấy lịch tự học.', 404);
    return data;
}

async function removeStudy(id) {
    const deleted = await db.xoaLichTuHoc(id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy lịch tự học.', 404);
}

function getFreeSlots(date, duration) {
    const minutes = validate.freeSlots(date, duration);
    return db.timKhoangTrongTuHoc(NGUOI_DUNG_ID, date, minutes);
}

module.exports = {
    setDb: instance => { db = instance; },
    getAll: () => db.layThoiKhoaBieu(NGUOI_DUNG_ID),
    getByDate,
    getByWeek,
    create,
    remove,
    getConflicts: () => db.kiemTraTrungLich(NGUOI_DUNG_ID),
    checkConflicts,
    getStudy: (from, to) => db.layLichTuHoc(NGUOI_DUNG_ID, from, to),
    createStudy,
    updateStudyStatus,
    updateStudy,
    removeStudy,
    getFreeSlots
};
