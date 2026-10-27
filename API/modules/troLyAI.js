"use strict";

const express = require("express");
const gemini = require("../shared/gemini-client");
const studyContext = require("../shared/study-context");
const { NGUOI_DUNG_ID } = require("../shared/nguoiDung");

const router = express.Router();
let db;

const MAX_QUESTION_LENGTH = 4000;
const MAX_TEXT_LENGTH = 30000;
const MAX_PLAN_DAYS = 31;
const MAX_PLAN_SESSIONS = 30;
const MIN_SESSION_MINUTES = 30;

const loi = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const xuLy = callback => async (req, res, next) => {
    try {
        res.json({ success: true, data: await callback(req) });
    } catch (error) {
        next(error);
    }
};

function requireDb() {
    if (!db) throw loi("Database chưa sẵn sàng.", 503);
    return db;
}

function requiredText(value, field, maxLength = MAX_TEXT_LENGTH) {
    if (typeof value !== "string" || !value.trim()) {
        throw loi(`${field} là bắt buộc.`);
    }
    const text = value.trim();
    if (text.length > maxLength) throw loi(`${field} tối đa ${maxLength} ký tự.`);
    return text;
}

function optionalText(value, maxLength = 500) {
    if (typeof value !== "string" || !value.trim()) return null;
    return value.trim().slice(0, maxLength);
}

function validDate(value, field) {
    const date = studyContext.normalizeDate(value);
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || date !== value) {
        throw loi(`${field} phải có định dạng YYYY-MM-DD.`);
    }
    return date;
}

function validTime(value, field) {
    const time = studyContext.normalizeTime(value);
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value) || !time) throw loi(`${field} phải có định dạng HH:mm.`);
    return time;
}

function dateAt(date, time = "00:00") {
    return new Date(`${date}T${time}:00${studyContext.OFFSET}`);
}

