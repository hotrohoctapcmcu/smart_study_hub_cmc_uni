'use strict';

const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
    process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = electron;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-sprint2-ui-'));
process.env.DB_PATH = path.join(directory, 'test.db');
process.env.API_PORT = '0'; process.env.APP_USER_ID = '1'; process.env.NODE_ENV = 'test';
app.setPath('userData', path.join(directory, 'browser'));

app.whenReady().then(async () => {
    let db, apiServer, staticServer, window, exitCode = 0;
    try {
        db = await require('../database')();
        await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'S2UI','Sprint 2 UI','IT')");
        await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','SQL')");
        require('../CRWEB/OUTLOOK').listMessages = async () => ({ source: 'microsoft-graph', account: 'test@cmcu.edu.vn', messages: [
            { id: 'real-shaped-email', sender: 'teacher@cmcu.edu.vn', senderName: 'Teacher <script>bad()</script>', subject: 'Nộp bài SQL', preview: 'Hạn nộp SQL',
                body: 'Môn học: SQL\nHạn nộp: 23:59 ngày 30/10/2026.', date: '2026-10-27T01:00:00Z', isRead: false }
        ] });
        apiServer = await require('../API').start();
        const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
        const frontend = path.resolve(__dirname, '../Frontend');
        const staticApp = express();
        staticApp.get('/src/shared/config/app.config.js', (_req, res) => res.type('application/javascript').send(
            fs.readFileSync(path.join(frontend, 'src/shared/config/app.config.js'), 'utf8').replace('http://localhost:3001', apiUrl)));
        staticApp.use(express.static(frontend));
        staticServer = await new Promise(resolve => { const server = staticApp.listen(0, '127.0.0.1', () => resolve(server)); });
        const url = `http://127.0.0.1:${staticServer.address().port}/?route=documents`;
        window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
        const errors = [];
        window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
        const evaluate = code => window.webContents.executeJavaScript(code);
        const waitFor = async code => {
            const until = Date.now() + 15000;
            while (Date.now() < until) {
                if (await evaluate(code)) return;
                await new Promise(resolve => setTimeout(resolve, 80));
            }
            throw new Error(`Timed out: ${code}`);
        };
        await window.loadURL(url);
        await waitFor("document.querySelector('#learningLibraryStatus')?.textContent === ''");
        await evaluate(`document.querySelector('#openUploadDocBtn').click();
            const form=document.querySelector('#uploadDocForm');
            form.elements.title.value='Textbook <img src=x onerror=alert(1)>';
            form.elements.subject.value='SQL'; form.elements.tags.value='review'; form.elements.isTextbook.checked=true;
            const dt=new DataTransfer(); dt.items.add(new File(['SQL textbook content'], 'textbook.txt', {type:'text/plain'}));
            form.elements.file.files=dt.files; form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
        await waitFor("document.querySelector('.doc-table')?.textContent.includes('Textbook <img')");
        assert.equal(await evaluate("document.querySelector('.doc-table img') === null"), true);
        const doc = (await db.executeQuery('SELECT * FROM EduxDocuments'))[0];
        assert.equal(await (await fetch(`${apiUrl}/api/v1/documents/${doc.document_id}/file`)).text(), 'SQL textbook content');
        console.log('PASS file picker uploads real bytes and escapes document metadata');

        await evaluate("document.querySelector('[data-doc-tab=notes]').click();document.querySelector('#paperEmptyCreateBtn').click()");
        await waitFor("Boolean(document.querySelector('#noteContentTextarea'))");
        await evaluate(`document.querySelector('#noteTitleInput').value='JOIN notes';
            document.querySelector('#noteContentTextarea').value='Persisted editor text </textarea><script>window.__xss=1</script>';
            document.querySelector('#noteTagsInput').value='review';
            document.querySelector('#noteChapterInput').value='Chapter 2';
            document.querySelector('#noteDocumentSelect').value='${doc.document_id}';
            document.querySelector('#noteContentTextarea').dispatchEvent(new Event('input',{bubbles:true}));
            document.querySelector('[data-doc-tab=docs]').click();`);
        await waitFor("import('/src/shared/services/workspace-api.js').then(s=>s.workspaceRequest('GET','/notes')).then(notes=>notes[0]?.title==='JOIN notes')");
        await window.loadURL(url);
        await waitFor("document.querySelector('#learningLibraryStatus')?.textContent === ''");
        await evaluate("document.querySelector('[data-doc-tab=notes]').click()");
        await waitFor("document.querySelector('#noteTitleInput')?.value === 'JOIN notes'");
        assert.equal(await evaluate("window.__xss === undefined && document.querySelector('#noteContentTextarea').value.includes('</textarea>')"), true);
        assert.equal((await db.executeQuery('SELECT chapter,document_id FROM Notes'))[0].document_id, doc.document_id);
        console.log('PASS autosave survives tab changes and reload; textbook and chapter persist');

        await db.executeQuery("CREATE TRIGGER reject_note_test BEFORE UPDATE ON Notes BEGIN SELECT RAISE(ABORT,'Save denied'); END");
        await evaluate("document.querySelector('#noteContentTextarea').value='Recoverable draft';document.querySelector('#noteContentTextarea').dispatchEvent(new Event('input',{bubbles:true}))");
        await waitFor("document.querySelector('#saveStatusText')?.textContent.includes('Chưa lưu được')");
        assert.notEqual((await db.executeQuery('SELECT content FROM Notes'))[0].content, 'Recoverable draft');
        await db.executeQuery('DROP TRIGGER reject_note_test');
        await evaluate("document.querySelector('#saveNoteManualBtn').click()");
        await waitFor("document.querySelector('#saveStatusText')?.textContent.includes('Đã lưu vào sổ tay')");
        assert.equal((await db.executeQuery('SELECT content FROM Notes'))[0].content, 'Recoverable draft');
        await evaluate("import('/src/features/documents/documents.service.js').then(s=>s.updateNote(s.getNotes()[0].id,{content:'Draft restored after reload',syncPending:true}))");
        await window.loadURL(url);
        await waitFor("document.querySelector('#learningLibraryStatus')?.textContent === ''");
        await evaluate("document.querySelector('[data-doc-tab=notes]').click()");
        await waitFor("document.querySelector('#noteContentTextarea')?.value === 'Draft restored after reload'");
        assert.equal((await db.executeQuery('SELECT content FROM Notes'))[0].content, 'Draft restored after reload');
        assert.equal(await evaluate("import('/src/features/documents/documents.service.js').then(s=>Boolean(s.getNotes()[0].syncPending))"), false);
        console.log('PASS failed autosave reports the error and retains a draft that can be retried');

        await evaluate("const input=document.querySelector('#globalSearchInput');input.value='#review';input.dispatchEvent(new Event('input',{bubbles:true}))");
        await waitFor("document.querySelectorAll('[data-search-result]').length === 2");
        await evaluate("[...document.querySelectorAll('[data-search-result]')].find(button=>button.textContent.includes('JOIN notes')).click()");
        await waitFor("document.querySelector('#noteTitleInput')?.value === 'JOIN notes'");
        console.log('PASS mounted global search finds tags and opens the matching note');

        await evaluate("import('/src/features/pomodoro/pomodoro.service.js').then(s=>s.startSession(0,0,3))");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await evaluate("import('/src/features/pomodoro/pomodoro.service.js').then(s=>s.pauseSession())");
        await new Promise(resolve => setTimeout(resolve, 300));
        await evaluate("import('/src/features/pomodoro/pomodoro.service.js').then(s=>s.resumeSession())");
        await waitFor("import('/src/shared/services/workspace-api.js').then(s=>s.workspaceRequest('GET','/pomodoro')).then(rows=>rows.length===1)");
        const session = (await db.executeQuery('SELECT * FROM PomodoroSessions'))[0];
        assert.equal(session.actual_study_seconds, 3); assert.equal(JSON.parse(session.focus_segments).length, 2);
        console.log('PASS running renderer timer saves actual focus segments to SQLite');

        await evaluate("import('/src/app/workspace.js').then(w=>w.changeCurrentTabRoute('notifications'))");
        await waitFor("Boolean(document.querySelector('#syncEmailNowBtn'))");
        await evaluate("document.querySelector('#syncEmailNowBtn').click()");
        await waitFor("Boolean(document.querySelector('[data-create-task-mail-id]'))");
        assert.equal(await evaluate("document.querySelector('.notifications-container script') === null"), true);
        await evaluate("document.querySelector('[data-create-task-mail-id]').click()");
        await waitFor("import('/src/shared/services/workspace-api.js').then(s=>s.workspaceRequest('GET','/email')).then(rows=>rows[0]?.isProcessed)");
        assert.equal((await db.executeQuery('SELECT * FROM Assignments')).length, 1);
        assert.equal((await db.executeQuery('SELECT task_id FROM SchoolEmails'))[0].task_id, 1);
        await waitFor("document.querySelector('.notifications-container')?.textContent.includes('Đã thêm vào Công việc')");
        await db.luuBaiTapEDUX(1, [{ id: 'edux-ui', subject: 'SQL', title: 'EDUX integration' }]);
        await evaluate("import('/src/features/tasks/tasks.service.js').then(async s=>{await s.fetchTasksFromApi();await s.updateTaskApi('edux-ui',{status:'Hoàn thành'});})");
        assert.equal((await db.executeQuery("SELECT status FROM EduxAssignments WHERE external_id='edux-ui'"))[0].status, 'Hoàn thành');
        const metrics = (await (await fetch(`${apiUrl}/api/v1/progress?advice=false`)).json()).data.metrics;
        assert.equal(metrics.subjects[0].completionRate, 50);
        console.log('PASS EDUX completion from the renderer reaches the shared progress report');
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.workspace-toolbar')).display === 'flex'"), true);
        assert.deepEqual(errors.filter(message => !message.includes('Save denied')), []);
        const screenshot = path.join(os.tmpdir(), 'unistudy-sprint2-notifications.png');
        await new Promise(resolve => setTimeout(resolve, 200));
        fs.writeFileSync(screenshot, (await window.webContents.capturePage()).toPNG());
        console.log('PASS inbox sync and deadline confirmation persist through the real API');
    } catch (error) { exitCode = 1; console.error(error.stack || error.message); }
    finally {
        if (window) window.destroy();
        for (const server of [staticServer, apiServer]) if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        spawn(process.execPath, [path.join(__dirname, 'helpers/cleanup-electron-temp.cjs'), directory, String(process.pid)], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, detached: true, stdio: 'ignore'
        }).unref();
        app.exit(exitCode);
    }
});
