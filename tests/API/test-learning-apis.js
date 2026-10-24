'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-api-tests-'));
process.env.DB_PATH = path.join(testDirectory, 'test.db');
process.env.APP_USER_ID = '1';
process.env.API_PORT = '0';
process.env.NODE_ENV = 'test';

// Giữ kiểm thử độc lập với Gemini và kết nối mạng bên ngoài.
const gemini = require('../../API/shared/gemini-client');
gemini.ask = async () => 'Nhận xét AI thử nghiệm.';

const API_PREFIX = '/api/v1';
const passed = [];
let server;
let db;

function assertPass(condition, description) {
    assert.ok(condition, description);
    passed.push(description);
    console.log(`  PASS ${description}`);
}

function datePlusDays(days) {
    const now = new Date();
    const vietnamNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const date = new Date(Date.UTC(
        vietnamNow.getUTCFullYear(),
        vietnamNow.getUTCMonth(),
        vietnamNow.getUTCDate() + days
    ));
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function databaseWeekStart(dateString) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

async function main() {
    try {
        const api = require('../../API');
        server = await api.start();
        db = await require('../../database')();

        const baseUrl = `http://127.0.0.1:${server.address().port}${API_PREFIX}`;
        async function request(method, route, body) {
            const response = await fetch(`${baseUrl}${route}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            let data;
            try {
                data = await response.json();
            } catch {
                data = null;
            }
            return { status: response.status, body: data };
        }

        await db.executeQuery(`
            INSERT INTO Students (student_code, full_name, major)
            VALUES ('API-TEST-1', 'Sinh viên kiểm thử', 'Kiểm thử API')
        `);
        const studentId = (await db.executeQuery(
            "SELECT student_id FROM Students WHERE student_code = 'API-TEST-1'"
        ))[0].student_id;
        await db.executeQuery(`
            INSERT INTO Students (student_code, full_name, major)
            VALUES ('API-TEST-2', 'Sinh viên kiểm thử khác', 'Kiểm thử API')
        `);
        const otherStudentId = (await db.executeQuery(
            "SELECT student_id FROM Students WHERE student_code = 'API-TEST-2'"
        ))[0].student_id;
        await db.executeQuery(`
            INSERT INTO Subjects (subject_code, subject_name)
            VALUES ('API-TEST-SUB', 'Môn kiểm thử API')
        `);
        const subjectId = (await db.executeQuery(
            "SELECT subject_id FROM Subjects WHERE subject_code = 'API-TEST-SUB'"
        ))[0].subject_id;
        await db.executeQuery(`
            INSERT INTO StudentSubjects (student_id, subject_id, status, semester, academic_year)
            VALUES (@studentId, @subjectId, 'STUDYING', '1', '2030-2031')
        `, { studentId, subjectId });

        console.log('\n== StudySchedules ==');
        const studyDate = datePlusDays(14);
        const conflictCheck = await request('POST', '/schedules/conflicts/check', {
            studyDate,
            startTime: '09:30',
            endTime: '10:30'
        });
        assertPass(conflictCheck.status === 200 && conflictCheck.body.hasConflict === false,
            'kiểm tra xung đột trả kết quả không có lịch khi ngày còn trống');

        const classDay = new Date(`${studyDate}T00:00:00Z`).getUTCDay();
        const dayOfWeek = classDay === 0 ? 8 : classDay + 1;
        await db.executeQuery(`
            INSERT INTO Timetables (
                student_id, subject_id, class_name, room, campus, day_of_week,
                start_time, end_time, start_date, end_date, source
            ) VALUES (
                @studentId, @subjectId, 'Lớp kiểm thử', 'P.101', 'CMC', @day,
                '09:00', '10:00', @date, @date, 'SYSTEM'
            )
        `, { studentId, subjectId, day: dayOfWeek, date: studyDate });

        const schoolConflict = await request('POST', '/schedules/conflicts/check', {
            studyDate,
            startTime: '09:30',
            endTime: '10:30'
        });
        assertPass(schoolConflict.status === 200 && schoolConflict.body.hasConflict === true
            && schoolConflict.body.conflicts.some(item => item.conflict_type === 'TIMETABLE'),
        'phát hiện xung đột với thời khóa biểu');

        const rejectedStudy = await request('POST', '/schedules/study', {
            title: 'Ca bị trùng', studyDate, startTime: '09:30', endTime: '10:30', subjectId
        });
        assertPass(rejectedStudy.status === 409, 'không lưu buổi tự học bị trùng');

        const createdStudy = await request('POST', '/schedules/study', {
            title: 'Buổi tự học API', studyDate, startTime: '10:00', endTime: '11:00', subjectId
        });
        assertPass(createdStudy.status === 201 && createdStudy.body.success,
            'tạo buổi tự học hợp lệ');
        const studyId = createdStudy.body.data.schedule_id;

        const ownConflict = await request('POST', '/schedules/conflicts/check', {
            studyDate, startTime: '10:15', endTime: '10:45'
        });
        assertPass(ownConflict.status === 200 && ownConflict.body.hasConflict === true,
            'phát hiện xung đột với buổi tự học đã lưu');

        const updatedStudy = await request('PUT', `/schedules/study/${studyId}`, {
            title: 'Buổi tự học đã sửa'
        });
        assertPass(updatedStudy.status === 200 && updatedStudy.body.data.title === 'Buổi tự học đã sửa',
            'cập nhật buổi tự học');

        const weeklyStudy = await request('POST', '/schedules/study', {
            title: 'Buổi học hoàn thành trong tuần',
            studyDate: datePlusDays(0), startTime: '18:00', endTime: '19:30', subjectId
        });
        assertPass(weeklyStudy.status === 201, 'tạo buổi học để kiểm tra tổng giờ tuần');
        const weeklyStudyId = weeklyStudy.body.data.schedule_id;
        const completedStudy = await request('PATCH', `/schedules/study/${weeklyStudyId}/status`, {
            status: 'COMPLETED'
        });
        assertPass(completedStudy.status === 200, 'đánh dấu buổi học hoàn thành');

        console.log('\n== Lịch thi ==');
        const examDate = studyDate;
        const createdExam = await request('POST', '/exams', {
            subjectId, examName: 'Kỳ thi kiểm thử', examDate, examTime: '13:00',
            durationMinutes: 90, room: 'P.202', campus: 'CMC'
        });
        assertPass(createdExam.status === 201 && createdExam.body.success, 'tạo kỳ thi');
        const examId = createdExam.body.data.exam_id;

        const upcomingExams = await request('GET', '/exams/upcoming');
        assertPass(upcomingExams.status === 200
            && upcomingExams.body.data.some(exam => Number(exam.exam_id) === Number(examId)),
        'đọc lịch thi sắp tới');

        const updatedExam = await request('PUT', `/exams/${examId}`, { room: 'P.303' });
        assertPass(updatedExam.status === 200 && updatedExam.body.data.room === 'P.303',
            'cập nhật kỳ thi');

        const createdPlan = await request('POST', '/exams/study-plans', {
            examId, phaseTitle: 'Ôn tập API', startDate: studyDate, endDate: studyDate
        });
        assertPass(createdPlan.status === 201, 'tạo kế hoạch ôn thi');
        const planId = createdPlan.body.data.plan_id;
        const updatedPlan = await request('PATCH', `/exams/study-plans/${planId}/status`, {
            status: 'COMPLETED'
        });
        assertPass(updatedPlan.status === 200, 'cập nhật trạng thái kế hoạch ôn thi');
        const deletedPlan = await request('DELETE', `/exams/study-plans/${planId}`);
        assertPass(deletedPlan.status === 200, 'xóa kế hoạch ôn thi');

        console.log('\n== Time Map ==');
        const timeMap = await request('GET', `/timemap?from=${studyDate}&to=${studyDate}`);
        const blocks = timeMap.body?.data?.[studyDate] || [];
        assertPass(timeMap.status === 200 && timeMap.body.success, 'trả Time Map theo ngày');
        assertPass(blocks.some(block => block.type === 'class'), 'chuẩn hóa block lịch học');
        assertPass(blocks.some(block => block.type === 'exam'), 'chuẩn hóa block kỳ thi');
        assertPass(blocks.some(block => block.type === 'self-study'), 'chuẩn hóa block tự học');
        assertPass(blocks.some(block => block.type === 'free-time'), 'tạo block thời gian trống');
        assertPass(blocks.every(block => block.startTime.endsWith('+07:00')
            && block.endTime.endsWith('+07:00')),
        'xuất mốc thời gian kèm múi giờ UTC+7');
        assertPass(timeMap.body.meta?.sources?.pomodoros?.available === false
            && timeMap.body.meta.warnings.length > 0,
        'báo rõ khi database chưa có nguồn Pomodoro');
        const invalidMap = await request('GET', '/timemap?from=2030-02-30&to=2030-03-01');
        assertPass(invalidMap.status === 400, 'từ chối ngày Time Map không hợp lệ');

        console.log('\n== Progress ==');
        const taskOne = await request('POST', '/tasks', {
            subjectId, title: 'Bài hoàn thành', deadline: new Date(Date.now() + 30 * 86400000).toISOString()
        });
        assertPass(taskOne.status === 201, 'tạo bài tập hoàn thành cho chỉ số tiến độ');
        await db.executeQuery("UPDATE Assignments SET status = 'COMPLETED' WHERE assignment_id = @id",
            { id: taskOne.body.data.assignment_id });
        await request('POST', '/tasks', {
            subjectId, title: 'Bài quá hạn', deadline: '2020-01-01T00:00:00.000Z'
        });
        await db.executeQuery(`
            INSERT INTO Grades (
                student_id, subject_id, semester, academic_year, credits,
                final_score, letter_grade, total_points, is_passed
            ) VALUES (@studentId, @subjectId, '1', '2030-2031', 3, 8.5, 'A', 11.4, 1)
        `, { studentId, subjectId });

        const progress = await request('GET', '/progress');
        const metrics = progress.body?.data?.metrics;
        assertPass(progress.status === 200 && progress.body.success, 'trả phân tích tiến độ');
        assertPass(metrics?.overdueCount >= 1, 'tính số bài quá hạn');
        assertPass(metrics?.subjects?.some(subject => subject.completionRate === 50),
            'tính tỷ lệ hoàn thành môn học');
        assertPass(metrics?.weeklyStudyHours?.selfStudyHours === 1.5,
            'tính số giờ tự học đã hoàn thành trong tuần');
        assertPass(metrics?.weeklyStudyHours?.sources?.pomodoroAvailable === false,
            'nêu trạng thái thiếu nguồn Pomodoro trong tiến độ');
        assertPass(metrics?.gpaBySemester?.some(item => item.gpa10 === 8.5), 'tính GPA theo kỳ');
        assertPass(metrics?.nextExam?.examId === examId, 'tìm kỳ thi gần nhất');
        assertPass(progress.body.data.advice === 'Nhận xét AI thử nghiệm.',
            'gọi tích hợp AI qua Gemini giả lập');

        console.log('\n== Thông báo và nhắc nhở ==');
        const reminder = await request('POST', '/notifications', {
            targetType: 'CUSTOM', targetId: 920001, title: 'Thông báo API kiểm thử',
            message: 'Kiểm tra vòng đời thông báo.', tier: 'CUSTOM',
            remindTime: new Date(Date.now() - 60_000).toISOString()
        });
        assertPass(reminder.status === 201 && reminder.body.success, 'tạo thông báo');
        const reminderId = reminder.body.data.reminder_id;
        const notificationList = await request('GET', '/notifications');
        assertPass(notificationList.status === 200
            && notificationList.body.data.some(item => Number(item.reminder_id) === Number(reminderId)),
        'đọc danh sách thông báo');
        const unread = await request('GET', '/notifications/unread-count');
        assertPass(unread.status === 200 && unread.body.unreadCount >= 1, 'đếm thông báo đến hạn chưa đọc');
        const markedRead = await request('PATCH', `/notifications/${reminderId}/read`, {});
        assertPass(markedRead.status === 200, 'đánh dấu thông báo đã đọc');
        const deletedReminder = await request('DELETE', `/notifications/${reminderId}`);
        assertPass(deletedReminder.status === 200, 'xóa thông báo');

        const firstTierSet = await request('POST', '/notifications/multi-tier', {
            targetType: 'ASSIGNMENT', targetId: taskOne.body.data.assignment_id,
            title: 'Nhắc bài hoàn thành', deadline: new Date(Date.now() + 10 * 86400000).toISOString()
        });
        const secondTierSet = await request('POST', '/notifications/multi-tier', {
            targetType: 'ASSIGNMENT', targetId: taskOne.body.data.assignment_id,
            title: 'Nhắc bài hoàn thành', deadline: new Date(Date.now() + 10 * 86400000).toISOString()
        });
        assertPass(firstTierSet.status === 201 && secondTierSet.status === 201
            && firstTierSet.body.data.created_count > 0 && secondTierSet.body.data.created_count === 0,
        'gọi nhiều lần không tạo trùng nhắc nhở theo tầng');
        const duplicateReminderRows = await db.executeQuery(`
            SELECT COUNT(*) AS total, COUNT(DISTINCT tier) AS tiers
            FROM Reminders
            WHERE student_id = @studentId AND target_type = 'ASSIGNMENT' AND target_id = @taskId
        `, { studentId, taskId: taskOne.body.data.assignment_id });
        assertPass(Number(duplicateReminderRows[0].total) === Number(duplicateReminderRows[0].tiers),
            'database giữ tối đa một nhắc nhở cho mỗi tầng');

        console.log('\n== Xóa task, EDUX và checklist ==');
        const ownedTask = await request('POST', '/tasks', {
            subjectId, title: 'Task sẽ xóa', deadline: new Date(Date.now() + 30 * 86400000).toISOString()
        });
        const ownedTaskId = ownedTask.body.data.assignment_id;
        const deletedTask = await request('DELETE', `/tasks/${ownedTaskId}`);
        assertPass(ownedTask.status === 201 && deletedTask.status === 200 && deletedTask.body.success,
            'xóa cứng task nội bộ có ID số');
        const deletedTaskRows = await db.executeQuery(`
            SELECT 1 FROM Assignments WHERE assignment_id = @id
        `, { id: ownedTaskId });
        const deletedTaskReminderRows = await db.executeQuery(`
            SELECT 1 FROM Reminders WHERE target_type = 'ASSIGNMENT' AND target_id = @id
        `, { id: ownedTaskId });
        assertPass(deletedTaskRows.length === 0 && deletedTaskReminderRows.length === 0,
            'xóa task đồng thời xóa nhắc nhở liên quan');

        const foreignTask = await db.themBaiTap(otherStudentId, {
            subjectId, title: 'Task hồ sơ khác', deadline: new Date(Date.now() + 30 * 86400000).toISOString()
        });
        const foreignDelete = await request('DELETE', `/tasks/${foreignTask.assignment_id}`);
        assertPass(foreignDelete.status === 403, 'từ chối xóa task thuộc hồ sơ khác với HTTP 403');

        const eduxId = 'edux-api-test-1';
        await db.luuBaiTapEDUX(1, [{ id: eduxId, title: 'EDUX kiểm thử', subject: 'Môn kiểm thử' }]);
        const hiddenEdux = await request('DELETE', `/tasks/${eduxId}`);
        const afterHide = await request('GET', '/tasks/edux');
        assertPass(hiddenEdux.status === 200 && afterHide.status === 200
            && afterHide.body.data.assignments.length === 0,
        'ẩn task EDUX và trả danh sách cache rỗng khi không còn task hiển thị');
        await db.luuBaiTapEDUX(1, [{ id: eduxId, title: 'EDUX kiểm thử', subject: 'Môn kiểm thử' }]);
        const afterResync = await request('GET', '/tasks/edux');
        assertPass(afterResync.status === 200 && afterResync.body.data.assignments.length === 0,
            'task EDUX đã ẩn không hiện lại sau đồng bộ');

        const checklist = await request('POST', '/tasks/checklist', { title: 'Checklist kiểm thử' });
        const checklistId = checklist.body.data.checklist_id;
        const checklistDelete = await request('DELETE', `/tasks/checklist/${checklistId}`);
        assertPass(checklist.status === 201 && checklistDelete.status === 200,
            'xóa checklist thuộc hồ sơ hiện tại');
        await db.executeQuery(`
            INSERT INTO Checklists (student_id, title) VALUES (@studentId, 'Checklist hồ sơ khác')
        `, { studentId: otherStudentId });
        const foreignChecklistId = (await db.executeQuery(`
            SELECT checklist_id FROM Checklists
            WHERE student_id = @studentId AND title = 'Checklist hồ sơ khác'
        `, { studentId: otherStudentId }))[0].checklist_id;
        const foreignChecklistDelete = await request('DELETE', `/tasks/checklist/${foreignChecklistId}`);
        assertPass(foreignChecklistDelete.status === 404,
            'không cho xóa checklist của hồ sơ khác');

        const deletedExam = await request('DELETE', `/exams/${examId}`);
        assertPass(deletedExam.status === 200, 'xóa kỳ thi');
        const examRows = await db.executeQuery('SELECT 1 FROM Exams WHERE exam_id = @id', { id: examId });
        const examReminderRows = await db.executeQuery(
            "SELECT 1 FROM Reminders WHERE target_type = 'EXAM' AND target_id = @id", { id: examId }
        );
        assertPass(examRows.length === 0 && examReminderRows.length === 0,
            'xóa kỳ thi đồng thời xóa nhắc nhở liên quan');

        const deletedStudy = await request('DELETE', `/schedules/study/${studyId}`);
        const deletedWeeklyStudy = await request('DELETE', `/schedules/study/${weeklyStudyId}`);
        assertPass(deletedStudy.status === 200 && deletedWeeklyStudy.status === 200,
            'xóa buổi tự học thuộc hồ sơ hiện tại');

        console.log(`\nKẾT QUẢ: ${passed.length}/${passed.length} kiểm tra đạt.`);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db?.closePool) await db.closePool();
        fs.rmSync(testDirectory, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error('\nKIỂM THỬ THẤT BẠI:', error.stack || error.message);
    process.exitCode = 1;
});
