'use strict';

const gemini = require('../utils/gemini-client');
const studyContext = require('./study-context.service');
const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { loi } = require('../utils/error');
const { MAX_PLAN_SESSIONS, MIN_SESSION_MINUTES } = require('../utils/trolyai-config');
const { optionalText, validDate, validTime, dateRange, validatePlanSessions, objectSchema } = require('../validators/trolyai.validator');
const { dateAt, addDays, minutes, timeFromMinutes, subtractInterval } = require('../utils/trolyai-time');
const { stringifyForAi, contextOptions } = require('../utils/trolyai-context');

function createTrolyaiScheduleService({ getDb, getHocTapAiService }) {
    function requireDb() {
        const db = getDb();
        if (!db) throw loi("Database chưa sẵn sàng.", 503);
        return db;
    }

    async function loadFreeSlots(studentId, dates, startTime, endTime) {
        const database = requireDb();
        // Đọc đầy đủ lịch thi; context cho mô hình có thể đã bị rút gọn.
        const exams = (await database.layLichThi(studentId) || []).filter(item =>
            !["CANCELLED", "CANCELED", "HUY", "HỦY"].includes(String(item.exam_status).toUpperCase())
        ).map(item => ({
            date: studyContext.normalizeDate(item.exam_date),
            time: studyContext.normalizeTime(item.exam_time),
            durationMinutes: Number(item.duration_minutes) > 0 ? Number(item.duration_minutes) : null
        }));
        const lowerBound = minutes(startTime);
        const upperBound = minutes(endTime);
        const result = [];

        for (const date of dates) {
            const rawSlots = await database.timKhoangTrongTuHoc(studentId, date, MIN_SESSION_MINUTES);
            let slots = (rawSlots || []).map(slot => ({
                date,
                start: studyContext.normalizeTime(slot.start_time),
                end: studyContext.normalizeTime(slot.end_time)
            })).filter(slot => slot.start && slot.end).map(slot => ({
                ...slot,
                start: timeFromMinutes(Math.max(minutes(slot.start), lowerBound)),
                end: timeFromMinutes(Math.min(minutes(slot.end), upperBound))
            })).filter(slot => minutes(slot.end) - minutes(slot.start) >= MIN_SESSION_MINUTES);

            for (const exam of exams.filter(item => item.date === date)) {
                // Thiếu giờ/thời lượng: chưa đủ căn cứ để xếp tự học trong ngày đó.
                if (!exam.time || !exam.durationMinutes) { slots = []; break; }
                const examStart = minutes(exam.time);
                const examEnd = Math.min(24 * 60, examStart + exam.durationMinutes);
                slots = subtractInterval(slots, exam.time, timeFromMinutes(examEnd));
            }

            for (const slot of slots) {
                if (dateAt(date, slot.end) <= new Date()) continue;
                if (dateAt(date, slot.start) < new Date()) {
                    const now = new Date();
                    const rounded = Math.ceil((minutes(studyContext.normalizeTime(now)) + 1) / 15) * 15;
                    const nextStart = timeFromMinutes(rounded);
                    if (minutes(slot.end) - minutes(nextStart) < MIN_SESSION_MINUTES) continue;
                    slot.start = nextStart;
                }
                result.push({
                    ...slot,
                    durationMinutes: minutes(slot.end) - minutes(slot.start)
                });
            }
        }

        return result;
    }

    let confirmationQueue = Promise.resolve();

    async function plan(body) {
        const startDate = validDate(body?.startDate, "startDate");
        const endDate = validDate(body?.endDate, "endDate");
        const dates = dateRange(startDate, endDate);
        const freeStartTime = validTime(body?.freeStartTime || body?.freeStartHour || "07:00", "freeStartTime");
        const freeEndTime = validTime(body?.freeEndTime || body?.freeEndHour || "22:00", "freeEndTime");
        if (minutes(freeEndTime) <= minutes(freeStartTime)) {
            throw loi("freeEndTime phải sau freeStartTime.");
        }

        const requestedDuration = body?.durationMinutes !== undefined ? Number(body.durationMinutes)
            : body?.durationHours !== undefined ? Number(body.durationHours) * 60 : 60;
        if (!Number.isFinite(requestedDuration) || requestedDuration < MIN_SESSION_MINUTES || requestedDuration > 240) {
            throw loi("Thời lượng mỗi phiên phải từ 30 đến 240 phút.");
        }

        const targetHours = body?.targetHours === undefined ? null : Number(body.targetHours);
        if (targetHours !== null && (!Number.isFinite(targetHours) || targetHours <= 0 || targetHours > 50)) throw loi("targetHours phải lớn hơn 0 và tối đa 50.");
        const daysOfWeek = body?.daysOfWeek;
        if (daysOfWeek !== undefined && (!Array.isArray(daysOfWeek) || !daysOfWeek.length
            || daysOfWeek.some(day => !Number.isInteger(day) || day < 2 || day > 8))) throw loi("daysOfWeek phải chứa các số từ 2 đến 8.");
        // Quy ước thứ của dự án: 2=Thứ Hai, 8=Chủ nhật.
        const planningDates = daysOfWeek ? dates.filter(date => {
            const day = new Date(`${date}T00:00:00Z`).getUTCDay();
            return daysOfWeek.includes(day === 0 ? 8 : day + 1);
        }) : dates;
        const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, { ...contextOptions(body), upcomingExamsOnly: true });
        let freeSlots = await loadFreeSlots(NGUOI_DUNG_ID, planningDates, freeStartTime, freeEndTime);
        if (!freeSlots.length) {
            return {
                preview: true,
                persisted: false,
                sessions: [],
                rejected: [],
                message: "Không có khoảng trống hợp lệ trong phạm vi đã chọn."
            };
        }

        const subject = optionalText(body?.subject, 120);
        const output = await gemini.generateJson([
            "Tạo bản xem trước kế hoạch tự học từ đúng các khoảng trống cho phép.",
            `Mỗi phiên mục tiêu khoảng ${Math.round(requestedDuration)} phút, tối thiểu ${MIN_SESSION_MINUTES} phút.`,
            targetHours ? `Tổng thời lượng không vượt quá ${targetHours} giờ trong phạm vi này.` : "",
            `Hiện tại: ${new Date().toISOString()}; múi giờ lịch: ${studyContext.TIMEZONE}. Tối đa ${MAX_PLAN_SESSIONS} phiên.`,
            subject ? `Ưu tiên môn/công việc: ${subject}.` : "Ưu tiên bài tập chưa hoàn thành và kỳ thi sắp tới.",
            "Không tạo phiên ngoài khoảng trống, không tạo phiên trong quá khứ. Không tự lưu lịch.",
            `Khoảng trống hợp lệ:\n${stringifyForAi(freeSlots)}`,
            `Bài tập chưa hoàn thành:\n${stringifyForAi(context.assignments)}`,
            `Kỳ thi:\n${stringifyForAi(context.exams)}`,
            `Điểm đã có:\n${stringifyForAi(context.grades)}`
        ].join("\n\n"), {
            validate: value => Array.isArray(value?.sessions),
            schemaDescription: stringifyForAi({
                sessions: [{
                    date: "YYYY-MM-DD",
                    start: "HH:mm",
                    end: "HH:mm",
                    title: "string",
                    subject: "string",
                    reason: "string",
                    assignmentId: "number|string|null",
                    examId: "number|string|null"
                }]
            })
        });

        // Lịch có thể thay đổi trong lúc chờ Gemini. Kiểm tra lại trước khi trả preview.
        freeSlots = await loadFreeSlots(NGUOI_DUNG_ID, planningDates, freeStartTime, freeEndTime);
        const validated = validatePlanSessions(output, {
            dates: planningDates, freeSlots, assignments: context.assignments, exams: context.exams,
            targetMinutes: targetHours ? targetHours * 60 : null
        });
        return {
            preview: true,
            persisted: false,
            ...validated,
            availableFreeSlots: freeSlots.length
        };
    }

    async function confirmPlan(body) {
        if (body?.confirmed !== true) throw loi("Cần xác nhận kế hoạch trước khi lưu.");
        const sessions = body?.sessions;
        if (!Array.isArray(sessions) || !sessions.length || sessions.length > MAX_PLAN_SESSIONS) {
            throw loi(`sessions phải có từ 1 đến ${MAX_PLAN_SESSIONS} phiên.`);
        }
        const dates = [...new Set(sessions.map(item => validDate(item?.date, "date")))].sort();
        dateRange(dates[0], dates[dates.length - 1]);
        const save = async () => {
            const database = requireDb();
            if (!await database.layHoSo(NGUOI_DUNG_ID)) throw loi("Chưa có hồ sơ sinh viên. Hãy đồng bộ hoặc tạo hồ sơ trước khi lưu lịch.", 409);
            if (typeof database.withTransaction !== "function") throw loi("Database chưa hỗ trợ lưu kế hoạch theo transaction.", 503);
            return database.withTransaction(async () => {
                const freeSlots = await loadFreeSlots(NGUOI_DUNG_ID, dates, "07:00", "22:00");
                const checked = validatePlanSessions({ sessions }, { dates, freeSlots });
                if (checked.rejected.length) {
                    const error = loi("Lịch đề xuất đã không còn hợp lệ. Hãy tạo lại kế hoạch.", 409);
                    error.code = "PLAN_CONFLICT";
                    throw error;
                }
                const saved = [];
                for (const session of checked.sessions) {
                    saved.push(await database.xepLichTuHoc(NGUOI_DUNG_ID, {
                        title: session.title, studyDate: session.date,
                        startTime: session.start, endTime: session.end,
                        isAiSuggested: true, notes: session.reason || "Kế hoạch AI đã được người học xác nhận."
                    }));
                }
                return { persisted: true, sessions: saved };
            });
        };
        const pending = confirmationQueue.then(save, save);
        confirmationQueue = pending.catch(() => {});
        return pending;
    }

    async function examPlan(body) {
        const nowDate = studyContext.normalizeDate(new Date());
        const examId = body?.examId === undefined || body?.examId === null
            ? null
            : String(body.examId);
        const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, {
            ...contextOptions(body), upcomingExamsOnly: true, examId
        });
        const exams = context.exams.filter(exam =>
            exam.date && exam.date >= nowDate && (examId === null || String(exam.id) === examId)
        );
        if (!exams.length) throw loi(examId ? "Không tìm thấy kỳ thi sắp tới." : "Chưa có kỳ thi sắp tới.", 404);

        const lastDate = exams.reduce((latest, exam) => exam.date > latest ? exam.date : latest, nowDate);
        const endDate = lastDate < addDays(nowDate, 30) ? lastDate : addDays(nowDate, 30);
        const dates = dateRange(nowDate, endDate);
        const freeSlots = await loadFreeSlots(NGUOI_DUNG_ID, dates, "07:00", "22:00");
        const weaknesses = await getHocTapAiService().weaknesses();

        const output = await gemini.generateJson([
            "Tạo bản xem trước các giai đoạn ôn thi. Không lưu vào database.",
            "Ngày bắt đầu/kết thúc không được ở quá khứ và không được sau ngày thi tương ứng.",
            "Chỉ dùng môn thi, điểm và ghi chú thật được cung cấp; không bịa điểm hay mức độ thành thạo.",
            "Đề xuất thêm sessions cụ thể trong các khoảng trống; mỗi session phải thuộc một phase cùng examId và kết thúc trước giờ thi. Phiên dài 30–240 phút. Không có khoảng trống thì trả sessions rỗng.",
            `Kỳ thi:\n${stringifyForAi(exams)}`,
            `Khoảng trống hợp lệ trong 31 ngày tới:\n${stringifyForAi(freeSlots)}`,
            `Điểm yếu đo từ bài kiểm tra:\n${stringifyForAi(weaknesses.topics)}`,
            `Điểm đã có:\n${stringifyForAi(context.grades)}`,
            `Ghi chú khó đã có:\n${stringifyForAi(context.notes.filter(note => note.isDifficult))}`
        ].join("\n\n"), {
            validate: objectSchema({ phases: "array" }),
            schemaDescription: stringifyForAi({
                phases: [{
                    examId: "number|string",
                    title: "string",
                    target: "string",
                    startDate: "YYYY-MM-DD",
                    endDate: "YYYY-MM-DD",
                    priority: "LOW|MEDIUM|HIGH|URGENT"
                }],
                sessions: [{ examId: "number|string", date: "YYYY-MM-DD", start: "HH:mm", end: "HH:mm", title: "string", subject: "string", reason: "string" }]
            })
        });

        const examMap = new Map(exams.map(exam => [String(exam.id), exam]));
        const phases = (Array.isArray(output?.phases) ? output.phases : []).map((phase, index) => {
            const selectedExam = examMap.get(String(phase?.examId));
            const startDate = studyContext.normalizeDate(phase?.startDate);
            const endDate = studyContext.normalizeDate(phase?.endDate);
            const title = optionalText(phase?.title, 180);
            if (!selectedExam || !startDate || !endDate || !title) return null;
            if (startDate !== phase.startDate || endDate !== phase.endDate) return null;
            if (startDate < nowDate || endDate < startDate || endDate > selectedExam.date) return null;
            const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(phase?.priority).toUpperCase())
                ? String(phase.priority).toUpperCase()
                : "HIGH";
            return {
                id: `ai-exam-preview-${index + 1}`,
                examId: selectedExam.id,
                subjectId: selectedExam.subjectId,
                subject: selectedExam.subject,
                title,
                target: optionalText(phase?.target, 500),
                startDate,
                endDate,
                priority,
                preview: true
            };
        }).filter(Boolean).slice(0, 30);

        const refreshedSlots = await loadFreeSlots(NGUOI_DUNG_ID, dates, "07:00", "22:00");
        const checked = validatePlanSessions({ sessions: Array.isArray(output.sessions) ? output.sessions : [] }, { dates, freeSlots: refreshedSlots, exams });
        const sessions = checked.sessions.filter(session => {
            const exam = examMap.get(String(session.examId));
            return exam && phases.some(p => String(p.examId) === String(session.examId) && session.date >= p.startDate && session.date <= p.endDate)
                && (session.date < exam.date || (exam.time && session.end <= exam.time));
        });
        return { preview: true, persisted: false, phases, sessions, rejected: checked.rejected };
    }

    return { loadFreeSlots, plan, confirmPlan, examPlan };
}

module.exports = { createTrolyaiScheduleService };
