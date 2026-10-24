'use strict';

const { NGUOI_DUNG_ID } = require('../shared/nguoiDung');

const UTC7_OFFSET_MINUTES = 7 * 60;
const UTC7_OFFSET_MS = UTC7_OFFSET_MINUTES * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const BLOCK_PRIORITY = {
    exam: 4,
    class: 3,
    pomodoro: 2,
    'self-study': 1,
    'free-time': 0
};

const POMODORO_COLUMN_CANDIDATES = {
    id: ['pomodoro_id', 'session_id', 'id'],
    owner: ['student_id', 'user_id'],
    startTime: ['started_at', 'start_time', 'created_at'],
    endTime: ['ended_at', 'end_time', 'finished_at'],
    durationSeconds: ['actual_study_seconds', 'study_seconds', 'duration_seconds']
};

function taoLoi(message, statusCode = 400, code = 'TIMEMAP_INVALID_INPUT') {
    return Object.assign(new Error(message), { statusCode, code });
}

function parseNgay(value, tenThamSo) {
    if (typeof value !== 'string') {
        throw taoLoi(`${tenThamSo} phải có định dạng YYYY-MM-DD.`);
    }

    const match = DATE_ONLY_PATTERN.exec(value);
    if (!match) {
        throw taoLoi(`${tenThamSo} phải có định dạng YYYY-MM-DD.`);
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);

    if (
        year < 1000 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw taoLoi(`${tenThamSo} không phải ngày hợp lệ.`);
    }

    return { value, epoch: date.getTime() };
}

