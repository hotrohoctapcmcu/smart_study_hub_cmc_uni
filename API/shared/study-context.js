"use strict";

const DEFAULT_LIMITS = Object.freeze({
    timetable: 40,
    studySchedules: 30,
    assignments: 30,
    exams: 20,
    grades: 30,
    documents: 15,
    notes: 20
});

let db;
const TIMEZONE = "Asia/Ho_Chi_Minh";
const OFFSET = "+07:00";
const MAX_CONTEXT_CHARS = 48000;

function localParts(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getTime() + 7 * 3600000).toISOString();
}

function setDb(instance) {
    db = instance;
}

function requireDb() {
    if (!db) {
        throw Object.assign(new Error("Database chưa sẵn sàng."), { statusCode: 503 });
    }
    return db;
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

async function loadOptionalTable(candidates, studentId) {
    const database = requireDb();
    if (typeof database.executeQuery !== "function") {
        return { available: false, rows: [], reason: "query-not-supported" };
    }

    const tables = await database.executeQuery("SELECT name FROM sqlite_master WHERE type = 'table'");
    const byLowerName = new Map((tables || []).map(item => [String(item.name).toLowerCase(), item.name]));
    const tableName = candidates.map(name => byLowerName.get(name.toLowerCase())).find(Boolean);
    if (!tableName) return { available: false, rows: [], reason: "table-not-found" };

    const columns = await database.executeQuery(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
    const names = new Set((columns || []).map(column => String(column.name)));
    const ownerColumn = ["student_id", "user_id", "owner_id"].find(name => names.has(name));
    if (!ownerColumn) {
        return { available: false, rows: [], reason: "owner-column-not-found", table: tableName };
    }

    const orderColumn = ["updated_at", "created_at", "uploaded_at", "id"]
        .find(name => names.has(name));
    const sql = [
        `SELECT * FROM ${quoteIdentifier(tableName)}`,
        `WHERE ${quoteIdentifier(ownerColumn)} = @studentId`,
        orderColumn ? `ORDER BY ${quoteIdentifier(orderColumn)} DESC` : ""
    ].filter(Boolean).join(" ");

    return {
        available: true,
        rows: await database.executeQuery(sql, { studentId: String(studentId) }),
        table: tableName
    };
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

/**
 * Gom dữ liệu học tập thật thành một cấu trúc nhỏ, ổn định để gửi cho AI.
 * Nguồn tùy chọn (Documents/Notes) không tồn tại sẽ được báo trong `sources`,
 * không tạo dữ liệu thay thế.
 */
async function buildStudyContext(studentId, options = {}) {
    const database = requireDb();
    if (studentId === null || studentId === undefined || studentId === "") {
        throw Object.assign(new Error("studentId là bắt buộc."), { statusCode: 400 });
    }

    const limits = Object.fromEntries(Object.entries(DEFAULT_LIMITS).map(([name, fallback]) => {
        const requested = options.limits?.[name] ?? fallback;
        return [name, Number.isInteger(requested) ? Math.max(0, Math.min(100, requested)) : fallback];
    }));
    const supplemental = options.studyData || {};
    for (const name of ["documents", "notes"]) {
        if (supplemental[name] !== undefined && (!Array.isArray(supplemental[name]) || supplemental[name].length > 500)) {
            throw Object.assign(new Error(`${name} phải là mảng tối đa 500 phần tử.`), { statusCode: 400 });
        }
        if (Array.isArray(supplemental[name]) && supplemental[name].some(row => !row || typeof row !== "object" || Array.isArray(row))) {
            throw Object.assign(new Error(`${name} chứa phần tử không hợp lệ.`), { statusCode: 400 });
        }
    }
    const profileRaw = typeof database.layHoSo === "function" ? await database.layHoSo(studentId) : null;
    const ownerId = profileRaw?.student_id ?? studentId;
    const calls = [
        database.layThoiKhoaBieu(studentId),
        typeof database.layLichTuHoc === "function" ? database.layLichTuHoc(studentId) : [],
        database.layDanhSachDeadline(studentId),
        database.layLichThi(studentId),
        database.layBangDiem(studentId),
        typeof database.layBaiTapEDUX === "function" ? database.layBaiTapEDUX(studentId) : [],
        Array.isArray(supplemental.documents)
            ? { available: true, rows: supplemental.documents, origin: "browser" }
            : loadOptionalTable(["Documents", "StudyDocuments", "EduxDocuments"], ownerId),
        Array.isArray(supplemental.notes)
            ? { available: true, rows: supplemental.notes, origin: "browser" }
            : loadOptionalTable(["Notes", "NotebookPages", "Notebooks"], ownerId)
    ];

    const [timetableRaw, studyRaw, assignmentsRaw, examsRaw, gradesRaw,
        eduxRaw, documentsRaw, notesRaw] = await Promise.all(calls);

    const timetableDate = options.timetableDate;
    const requestedDay = timetableDate ? new Date(`${timetableDate}T00:00:00Z`).getUTCDay() : null;
    const timetableAll = (timetableRaw || []).map(item => ({
        id: item.timetable_id,
        subjectId: item.subject_id,
        subjectCode: truncate(item.subject_code, 30),
        subject: truncate(item.subject_name, 120),
        className: truncate(item.class_name, 80),
        room: truncate(item.room, 60),
        campus: truncate(item.campus, 80),
        dayOfWeek: toNumber(item.day_of_week),
        startTime: normalizeTime(item.start_time),
        endTime: normalizeTime(item.end_time),
        startDate: normalizeDate(item.start_date),
        endDate: normalizeDate(item.end_date),
        lecturer: truncate(item.lecturer_name, 120)
    })).filter(item => !timetableDate || (item.startDate && item.endDate
        && item.startDate <= timetableDate && item.endDate >= timetableDate
        && item.dayOfWeek === (requestedDay === 0 ? 8 : requestedDay + 1)));

    const studyAll = (studyRaw || [])
        .filter(item => String(item.status).toUpperCase() !== "CANCELLED")
        .map(item => ({
            id: item.schedule_id,
            subjectId: item.subject_id,
            subject: truncate(item.subject_name, 120),
            title: truncate(item.title, 180),
            date: normalizeDate(item.study_date),
            startTime: normalizeTime(item.start_time),
            endTime: normalizeTime(item.end_time),
            status: truncate(item.status, 30)
        }));

    const localIncomplete = (assignmentsRaw || [])
        .filter(item => isIncompleteStatus(item.status))
        .map(item => ({
            id: item.assignment_id,
            subjectId: item.subject_id,
            subjectCode: truncate(item.subject_code, 30),
            subject: truncate(item.subject_name, 120),
            title: truncate(item.title, 180),
            description: truncate(item.description, 600),
            deadline: normalizeDateTime(item.deadline),
            status: truncate(item.status, 30),
            priority: truncate(item.priority, 20),
            source: truncate(item.source, 20) || "LOCAL"
        }));

    const eduxIncomplete = (eduxRaw || [])
        .filter(item => isIncompleteStatus(item.status))
        .map(item => ({
            id: truncate(item.id, 100),
            subjectId: truncate(item.subjectId, 80),
            subjectCode: null,
            subject: truncate(item.subject, 120),
            title: truncate(item.title, 180),
            description: truncate(item.description, 600),
            deadline: normalizeDateTime(item.due),
            status: truncate(item.status, 30),
            priority: truncate(item.priority, 20),
            source: "EDUX",
            progress: item.progress && typeof item.progress === "object" ? {
                completed: toNumber(item.progress.daHoc),
                total: toNumber(item.progress.tongSo)
            } : null
        }));

    const assignmentsAll = [...localIncomplete, ...eduxIncomplete]
        .sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));

    const examsAll = (examsRaw || []).map(item => ({
        id: item.exam_id,
        subjectId: item.subject_id,
        subjectCode: truncate(item.subject_code, 30),
        subject: truncate(item.subject_name, 120),
        name: truncate(item.exam_name, 160),
        date: normalizeDate(item.exam_date),
        time: normalizeTime(item.exam_time),
        durationMinutes: toNumber(item.duration_minutes),
        room: truncate(item.room, 60),
        campus: truncate(item.campus, 80),
        format: truncate(item.exam_format, 80),
        status: truncate(item.exam_status, 30)
    })).filter(exam => (!options.upcomingExamsOnly || (exam.date && exam.date >= normalizeDate(new Date())))
        && (options.examId == null || String(exam.id) === String(options.examId)));

    const gradesAll = (gradesRaw || []).map(item => ({
        id: item.grade_id,
        subjectId: item.subject_id,
        subjectCode: truncate(item.subject_code, 30),
        subject: truncate(item.subject_name, 120),
        semester: truncate(item.semester, 40),
        academicYear: truncate(item.academic_year, 30),
        attempt: toNumber(item.attempt_number),
        componentScore: toNumber(item.component_score),
        examScore: toNumber(item.exam_score),
        finalScore: toNumber(item.final_score),
        letterGrade: truncate(item.letter_grade, 5),
        passed: item.is_passed === null || item.is_passed === undefined
            ? null
            : toBoolean(item.is_passed)
    }));

    const documentsAll = (documentsRaw.rows || []).map(normalizeDocument);
    const notesAll = (notesRaw.rows || []).map(normalizeNote)
        .filter(note => !options.difficultOnly || note.isDifficult)
        .sort((a, b) => Number(b.isDifficult) - Number(a.isDifficult));

    const timetable = take(timetableAll, limits.timetable);
    const studySchedules = take(studyAll, limits.studySchedules);
    const assignments = take(assignmentsAll, limits.assignments);
    const exams = take(examsAll, limits.exams);
    const grades = take(gradesAll, limits.grades);
    const documents = take(documentsAll, limits.documents);
    const notes = take(notesAll, limits.notes);
    const profile = profileRaw && typeof profileRaw === "object" ? {
        studentCode: truncate(profileRaw.student_code, 40),
        fullName: truncate(profileRaw.full_name, 120),
        major: truncate(profileRaw.major, 120),
        currentSemester: truncate(profileRaw.current_semester, 40)
    } : null;

    const context = {
        studentId,
        generatedAt: new Date().toISOString(),
        timezone: TIMEZONE,
        profile,
        timetable,
        studySchedules,
        assignments,
        exams,
        grades,
        documents,
        notes,
        sources: {
            profile: { available: typeof database.layHoSo === "function", found: !!profileRaw },
            timetable: sourceInfo(timetableAll, timetable),
            studySchedules: sourceInfo(studyAll, studySchedules, typeof database.layLichTuHoc === "function"),
            assignments: sourceInfo(assignmentsAll, assignments),
            exams: sourceInfo(examsAll, exams),
            grades: sourceInfo(gradesAll, grades),
            documents: sourceInfo(documentsAll, documents, documentsRaw.available, {
                origin: documentsRaw.origin || "database",
                reason: documentsRaw.reason || null
            }),
            notes: sourceInfo(notesAll, notes, notesRaw.available, {
                origin: notesRaw.origin || "database",
                reason: notesRaw.reason || null
            })
        }
    };
    // Giới hạn tổng payload, đồng thời giữ JSON hợp lệ và báo rõ phần bị cắt.
    while (JSON.stringify(context).length > MAX_CONTEXT_CHARS) {
        const name = Object.keys(DEFAULT_LIMITS).filter(key => context[key].length)
            .sort((a, b) => JSON.stringify(context[b]).length - JSON.stringify(context[a]).length)[0];
        if (!name) break;
        context[name].pop();
        context.sources[name].included = context[name].length;
        context.sources[name].truncated = true;
    }
    return context;
}

module.exports = {
    setDb,
    buildStudyContext,
    normalizeDate,
    normalizeTime,
    normalizeDateTime,
    DEFAULT_LIMITS,
    TIMEZONE,
    OFFSET,
    MAX_CONTEXT_CHARS
};
