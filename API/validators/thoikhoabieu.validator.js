const { loi } = require('../utils/error');
const { planningDate, futureStart } = require('../utils/planning-time');
const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function date(value) {
    if (!value) throw loi('ngay là bắt buộc (YYYY-MM-DD).');
}

function week(from, to) {
    if (!from || !to) throw loi('tuNgay và denNgay là bắt buộc.');
}

function create(data) {
    if (!data?.subjectId || !data?.className || !data?.room) throw loi('subjectId, className và room là bắt buộc.');
    futureStart(data.startDate, data.startTime);
}

function conflicts(studyDate, startTime, endTime) {
    if (!studyDate || !startTime || !endTime) throw loi('studyDate, startTime và endTime là bắt buộc.');
}

function study(data) {
    if (!data?.title || !data?.studyDate || !data?.startTime || !data?.endTime) {
        throw loi('title, studyDate, startTime và endTime là bắt buộc.');
    }
    futureStart(data.studyDate, data.startTime);
}

function studyStatus(body) {
    const { status } = body;
    if (!status || !validStatuses.includes(status)) throw loi(`status phải là một trong: ${validStatuses.join(', ')}`);
    return status;
}

function freeSlots(date, duration) {
    if (!date) throw loi('date là bắt buộc.');
    planningDate(date, 'Ngày tìm giờ trống');
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes <= 0) throw loi('duration phải là số nguyên dương.');
    return minutes;
}

function id(value) {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        throw loi('timetableId phải là số nguyên dương.');
    }
}

module.exports = { date, week, create, conflicts, study, studyStatus, freeSlots, id };
