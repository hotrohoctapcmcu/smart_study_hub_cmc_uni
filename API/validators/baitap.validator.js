const { kiemTra } = require('../utils/error');
const trangThaiHopLe = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
const trangThaiEDUX = ['Chưa làm', 'Đang làm', 'Hoàn thành'];

function create(body) {
    const { subjectId, title, deadline } = body;
    kiemTra(subjectId && title && deadline, 'subjectId, title và deadline là bắt buộc.');
}

function status(body) {
    kiemTra(trangThaiHopLe.includes(body?.status), `status phải là một trong: ${trangThaiHopLe.join(', ')}`);
}

function eduxStatus(body) {
    kiemTra(trangThaiEDUX.includes(body?.status), `status phải là một trong: ${trangThaiEDUX.join(', ')}`);
}

function id(value) {
    positiveId(value, 'assignmentId phải là số nguyên dương.');
}

function positiveId(id, message) {
    kiemTra(/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0, message);
}

function checklist(body) {
    kiemTra(body?.title, 'title là bắt buộc.');
    if (body.minutes !== undefined) kiemTra(Number.isInteger(body.minutes) && body.minutes >= 1 && body.minutes <= 480, 'Thời lượng bước phải từ 1 đến 480 phút.');
    if (body.doneWhen !== undefined) kiemTra(typeof body.doneWhen === 'string' && body.doneWhen.trim() && body.doneWhen.length <= 250, 'Đầu ra bước tối đa 250 ký tự và không được trống.');
}

module.exports = { create, status, eduxStatus, id, positiveId, checklist };
