'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-api-report-'));
Object.assign(process.env, {
    DB_PATH: path.join(directory, 'test.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
    API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'production', OUTLOOK_ACCESS_TOKEN: ''
});

test('API audit regressions: resource contracts, ownership and Progress latency', async t => {
    const db = await require('../../database')();
    const q = (...args) => db.executeQuery(...args);
    t.after(async () => {
        await db.closePool();
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    await q("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'AUDIT','Audit student','IT'),(2,'FOREIGN','Private student','IT')");
    await q("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'AUDIT','Audit subject')");

    const gemini = require('../../API/utils/gemini-client');
    const originals = { ask: gemini.ask, generateText: gemini.generateText, generateJson: gemini.generateJson };
    const edux = require('../../CRWEB/modules/EDUX');
    const originalLogout = edux.logoutEdux;
    // Session deletion is exercised without deleting a user's crawler cookie file.
    edux.logoutEdux = () => true;
    t.after(() => { edux.logoutEdux = originalLogout; });
    let aiCalls = 0;
    for (const name of Object.keys(originals)) gemini[name] = async () => { aiCalls++; throw new Error('Unexpected AI call'); };
    t.after(() => Object.assign(gemini, originals));
    const server = await require('../../API').start();
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, endpoint, body) => {
        const response = await fetch(base + endpoint, {
            method, signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json' },
            ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) })
        });
        return { status: response.status, body: await response.json() };
    };

    await t.test('all 153 endpoints respond without 5xx, timeouts or remote AI calls', async () => {
        const endpoints = [...require('../../API/tests/fixtures/endpoints.before.json').endpoints,
            { method: 'POST', path: '/api/v1/sync/all' },
            { method: 'GET', path: '/api/v1/ai/summary-jobs/:id' }, { method: 'DELETE', path: '/api/v1/ai/summary-jobs/:id' }];
        assert.equal(endpoints.length, 153);
        for (const endpoint of endpoints) {
            const url = endpoint.path.replace(/:[A-Za-z]+/g, '999999');
            const response = await request(endpoint.method, url);
            assert.ok(response.status < 500, `${endpoint.method} ${url}: ${JSON.stringify(response)}`);
            assert.notEqual(response.status, 408, `${endpoint.method} ${url}`);
        }
        assert.equal(aiCalls, 0);
    });

    let sequence = 0;
    async function seed(kind, owner = 1) {
        const serial = ++sequence;
        const date = new Date(Date.UTC(2030, 0, serial)).toISOString().slice(0, 10);
        const definitions = {
            schedule: ['Timetables', 'timetable_id', `INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,source)
                VALUES(@owner,1,'Audit class','A1','CMC',2,'08:00','09:00',@date,@date,'MANUAL')`],
            task: ['Assignments', 'assignment_id', "INSERT INTO Assignments(student_id,subject_id,title,deadline) VALUES(@owner,1,'Private task',@date)"],
            checklist: ['Checklists', 'checklist_id', "INSERT INTO Checklists(student_id,title) VALUES(@owner,'Private checklist')"],
            notification: ['Reminders', 'reminder_id', "INSERT INTO Reminders(student_id,target_type,target_id,title,tier,remind_time) VALUES(@owner,'CUSTOM',@serial,'Private reminder','CUSTOM',@date)"],
            exam: ['Exams', 'exam_id', "INSERT INTO Exams(student_id,subject_id,exam_name,exam_date,exam_time,room,campus) VALUES(@owner,1,'Private exam',@date,'09:00','A1','CMC')"],
            plan: ['ExamStudyPlans', 'plan_id', "INSERT INTO ExamStudyPlans(student_id,exam_id,subject_id,phase_title,start_date,end_date) VALUES(@owner,@examId,1,'Private plan',@date,@date)"]
        };
        const [table, key, sql] = definitions[kind];
        const examId = kind === 'plan' ? (await seed('exam', owner)).id : null;
        const [row] = await q(`${sql} RETURNING ${key}`, { owner, date, serial, examId });
        return { id: row[key], table, key };
    }
    const rowFor = async resource => (await q(`SELECT * FROM ${resource.table} WHERE ${resource.key}=@id`, { id: resource.id }))[0];

    const cases = [
        { method: 'DELETE', route: '/schedules/:id', kind: 'schedule' },
        ...['tasks', 'checklist'].flatMap(mount => [
            { method: 'PUT', route: `/${mount}/:id`, kind: 'task', body: { title: 'Updated task' }, field: 'title', value: 'Updated task' },
            { method: 'PATCH', route: `/${mount}/:id/status`, kind: 'task', body: { status: 'COMPLETED' }, field: 'status', value: 'COMPLETED' },
            { method: 'PUT', route: `/${mount}/checklist/:id`, kind: 'checklist', body: { title: 'Updated checklist' }, field: 'title', value: 'Updated checklist' },
            { method: 'PATCH', route: `/${mount}/checklist/:id/done`, kind: 'checklist', body: { isCompleted: true }, field: 'is_completed', value: 1 },
            { method: 'DELETE', route: `/${mount}/checklist/:id`, kind: 'checklist' }
        ]),
        { method: 'PATCH', route: '/notifications/:id/read', kind: 'notification', field: 'is_sent', value: 1 },
        { method: 'PATCH', route: '/notifications/:id/sent', kind: 'notification', field: 'is_sent', value: 1 },
        { method: 'DELETE', route: '/notifications/:id', kind: 'notification' },
        { method: 'PUT', route: '/exams/:id', kind: 'exam', body: { examName: 'Updated exam' }, field: 'exam_name', value: 'Updated exam' },
        { method: 'PATCH', route: '/exams/study-plans/:id/status', kind: 'plan', body: { status: 'COMPLETED' }, field: 'status', value: 'COMPLETED' },
        { method: 'DELETE', route: '/exams/study-plans/:id', kind: 'plan' },
        { method: 'DELETE', route: '/exams/:id', kind: 'exam' }
    ];
    for (const item of cases) {
        const call = id => request(item.method, '/api/v1' + item.route.replace(':id', id), item.body);
        await t.test(`${item.method} ${item.route}: missing resource returns 404`, async () => {
            const response = await call(999999);
            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
            assert.equal(typeof response.body.message, 'string');
        });
        await t.test(`${item.method} ${item.route}: foreign resource returns 404 without changes or disclosure`, async () => {
            const resource = await seed(item.kind, 2);
            const before = await rowFor(resource);
            const response = await call(resource.id);
            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
            assert.equal(response.body.data, undefined);
            assert.deepEqual(await rowFor(resource), before);
        });
        await t.test(`${item.method} ${item.route}: owned resource succeeds and persists`, async () => {
            const resource = await seed(item.kind);
            assert.equal((await call(resource.id)).status, 200);
            const after = await rowFor(resource);
            if (item.method === 'DELETE') {
                assert.equal(after, undefined);
                assert.equal((await call(resource.id)).status, 404);
            } else {
                assert.equal(after[item.field], item.value);
                assert.equal((await call(resource.id)).status, 200);
            }
        });
        await t.test(`${item.method} ${item.route}: malformed IDs return 400`, async () => {
            for (const id of ['0', '-1', '1garbage', '1.5', '9007199254740992']) {
                assert.equal((await call(id)).status, 400, id);
            }
        });
    }

    await t.test('concurrent deletes report each row outcome independently', async () => {
        const resource = await seed('notification');
        const responses = await Promise.all([
            request('DELETE', `/api/v1/notifications/${resource.id}`),
            request('DELETE', '/api/v1/notifications/999999')
        ]);
        assert.deepEqual(responses.map(response => response.status), [200, 404]);
        assert.equal(await rowFor(resource), undefined);
    });
    await t.test('exam deletion still removes dependent plans and reminders atomically', async () => {
        const exam = await seed('exam');
        await q("INSERT INTO ExamStudyPlans(student_id,exam_id,subject_id,phase_title,start_date,end_date) VALUES(1,@id,1,'Cascade plan','2030-01-01','2030-01-01')", { id: exam.id });
        await q("INSERT INTO Reminders(student_id,target_type,target_id,title,tier,remind_time) VALUES(1,'EXAM',@id,'Cascade reminder','CUSTOM','2030-01-01')", { id: exam.id });
        assert.equal((await request('DELETE', `/api/v1/exams/${exam.id}`)).status, 200);
        assert.equal((await q('SELECT * FROM ExamStudyPlans WHERE exam_id=@id', { id: exam.id })).length, 0);
        assert.equal((await q("SELECT * FROM Reminders WHERE target_type='EXAM' AND target_id=@id", { id: exam.id })).length, 0);
    });
    await t.test('Progress returns metrics promptly by default even when AI is unavailable', async () => {
        gemini.ask = async () => { aiCalls++; return new Promise(() => {}); };
        const started = performance.now();
        for (const suffix of ['', '?advice=false']) {
            const response = await request('GET', '/api/v1/progress' + suffix);
            assert.equal(response.status, 200);
            assert.ok(response.body.data.metrics.weeklyStudyHours);
            assert.equal(response.body.data.advice, null);
        }
        const elapsed = performance.now() - started;
        assert.ok(elapsed < 1000, `Progress metrics took ${elapsed.toFixed(1)}ms`);
        assert.equal(aiCalls, 0);
        t.diagnostic(`Progress default + advice=false: ${elapsed.toFixed(1)}ms total`);
    });
    await t.test('Progress still supports explicit AI advice', async () => {
        gemini.ask = async () => { aiCalls++; return 'Explicit progress advice'; };
        const response = await request('GET', '/api/v1/progress?advice=true');
        assert.equal(response.status, 200);
        assert.equal(response.body.data.advice, 'Explicit progress advice');
        assert.equal(aiCalls, 1);
    });
});
