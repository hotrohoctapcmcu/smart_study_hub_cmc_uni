'use strict';

const gemini = require('../utils/gemini-client');
const studyContext = require('./study-context.service');
const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { MAX_QUESTION_LENGTH } = require('../utils/trolyai-config');
const { requiredText, optionalText, validDate, validatePlanSessions, stringList, objectSchema } = require('../validators/trolyai.validator');
const { stringifyForAi, compactContext, contextOptions } = require('../utils/trolyai-context');
const { createTrolyaiScheduleService } = require('./trolyai-schedule.service');
const { generateProgressAdvice, analyzeDifficultNotes } = require('./trolyai-insights.service');
const { createSummaryService } = require('./ai-summary.service');
const { createPomodoroGoalService } = require('./pomodoro-goals.service');

function createTrolyaiService(options) {
    const schedule = createTrolyaiScheduleService(options);
    const summaries = createSummaryService();
    const pomodoroGoals = createPomodoroGoalService(options);

    async function check(body, options = {}) {
        const question = requiredText(body?.question, "question", MAX_QUESTION_LENGTH);
        const answer = requiredText(body?.answer, "answer", 8000);
        const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, contextOptions(body));
        const output = await gemini.generateJson([
            "Kiểm tra câu trả lời của người học. Nêu rõ phần đúng, phần cần sửa và lời giải thích.",
            "Nếu ngữ cảnh không đủ để xác minh chắc chắn thì verdict phải là unknown; không tự tạo đáp án từ dữ liệu cá nhân bị thiếu.",
            `Câu hỏi:\n${question}`,
            `Câu trả lời:\n${answer}`,
            `Ngữ cảnh học tập có sẵn:\n${stringifyForAi(compactContext(context))}`
        ].join("\n\n"), {
            signal: options.signal,
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
    }

    async function draftLeave(body, options = {}) {
        const date = validDate(body?.date, "date");
        const reason = requiredText(body?.reason, "reason", 1000);
        const session = optionalText(body?.session || body?.period, 120);
        const subject = optionalText(body?.subject, 120);
        const recipient = optionalText(body?.recipient, 180);
        // Chọn ngày trước khi giới hạn context, tránh bỏ sót lớp trong lịch sử dài.
        const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, {
            ...contextOptions(body), timetableDate: date,
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
        ].filter(Boolean).join("\n\n"), { maxOutputTokens: 1200, signal: options.signal });

        return { draft, matchedClasses: matchingClasses.length };
    }

    return { ...schedule, ...summaries, check, draftLeave, pomodoroGoals: pomodoroGoals.breakdown,
        status: () => gemini.getStatus(),
        ask: (body, requestOptions) => options.getHocTapAiService().ask(body, requestOptions),
        progressAdvice: async (body, requestOptions) => {
            if (!body?.progress || typeof body.progress !== 'object' || Array.isArray(body.progress)) return generateProgressAdvice(body?.progress, requestOptions);
            const context = await studyContext.buildStudyContext(NGUOI_DUNG_ID, { limits: { timetable: 0, studySchedules: 0, assignments: 0, exams: 0, grades: 0, documents: 0, notes: 0 } });
            const { academicHistory: ignoredClientHistory, ...metrics } = body.progress;
            return generateProgressAdvice(context.academicHistory.gradeCount ? { ...metrics, academicHistory: context.academicHistory } : metrics, requestOptions);
        },
        difficultNotes: (body, requestOptions) => analyzeDifficultNotes(NGUOI_DUNG_ID, { ...contextOptions(body), ...requestOptions })
    };
}

module.exports = { createTrolyaiService, generateProgressAdvice, analyzeDifficultNotes, validatePlanSessions };