function addDays(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

function dateRange(startDate, endDate) {
    const days = Math.floor((dateAt(endDate) - dateAt(startDate)) / 86400000) + 1;
    if (days <= 0) throw loi("endDate không được trước startDate.");
    if (days > MAX_PLAN_DAYS) throw loi(`Khoảng lập kế hoạch tối đa ${MAX_PLAN_DAYS} ngày.`);
    return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function minutes(time) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
}

function timeFromMinutes(value) {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function overlaps(startA, endA, startB, endB) {
    return minutes(startA) < minutes(endB) && minutes(endA) > minutes(startB);
}

function subtractInterval(slots, blockedStart, blockedEnd) {
    const blockedStartMinutes = minutes(blockedStart);
    const blockedEndMinutes = minutes(blockedEnd);
    if (blockedEndMinutes <= blockedStartMinutes) return slots;

    return slots.flatMap(slot => {
        const start = minutes(slot.start);
        const end = minutes(slot.end);
        if (end <= blockedStartMinutes || start >= blockedEndMinutes) return [slot];

        const pieces = [];
        if (blockedStartMinutes - start >= MIN_SESSION_MINUTES) {
            pieces.push({ ...slot, end: timeFromMinutes(blockedStartMinutes) });
        }
        if (end - blockedEndMinutes >= MIN_SESSION_MINUTES) {
            pieces.push({ ...slot, start: timeFromMinutes(blockedEndMinutes) });
        }
        return pieces;
    });
}

function stringifyForAi(value) {
    return JSON.stringify(value);
}

function compactContext(context) {
    return {
        profile: context.profile,
        generatedAt: context.generatedAt,
        timezone: context.timezone,
        timetable: context.timetable,
        studySchedules: context.studySchedules,
        assignments: context.assignments,
        exams: context.exams,
        grades: context.grades,
        documents: context.documents,
        notes: context.notes,
        sources: context.sources
    };
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

function sessionsFromAi(output) {
    if (Array.isArray(output)) return output;
    if (Array.isArray(output?.sessions)) return output.sessions;
    if (Array.isArray(output?.proposals)) return output.proposals;
    throw new gemini.GeminiError("AI không trả về danh sách sessions.", "GEMINI_SCHEMA", 502);
}

function validatePlanSessions(output, constraints) {
    const candidates = sessionsFromAi(output);
    const accepted = [];
    const rejected = [];
    const allowedDates = new Set(constraints.dates);
    let totalMinutes = 0;

    for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index] || {};
        const date = studyContext.normalizeDate(candidate.date || candidate.studyDate);
        const start = studyContext.normalizeTime(candidate.start || candidate.startTime);
        const end = studyContext.normalizeTime(candidate.end || candidate.endTime);
        const title = optionalText(candidate.title || candidate.subject, 180);
        const subject = optionalText(candidate.subject || candidate.title, 120);
        let reason = null;

        if (index >= MAX_PLAN_SESSIONS) {
            reason = "session-limit";
        } else if (!date || !start || !end || !title || !subject
            || date !== (candidate.date || candidate.studyDate)
            || start !== (candidate.start || candidate.startTime)
            || end !== (candidate.end || candidate.endTime)) {
            reason = "invalid-schema";
        } else if (!allowedDates.has(date)) {
            reason = "outside-date-range";
        } else if (minutes(end) - minutes(start) < MIN_SESSION_MINUTES || minutes(end) - minutes(start) > 240) {
            reason = "invalid-duration";
        } else if (dateAt(date, start) <= new Date()) {
            reason = "past-session";
        } else {
            const matchingSlot = constraints.freeSlots.find(slot =>
                slot.date === date && minutes(start) >= minutes(slot.start) && minutes(end) <= minutes(slot.end)
            );
            if (!matchingSlot) reason = "not-in-free-slot";
        }

        if (!reason && candidate.assignmentId != null && constraints.assignments
            && !constraints.assignments.some(item => String(item.id) === String(candidate.assignmentId))) reason = "unknown-assignment";
        if (!reason && candidate.examId != null && constraints.exams
            && !constraints.exams.some(item => String(item.id) === String(candidate.examId))) reason = "unknown-exam";
        if (!reason && constraints.targetMinutes && totalMinutes + minutes(end) - minutes(start) > constraints.targetMinutes) {
            reason = "target-hours-exceeded";
        }

        if (!reason && accepted.some(item =>
            item.date === date && overlaps(start, end, item.start, item.end)
        )) {
            reason = "overlaps-proposal";
        }

        if (reason) {
            rejected.push({ index, reason });
            continue;
        }

        accepted.push({
            id: `ai-preview-${index + 1}`,
            date,
            start,
            end,
            title,
            subject,
            reason: optionalText(candidate.reason, 300),
            assignmentId: candidate.assignmentId ?? null,
            examId: candidate.examId ?? null,
            durationMinutes: minutes(end) - minutes(start),
            preview: true
        });
        totalMinutes += minutes(end) - minutes(start);
    }

    return { sessions: accepted, rejected };
}

function sanitizeProgress(value, depth = 0) {
    if (depth > 6 || value === undefined || typeof value === "function") return undefined;
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return value.trim().slice(0, 500);
    if (Array.isArray(value)) {
        return value.slice(0, 50).map(item => sanitizeProgress(item, depth + 1))
            .filter(item => item !== undefined);
    }
    if (typeof value === "object") {
        return Object.fromEntries(Object.entries(value).slice(0, 80)
            .map(([key, item]) => [key.slice(0, 80), sanitizeProgress(item, depth + 1)])
            .filter(([, item]) => item !== undefined));
    }
    return undefined;
}

function progressAvailability(progress) {
    const entries = [];
    const walk = (value, path = "") => {
        if (value && typeof value === "object") {
            for (const [key, item] of Object.entries(value)) walk(item, path ? `${path}.${key}` : key);
        } else if (value !== null && value !== undefined && value !== "") {
            entries.push({ path, value });
        }
    };
    walk(progress);

    const paths = entries.map(entry => entry.path.toLowerCase());
    const has = regex => paths.some(path => regex.test(path));
    return {
        hasData: entries.some(entry => typeof entry.value === "number"),
        presentFields: entries.map(entry => entry.path).slice(0, 80),
        unavailableMetrics: [
            ["studyTime", /study.*(time|minute|hour|second)|actual.*(minute|hour|second)/],
            ["completedSessions", /session/],
            ["taskCompletion", /task|completion|completed/],
            ["grades", /grade|score|gpa|điểm/]
        ].filter(([, regex]) => !has(regex)).map(([name]) => name)
    };
}

function stringList(value, limit, maxLength) {
    return (Array.isArray(value) ? value : [])
        .filter(item => typeof item === "string" && item.trim())
        .map(item => item.trim().slice(0, maxLength))
        .slice(0, limit);
}

function objectSchema(fields) {
    return value => !!value && typeof value === "object" && !Array.isArray(value)
        && Object.entries(fields).every(([key, type]) => type === "array"
            ? Array.isArray(value[key]) : typeof value[key] === type);
}

function contextOptions(req) {
    return { studyData: req.body?.studyData };
}

/**
 * Phân tích đúng dữ liệu tiến độ do caller cung cấp. Kết quả không chứa số liệu
 * mới để tránh biến suy luận của mô hình thành chỉ số đo lường.
 */
async function generateProgressAdvice(progress) {
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
        throw loi("progress phải là một object.");
    }

    const cleanProgress = sanitizeProgress(progress);
    const serialized = JSON.stringify(cleanProgress);
    if (serialized.length > MAX_TEXT_LENGTH) throw loi(`progress tối đa ${MAX_TEXT_LENGTH} ký tự JSON.`);

    const availability = progressAvailability(cleanProgress);
    if (!availability.hasData) {
        return {
            overview: "Chưa có dữ liệu tiến độ thực tế để phân tích.",
            comments: [],
            revisionSuggestions: [],
            unavailableMetrics: availability.unavailableMetrics,
            basedOnFields: []
        };
    }

    const output = await gemini.generateJson([
        "Phân tích dữ liệu tiến độ học tập dưới đây.",
        "Chỉ nhận xét điều được chứng minh trực tiếp bởi dữ liệu. Giá trị null hoặc trường vắng mặt là không có dữ liệu, không phải 0.",
        "Không tính, đoán hoặc nêu bất kỳ tỷ lệ, điểm số, thời lượng hay số phiên nào không xuất hiện trong input.",
        "Đưa ra nhận xét ngắn và gợi ý ôn tập có thể hành động.",
        `Dữ liệu tiến độ:\n${stringifyForAi(cleanProgress)}`
    ].join("\n\n"), {
        validate: objectSchema({ overview: "string", comments: "array", revisionSuggestions: "array" }),
        schemaDescription: stringifyForAi({
            overview: "string",
            comments: ["string"],
            revisionSuggestions: ["string"]
        })
    });

    const numbers = new Set(serialized.match(/\d+(?:[.,]\d+)?/g) || []);
    const supported = text => (text.match(/\d+(?:[.,]\d+)?/g) || []).every(number => numbers.has(number));
    const overview = optionalText(output?.overview, 1000);
    return {
        overview: overview && supported(overview) ? overview : "Hãy xem lại dữ liệu tiến độ đã ghi nhận và ưu tiên các nội dung còn chưa hoàn thành.",
        comments: stringList(output?.comments, 8, 500).filter(supported),
        revisionSuggestions: stringList(output?.revisionSuggestions, 8, 500).filter(supported),
        unavailableMetrics: availability.unavailableMetrics,
        basedOnFields: availability.presentFields
    };
}

