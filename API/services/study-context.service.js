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

const { truncate, normalizeDate, normalizeTime, normalizeDateTime, toNumber, toBoolean, take, sourceInfo, normalizeNote, normalizeDocument, isIncompleteStatus } = require("../utils/study-context");
const { loadOptionalTable } = require("./study-sources.service");

function setDb(instance) {
    db = instance;
}

function requireDb() {
    if (!db) {
        throw Object.assign(new Error("Database chưa sẵn sàng."), { statusCode: 503 });
    }
    return db;
}

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
            : loadOptionalTable(database, ["Documents", "StudyDocuments", "EduxDocuments"], ownerId),
        Array.isArray(supplemental.notes)
            ? { available: true, rows: supplemental.notes, origin: "browser" }
            : loadOptionalTable(database, ["Notes", "NotebookPages", "Notebooks"], ownerId)
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
