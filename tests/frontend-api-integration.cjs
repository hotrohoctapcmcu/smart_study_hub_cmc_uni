'use strict';

// Exercise the actual frontend Axios wrappers against the unchanged API and an
// isolated database. No portal logins, external AI calls or real user data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('frontend services connect to the existing backend over real HTTP', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-frontend-api-'));
    Object.assign(process.env, {
        DB_PATH: path.join(directory, 'test.db'),
        DOCUMENTS_PATH: path.join(directory, 'documents'),
        API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test',
        VITE_USE_MOCK: 'false', GEMINI_ENABLE_WEB_FALLBACK: 'false'
    });
    let server, vite, db;
    const previousWindow = globalThis.window;
    try {
        db = await require('../database')();
        await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major,email) VALUES(1,'FE001','Frontend HTTP Tester','IT','test@example.invalid')");
        await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'FE-TEST','Frontend integration')");
        server = await require('../API').start();
        const origin = `http://127.0.0.1:${server.address().port}`;
        process.env.VITE_API_URL = `${origin}/api/v1`;
        globalThis.window = { location: { origin } };
        const frontend = path.resolve(__dirname, '../Frontend');
        const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [frontend] })).href);
        vite = await createServer({ root: frontend, configFile: false,
            server: { middlewareMode: true }, appType: 'custom',
            define: { 'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL), 'import.meta.env.VITE_USE_MOCK': '"false"' } });
        const api = await vite.ssrLoadModule('/src/api/index.js');
        const { unwrapResponse: unwrap } = await vite.ssrLoadModule('/src/api/apiClient.js');

        await t.test('health, profile and initial dashboard use live responses', async () => {
            assert.equal((await api.healthApi.check()).data.status, 'online');
            assert.equal(unwrap(await api.studentApi.getProfile()).student_code, 'FE001');
            await api.studentApi.updateProfile({ studentCode: 'FE001', fullName: 'Updated HTTP Tester', major: 'IT' });
            assert.equal(unwrap(await api.dashboardApi.getDashboard()).profile.full_name, 'Updated HTTP Tester');
        });
        await t.test('task and nested checklist mutations persist', async () => {
            const task = unwrap(await api.taskApi.create({ subjectId: 1, title: 'HTTP integration task', deadline: '2099-11-01T23:59', priority: 'HIGH' }));
            const item = unwrap(await api.taskApi.createChecklist(task.assignment_id, { title: 'HTTP checklist' }));
            await api.taskApi.toggleChecklist(item.checklist_id, true);
            assert.equal(unwrap(await api.taskApi.taskChecklist(task.assignment_id))[0].is_completed, 1);
            await api.taskApi.changeStatus(task.assignment_id, 'COMPLETED');
            assert.equal(unwrap(await api.taskApi.list()).find(row => row.assignment_id === task.assignment_id).status, 'COMPLETED');
            await api.taskApi.removeChecklist(item.checklist_id);
            await api.taskApi.remove(task.assignment_id);
        });
        await t.test('class recurrence and dated self-study use backend contracts', async () => {
            const klass = unwrap(await api.scheduleApi.createClass({ subjectId: 1, className: 'HTTP class', room: 'A101', dayOfWeek: 2, startTime: '08:00', endTime: '09:00', startDate: '2099-10-01', endDate: '2099-11-30' }));
            const rows = unwrap(await api.scheduleApi.byWeek('2099-10-26', '2099-11-01'));
            assert.ok(rows.some(row => row.timetable_id === klass.timetable_id && row.day_of_week === 2));
            const study = unwrap(await api.scheduleApi.create({ subjectId: 1, title: 'HTTP study', studyDate: '2099-10-30', startTime: '18:00', endTime: '19:00' }));
            assert.ok(unwrap(await api.scheduleApi.study({ from: '2099-10-30', to: '2099-10-30' })).some(row => row.schedule_id === study.schedule_id));
            assert.equal((await api.scheduleApi.checkConflicts({ studyDate: '2099-10-30', startTime: '18:30', endTime: '19:30' })).data.hasConflict, true);
            await api.scheduleApi.changeStatus(study.schedule_id, 'COMPLETED');
            await api.scheduleApi.remove(study.schedule_id);
            await api.scheduleApi.removeClass(klass.timetable_id);
        });
        await t.test('Vietnamese document metadata and bytes survive upload/download', async () => {
            const bytes = Buffer.from('Tài liệu kiểm tra kết nối API\n', 'utf8');
            const document = unwrap(await api.documentApi.upload(bytes, { filename: 'tài-liệu.txt', title: 'Tài liệu HTTP', subject: 'Frontend integration', tags: ['HTTP'] }));
            const download = await api.documentApi.download(document.id);
            assert.deepEqual(Buffer.from(download.data), bytes);
            assert.ok(unwrap(await api.searchApi.search('Tài liệu HTTP')).some(row => row.type === 'document' && row.id === document.id));
            await api.documentApi.updateTags(document.id, ['Verified']);
            assert.deepEqual(unwrap(await api.documentApi.list())[0].tags, ['Verified']);
            await api.documentApi.remove(document.id);
        });
        await t.test('notes export and Pomodoro history reach persistent workspace routes', async () => {
            const note = unwrap(await api.workspaceApi.notes.create({ title: 'HTTP note', content: 'Frontend integration content' }));
            const exported = await api.workspaceApi.notes.export(note.id);
            assert.equal(Buffer.from(exported.data).subarray(0, 2).toString(), 'PK');
            await api.workspaceApi.notes.remove(note.id);
            const startTime = '2026-10-30T01:00:00Z', endTime = '2026-10-30T01:01:00Z';
            await api.pomodoroApi.create({ id: 'http-pomodoro', startTime, endTime, actualStudySeconds: 60, workDurationMinutes: 1, status: 'Hoàn thành', focusSegments: [{ start: startTime, end: endTime }] });
            assert.equal(unwrap(await api.pomodoroApi.list())[0].actualStudySeconds, 60);
            await api.pomodoroApi.remove();
        });
        await t.test('learning, statistics, notifications, email and AI resource reads use existing routes', async () => {
            assert.ok(unwrap(await api.courseApi.list()));
            assert.ok(unwrap(await api.progressApi.getProgress()));
            assert.ok(unwrap(await api.timemapApi.getTimemap()));
            assert.ok(Array.isArray(unwrap(await api.notificationApi.list())));
            assert.ok(Array.isArray(unwrap(await api.emailApi.list())));
            assert.ok(unwrap(await api.emailApi.status()));
            assert.ok(unwrap(await api.aiApi.status()));
            assert.ok(Array.isArray(unwrap(await api.quizApi.list())));
            assert.ok(Array.isArray(unwrap(await api.weaknessApi.list()).topics));
        });
        await t.test('backend validation failures are not converted into mock success', async () => {
            await assert.rejects(api.taskApi.create({ title: 'Missing required fields' }), error => error.response?.status === 400);
        });
    } finally {
        if (vite) await vite.close();
        if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
        if (db?.closePool) await db.closePool();
        globalThis.window = previousWindow;
        // Verify the exact generated target before recursive cleanup on Windows.
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('unistudy-frontend-api-'));
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
