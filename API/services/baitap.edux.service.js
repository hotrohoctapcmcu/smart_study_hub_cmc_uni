const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const eduxKho = require('../utils/edux-session');
const { keoBaiTapEDUX, laHetPhien } = require('../utils/edux-client');
const { getCurrentCourseScope, matchCourse } = require('../utils/current-courses');
const { loi } = require('../utils/error');

function createEduxService(getDb) {
    function session() {
        const saved = eduxKho.getSession(NGUOI_DUNG_ID);
        if (!saved) throw loi('Chưa có phiên EDUX. Hãy đăng nhập EDUX trước.', 401);
        return saved;
    }

    async function cached(saved, subjectId, options, current) {
        const db = getDb();
        const cachedAssignments = await db.layBaiTapEDUX(NGUOI_DUNG_ID, {
            subjectId: options.subjectId, includeHidden: true
        });
        const assignments = current(cachedAssignments.filter(item => !item.isHidden));
        if (cachedAssignments.length) return { source: 'EDUX', cached: true, assignments, total: assignments.length };
        if (!saved || !Array.isArray(saved.data)) return null;
        const subjectIds = saved.subjectIds || [];
        if (subjectId && subjectIds.length && !subjectIds.includes(String(subjectId))) {
            throw loi(`Không tìm thấy học phần ${subjectId} trên EDUX.`, 404);
        }
        await db.luuBaiTapEDUX(NGUOI_DUNG_ID, current(saved.data), { preserveExisting: true });
        const daLuu = current(await db.layBaiTapEDUX(NGUOI_DUNG_ID, { subjectId }));
        return { source: 'EDUX', cached: true, assignments: daLuu, total: daLuu.length };
    }

    async function fetchAssignments(options) {
        const saved = session();
        let result;
        try { result = await keoBaiTapEDUX(saved.cookie, options); }
        catch (err) {
            if (!laHetPhien(err)) throw err;
            eduxKho.clearSession(NGUOI_DUNG_ID);
            throw loi('Phiên EDUX đã hết hạn. Hãy đăng nhập EDUX lại.', 401);
        }
        eduxKho.saveSession(NGUOI_DUNG_ID, {
            cookie: saved.cookie, email: saved.email, data: result.assignments, subjectIds: result.subjectIds
        });
        await getDb().luuBaiTapEDUX(NGUOI_DUNG_ID, result.assignments, { preserveExisting: true });
        return result;
    }

    async function getAll({ subjectId, questions, refresh }) {
        const canCauHoi = ['1', 'true'].includes(questions);
        const lamMoi = ['1', 'true'].includes(refresh);
        const options = { subjectId: subjectId || undefined, questions: canCauHoi };
        const saved = eduxKho.getSession(NGUOI_DUNG_ID);
        const courseScope = await getCurrentCourseScope(getDb(), NGUOI_DUNG_ID);
        options.courseScope = courseScope;
        const current = rows => rows.filter(item => matchCourse(courseScope, item));
        if (!courseScope.resolved || !courseScope.courses.length) {
            return { source: 'EDUX', cached: true, assignments: [], total: 0, scope: courseScope };
        }
        if (!lamMoi && !canCauHoi) {
            const result = await cached(saved, subjectId, options, current);
            if (result) return result;
        }
        const result = await fetchAssignments(options);
        const assignments = current(await getDb().layBaiTapEDUX(NGUOI_DUNG_ID, { subjectId }));
        return { source: 'EDUX', cached: false, assignments, total: assignments.length, thatBai: result.thatBai };
    }

    async function getById(id) {
        const assignments = await getDb().layBaiTapEDUX(NGUOI_DUNG_ID);
        let assignment = assignments.find(item => item.id === id);
        if (!assignment) {
            const saved = eduxKho.getSession(NGUOI_DUNG_ID);
            assignment = saved?.data?.find(item => item.id === id);
        }
        if (assignment) return { source: 'EDUX', assignment };
        session();
        throw loi(`Không tìm thấy bài tập EDUX: ${id}`, 404);
    }

    return { getAll, getById };
}

module.exports = { createEduxService };
