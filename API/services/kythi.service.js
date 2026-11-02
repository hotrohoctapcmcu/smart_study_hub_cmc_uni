const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { loi } = require('../utils/error');
const validate = require('../validators/kythi.validator');
let db;

function create(body) {
    validate.create(body);
    return db.themLichThi(NGUOI_DUNG_ID, body);
}

function createStudyPlan(body) {
    validate.studyPlan(body);
    return db.taoKeHoachOnThi(NGUOI_DUNG_ID, body);
}

async function update(id, body) {
    validate.id(id);
    let data;
    try { data = await db.capNhatLichThi(NGUOI_DUNG_ID, id, body); }
    catch (err) { throw loi(err.message, err.statusCode || 400); }
    if (!data) throw loi('Không tìm thấy kỳ thi.', 404);
    return data;
}

async function updatePlanStatus(id, body) {
    validate.id(id);
    const status = validate.planStatus(body);
    const updated = await db.capNhatTrangThaiKeHoachOnThi(id, status, NGUOI_DUNG_ID);
    if (!updated) throw loi('Không tìm thấy kế hoạch ôn thi.', 404);
}

async function removeStudyPlan(id) {
    validate.id(id);
    const deleted = await db.xoaKeHoachOnThi(id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy kế hoạch ôn thi.', 404);
}

async function remove(id) {
    validate.id(id);
    const deleted = await db.xoaLichThi(id, NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy kỳ thi.', 404);
}

module.exports = {
    setDb: instance => { db = instance; },
    getAll: () => db.layLichThi(NGUOI_DUNG_ID),
    getUpcoming: () => db.layLichThiSapToi(NGUOI_DUNG_ID),
    getStudyPlans: examId => examId === undefined ? db.layKeHoachOnThi(NGUOI_DUNG_ID) : db.layKeHoachOnThi(NGUOI_DUNG_ID, examId),
    create,
    createStudyPlan,
    update,
    updatePlanStatus,
    removeStudyPlan,
    remove
};