/**
 * Chỉ gửi các ghi chú được đánh dấu khó/cần ôn. Nếu nguồn Notes chưa có ở DB,
 * trả kết quả rỗng có metadata thay vì tạo chủ đề giả.
 */
async function analyzeDifficultNotes(studentId, options = {}) {
    const context = await studyContext.buildStudyContext(studentId, {
        ...options, difficultOnly: true, limits: { timetable: 0, studySchedules: 0, assignments: 0, exams: 0, grades: 0, documents: 0, notes: 50 }
    });
    if (!context.sources.notes.available) {
        return {
            available: false,
            reason: context.sources.notes.reason || "notes-unavailable",
            difficultNotesCount: 0,
            topics: [],
            suggestions: []
        };
    }

    const difficultNotes = context.notes.filter(note => note.isDifficult);
    if (!difficultNotes.length) {
        return {
            available: true,
            difficultNotesCount: 0,
            topics: [],
            suggestions: []
        };
    }

    const output = await gemini.generateJson([
        "Phân tích các ghi chú đã được người học đánh dấu khó/cần ôn dưới đây.",
        "Chỉ nêu chủ đề xuất hiện trong ghi chú. Không bịa nội dung học tập còn thiếu.",
        `Ghi chú khó:\n${stringifyForAi(difficultNotes)}`
    ].join("\n\n"), {
        validate: objectSchema({ topics: "array", suggestions: "array" }),
        schemaDescription: stringifyForAi({
            topics: [{ topic: "string", reason: "string", noteIds: ["id"] }],
            suggestions: ["string"]
        })
    });

    const noteIds = new Set(difficultNotes.map(note => String(note.id)));
    const topics = (Array.isArray(output?.topics) ? output.topics : []).map(item => ({
        topic: optionalText(item?.topic, 180),
        reason: optionalText(item?.reason, 500),
        noteIds: (Array.isArray(item?.noteIds) ? item.noteIds : [])
            .map(String).filter(id => noteIds.has(id)).slice(0, 20)
    })).filter(item => item.topic && item.noteIds.length).slice(0, 15);

    return {
        available: true,
        difficultNotesCount: difficultNotes.length,
        source: context.sources.notes,
        topics,
        suggestions: stringList(output?.suggestions, 10, 500)
    };
}

