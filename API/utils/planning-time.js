const { loi } = require('./error');
const { normalizeDate } = require('./study-context');

function planningDate(value, label = 'Ngày bắt đầu') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || normalizeDate(value) !== value) {
        throw loi(`${label} không hợp lệ.`);
    }
    if (value < normalizeDate(new Date())) throw loi(`${label} không được là ngày đã qua.`);
}

function futureStart(date, time, label = 'Giờ bắt đầu học') {
    planningDate(date, 'Ngày học');
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw loi(`${label} không hợp lệ.`);
    if (new Date(`${date}T${time}:00+07:00`) <= new Date()) throw loi(`${label} phải sau thời điểm hiện tại.`);
}

module.exports = { planningDate, futureStart };
