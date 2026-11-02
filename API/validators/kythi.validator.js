const { loi } = require('../utils/error');
const trangThaiHopLe = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function create(body) {
    const { subjectId, examDate, examTime, room } = body;
    if (!subjectId || !examDate || !examTime || !room) {
        throw loi('subjectId, examDate, examTime và room là bắt buộc.');
    }
}

function studyPlan(body) {
    const { examId, phaseTitle, startDate, endDate } = body;
    if (!examId || !phaseTitle || !startDate || !endDate) {
        throw loi('examId, phaseTitle, startDate và endDate là bắt buộc.');
    }
}

function planStatus(body) {
    const { status } = body;
    if (!trangThaiHopLe.includes(status)) throw loi(`status phải là: ${trangThaiHopLe.join(', ')}`);
    return status;
}

function id(value) {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        throw loi('ID kỳ thi/kế hoạch ôn thi phải là số nguyên dương.');
    }
}

module.exports = { create, studyPlan, planStatus, id };
