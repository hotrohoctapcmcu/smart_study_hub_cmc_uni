const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { loi } = require('../utils/error');
const validate = require('../validators/thoikhoabieu.validator');
const { futureStart } = require('../utils/planning-time');
const { normalizeDate, normalizeTime } = require('../utils/study-context');
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
    if (['studyDate', 'startTime', 'endTime'].some(field => Object.prototype.hasOwnProperty.call(body, field))) {
        const current = (await db.layLichTuHoc(NGUOI_DUNG_ID)).find(row => String(row.schedule_id) === String(id));
        if (!current) throw loi('Không tìm thấy lịch tự học.', 404);
        const date = body.studyDate === undefined ? current.study_date : body.studyDate;
        const start = body.startTime === undefined ? normalizeTime(current.start_time) : body.startTime;
        const end = body.endTime === undefined ? normalizeTime(current.end_time) : body.endTime;
        if (date !== current.study_date || start !== normalizeTime(current.start_time) || end !== normalizeTime(current.end_time)) {
            futureStart(date, start);
        }
    }
    const data = await db.capNhatLichTuHoc(NGUOI_DUNG_ID, id, body);
    if (!data) throw loi('Không tìm thấy lịch tự học.', 404);
    return data;
}

async function removeStudy(id) {
    const deleted = await db.xoaLichTuHoc(id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy lịch tự học.', 404);
}

async function getFreeSlots(date, duration) {
    const requiredMinutes = validate.freeSlots(date, duration);
    const slots = await db.timKhoangTrongTuHoc(NGUOI_DUNG_ID, date, requiredMinutes);
    const now = new Date();
    if (date < normalizeDate(now)) return [];
    if (date > normalizeDate(now)) return slots;
    const nextMinute = new Date(now.getTime() + 60000);
    if (normalizeDate(nextMinute) !== date) return [];
    const cutoff = normalizeTime(nextMinute);
    const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    return slots.map(slot => {
        const start = slot.start_time < cutoff ? cutoff : slot.start_time;
        return { ...slot, start_time: start, duration_minutes: minutes(slot.end_time) - minutes(start) };
    }).filter(slot => slot.duration_minutes >= requiredMinutes);
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
