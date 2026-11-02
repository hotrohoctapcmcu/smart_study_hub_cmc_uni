const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');

let db;

function isAvailable() {
    return !!db;
}

async function getDashboard() {
    const today = new Date().toISOString().slice(0, 10);
    const [profile, schedules, deadlines, exams, reminders] = await Promise.all([
        db.layHoSo(NGUOI_DUNG_ID),
        db.layThoiKhoaBieuTheoNgay(NGUOI_DUNG_ID, today),
        db.layDeadlineSapToi(NGUOI_DUNG_ID, 3),
        db.layLichThiSapToi(NGUOI_DUNG_ID),
        db.layDanhSachNhacNho(NGUOI_DUNG_ID)
    ]);

    return {
        profile,
        todaySchedules: schedules,
        upcomingDeadlines: deadlines,
        upcomingExams: exams,
        unreadRemindersCount: (reminders || []).filter(item => !item.is_sent).length
    };
}

module.exports = { getDashboard, isAvailable, setDb: instance => { db = instance; } };
