'use strict';

const { createHash } = require('node:crypto');
const context = require('./study-context.service');
const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');

const { fail, clean, required, date } = require('../validators/hoctapai.validator');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const { createHoiThoaiService } = require('./hoithoai.service');
const { createQuizService } = require('./quiz.service');
const { createDonNghiService } = require('./donnghi.service');

function createHocTapAiService({ getDb, userId = NGUOI_DUNG_ID, loadFreeSlots, validatePlanSessions }) {
    const db = () => { const value = getDb(); if (!value) throw fail('Database chưa sẵn sàng.', 503); return value; };
    const q = (sql, params = {}) => db().executeQuery(sql, { ...params, uid: userId });
    let queue = Promise.resolve();
    const mutate = fn => { const pending = queue.then(fn); queue = pending.catch(() => {}); return pending; };
    async function one(sql, params) {
        const rows = await q(sql, params);
        if (!rows.length) throw fail('Không tìm thấy dữ liệu của bạn.', 404, 'AI_NOT_FOUND');
        return rows[0];
    }
    const { ask, conversations, conversation } = createHoiThoaiService({ q, one, userId });

    const { quizzes, quiz, generateQuiz, submitQuiz, weaknesses, analyzeWeaknesses } = createQuizService({ q, one, userId, mutate });

    const { leaveDrafts, saveLeave, exportLeave } = createDonNghiService({ q, one });

    async function confirmExamPlan(body = {}) {
        if (body.confirmed !== true) throw fail('Cần xác nhận kế hoạch trước khi lưu.');
        const requestId = required(body.requestId, 'Mã xác nhận', 80);
        if (!Array.isArray(body.phases) || !body.phases.length || body.phases.length > 30) throw fail('Cần từ 1 đến 30 giai đoạn.');
        if (body.sessions !== undefined && (!Array.isArray(body.sessions) || body.sessions.length > 30)) throw fail('Danh sách buổi học không hợp lệ.');
        const payloadHash = hash({ phases: body.phases, sessions: body.sessions || [] });
        return mutate(async () => {
            const existing = await q('SELECT * FROM AiExamConfirmations WHERE user_id=@uid AND request_id=@id', { id: requestId });
            if (existing.length) {
                if (existing[0].payload_hash !== payloadHash) throw fail('Mã xác nhận đã dùng cho một kế hoạch khác.', 409);
                return JSON.parse(existing[0].result_json);
            }
            const profile = await db().layHoSo(userId);
            if (!profile) throw fail('Hãy đồng bộ hồ sơ trước khi lưu kế hoạch.', 409);
            return db().withTransaction(async () => {
                const exams = await q('SELECT * FROM Exams WHERE student_id=@sid', { sid: profile.student_id });
                const today = context.normalizeDate(new Date());
                const phases = body.phases.map(item => {
                    const exam = exams.find(e => String(e.exam_id) === String(item?.examId));
                    if (!exam) throw fail('Kỳ thi không tồn tại hoặc không thuộc hồ sơ hiện tại.', 404);
                    const startDate = date(item.startDate), endDate = date(item.endDate);
                    if (startDate < today || endDate < startDate || endDate > context.normalizeDate(exam.exam_date)) throw fail('Giai đoạn phải từ hôm nay đến ngày thi.', 409);
                    const priority = item.priority || 'HIGH';
                    if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) throw fail('Mức ưu tiên không hợp lệ.');
                    return { examId: exam.exam_id, subjectId: exam.subject_id, title: required(item.title, 'Tên giai đoạn', 180),
                        target: clean(item.target, 1000), startDate, endDate, priority };
                });
                const sessions = body.sessions || [];
                for (const session of sessions) {
                    if (!phases.some(p => String(p.examId) === String(session?.examId) && session.date >= p.startDate && session.date <= p.endDate)) throw fail('Buổi học phải thuộc một giai đoạn của kỳ thi.', 409);
                    const exam = exams.find(e => String(e.exam_id) === String(session.examId));
                    if (session.date === context.normalizeDate(exam.exam_date) && (!exam.exam_time || session.end > String(exam.exam_time).slice(0, 5))) throw fail('Buổi ôn phải kết thúc trước giờ thi.', 409);
                }
                const dates = [...new Set(sessions.map(s => date(s.date)))];
                const freeSlots = dates.length ? await loadFreeSlots(userId, dates, '07:00', '22:00') : [];
                const validated = validatePlanSessions({ sessions }, { dates, freeSlots });
                if (validated.rejected.length) throw fail('Lịch ôn bị trùng hoặc không còn hợp lệ. Hãy chỉnh thời gian rồi xác nhận lại.', 409, 'PLAN_CONFLICT');
                const savedPhases = [];
                for (const p of phases) savedPhases.push(await db().taoKeHoachOnThi(userId, { examId: p.examId, phaseTitle: p.title,
                    targetDescription: p.target, startDate: p.startDate, endDate: p.endDate, priority: p.priority, notes: 'AI: người học đã xác nhận.' }));
                const savedSessions = [];
                for (const s of validated.sessions) savedSessions.push(await db().xepLichTuHoc(userId, { title: s.title, studyDate: s.date,
                    startTime: s.start, endTime: s.end, subjectId: exams.find(e => String(e.exam_id) === String(s.examId)).subject_id,
                    isAiSuggested: true, notes: s.reason || 'Ôn thi AI đã xác nhận.' }));
                const result = { persisted: true, phases: savedPhases, sessions: savedSessions };
                await q('INSERT INTO AiExamConfirmations(user_id,request_id,payload_hash,result_json) VALUES(@uid,@id,@hash,@result)',
                    { id: requestId, hash: payloadHash, result: JSON.stringify(result) });
                return result;
            });
        });
    }
    return { ask, conversations, conversation, quizzes, quiz, generateQuiz, submitQuiz, weaknesses, analyzeWeaknesses,
        leaveDrafts, saveLeave, exportLeave, confirmExamPlan };
}

module.exports = { createHocTapAiService };
