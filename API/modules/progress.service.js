'use strict';

const gemini = require('../shared/gemini-client');

const AI_TIMEOUT_MS = 10_000;
const AI_FALLBACK_ADVICE = 'Hiện chưa thể tạo nhận xét học tập tự động. Vui lòng xem các chỉ số tiến độ để chọn nội dung cần ưu tiên ôn tập.';

/**
 * Dịch vụ truy vấn và tổng hợp các chỉ số tiến độ học tập từ SQLite.
 * Database được truyền từ API module registry theo cơ chế setDb hiện có.
 */
function createProgressService({ getDb }) {
    async function getStudentContext(studentId) {
        if (!studentId) {
            throw Object.assign(new Error('studentId là bắt buộc.'), { statusCode: 400 });
        }

        const db = getDb();
        if (!db || typeof db.layHoSo !== 'function' || typeof db.executeQuery !== 'function') {
            throw Object.assign(new Error('Cơ sở dữ liệu hiện chưa sẵn sàng.'), { statusCode: 503 });
        }

        const profile = await db.layHoSo(studentId);
        if (!profile) {
            throw Object.assign(new Error('Không tìm thấy hồ sơ sinh viên.'), { statusCode: 404 });
        }

        return { db, profile };
    }

    async function getTaskMetrics(studentId) {
        const { db, profile } = await getStudentContext(studentId);
        const now = new Date();
        const today = getVnDateString(now);
        const nowUtc = now.toISOString();

        const rows = await db.executeQuery(`
            SELECT
                s.subject_id AS subjectId,
                s.subject_code AS subjectCode,
                s.subject_name AS subjectName,
                COUNT(a.assignment_id) AS totalAssignments,
                COALESCE(SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END), 0)
                    AS completedAssignments,
                COALESCE(SUM(CASE
                    WHEN a.assignment_id IS NOT NULL
                     AND a.status <> 'COMPLETED'
                     AND (
                        a.status = 'OVERDUE'
                        OR (length(a.deadline) <= 10 AND date(a.deadline) < date(@today))
                        OR (length(a.deadline) > 10
                            AND datetime(a.deadline) < datetime(@nowUtc))
                     )
                    THEN 1 ELSE 0
                END), 0) AS overdueAssignments
            FROM Subjects s
            LEFT JOIN Assignments a
                ON a.subject_id = s.subject_id
               AND a.student_id = @studentId
            WHERE EXISTS (
                    SELECT 1
                    FROM StudentSubjects enrolled_subject
                    WHERE enrolled_subject.subject_id = s.subject_id
                      AND enrolled_subject.student_id = @studentId
                      AND enrolled_subject.status <> 'DROPPED'
               ) OR EXISTS (
                    SELECT 1
                    FROM Assignments owned_assignment
                    WHERE owned_assignment.subject_id = s.subject_id
                      AND owned_assignment.student_id = @studentId
               )
            GROUP BY s.subject_id, s.subject_code, s.subject_name
            ORDER BY s.subject_name COLLATE NOCASE ASC
        `, { studentId: profile.student_id, today, nowUtc });

        const subjects = rows.map(row => {
            const totalAssignments = Number(row.totalAssignments) || 0;
            const completedAssignments = Number(row.completedAssignments) || 0;

            return {
                subjectId: row.subjectId,
                subjectCode: row.subjectCode,
                subjectName: row.subjectName,
                totalAssignments,
                completedAssignments,
                completionRate: totalAssignments === 0
                    ? 0
                    : Math.round((completedAssignments / totalAssignments) * 10000) / 100
            };
        });

        return {
            overdueCount: rows.reduce(
                (total, row) => total + (Number(row.overdueAssignments) || 0),
                0
            ),
            subjects
        };
    }

    async function getWeeklyStudyHours(studentId) {
        const { db, profile } = await getStudentContext(studentId);
        const week = getCurrentVnWeek();

        const scheduleRows = await db.executeQuery(`
            SELECT COALESCE(SUM(duration_minutes), 0) AS totalMinutes
            FROM StudySchedules
            WHERE student_id = @studentId
              AND status = 'COMPLETED'
              AND study_date >= @weekStart
              AND study_date < @weekEnd
        `, {
            studentId: profile.student_id,
            weekStart: week.startDate,
            weekEnd: week.endDate
        });
        const selfStudyMinutes = Number(scheduleRows[0]?.totalMinutes) || 0;
        const pomodoro = await getPomodoroMinutes(db, studentId, profile.student_id, week);

        return {
            totalHours: roundHours((selfStudyMinutes + pomodoro.minutes) / 60),
            selfStudyHours: roundHours(selfStudyMinutes / 60),
            pomodoroHours: roundHours(pomodoro.minutes / 60),
            weekStart: week.startDate,
            weekEnd: week.endDate,
            sources: {
                selfStudyAvailable: true,
                pomodoroAvailable: pomodoro.available
            },
            warnings: pomodoro.warning ? [pomodoro.warning] : []
        };
    }

    async function getGPA(studentId) {
        const { db, profile } = await getStudentContext(studentId);
        const rows = await db.executeQuery(`
            SELECT
                g.semester,
                g.academic_year AS academicYear,
                ROUND(SUM(g.final_score * g.credits) / NULLIF(SUM(g.credits), 0), 2) AS gpa10,
                ROUND(SUM((CASE g.letter_grade
                    WHEN 'A+' THEN 4.0
                    WHEN 'A' THEN 3.8
                    WHEN 'B+' THEN 3.5
                    WHEN 'B' THEN 3.0
                    WHEN 'C+' THEN 2.5
                    WHEN 'C' THEN 2.0
                    WHEN 'D+' THEN 1.5
                    WHEN 'D' THEN 1.0
                    ELSE 0.0
                END) * g.credits) / NULLIF(SUM(g.credits), 0), 2) AS gpa4,
                SUM(g.credits) AS credits,
                COUNT(*) AS subjectCount
            FROM Grades g
            WHERE g.student_id = @studentId
              AND g.attempt_number = (
                    SELECT MAX(latest.attempt_number)
                    FROM Grades latest
                    WHERE latest.student_id = g.student_id
                      AND latest.subject_id = g.subject_id
                      AND latest.semester = g.semester
                      AND latest.academic_year = g.academic_year
              )
            GROUP BY g.semester, g.academic_year
            ORDER BY g.academic_year ASC, g.semester ASC
        `, { studentId: profile.student_id });

        return rows.map(row => ({
            semester: row.semester,
            academicYear: row.academicYear,
            gpa10: Number(row.gpa10) || 0,
            gpa4: Number(row.gpa4) || 0,
            credits: Number(row.credits) || 0,
            subjectCount: Number(row.subjectCount) || 0
        }));
    }

    async function getDaysToNextExam(studentId) {
        const { db, profile } = await getStudentContext(studentId);
        const today = getVnDateString(new Date());
        const rows = await db.executeQuery(`
            SELECT exam_id AS examId, exam_name AS examName, exam_date AS examDate,
                   exam_time AS examTime
            FROM Exams
            WHERE student_id = @studentId
              AND date(exam_date) >= date(@today)
            ORDER BY date(exam_date) ASC, exam_time ASC
            LIMIT 1
        `, { studentId: profile.student_id, today });

        if (!rows.length) return null;

        const exam = rows[0];
        return {
            examId: exam.examId,
            examName: exam.examName,
            examDate: exam.examDate,
            daysRemaining: Math.max(0, daysBetweenVnDates(today, exam.examDate))
        };
    }

    async function generateProgressAdvice(progressData) {
        try {
            if (!progressData || typeof progressData !== 'object' || Array.isArray(progressData)) {
                throw new TypeError('progressData phải là một object.');
            }

            const prompt = [
                'Dựa duy nhất trên dữ liệu JSON tiến độ bên dưới, viết một nhận xét và gợi ý ôn tập ngắn bằng tiếng Việt (tối đa 3 câu).',
                'Nêu ưu tiên cụ thể từ số liệu; không suy diễn dữ liệu không có. Nếu thiếu dữ liệu, hãy nói rõ.',
                JSON.stringify(progressData)
            ].join('\n\n');

            let timeoutId;
            let advice;
            const abortController = new AbortController();
            try {
                advice = await Promise.race([
                    gemini.ask(prompt, {
                        timeoutMs: AI_TIMEOUT_MS,
                        retry: false,
                        signal: abortController.signal
                    }),
                    new Promise((_, reject) => {
                        timeoutId = setTimeout(
                            () => {
                                abortController.abort();
                                reject(new Error('Gemini quá thời gian phản hồi.'));
                            },
                            AI_TIMEOUT_MS
                        );
                    })
                ]);
            } finally {
                clearTimeout(timeoutId);
            }

            return typeof advice === 'string' && advice.trim()
                ? advice.trim()
                : AI_FALLBACK_ADVICE;
        } catch (error) {
            console.warn('[Progress] Không tạo được gợi ý AI:', error.message);
            return AI_FALLBACK_ADVICE;
        }
    }

    return {
        getTaskMetrics,
        getWeeklyStudyHours,
        getGPA,
        getDaysToNextExam,
        generateProgressAdvice
    };
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const POMODORO_DURATION_COLUMNS = ['actual_study_seconds', 'study_seconds', 'duration_seconds'];
const POMODORO_START_COLUMNS = ['started_at', 'start_time', 'created_at'];
const POMODORO_END_COLUMNS = ['ended_at', 'end_time', 'finished_at'];
const POMODORO_OWNER_COLUMNS = ['student_id', 'user_id'];

function getVnDateString(date) {
    const vnDate = new Date(date.getTime() + VN_OFFSET_MS);
    return [
        vnDate.getUTCFullYear(),
        String(vnDate.getUTCMonth() + 1).padStart(2, '0'),
        String(vnDate.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function getCurrentVnWeek() {
    const today = getVnDateString(new Date());
    const [year, month, day] = today.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
    const startDate = formatUtcDate(utcDate);
    utcDate.setUTCDate(utcDate.getUTCDate() + 7);

    return { startDate, endDate: formatUtcDate(utcDate) };
}

function formatUtcDate(date) {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function daysBetweenVnDates(fromDate, toDate) {
    const [fromYear, fromMonth, fromDay] = String(fromDate).slice(0, 10).split('-').map(Number);
    const [toYear, toMonth, toDay] = String(toDate).slice(0, 10).split('-').map(Number);
    return Math.ceil((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / DAY_MS);
}

function roundHours(hours) {
    return Math.round(hours * 100) / 100;
}

async function getPomodoroMinutes(db, userId, studentId, week) {
    const tables = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(@tableName) LIMIT 1",
        { tableName: 'Pomodoros' }
    );
    if (!tables.length) {
        return {
            minutes: 0,
            available: false,
            warning: 'Pomodoro chưa được lưu trong database; tổng giờ hiện chỉ gồm các buổi tự học đã hoàn thành.'
        };
    }

    const tableName = tables[0].name;
    const columns = await db.executeQuery(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`);
    const names = columns.map(column => column.name.toLowerCase());
    const findColumn = candidates => {
        const index = candidates.find(candidate => names.includes(candidate));
        return index ? columns.find(column => column.name.toLowerCase() === index).name : null;
    };
    const ownerColumn = findColumn(POMODORO_OWNER_COLUMNS);
    const startColumn = findColumn(POMODORO_START_COLUMNS);
    const endColumn = findColumn(POMODORO_END_COLUMNS);
    const durationColumn = findColumn(POMODORO_DURATION_COLUMNS);

    if (!ownerColumn || !startColumn || (!endColumn && !durationColumn)) {
        return {
            minutes: 0,
            available: false,
            warning: 'Schema Pomodoros chưa có đủ cột chủ sở hữu, thời điểm bắt đầu và thời lượng; tổng giờ chưa bao gồm Pomodoro.'
        };
    }

    const quote = identifier => `"${identifier.replace(/"/g, '""')}"`;
    const ownerId = ownerColumn.toLowerCase() === 'user_id' ? userId : studentId;
    const timeRange = `datetime(${quote(startColumn)}) >= datetime(@weekStartUtc)
        AND datetime(${quote(startColumn)}) < datetime(@weekEndUtc)`;
    const durationExpression = durationColumn
        ? `COALESCE(SUM(COALESCE(${quote(durationColumn)}, 0)), 0)`
        : `COALESCE(SUM(MAX(0, (julianday(${quote(endColumn)}) - julianday(${quote(startColumn)})) * 86400)), 0)`;
    const rows = await db.executeQuery(`
        SELECT ${durationExpression} AS totalDuration
        FROM ${quote(tableName)}
        WHERE ${quote(ownerColumn)} = @ownerId
          AND ${timeRange}
    `, {
        ownerId,
        weekStartUtc: new Date(Date.parse(`${week.startDate}T00:00:00+07:00`)).toISOString(),
        weekEndUtc: new Date(Date.parse(`${week.endDate}T00:00:00+07:00`)).toISOString()
    });

    // Các cột thời lượng Pomodoro đang được hỗ trợ lưu theo giây.
    return { minutes: (Number(rows[0]?.totalDuration) || 0) / 60, available: true, warning: null };
}

module.exports = { createProgressService };
