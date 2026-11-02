"use strict";

const OFFSET = "+07:00";

function localParts(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getTime() + 7 * 3600000).toISOString();
}

function truncate(value, maxLength = 500) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeDate(value) {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return localParts(value).slice(0, 10);
    }

    const text = String(value).trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
    if (match) {
        if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
        const date = new Date(`${match[1]}T00:00:00Z`);
        if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1]) {
            if (match[5]) {
                return localParts(text)?.slice(0, 10) || null;
            }
            return match[1];
        }
    }
    return null;
}

function normalizeTime(value) {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return localParts(value).slice(11, 16);
    }
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}[T\s].*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
        return normalizeDate(text) ? localParts(text)?.slice(11, 16) || null : null;
    }
    const match = text.match(/^(?:\d{4}-\d{2}-\d{2}[T\s])?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59 || Number(match[3]) > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeDateTime(value) {
    const date = normalizeDate(value);
    if (!date) return null;
    const time = normalizeTime(value);
    return time ? `${date}T${time}:00${OFFSET}` : date;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function toBoolean(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value === null || value === undefined) return false;
    return ["true", "yes", "1", "difficult", "hard", "khó", "can_review", "needs_review"]
        .includes(String(value).trim().toLowerCase());
}

function take(items, limit) {
    return (Array.isArray(items) ? items : []).slice(0, limit);
}

function sourceInfo(items, included, available = true, extra = {}) {
    return {
        available,
        total: Array.isArray(items) ? items.length : 0,
        included: included.length,
        truncated: Array.isArray(items) && items.length > included.length,
        ...extra
    };
}

function normalizeTags(value) {
    if (Array.isArray(value)) return value.map(tag => truncate(tag, 60)).filter(Boolean).slice(0, 10);
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return normalizeTags(parsed);
    } catch { /* tags có thể là chuỗi phân cách bằng dấu phẩy */ }
    return String(value).split(",").map(tag => truncate(tag, 60)).filter(Boolean).slice(0, 10);
}

function valueFrom(row, names) {
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    }
    return null;
}

function quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeNote(row) {
    const tags = normalizeTags(valueFrom(row, ["tags", "tag_list", "labels"]));
    const difficultValue = valueFrom(row, ["isDifficult", "is_hard", "is_difficult", "difficult", "needs_review", "review_required", "difficulty"]);
    const difficultTags = new Set(["difficult", "hard", "khó", "khó hiểu", "cần ôn", "needs review"]);

    return {
        id: truncate(valueFrom(row, ["note_id", "page_id", "id"]), 80),
        title: truncate(valueFrom(row, ["title", "name"]), 180),
        subject: truncate(valueFrom(row, ["subject_name", "subject", "course_name"]), 120),
        tags,
        content: truncate(valueFrom(row, ["content", "body", "text", "note_text"]), 1200),
        isDifficult: toBoolean(difficultValue)
            || tags.some(tag => difficultTags.has(String(tag).toLowerCase())),
        updatedAt: normalizeDateTime(valueFrom(row, ["updatedAt", "updated_at", "created_at"]))
    };
}

function normalizeDocument(row) {
    return {
        id: truncate(valueFrom(row, ["document_id", "file_id", "id"]), 80),
        title: truncate(valueFrom(row, ["title", "name", "file_name"]), 180),
        subject: truncate(valueFrom(row, ["subject_name", "subject", "course_name"]), 120),
        category: truncate(valueFrom(row, ["category", "document_type", "file_type"]), 80),
        text: truncate(valueFrom(row, ["extracted_text", "content", "summary", "description"]), 1000),
        updatedAt: normalizeDateTime(valueFrom(row, ["updatedAt", "uploadedAt", "updated_at", "uploaded_at", "created_at"]))
    };
}

function isIncompleteStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    return !["completed", "done", "submitted", "hoàn thành", "đã hoàn thành", "đã làm"].includes(status);
}


module.exports = { localParts, truncate, normalizeDate, normalizeTime, normalizeDateTime, toNumber, toBoolean, take, sourceInfo, normalizeTags, valueFrom, quoteIdentifier, normalizeNote, normalizeDocument, isIncompleteStatus, OFFSET };
