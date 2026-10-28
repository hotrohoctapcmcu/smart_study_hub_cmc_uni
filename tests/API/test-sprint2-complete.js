'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-sprint2-complete-'));
process.env.DB_PATH = path.join(directory, 'test.db');
process.env.API_PORT = '0';
process.env.APP_USER_ID = '1';
process.env.NODE_ENV = 'test';

test('Sprint 2 complete API flows persist real data', async t => {
    let db = await require('../../database')();
    const q = (...args) => db.executeQuery(...args);
    await q("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'S2','Sprint 2','IT'),(2,'OTHER','Other','IT')");
    await q("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','SQL')");
    const server = await require('../../API').start();
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const request = async (method, endpoint, body) => {
        const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined && { body: JSON.stringify(body) }) });
        return { status: response.status, ...(await response.json()) };
    };
    let document, notebook, note;
    const outlook = require('../../CRWEB/OUTLOOK');
    const originalList = outlook.listMessages;
    t.after(async () => {
        outlook.listMessages = originalList;
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        await db.closePool();
        const resolved = path.resolve(directory);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    await t.test('migration is additive and repeatable', async () => {
        const pool = await db.getPool();
        require('../../database/sprint2/workspaceMigration').migrateWorkspace(pool);
        assert.equal((await q('SELECT * FROM Students')).length, 2);
        assert.ok((await q('PRAGMA table_info(Notes)')).some(column => column.name === 'document_id'));
    });
    await t.test('upload, open and download preserve exact file bytes', async () => {
        const bytes = Buffer.from('%PDF-1.4\nSprint 2 textbook\n%%EOF');
        const response = await fetch(base + '/documents', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream',
            'X-Document-Meta': encodeURIComponent(JSON.stringify({ filename: 'Sổ tay.pdf', title: 'SQL textbook', subject: 'SQL', tags: ['sql', 'sprint2'], isTextbook: true })) }, body: bytes });
        assert.equal(response.status, 201);
        document = (await response.json()).data;
        assert.equal(document.size, bytes.length); assert.equal(document.isTextbook, true);
        for (const suffix of ['', '?download=1']) {
            const opened = await fetch(`${base}/documents/${document.id}/file${suffix}`);
            assert.equal(opened.status, 200); assert.deepEqual(Buffer.from(await opened.arrayBuffer()), bytes);
            assert.match(opened.headers.get('content-disposition'), suffix ? /^attachment/ : /^inline/);
        }
    });
    await t.test('invalid files, oversized uploads and foreign files are rejected', async () => {
        const upload = (filename, body) => fetch(base + '/documents', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Document-Meta': encodeURIComponent(JSON.stringify({ filename, title: 'Bad', subject: 'SQL' })) }, body });
        assert.equal((await upload('bad.html', Buffer.from('<script>1</script>'))).status, 400);
        assert.equal((await upload('big.pdf', Buffer.alloc(25 * 1024 * 1024 + 1))).status, 413);
        const [foreign] = await q("INSERT INTO EduxDocuments(student_id,title,source) VALUES(2,'Private','LOCAL') RETURNING document_id");
        assert.equal((await fetch(`${base}/documents/${foreign.document_id}/file`)).status, 404);
    });
    await t.test('notebooks and notes support autosave, attachments and DOCX export', async () => {
        notebook = (await request('POST', '/notebooks', { title: 'Sổ SQL' })).data;
        note = (await request('POST', '/notes', { id: 'legacy-note-1', notebookId: notebook.notebook_id, title: 'JOIN', content: 'Ghi chú thật', documentId: document.id, chapter: 'Chương 2', tags: ['sql'], isDifficult: true })).data;
        assert.equal((await request('PUT', `/notes/${note.id}`, { content: 'INNER JOIN – tự lưu', tags: ['sql', 'sprint2'] })).status, 200);
        assert.equal((await request('POST', '/notes', { id: 'legacy-note-1', content: 'duplicate' })).data.databaseId, note.databaseId);
        assert.equal((await request('GET', '/notes')).data.length, 1);
        const exported = await fetch(`${base}/notes/${note.id}/export`);
        const zip = await require('jszip').loadAsync(Buffer.from(await exported.arrayBuffer()));
        assert.match(await zip.file('word/document.xml').async('string'), /INNER JOIN – tự lưu/);
        assert.equal((await request('PUT', `/notes/${note.id}`, { content: '', tags: [], documentId: '' })).data.content, '');
        assert.equal((await request('PUT', `/notes/${note.id}`, { content: 'INNER JOIN', tags: ['sprint2'], documentId: document.id })).status, 200);
        const foreign = await db.taoSoTay(2, { title: 'Private' });
        assert.equal((await request('PUT', `/notes/${note.id}`, { notebookId: foreign.notebook_id })).status, 404);
    });
    await t.test('Pomodoro is idempotent and splits midnight and pauses correctly', async () => {
        const body = { id: 'cross-midnight', startTime: '2030-05-01T23:50:00+07:00', endTime: '2030-05-02T00:30:00+07:00', actualStudySeconds: 1200, workDurationMinutes: 20, status: 'Hoàn thành', focusSegments: [
            { start: '2030-05-01T23:50:00+07:00', end: '2030-05-02T00:00:00+07:00' },
            { start: '2030-05-02T00:20:00+07:00', end: '2030-05-02T00:30:00+07:00' }
        ] };
        assert.equal((await request('POST', '/pomodoro', body)).status, 201);
        assert.equal((await request('POST', '/pomodoro', body)).status, 201);
        assert.equal((await request('GET', '/pomodoro')).data.length, 1);
        assert.equal((await request('POST', '/pomodoro', { ...body, id: 'bad', actualStudySeconds: 99999 })).status, 400);
        assert.equal((await request('POST', '/pomodoro', { ...body, id: 'bad-date', startTime: 'invalid' })).status, 400);
        const map = await request('GET', '/timemap?from=2030-05-02&to=2030-05-02');
        const blocks = map.data['2030-05-02'].filter(block => block.type === 'pomodoro');
        assert.equal(blocks.length, 1); assert.equal(blocks[0].startTime, '2030-05-02T00:20:00+07:00');
        const progress = await request('GET', '/progress?advice=false&from=2030-05-02&to=2030-05-02');
        assert.equal(progress.data.metrics.weeklyStudyHours.pomodoroHours, 0.17);
    });
    await t.test('progress includes EDUX, ignores hidden tasks and counts overlapping study once', async () => {
        await q("INSERT INTO StudySchedules(student_id,title,study_date,start_time,end_time,duration_minutes,status) VALUES(1,'Completed','2030-05-02','00:00','00:40',40,'COMPLETED')");
        await q("INSERT INTO Assignments(student_id,subject_id,title,deadline,status) VALUES(1,1,'Local done','2030-05-02','COMPLETED'),(1,1,'Local pending','2030-05-02','PENDING')");
        await db.luuBaiTapEDUX(1, [{ id: 'edux-done', title: 'EDUX done', subject: 'SQL', status: 'Hoàn thành' }, { id: 'edux-pending', title: 'EDUX pending', subject: 'SQL' }, { id: 'edux-hidden', title: 'Hidden', subject: 'SQL' }]);
        await db.anBaiTapEDUX(1, 'edux-hidden');
        const progress = (await request('GET', '/progress?advice=false&from=2030-05-02&to=2030-05-02')).data.metrics;
        assert.equal(progress.subjects[0].totalAssignments, 4); assert.equal(progress.subjects[0].completionRate, 50);
        assert.equal(progress.weeklyStudyHours.totalHours, 0.67); assert.equal(progress.weeklyStudyHours.selfStudyHours, 0.5);
        assert.equal((await request('GET', '/progress?from=2030-02-30&to=2030-03-01')).status, 400);
    });
    await t.test('global search finds real content and tags across the library and both task sources', async () => {
        await request('PATCH', '/tags/tasks/1', { tags: ['sprint2'] });
        await request('PATCH', '/tags/edux/edux-done', { tags: ['sprint2'] });
        assert.equal((await request('GET', '/tasks')).data[0].tags, '["sprint2"]');
        const results = (await request('GET', '/search?tag=sprint2')).data;
        assert.equal(results.filter(item => item.type === 'task').length, 2);
        assert.ok(results.some(item => item.type === 'document'));
        assert.ok(results.some(item => item.type === 'note'));
        assert.equal((await request('GET', '/search?q=INNER%20JOIN')).data[0].type, 'note');
    });
    await t.test('Outlook sync analyzes actual message content and creates durable items once', async () => {
        outlook.listMessages = async () => ({ account: 'student@cmcu.edu.vn', source: 'microsoft-graph', messages: [
            { id: 'deadline', subject: 'Nộp bài SQL', sender: 'teacher@cmcu.edu.vn', senderName: 'Teacher', date: '2026-10-27T01:00:00Z', body: 'Môn học: SQL\nHạn nộp: 23:59 ngày 30/10/2026.', isRead: false },
            { id: 'exam', subject: 'Lịch thi SQL', sender: 'school@cmcu.edu.vn', date: '2026-10-27T02:00:00Z', body: 'Môn học: SQL\nNgày thi: 16/11/2026\nGiờ thi: 08:00\nPhòng thi: A205\nThời lượng: 90 phút', isRead: false }
        ] });
        let sync = await request('POST', '/email/sync', {});
        assert.equal(sync.status, 200); assert.equal(sync.data.messages.length, 2);
        const mail = sync.data.messages.find(item => item.externalId === 'deadline');
        const exam = sync.data.messages.find(item => item.externalId === 'exam');
        assert.equal(mail.extractedDeadline.due, '2026-10-30T23:59'); assert.equal(exam.extractedExam.room, 'A205');
        const first = await request('POST', `/email/${mail.id}/task`, {});
        const again = await request('POST', `/email/${mail.id}/task`, {});
        assert.equal(first.data.id, again.data.id); assert.equal(again.data.alreadyProcessed, true);
        const createdExam = await request('POST', `/email/${exam.id}/exam`, {});
        assert.equal(createdExam.status, 201);
        await request('PATCH', `/email/${mail.id}/read`);
        sync = await request('POST', '/email/sync', {});
        assert.equal(sync.data.messages.find(item => item.id === mail.id).isRead, true);
        outlook.listMessages = async () => { throw Object.assign(new Error('Expired Outlook session'), { statusCode: 401 }); };
        assert.equal((await request('POST', '/email/sync', {})).status, 401);
        assert.equal((await request('GET', '/email')).data.length, 2);
    });
    await t.test('files, notes, email actions and focus history survive a database reopen', async () => {
        await db.closePool(); db = await require('../../database')();
        const rows = await q('SELECT * FROM Notes'); assert.equal(rows[0].content, 'INNER JOIN');
        assert.equal((await q('SELECT * FROM PomodoroSessions')).length, 1);
        assert.equal((await q('SELECT * FROM SchoolEmails WHERE task_id IS NOT NULL')).length, 1);
        assert.equal((await fetch(`${base}/documents/${document.id}/file`)).status, 200);
        assert.equal((await request('DELETE', `/documents/${document.id}`)).status, 200);
        assert.equal((await q('SELECT document_id FROM Notes'))[0].document_id, null);
        assert.equal((await request('DELETE', `/notebooks/${notebook.notebook_id}`)).status, 200);
        assert.equal((await q('SELECT * FROM Notes')).length, 0);
    });
});

