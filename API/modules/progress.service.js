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
            WITH task_sources AS (
                SELECT a.subject_id, s.subject_name, s.subject_code, a.title, a.deadline,
                       CASE WHEN a.status='COMPLETED' THEN 1 ELSE 0 END AS completed,
                       CASE WHEN a.status='OVERDUE' THEN 1 ELSE 0 END AS overdue
                FROM Assignments a JOIN Subjects s ON s.subject_id=a.subject_id WHERE a.student_id=@studentId
                UNION ALL
                SELECT NULL, COALESCE(e.subject_name,'EDUX'), 'EDUX', e.title, e.deadline,
                       CASE WHEN e.status IN ('Hoàn thành','COMPLETED') THEN 1 ELSE 0 END, 0
                FROM EduxAssignments e WHERE e.user_id=@userId AND e.is_hidden=0
            ), subject_catalog AS (
                SELECT MIN(subject_id) AS subject_id, MIN(subject_code) AS subject_code, subject_name
                FROM (
                    SELECT s.subject_id,s.subject_code,s.subject_name FROM Subjects s
                    JOIN StudentSubjects enrolled ON enrolled.subject_id=s.subject_id
                    WHERE enrolled.student_id=@studentId AND enrolled.status<>'DROPPED'
                    UNION ALL SELECT subject_id,subject_code,subject_name FROM task_sources
                ) GROUP BY subject_name COLLATE NOCASE
            )
            SELECT c.subject_id AS subjectId, c.subject_code AS subjectCode, c.subject_name AS subjectName,
                   COUNT(t.title) AS totalAssignments, COALESCE(SUM(t.completed),0) AS completedAssignments,
                   SUM(CASE WHEN t.completed=0 AND (t.overdue=1 OR
                       (length(t.deadline)<=10 AND date(t.deadline)<date(@today)) OR
                       (length(t.deadline)>10 AND datetime(t.deadline)<datetime(@nowUtc))) THEN 1 ELSE 0 END) AS overdueAssignments
            FROM subject_catalog c LEFT JOIN task_sources t ON t.subject_name=c.subject_name COLLATE NOCASE
            GROUP BY c.subject_name COLLATE NOCASE ORDER BY c.subject_name
        `, { studentId: profile.student_id, userId: studentId, today, nowUtc });

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

    async function getWeeklyStudyHours(studentId, from, to) {
        const { db, profile } = await getStudentContext(studentId);
        const { sessionSegments, unionMilliseconds, requestedRange } = require('../shared/study-time');
        const week = requestedRange(from, to) || getCurrentVnWeek();
        const rangeStart = Date.parse(`${week.startDate}T00:00:00+07:00`);
        const rangeEnd = Date.parse(`${week.endDate}T00:00:00+07:00`);
        const schedules = await db.executeQuery(`SELECT study_date,start_time,end_time FROM StudySchedules
            WHERE student_id=@sid AND status='COMPLETED' AND study_date>=@start AND study_date<@end`,
            { sid: profile.student_id, start: week.startDate, end: week.endDate });
        const sessions = await db.executeQuery(`SELECT * FROM PomodoroSessions WHERE student_id=@sid AND status IN ('COMPLETED','CANCELLED')`, { sid: profile.student_id });
        const self = schedules.map(row => [Date.parse(`${row.study_date}T${row.start_time}+07:00`), Date.parse(`${row.study_date}T${row.end_time}+07:00`)]);
        const focus = sessions.flatMap(sessionSegments);
        const pomoMs = unionMilliseconds(focus, rangeStart, rangeEnd);
        const totalMs = unionMilliseconds([...self, ...focus], rangeStart, rangeEnd);
        return {
            totalHours: roundHours(totalMs / 3600000), selfStudyHours: roundHours((totalMs-pomoMs) / 3600000),
            pomodoroHours: roundHours(pomoMs / 3600000), weekStart: week.startDate, weekEnd: week.endDate,
            sources: { selfStudyAvailable: true, pomodoroAvailable: true }, warnings: [],
            overlapPolicy: 'Pomodoro được ưu tiên; khoảng tự học trùng chỉ tính một lần.'
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

module.exports = { createProgressService };