router.get("/status", xuLy(async () => gemini.getStatus()));

router.post("/ask", xuLy(async req => {
    const question = requiredText(req.body?.question, "question", MAX_QUESTION_LENGTH);
    const conversationId = optionalText(req.body?.conversationId, 64) || undefined;
    const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, contextOptions(req));
    const answer = await gemini.ask([
        "Trả lời câu hỏi của người học. Khi câu hỏi liên quan dữ liệu cá nhân, chỉ dùng ngữ cảnh thật bên dưới. Nếu dữ liệu cần thiết không có, nói rõ là chưa có dữ liệu.",
        `Ngữ cảnh học tập:\n${stringifyForAi(compactContext(context))}`,
        `Câu hỏi:\n${question}`
    ].join("\n\n"), { conversationId });

    return { answer, conversationId: conversationId || null };
}));

router.post("/plan", xuLy(async req => {
    const startDate = validDate(req.body?.startDate, "startDate");
    const endDate = validDate(req.body?.endDate, "endDate");
    const dates = dateRange(startDate, endDate);
    const freeStartTime = validTime(req.body?.freeStartTime || req.body?.freeStartHour || "07:00", "freeStartTime");
    const freeEndTime = validTime(req.body?.freeEndTime || req.body?.freeEndHour || "22:00", "freeEndTime");
    if (minutes(freeEndTime) <= minutes(freeStartTime)) {
        throw loi("freeEndTime phải sau freeStartTime.");
    }

    const requestedDuration = req.body?.durationMinutes !== undefined ? Number(req.body.durationMinutes)
        : req.body?.durationHours !== undefined ? Number(req.body.durationHours) * 60 : 60;
    if (!Number.isFinite(requestedDuration) || requestedDuration < MIN_SESSION_MINUTES || requestedDuration > 240) {
        throw loi("Thời lượng mỗi phiên phải từ 30 đến 240 phút.");
    }

    const targetHours = req.body?.targetHours === undefined ? null : Number(req.body.targetHours);
    if (targetHours !== null && (!Number.isFinite(targetHours) || targetHours <= 0 || targetHours > 50)) throw loi("targetHours phải lớn hơn 0 và tối đa 50.");
    const daysOfWeek = req.body?.daysOfWeek;
    if (daysOfWeek !== undefined && (!Array.isArray(daysOfWeek) || !daysOfWeek.length
        || daysOfWeek.some(day => !Number.isInteger(day) || day < 2 || day > 8))) throw loi("daysOfWeek phải chứa các số từ 2 đến 8.");
    // Quy ước thứ của dự án: 2=Thứ Hai, 8=Chủ nhật.
    const planningDates = daysOfWeek ? dates.filter(date => {
        const day = new Date(`${date}T00:00:00Z`).getUTCDay();
        return daysOfWeek.includes(day === 0 ? 8 : day + 1);
    }) : dates;
    const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, { ...contextOptions(req), upcomingExamsOnly: true });
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

    const subject = optionalText(req.body?.subject, 120);
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
}));

