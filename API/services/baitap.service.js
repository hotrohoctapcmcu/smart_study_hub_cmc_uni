const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { getCurrentCourseScope, matchCourse } = require('../utils/current-courses');
const { loi } = require('../utils/error');
const validate = require('../validators/baitap.validator');
const { createEduxService } = require('./baitap.edux.service');
let db;
const edux = createEduxService(() => db);

async function getAll(status) {
    const rows = await db.layDanhSachDeadline(NGUOI_DUNG_ID, status);
    const scope = await getCurrentCourseScope(db, NGUOI_DUNG_ID);
    return scope.resolved ? rows.filter(row => !row.subject_id || matchCourse(scope, row)) : rows;
}

async function updateEduxStatus(id, body) {
    validate.eduxStatus(body);
    const row = await db.capNhatTrangThaiBaiTapEDUX(NGUOI_DUNG_ID, id, body.status);
    if (!row) throw loi(`Không tìm thấy bài tập EDUX: ${id}`, 404);
    return row;
}

function create(body) {
    validate.create(body);
    return db.themBaiTap(NGUOI_DUNG_ID, body);
}

async function update(id, body) {
    validate.id(id);
    const row = await db.capNhatBaiTap(id, body, NGUOI_DUNG_ID);
    if (!row) throw loi('Không tìm thấy bài tập.', 404);
    return row;
}

async function updateStatus(id, body) {
    validate.id(id);
    validate.status(body);
    const row = await db.capNhatTrangThaiBaiTap(id, body.status, NGUOI_DUNG_ID);
    if (!row) throw loi('Không tìm thấy bài tập.', 404);
    return row;
}

async function remove(value) {
    const id = String(value || '').trim();
    if (/^edux-/i.test(id)) {
        const hidden = await db.anBaiTapEDUX(NGUOI_DUNG_ID, id);
        if (!hidden) throw loi(`Không tìm thấy bài tập EDUX: ${id}`, 404);
        return { id, hidden: true };
    }
    validate.positiveId(id, 'ID bài tập phải là số nguyên dương hoặc có tiền tố edux-.');
    await db.xoaBaiTap(Number(id), NGUOI_DUNG_ID);
    return { id: Number(id) };
}

async function getTaskChecklist(taskId) {
    const items = await db.layChecklist(NGUOI_DUNG_ID);
    return items.filter(item => item.assignment_id === taskId);
}

function createChecklist(body) {
    validate.checklist(body);
    return db.themChecklist(NGUOI_DUNG_ID, body);
}

function createTaskChecklist(taskId, body) {
    validate.checklist(body);
    return db.themChecklist(NGUOI_DUNG_ID, { ...body, assignmentId: taskId });
}

async function updateChecklist(id, body) {
    validate.positiveId(id, 'checklistId phải là số nguyên dương.');
    const row = await db.capNhatChecklist(id, body, NGUOI_DUNG_ID);
    if (!row) throw loi('Không tìm thấy checklist thuộc người dùng hiện tại.', 404);
    return row;
}

async function completeChecklist(id, completed) {
    validate.positiveId(id, 'checklistId phải là số nguyên dương.');
    const row = await db.hoanThanhChecklist(id, completed, NGUOI_DUNG_ID);
    if (!row) throw loi('Không tìm thấy checklist thuộc người dùng hiện tại.', 404);
    return row;
}

async function removeChecklist(value) {
    const id = String(value || '').trim();
    validate.positiveId(id, 'checklistId phải là số nguyên dương.');
    const deleted = await db.xoaChecklist(Number(id), NGUOI_DUNG_ID);
    if (!deleted) throw loi('Không tìm thấy checklist thuộc người dùng hiện tại.', 404);
    return { checklistId: Number(id) };
}

module.exports = {
    setDb: instance => { db = instance; },
    getAll,
    getUpcoming: days => db.layDeadlineSapToi(NGUOI_DUNG_ID, days),
    getEdux: edux.getAll,
    getEduxById: edux.getById,
    updateEduxStatus,
    create,
    update,
    updateStatus,
    remove,
    getChecklist: () => db.layChecklist(NGUOI_DUNG_ID),
    getTaskChecklist,
    createChecklist,
    createTaskChecklist,
    updateChecklist,
    completeChecklist,
    removeChecklist
};
