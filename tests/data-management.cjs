'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const data = require('../electron/data-management');

function storage(values = {}) {
    const result = { ...values };
    Object.defineProperties(result, {
        getItem: { value: key => Object.hasOwn(result, key) ? result[key] : null },
        setItem: { value: (key, value) => { result[key] = String(value); } },
        removeItem: { value: key => { delete result[key]; } }
    });
    return result;
}

test('selective desktop reset runs on isolated data, respects dependencies and preserves unselected content', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'study-data-reset-'));
    Object.assign(process.env, { DB_PATH: path.join(directory, 'test.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
        EDUX_ACCOUNTS_PATH: path.join(directory, 'accounts'), EDUX_COOKIE_PATH: path.join(directory, 'cookie.txt'),
        GEMINI_SESSION_DIR: path.join(directory, 'gemini') });
    const app = { getPath: () => path.join(directory, 'profile') };
    const cleared = [], electron = { app, session: {
        fromPartition: partition => ({ clearStorageData: async () => cleared.push(partition) }),
        defaultSession: { clearStorageData: async options => cleared.push(options) }
    } };
    const db = await require('../database')();
    t.after(async () => {
        await db.closePool();
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('study-data-reset-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'RESET','Keep profile','IT')");
    await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'RESET','Keep subject')");
    await db.executeQuery("INSERT INTO Notebooks(notebook_id,student_id,title) VALUES(1,1,'Keep notebook')");
    const key = randomUUID() + '.txt';
    fs.mkdirSync(process.env.DOCUMENTS_PATH, { recursive: true });
    fs.writeFileSync(path.join(process.env.DOCUMENTS_PATH, key), 'selected document');
    fs.writeFileSync(path.join(process.env.DOCUMENTS_PATH, 'unrelated.txt'), 'unrelated user file');
    await db.executeQuery("INSERT INTO EduxDocuments(document_id,student_id,title,storage_key,source) VALUES(1,1,'Delete document',@key,'LOCAL')", { key });
    await db.executeQuery("INSERT INTO Notes(student_id,notebook_id,title,content,document_id) VALUES(1,1,'Keep note','Keep content',1)");
    await db.executeQuery("INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date) VALUES(1,1,'Delete class','A1','CMC',2,'08:00','09:00','2099-01-01','2099-01-01')");
    const request = { id: randomUUID(), categories: ['timetable', 'documents'] };
    data.writeRequest(app, request);
    await data.applyPendingReset(electron);
    assert.equal((await db.executeQuery('SELECT * FROM Timetables')).length, 0);
    assert.equal((await db.executeQuery('SELECT * FROM EduxDocuments')).length, 0);
    const [note] = await db.executeQuery('SELECT * FROM Notes');
    assert.equal(note.content, 'Keep content');
    assert.equal(note.document_id, null);
    assert.equal((await db.executeQuery('SELECT full_name FROM Students'))[0].full_name, 'Keep profile');
    assert.equal(fs.existsSync(path.join(process.env.DOCUMENTS_PATH, key)), false);
    assert.equal(fs.readFileSync(path.join(process.env.DOCUMENTS_PATH, 'unrelated.txt'), 'utf8'), 'unrelated user file');
    assert.equal(cleared.length, 0, 'unselected sessions stay intact');
    await data.applyPendingReset(electron); // restart recovery remains idempotent
    data.completeReset(app, request.id);
    assert.equal(data.readResetRequest(app), null);

    const localStorage = storage({ 'ssh-textbooks-v1:owner': 'drawing', 'ssh:typed-notebooks:v1:owner': 'draft', 'ssh-preferences': 'theme', other: 'keep' });
    const sandbox = { localStorage, sessionStorage: { clear() {} } };
    const script = data.resetStorageScript({ id: randomUUID(), categories: ['notes'] });
    vm.runInNewContext(script, sandbox);
    assert.equal(localStorage.getItem('ssh-textbooks-v1:owner'), null);
    assert.equal(localStorage.getItem('ssh:typed-notebooks:v1:owner'), null);
    assert.equal(localStorage.getItem('ssh-preferences'), 'theme');
    localStorage.setItem('ssh-textbooks-v1:owner', 'new drawing');
    vm.runInNewContext(script, sandbox);
    assert.equal(localStorage.getItem('ssh-textbooks-v1:owner'), 'new drawing', 'reload cannot erase newly created content');

    await db.executeQuery("INSERT INTO Assignments(assignment_id,student_id,subject_id,title,deadline) VALUES(1,1,1,'Task to delete','2099-01-01')");
    await db.executeQuery("INSERT INTO Checklists(student_id,subject_id,assignment_id,title) VALUES(1,1,1,'Linked checklist')");
    await db.executeQuery("INSERT INTO Exams(exam_id,student_id,subject_id,exam_date,exam_time,room,campus) VALUES(1,1,1,'2099-01-01','08:00','A1','CMC')");
    await db.executeQuery("INSERT INTO ExamStudyPlans(student_id,exam_id,subject_id,phase_title,start_date,end_date) VALUES(1,1,1,'Linked plan','2098-12-01','2098-12-31')");
    await db.executeQuery("INSERT INTO SchoolEmails(user_id,external_id,payload,task_id,exam_id) VALUES(1,'keep-email','{}',1,1)");
    const linked = { id: randomUUID(), categories: ['tasks', 'exams'] };
    data.writeRequest(app, linked);
    await data.applyPendingReset(electron);
    const [email] = await db.executeQuery('SELECT * FROM SchoolEmails');
    assert.equal(email.task_id, null); assert.equal(email.exam_id, null);
    assert.equal((await db.executeQuery('SELECT * FROM Checklists')).length, 0);
    assert.equal((await db.executeQuery('SELECT * FROM ExamStudyPlans')).length, 0);
    assert.equal((await db.executeQuery('PRAGMA foreign_key_check')).length, 0);
    data.completeReset(app, linked.id);

    const handlers = new Map(); let restarted = 0;
    data.registerDataBridge({ electron: { app: { ...app, relaunch: () => restarted++, quit() {} },
        ipcMain: { handle: (name, handler) => handlers.set(name, handler) } } });
    const reset = handlers.get('data:reset'), event = { senderFrame: { url: 'studyhub://app/settings' } };
    assert.throws(() => reset({ senderFrame: { url: 'https://example.invalid' } }, { categories: ['all'], confirmation: 'XÓA' }), /không hợp lệ/);
    for (const categories of [[], ['unknown'], ['../outside']]) assert.throws(() => reset(event, { categories, confirmation: 'XÓA' }), /chọn/);
    assert.throws(() => reset(event, { categories: ['all'], confirmation: '' }), /XÓA/);
    assert.equal(data.readResetRequest(app), null);
    assert.ok((await handlers.get('data:catalog')(event)).some(item => item.id === 'notes' && item.count > 0));
    assert.equal(reset(event, { categories: ['notes'], confirmation: 'XÓA' }).restarting, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(restarted, 1);
    assert.equal((await db.executeQuery('SELECT * FROM Notes')).length, 1, 'request only schedules deletion');
    const pending = await data.applyPendingReset(electron);
    assert.equal((await db.executeQuery('SELECT * FROM Notes')).length, 0);
    data.completeReset(app, pending.id);

    fs.mkdirSync(process.env.EDUX_ACCOUNTS_PATH, { recursive: true });
    fs.writeFileSync(path.join(process.env.EDUX_ACCOUNTS_PATH, '1.json'), '{}');
    fs.writeFileSync(process.env.EDUX_COOKIE_PATH, 'test-only');
    data.writeRequest(app, { id: randomUUID(), categories: ['all'] });
    const full = await data.applyPendingReset(electron);
    assert.equal((await db.executeQuery('SELECT * FROM Students')).length, 0);
    assert.equal((await db.executeQuery('SELECT * FROM Subjects')).length, 0);
    assert.equal(fs.existsSync(path.join(process.env.EDUX_ACCOUNTS_PATH, '1.json')), false);
    assert.equal(fs.existsSync(process.env.EDUX_COOKIE_PATH), false);
    assert.equal(cleared.length, 3);
    await db.executeQuery("INSERT INTO Students(student_code,full_name,major) VALUES('NEW','New profile','IT')");
    assert.equal((await db.executeQuery('SELECT student_id FROM Students'))[0].student_id, 1);
    data.completeReset(app, full.id);
    const portable = path.join(directory, 'portable-fixture.exe');
    fs.writeFileSync(portable, 'test-only');
    let relaunched, quit = false;
    data.restartApp({ isPackaged: true, relaunch: options => { relaunched = options; }, quit: () => { quit = true; } }, {
        PORTABLE_EXECUTABLE_FILE: portable
    }, ['extracted-app.exe', '--release-smoke']);
    assert.deepEqual(relaunched, { execPath: portable, args: ['--release-smoke'] });
    assert.equal(quit, true);
    data.restartApp({ isPackaged: false, relaunch: options => { relaunched = options; }, quit() {} }, {
        PORTABLE_EXECUTABLE_FILE: portable
    });
    assert.equal(relaunched, undefined, 'source builds never use a portable environment path');
});