let confirmationQueue = Promise.resolve();
router.post("/plan/confirm", xuLy(async req => {
    if (req.body?.confirmed !== true) throw loi("Cần xác nhận kế hoạch trước khi lưu.");
    const sessions = req.body?.sessions;
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
}));

router.post("/exam-plan", xuLy(async req => {
    const nowDate = studyContext.normalizeDate(new Date());
    const examId = req.body?.examId === undefined || req.body?.examId === null
        ? null
        : String(req.body.examId);
    const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, {
        ...contextOptions(req), upcomingExamsOnly: true, examId
    });
    const exams = context.exams.filter(exam =>
        exam.date && exam.date >= nowDate && (examId === null || String(exam.id) === examId)
    );
    if (!exams.length) throw loi(examId ? "Không tìm thấy kỳ thi sắp tới." : "Chưa có kỳ thi sắp tới.", 404);

    const output = await gemini.generateJson([
        "Tạo bản xem trước các giai đoạn ôn thi. Không lưu vào database.",
        "Ngày bắt đầu/kết thúc không được ở quá khứ và không được sau ngày thi tương ứng.",
        "Chỉ dùng môn thi, điểm và ghi chú thật được cung cấp; không bịa điểm hay mức độ thành thạo.",
        `Kỳ thi:\n${stringifyForAi(exams)}`,
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
            }]
        })
    });

    const examMap = new Map(exams.map(exam => [String(exam.id), exam]));
    const phases = (Array.isArray(output?.phases) ? output.phases : []).map((phase, index) => {
        const selectedExam = examMap.get(String(phase?.examId));
        const startDate = studyContext.normalizeDate(phase?.startDate);
        const endDate = studyContext.normalizeDate(phase?.endDate);
        const title = optionalText(phase?.title, 180);
        if (!selectedExam || !startDate || !endDate || !title) return null;
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

    return { preview: true, persisted: false, phases };
}));

router.post("/check", xuLy(async req => {
    const question = requiredText(req.body?.question, "question", MAX_QUESTION_LENGTH);
    const answer = requiredText(req.body?.answer, "answer", 8000);
    const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, contextOptions(req));
    const output = await gemini.generateJson([
        "Kiểm tra câu trả lời của người học. Nêu rõ phần đúng, phần cần sửa và lời giải thích.",
        "Nếu ngữ cảnh không đủ để xác minh chắc chắn thì verdict phải là unknown; không tự tạo đáp án từ dữ liệu cá nhân bị thiếu.",
        `Câu hỏi:\n${question}`,
        `Câu trả lời:\n${answer}`,
        `Ngữ cảnh học tập có sẵn:\n${stringifyForAi(compactContext(context))}`
    ].join("\n\n"), {
        validate: objectSchema({ verdict: "string", feedback: "string", corrections: "array", revisionSuggestions: "array" }),
        schemaDescription: stringifyForAi({
            verdict: "correct|partially-correct|incorrect|unknown",
            feedback: "string",
            corrections: ["string"],
            revisionSuggestions: ["string"]
        })
    });

    const verdicts = new Set(["correct", "partially-correct", "incorrect", "unknown"]);
    return {
        verdict: verdicts.has(output?.verdict) ? output.verdict : "unknown",
        feedback: optionalText(output?.feedback, 1500) || "Chưa đủ thông tin để nhận xét.",
        corrections: stringList(output?.corrections, 10, 500),
        revisionSuggestions: stringList(output?.revisionSuggestions, 10, 500)
    };
}));

