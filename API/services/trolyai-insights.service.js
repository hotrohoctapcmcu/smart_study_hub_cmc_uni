'use strict';

const gemini = require('../utils/gemini-client');
const studyContext = require('./study-context.service');
const { loi } = require('../utils/error');
const MAX_PROGRESS_LENGTH = 30000;
const { optionalText, sanitizeProgress, stringList, objectSchema } = require('../validators/trolyai.validator');
const { stringifyForAi, progressAvailability } = require('../utils/trolyai-context');

async function generateProgressAdvice(progress, options = {}) {
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
        throw loi("progress phải là một object.");
    }

    const cleanProgress = sanitizeProgress(progress);
    const serialized = JSON.stringify(cleanProgress);
    if (serialized.length > MAX_PROGRESS_LENGTH) throw loi(`progress tối đa ${MAX_PROGRESS_LENGTH} ký tự JSON.`, 413);

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
        'Đối chiếu academicHistory.semesters, comparison và retakes khi có: nêu kỳ cũ/kỳ mới và phạm vi dữ liệu. Phân biệt điểm hệ 10/hệ 4, trung bình/tích lũy. Không suy diễn năng lực chỉ từ một môn hay dự đoán điểm chưa có.',
        `Dữ liệu tiến độ:\n${stringifyForAi(cleanProgress)}`
    ].join("\n\n"), {
        signal: options.signal,
        validate: objectSchema({ overview: "string", comments: "array", revisionSuggestions: "array" }),
        schemaDescription: stringifyForAi({
            overview: "string",
            comments: ["string"],
            revisionSuggestions: ["string"]
        })
    });

    const numbers = new Set((serialized.match(/\d+(?:[.,]\d+)?/g) || []).map(number => number.replace(',', '.')));
    const supported = text => (text.match(/\d+(?:[.,]\d+)?/g) || []).every(number => numbers.has(number.replace(',', '.')));
    const overview = optionalText(output?.overview, 1000);
    return {
        overview: overview && supported(overview) ? overview : "Hãy xem lại dữ liệu tiến độ đã ghi nhận và ưu tiên các nội dung còn chưa hoàn thành.",
        comments: stringList(output?.comments, 8, 500).filter(supported),
        revisionSuggestions: stringList(output?.revisionSuggestions, 8, 500).filter(supported),
        unavailableMetrics: availability.unavailableMetrics,
        basedOnFields: availability.presentFields
    };
}

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
        signal: options.signal,
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

module.exports = { generateProgressAdvice, analyzeDifficultNotes };
