'use strict';

const gemini = require('../utils/gemini-client');
const studyContext = require('../utils/study-context');
const { loi } = require('../utils/error');
const { normalizeText, characterCount, sliceText, hasVisibleText } = require('../utils/ai-text');
const { MAX_TEXT_LENGTH, MAX_PLAN_DAYS, MAX_PLAN_SESSIONS, MIN_SESSION_MINUTES } = require('../utils/trolyai-config');
const { dateAt, addDays, minutes, overlaps } = require('../utils/trolyai-time');

function requiredText(value, field, maxLength = MAX_TEXT_LENGTH) {
    if (typeof value !== "string" || !value.trim()) {
        throw loi(`${field} là bắt buộc.`);
    }
    const text = normalizeText(value).trim();
    if (!hasVisibleText(text)) throw loi(`${field} là bắt buộc.`);
    if (characterCount(text) > maxLength) throw loi(`${field} tối đa ${maxLength} ký tự.`, 413);
    return text;
}

function optionalText(value, maxLength = 500) {
    if (typeof value !== "string" || !value.trim()) return null;
    return sliceText(normalizeText(value).trim(), maxLength);
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

function dateRange(startDate, endDate) {
    const days = Math.floor((dateAt(endDate) - dateAt(startDate)) / 86400000) + 1;
    if (days <= 0) throw loi("endDate không được trước startDate.");
    if (days > MAX_PLAN_DAYS) throw loi(`Khoảng lập kế hoạch tối đa ${MAX_PLAN_DAYS} ngày.`);
    return Array.from({ length: days }, (_, index) => addDays(startDate, index));
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
      if (typeof value === "string") return sliceText(normalizeText(value).trim(), 500);
    if (Array.isArray(value)) {
        return value.slice(0, 50).map(item => sanitizeProgress(item, depth + 1))
            .filter(item => item !== undefined);
    }
    if (typeof value === "object") {
        return Object.fromEntries(Object.entries(value).slice(0, 80)
            .map(([key, item]) => [sliceText(normalizeText(key), 80), sanitizeProgress(item, depth + 1)])
            .filter(([, item]) => item !== undefined));
    }
    return undefined;
}

function stringList(value, limit, maxLength) {
    return (Array.isArray(value) ? value : [])
        .filter(item => typeof item === "string" && item.trim())
          .map(item => sliceText(normalizeText(item).trim(), maxLength))
        .slice(0, limit);
}

function objectSchema(fields) {
    return value => !!value && typeof value === "object" && !Array.isArray(value)
        && Object.entries(fields).every(([key, type]) => type === "array"
            ? Array.isArray(value[key]) : typeof value[key] === type);
}

module.exports = { requiredText, optionalText, validDate, validTime, dateRange, sessionsFromAi, validatePlanSessions, sanitizeProgress, stringList, objectSchema };