router.post("/summarize", xuLy(async req => {
    const text = requiredText(req.body?.text || req.body?.content, "text", MAX_TEXT_LENGTH);
    const title = optionalText(req.body?.title, 180);
    const summary = await gemini.generateText([
        "Tóm tắt nội dung học tập sau bằng tiếng Việt. Giữ đúng dữ kiện trong văn bản, nêu ý chính và các khái niệm cần nhớ; không bổ sung dữ kiện ngoài văn bản.",
        title ? `Tiêu đề: ${title}` : "",
        `Nội dung:\n${text}`
    ].filter(Boolean).join("\n\n"), { maxOutputTokens: 2048 });
    return { title, summary };
}));

router.post("/draft-leave", xuLy(async req => {
    const date = validDate(req.body?.date, "date");
    const reason = requiredText(req.body?.reason, "reason", 1000);
    const session = optionalText(req.body?.session || req.body?.period, 120);
    const subject = optionalText(req.body?.subject, 120);
    const recipient = optionalText(req.body?.recipient, 180);
    // Chọn ngày trước khi giới hạn context, tránh bỏ sót lớp trong lịch sử dài.
    const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, {
        ...contextOptions(req), timetableDate: date,
        limits: { timetable: 100, studySchedules: 0, assignments: 0, exams: 0, grades: 0, documents: 0, notes: 0 }
    });
    const matchingClasses = context.timetable.filter(item => {
        if (!item.startDate || !item.endDate || date < item.startDate || date > item.endDate) return false;
        const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
        const projectDay = jsDay === 0 ? 8 : jsDay + 1;
        return item.dayOfWeek === projectDay && (!subject || item.subject?.toLowerCase().includes(subject.toLowerCase()));
    });

    const draft = await gemini.generateText([
        "Soạn một đơn xin nghỉ học ngắn, lịch sự bằng tiếng Việt từ dữ liệu được cung cấp.",
        "Không bịa tên giảng viên, lớp, mã sinh viên hoặc thông tin liên hệ. Nếu thiếu thì dùng chỗ trống [Điền thông tin].",
        `Ngày nghỉ: ${date}`,
        session ? `Buổi/tiết: ${session}` : "",
        subject ? `Môn: ${subject}` : "",
        recipient ? `Người nhận: ${recipient}` : "",
        `Lý do do người học cung cấp: ${reason}`,
        `Hồ sơ có sẵn:\n${stringifyForAi(context.profile)}`,
        `Lớp khớp ngày/môn:\n${stringifyForAi(matchingClasses)}`
    ].filter(Boolean).join("\n\n"), { maxOutputTokens: 1200 });

    return { draft, matchedClasses: matchingClasses.length };
}));

router.post("/progress-advice", xuLy(async req => generateProgressAdvice(req.body?.progress)));
router.post("/difficult-notes", xuLy(async req => analyzeDifficultNotes(NGUOI_DUNG_ID, contextOptions(req))));

router.use((error, req, res, next) => {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Không thể xử lý yêu cầu AI." : error.message;
    res.status(status).json({ success: false, data: null, message, error: { code: error.code || "AI_ERROR", message } });
});

module.exports = router;
module.exports.setDb = instance => {
    db = instance;
    studyContext.setDb(instance);
};
module.exports.generateProgressAdvice = generateProgressAdvice;
module.exports.analyzeDifficultNotes = analyzeDifficultNotes;
module.exports.validatePlanSessions = validatePlanSessions;
