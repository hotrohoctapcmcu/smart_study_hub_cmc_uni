'use strict';

const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { taoLoi, parseNgay } = require('../validators/timemap.validator');
const { formatNgay, congNgay, localDateTimeToEpoch, formatUtc7, buildLocalBlock } = require('../utils/timemap-time');

const POMODORO_COLUMN_CANDIDATES = {
    id: ['pomodoro_id', 'session_id', 'id'],
    owner: ['student_id', 'user_id'],
    startTime: ['started_at', 'start_time', 'created_at'],
    endTime: ['ended_at', 'end_time', 'finished_at'],
    durationSeconds: ['actual_study_seconds', 'study_seconds', 'duration_seconds']
};


function ensureRows(rows, sourceName) {
    if (!Array.isArray(rows)) {
        throw taoLoi(`Nguồn dữ liệu ${sourceName} không trả về danh sách hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }
    return rows;
}

function quoteIdentifier(identifier) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
        throw taoLoi('Tên cột Pomodoros không hợp lệ.', 500, 'TIMEMAP_INVALID_POMODORO_SCHEMA');
    }
    return `"${identifier}"`;
}

function findColumn(columns, candidates) {
    const byLowerCase = new Map(columns.map(column => [String(column.name).toLowerCase(), column.name]));
    for (const candidate of candidates) {
        const column = byLowerCase.get(candidate.toLowerCase());
        if (column) return column;
    }
    return null;
}

function parsePomodoroTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return NaN;

    const timestamp = value.trim();
    // SQLite datetime('now') lưu UTC nhưng không gắn hậu tố múi giờ.
    const sqliteUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(timestamp);
    const normalized = sqliteUtc ? `${sqliteUtc[1]}T${sqliteUtc[2]}Z` : timestamp;

    // Timestamp khác phải nêu rõ Z hoặc offset để không phụ thuộc múi giờ máy chạy API.
    if (!sqliteUtc && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) return NaN;
    return Date.parse(normalized);
}

function createPomodoroBlock(row, columns, index, range) {
    const idColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.id);
    const startColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.startTime);
    const endColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.endTime);
    const durationColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.durationSeconds);
    const rawStart = row[startColumn];
    const startEpoch = parsePomodoroTimestamp(rawStart);

    if (!Number.isFinite(startEpoch)) {
        throw taoLoi(`Bản ghi Pomodoro ${index + 1} có thời điểm bắt đầu không hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    let endEpoch;
    if (endColumn && row[endColumn] !== null && row[endColumn] !== undefined) {
        endEpoch = parsePomodoroTimestamp(String(row[endColumn]));
    } else if (durationColumn && Number.isFinite(Number(row[durationColumn]))) {
        endEpoch = startEpoch + Number(row[durationColumn]) * 1000;
    }

    if (!Number.isFinite(endEpoch) || endEpoch <= startEpoch) {
        throw taoLoi(`Bản ghi Pomodoro ${index + 1} có thời lượng không hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    if (endEpoch <= range.startEpoch || startEpoch >= range.endExclusiveEpoch) return null;

    const id = idColumn && row[idColumn] !== null && row[idColumn] !== undefined
        ? row[idColumn]
        : `${rawStart}-${index + 1}`;

    return {
        id: `pomodoro:${id}`,
        type: 'pomodoro',
        startTime: formatUtc7(startEpoch),
        endTime: formatUtc7(endEpoch),
        title: 'Pomodoro',
        isRequired: false
    };
}

async function fetchPomodoroRows(db, userId, studentId) {
    const sessions = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = @tableName LIMIT 1",
        { tableName: 'PomodoroSessions' }
    );
    if (sessions.length) {
        const rows = await db.executeQuery(`
            SELECT session_id, started_at, focus_segments,
                   COALESCE(actual_study_seconds, total_focus_minutes * 60) AS actual_study_seconds
            FROM PomodoroSessions
            WHERE student_id = @studentId
              AND status IN ('COMPLETED', 'CANCELLED')
              AND COALESCE(actual_study_seconds, total_focus_minutes * 60) > 0
        `, { studentId });
        return {
            available: true, rows: rows.flatMap(row => {
                const { sessionSegments } = require('../utils/study-time');
                return sessionSegments(row).map(([start, end], index) => ({
                    session_id: `${row.session_id}:${index}`, started_at: new Date(start).toISOString(),
                    actual_study_seconds: (end - start) / 1000
                }));
            }),
            columns: ['session_id', 'started_at', 'actual_study_seconds'].map(name => ({ name })),
            warning: null
        };
    }
    const tableRows = await db.executeQuery(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(@tableName) LIMIT 1`,
        { tableName: 'Pomodoros' }
    );

    if (!tableRows.length) {
        return {
            available: false,
            rows: [],
            columns: [],
            warning: 'Lịch sử Pomodoro chưa được lưu trong database; Time Map hiện chưa bao gồm các phiên Pomodoro.'
        };
    }

    const tableName = tableRows[0].name;
    const columns = await db.executeQuery(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
    const ownerColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.owner);
    const startColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.startTime);
    const endColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.endTime);
    const durationColumn = findColumn(columns, POMODORO_COLUMN_CANDIDATES.durationSeconds);

    if (!ownerColumn || !startColumn || (!endColumn && !durationColumn)) {
        return {
            available: false,
            rows: [],
            columns,
            warning: 'Schema Pomodoros chưa có đủ cột chủ sở hữu, thời điểm bắt đầu và thời điểm kết thúc hoặc thời lượng.'
        };
    }

    const ownerId = ownerColumn.toLowerCase() === 'user_id' ? userId : studentId;
    const sql = `SELECT * FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(ownerColumn)} = @ownerId`;
    return {
        available: true,
        rows: await db.executeQuery(sql, { ownerId }),
        columns,
        warning: null
    };
}

function normalizeTimetables(rows, from, to) {
    const blocks = [];

    for (const row of ensureRows(rows, 'Timetables')) {
        const activeFrom = parseNgay(String(row.start_date || '').slice(0, 10), 'Timetables.start_date').epoch;
        const activeTo = parseNgay(String(row.end_date || '').slice(0, 10), 'Timetables.end_date').epoch;
        const firstDate = Math.max(from.epoch, activeFrom);
        const lastDate = Math.min(to.epoch, activeTo);

        for (let dateEpoch = firstDate; dateEpoch <= lastDate; dateEpoch += 24 * 60 * 60 * 1000) {
            const date = formatNgay(dateEpoch);
            const jsWeekday = new Date(dateEpoch).getUTCDay();
            const databaseWeekday = jsWeekday === 0 ? 8 : jsWeekday + 1;
            if (Number(row.day_of_week) !== databaseWeekday) continue;

            blocks.push(buildLocalBlock({
                id: `class:${row.timetable_id}:${date}`,
                type: 'class',
                date,
                start: row.start_time,
                end: row.end_time,
                title: row.subject_name || row.class_name || 'Lớp học',
                isRequired: true
            }));
        }
    }

    return blocks;
}

function normalizeExams(rows) {
    return ensureRows(rows, 'Exams').map(row => {
        const durationMinutes = Number(row.duration_minutes);
        if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
            throw taoLoi(`Kỳ thi ${row.exam_id} có duration_minutes không hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
        }

        const startEpoch = localDateTimeToEpoch(row.exam_date, row.exam_time);
        const endEpoch = startEpoch + durationMinutes * 60 * 1000;
        return {
            id: `exam:${row.exam_id}`,
            type: 'exam',
            startTime: formatUtc7(startEpoch),
            endTime: formatUtc7(endEpoch),
            title: row.exam_name || row.subject_name || 'Kỳ thi',
            isRequired: true
        };
    });
}

function normalizeStudySchedules(rows) {
    return ensureRows(rows, 'StudySchedules')
        .filter(row => String(row.status || '').toUpperCase() !== 'CANCELLED')
        .map(row => buildLocalBlock({
            id: `self-study:${row.schedule_id}`,
            type: 'self-study',
            date: String(row.study_date || '').slice(0, 10),
            start: row.start_time,
            end: row.end_time,
            title: row.title || 'Tự học',
            isRequired: false
        }));
}

async function fetchAndNormalizeTimeBlocks({ db, userId = NGUOI_DUNG_ID, from: fromValue, to: toValue } = {}) {
    const from = parseNgay(fromValue, 'from');
    const to = parseNgay(toValue, 'to');

    if (from.epoch > to.epoch) {
        throw taoLoi('from phải nhỏ hơn hoặc bằng to.');
    }
    if (!db || typeof db.executeQuery !== 'function' || typeof db.layHoSo !== 'function') {
        throw taoLoi('Database chưa được khởi tạo đầy đủ.', 503, 'TIMEMAP_DATABASE_UNAVAILABLE');
    }

    const profile = await db.layHoSo(userId);
    if (!profile || !profile.student_id) {
        throw taoLoi('Không tìm thấy hồ sơ sinh viên để tạo Time Map.', 404, 'TIMEMAP_STUDENT_NOT_FOUND');
    }

    const studentId = profile.student_id;
    const params = { studentId, from: from.value, to: to.value };
    const [timetables, exams, studySchedules, pomodoroResult] = await Promise.all([
        db.executeQuery(`
            SELECT t.timetable_id, t.student_id, t.class_name, t.day_of_week,
                   t.start_time, t.end_time, t.start_date, t.end_date,
                   sub.subject_name
            FROM Timetables t
            LEFT JOIN Subjects sub ON sub.subject_id = t.subject_id
            WHERE t.student_id = @studentId
              AND date(t.start_date) <= date(@to)
              AND date(t.end_date) >= date(@from)
        `, params),
        db.executeQuery(`
            SELECT e.exam_id, e.exam_date, e.exam_time, e.duration_minutes,
                   e.exam_name, sub.subject_name
            FROM Exams e
            LEFT JOIN Subjects sub ON sub.subject_id = e.subject_id
            WHERE e.student_id = @studentId
              AND date(e.exam_date) >= date(@from)
              AND date(e.exam_date) <= date(@to)
        `, params),
        db.executeQuery(`
            SELECT schedule_id, student_id, title, study_date,
                   start_time, end_time, status
            FROM StudySchedules
            WHERE student_id = @studentId
              AND date(study_date) >= date(@from)
              AND date(study_date) <= date(@to)
              AND upper(status) != 'CANCELLED'
        `, params),
        fetchPomodoroRows(db, userId, studentId)
    ]);

    const range = {
        startEpoch: localDateTimeToEpoch(from.value, '00:00:00'),
        endExclusiveEpoch: localDateTimeToEpoch(congNgay(to.value, 1), '00:00:00')
    };
    const pomodoros = ensureRows(pomodoroResult.rows, 'Pomodoros')
        .map((row, index) => createPomodoroBlock(row, pomodoroResult.columns, index, range))
        .filter(Boolean);

    const timeBlocks = [
        ...normalizeTimetables(timetables, from, to),
        ...normalizeExams(exams),
        ...normalizeStudySchedules(studySchedules),
        ...pomodoros
    ].sort((left, right) => Date.parse(left.startTime) - Date.parse(right.startTime));

    return {
        timeBlocks,
        sources: {
            timetables: { available: true },
            exams: { available: true },
            studySchedules: { available: true },
            pomodoros: { available: pomodoroResult.available }
        },
        warnings: pomodoroResult.warning ? [pomodoroResult.warning] : []
    };
}

module.exports = { fetchAndNormalizeTimeBlocks };