function formatNgay(epoch) {
    const date = new Date(epoch);
    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function congNgay(ngay, soNgay) {
    const parsed = parseNgay(ngay, 'ngày');
    return formatNgay(parsed.epoch + soNgay * 24 * 60 * 60 * 1000);
}

function parseGio(value, label) {
    const match = TIME_PATTERN.exec(String(value || ''));
    if (!match) {
        throw taoLoi(`${label} phải có định dạng HH:mm hoặc HH:mm:ss.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    if (hour > 23 || minute > 59 || second > 59) {
        throw taoLoi(`${label} không phải giờ hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    return {
        hour,
        minute,
        second,
        text: `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`
    };
}

function localDateTimeToEpoch(ngay, gio) {
    const parsedDate = parseNgay(ngay, 'ngày dữ liệu');
    const parsedTime = parseGio(gio, 'Giờ dữ liệu');
    return parsedDate.epoch +
        ((parsedTime.hour * 60 + parsedTime.minute - UTC7_OFFSET_MINUTES) * 60 + parsedTime.second) * 1000;
}

function formatUtc7(epoch) {
    const local = new Date(epoch + UTC7_OFFSET_MS);
    const ngay = formatNgay(local.getTime());
    const gio = [
        String(local.getUTCHours()).padStart(2, '0'),
        String(local.getUTCMinutes()).padStart(2, '0'),
        String(local.getUTCSeconds()).padStart(2, '0')
    ].join(':');
    const milliseconds = local.getUTCMilliseconds();
    const fraction = milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : '';
    return `${ngay}T${gio}${fraction}+07:00`;
}

function buildLocalBlock({ id, type, date, start, end, title, isRequired }) {
    const startTime = localDateTimeToEpoch(date, start);
    const endTime = localDateTimeToEpoch(date, end);

    if (endTime <= startTime) {
        throw taoLoi(`Khoảng thời gian của ${id} không hợp lệ.`, 500, 'TIMEMAP_INVALID_SOURCE_DATA');
    }

    return {
        id: String(id),
        type,
        startTime: formatUtc7(startTime),
        endTime: formatUtc7(endTime),
        title: String(title || type),
        isRequired: Boolean(isRequired)
    };
}

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

function parseTimeBlock(block, index) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
        throw taoLoi(`timeBlocks[${index}] phải là object.`, 400, 'TIMEMAP_INVALID_BLOCK');
    }

    if (!Object.prototype.hasOwnProperty.call(BLOCK_PRIORITY, block.type)) {
        throw taoLoi(`timeBlocks[${index}] có type không được hỗ trợ.`, 400, 'TIMEMAP_INVALID_BLOCK');
    }

    if (block.id === undefined || block.id === null || String(block.id).trim() === '') {
        throw taoLoi(`timeBlocks[${index}].id là bắt buộc.`, 400, 'TIMEMAP_INVALID_BLOCK');
    }
    if (typeof block.title !== 'string' || typeof block.isRequired !== 'boolean') {
        throw taoLoi(
            `timeBlocks[${index}] phải có title dạng chuỗi và isRequired dạng boolean.`,
            400,
            'TIMEMAP_INVALID_BLOCK'
        );
    }

    const timezoneSpecified = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
    if (!timezoneSpecified(block.startTime) || !timezoneSpecified(block.endTime)) {
        throw taoLoi(
            `timeBlocks[${index}] phải có startTime/endTime kèm múi giờ.`,
            400,
            'TIMEMAP_INVALID_BLOCK'
        );
    }

    const startEpoch = Date.parse(block.startTime);
    const endEpoch = Date.parse(block.endTime);
    if (!Number.isFinite(startEpoch) || !Number.isFinite(endEpoch) || endEpoch <= startEpoch) {
        throw taoLoi(
            `timeBlocks[${index}] có khoảng thời gian không hợp lệ.`,
            400,
            'TIMEMAP_INVALID_BLOCK'
        );
    }

    return {
        block,
        id: String(block.id),
        priority: BLOCK_PRIORITY[block.type],
        startEpoch,
        endEpoch
    };
}

function subtractInterval(intervals, occupiedStart, occupiedEnd) {
    const remaining = [];

    for (const interval of intervals) {
        if (occupiedEnd <= interval.start || occupiedStart >= interval.end) {
            remaining.push(interval);
            continue;
        }

        if (occupiedStart > interval.start) {
            remaining.push({ start: interval.start, end: occupiedStart });
        }
        if (occupiedEnd < interval.end) {
            remaining.push({ start: occupiedEnd, end: interval.end });
        }
    }

    return remaining;
}

/**
 * Loại bỏ các khoảng giao nhau theo ưu tiên Exam > Class > Pomodoro > Self-study.
 * Khi một block bị chia thành nhiều đoạn, các đoạn nhận ID riêng dạng :part-N.
 * Hàm không thay đổi mảng hoặc các object đầu vào.
 *
 * @param {Array<{id: string|number, type: string, startTime: string, endTime: string}>} timeBlocks
 * @returns {Array<object>}
 */
function mergeOverlappingBlocks(timeBlocks) {
    // Nhận được cả mảng cũ lẫn kết quả giàu metadata của Giai đoạn 1.
    const blocks = Array.isArray(timeBlocks) ? timeBlocks : timeBlocks?.timeBlocks;
    if (!Array.isArray(blocks)) {
        throw taoLoi('timeBlocks phải là một mảng hoặc kết quả từ fetchAndNormalizeTimeBlocks.', 400, 'TIMEMAP_INVALID_BLOCKS');
    }

    const parsedBlocks = blocks.map(parseTimeBlock);
    const sortedByPriority = [...parsedBlocks].sort((left, right) =>
        right.priority - left.priority ||
        left.startEpoch - right.startEpoch ||
        right.endEpoch - left.endEpoch ||
        left.id.localeCompare(right.id)
    );

    const accepted = [];
    for (const candidate of sortedByPriority) {
        let remaining = [{ start: candidate.startEpoch, end: candidate.endEpoch }];

        for (const kept of accepted) {
            remaining = subtractInterval(remaining, kept.startEpoch, kept.endEpoch);
            if (remaining.length === 0) break;
        }

        remaining.forEach((interval, index) => {
            accepted.push({
                ...candidate,
                startEpoch: interval.start,
                endEpoch: interval.end,
                partIndex: index + 1,
                partCount: remaining.length
            });
        });
    }

    return accepted
        .sort((left, right) =>
            left.startEpoch - right.startEpoch ||
            left.endEpoch - right.endEpoch ||
            right.priority - left.priority ||
            left.id.localeCompare(right.id)
        )
        .map(item => ({
            ...item.block,
            id: item.partCount > 1 ? `${item.id}:part-${item.partIndex}` : item.id,
            startTime: formatUtc7(item.startEpoch),
            endTime: formatUtc7(item.endEpoch)
        }));
}

/**
 * Bổ sung các khoảng trống trong từng ngày theo giờ Việt Nam (UTC+7).
 * Khoảng ngày là inclusive; mốc 00:00 ngày kế tiếp được dùng làm ranh giới
 * kết thúc loại trừ để bao trọn ngày hiện tại.
 *
 * @param {Array<object>} mergedBlocks Các block đã được xử lý overlap.
 * @param {string} fromDate Ngày bắt đầu, YYYY-MM-DD.
 * @param {string} toDate Ngày kết thúc, YYYY-MM-DD.
 * @returns {Array<object>} Danh sách block bận và free-time theo timeline.
 */
function calculateFreeSlots(mergedBlocks, fromDate, toDate) {
    if (!Array.isArray(mergedBlocks)) {
        throw taoLoi('mergedBlocks phải là một mảng.', 400, 'TIMEMAP_INVALID_BLOCKS');
    }

    const from = parseNgay(fromDate, 'fromDate');
    const to = parseNgay(toDate, 'toDate');
    if (from.epoch > to.epoch) {
        throw taoLoi('fromDate phải nhỏ hơn hoặc bằng toDate.');
    }

    const busyBlocks = mergedBlocks.map(parseTimeBlock);
    const result = [...mergedBlocks];

    for (let dayEpoch = from.epoch; dayEpoch <= to.epoch; dayEpoch += 24 * 60 * 60 * 1000) {
        const date = formatNgay(dayEpoch);
        const dayStart = localDateTimeToEpoch(date, '00:00:00');
        const dayEnd = localDateTimeToEpoch(congNgay(date, 1), '00:00:00');
        const intervals = busyBlocks
            .filter(block => block.startEpoch < dayEnd && block.endEpoch > dayStart)
            .map(block => ({
                start: Math.max(block.startEpoch, dayStart),
                end: Math.min(block.endEpoch, dayEnd)
            }))
            .sort((left, right) => left.start - right.start || left.end - right.end);

        let cursor = dayStart;
        for (const interval of intervals) {
            if (interval.start > cursor) {
                result.push({
                    id: `free-time:${date}:${cursor}`,
                    type: 'free-time',
                    startTime: formatUtc7(cursor),
                    endTime: formatUtc7(interval.start),
                    title: 'Thời gian trống',
                    isRequired: false
                });
            }
            cursor = Math.max(cursor, interval.end);
        }

        if (cursor < dayEnd) {
            result.push({
                id: `free-time:${date}:${cursor}`,
                type: 'free-time',
                startTime: formatUtc7(cursor),
                endTime: formatUtc7(dayEnd),
                title: 'Thời gian trống',
                isRequired: false
            });
        }
    }

    return result.sort((left, right) =>
        Date.parse(left.startTime) - Date.parse(right.startTime) ||
        Date.parse(left.endTime) - Date.parse(right.endTime) ||
        left.id.localeCompare(right.id)
    );
}

/**
 * Đọc và chuẩn hóa các khoảng thời gian trong khoảng ngày theo lịch Việt Nam.
 * Các mốc từ database có ngày/giờ địa phương được xuất thành ISO-8601 kèm +07:00.
 *
 * @param {{ db: object, userId?: string|number, from: string, to: string }} options
 * @returns {Promise<{timeBlocks: Array<{id: string, type: string, startTime: string, endTime: string, title: string, isRequired: boolean}>, sources: object, warnings: string[]}>}
 */
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

module.exports = {
    fetchAndNormalizeTimeBlocks,
    mergeOverlappingBlocks,
    calculateFreeSlots
};