test('Outlook Graph adapter follows pagination, normalizes bodies and reports expired access', async () => {
    const { createOutlookClient } = require('../../CRWEB/OUTLOOK');
    const calls = [];
    const client = createOutlookClient({ tokenProvider: () => 'server-only-token', fetchImpl: async (url, options) => {
        calls.push({ url, headers: options.headers });
        return { ok: true, json: async () => ({ value: [{ id: `mail-${calls.length}`, subject: 'SQL', body: { contentType: 'html', content: '<p>Deadline &amp; SQL</p><script>bad()</script>' } }], ...(calls.length === 1 && { '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/messages?$skip=1' }) }) };
    } });
    const result = await client.listMessages({ top: 2 });
    assert.equal(result.messages.length, 2); assert.equal(result.messages[0].body, 'Deadline & SQL');
    assert.equal(calls[0].headers.Authorization, 'Bearer server-only-token');
    await client.logout(); assert.equal(client.status().connected, false);
    assert.match(calls[1].url, /\$skip=1/);
    const expired = createOutlookClient({ tokenProvider: () => 'expired', fetchImpl: async () => ({ ok: false, status: 401 }) });
    await assert.rejects(expired.listMessages(), error => error.statusCode === 401);
    const { analyzeMessage } = require('../../CRWEB/OUTLOOK/analysis');
    assert.equal(analyzeMessage({ body: 'Hạn nộp: 31/02/2026 08:00' }).extractedDeadline, null);
    assert.equal(analyzeMessage({ body: 'Hạn nộp: 30/10/2026' }).extractedDeadline, null);
    const announcement = analyzeMessage({ subject: 'Nhắc hạn nộp Bài tập lớn Lập trình Web',
        body: 'Chào các em sinh viên.\n\n' + 'Thông tin học phần và yêu cầu báo cáo. '.repeat(20) + '\n\nHạn chót nộp báo cáo là: 23:59 ngày 25/10/2026.\nYêu cầu nộp đủ mã nguồn.' });
    assert.equal(announcement.extractedDeadline.due, '2026-10-25T23:59');
    const exam = analyzeMessage({ subject: 'Thông báo lịch thi', body: 'Phòng Khảo thí thông báo lịch thi học kỳ:\nHọc phần: SQL\nNgày thi: 16/11/2026\nGiờ thi: 08:00\nPhòng thi: A205 (Tòa Alpha)' });
    assert.equal(exam.extractedExam.room, 'A205');
    assert.equal(analyzeMessage({ body: 'Hạn nộp: 08:00 ngày 30/10/2026 hoặc 31/10/2026' }).extractedDeadline, null);
});
