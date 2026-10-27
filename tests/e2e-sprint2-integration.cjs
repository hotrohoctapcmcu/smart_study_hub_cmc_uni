'use strict';

const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
    const environment = { ...process.env };
    delete environment.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, [__filename], { env: environment, windowsHide: true, stdio: 'inherit' });
    process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = electron;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-branches-e2e-'));
process.env.DB_PATH = path.join(directory, 'test.db');
process.env.API_PORT = '0';
process.env.APP_USER_ID = '1';
process.env.NODE_ENV = 'test';
app.setPath('userData', path.join(directory, 'browser'));

app.whenReady().then(async () => {
    let database;
    let apiServer;
    let staticServer;
    let window;
    let exitCode = 0;
    try {
        database = await require('../database')();
        await database.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'E2E','Integration student','Test')");
        await database.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'TEST','Integration subject')");
        const task = await database.themBaiTap(1, { subjectId: 1, title: 'Integration task', deadline: '2030-12-31T18:00:00+07:00' });
        const item = await database.themChecklist(1, { assignmentId: task.assignment_id, title: 'Remove this item' });
        const session = await database.batDauPomodoro(1);
        await database.ketThucPomodoro(session.session_id, { totalFocusMinutes: 30, completedCycles: 1 });
        apiServer = await require('../API').start();
        const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
        const frontend = path.resolve(__dirname, '../Frontend');
        const staticApp = express();
        staticApp.get('/src/shared/config/app.config.js', (_req, res) => {
            const config = fs.readFileSync(path.join(frontend, 'src/shared/config/app.config.js'), 'utf8');
            res.type('application/javascript').send(config.replace('http://localhost:3001', apiUrl));
        });
        staticApp.use(express.static(frontend));
        staticServer = await new Promise(resolve => {
            const server = staticApp.listen(0, '127.0.0.1', () => resolve(server));
        });
        window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: {
            contextIsolation: true, nodeIntegration: false, sandbox: true
        } });
        const runtimeErrors = [];
        window.webContents.on('console-message', (_event, level, message) => {
            if (level >= 3) runtimeErrors.push(message);
        });
        await window.loadURL(`http://127.0.0.1:${staticServer.address().port}/?route=progress`);
        const evaluate = code => window.webContents.executeJavaScript(code);
        const waitFor = async code => {
            const deadline = Date.now() + 10000;
            while (Date.now() < deadline) {
                if (await evaluate(code)) return;
                await new Promise(resolve => setTimeout(resolve, 75));
            }
            throw new Error(`Timed out: ${code}`);
        };
        await waitFor("document.querySelector('[aria-label=\"Tiến độ đã lưu\"]')?.textContent.includes('0.5 giờ học')");
        await waitFor("document.querySelector('[aria-label=\"Tiến độ đã lưu\"]')?.textContent.includes('Bản đồ thời gian theo khoảng đã chọn')");
        console.log('PASS Electron renders database progress and Time Map through the real API');
        await evaluate(`import('/src/features/tasks/tasks.service.js').then(async service => {
            await service.updateTaskApi('task-${task.assignment_id}', { removedChecklistIds: [${item.checklist_id}], checklist: [{ text: 'Persisted replacement', done: true }] });
        })`);
        const checklists = await database.layChecklist(1);
        assert.equal(checklists.length, 1);
        assert.equal(checklists[0].title, 'Persisted replacement');
        assert.equal(checklists[0].is_completed, 1);
        console.log('PASS renderer persists checklist removal, addition and completed state');
        await evaluate(`import('/src/features/tasks/tasks.service.js').then(service => service.deleteTaskApi('task-${task.assignment_id}'))`);
        assert.equal((await database.layDanhSachDeadline(1)).length, 0);
        assert.equal((await database.layChecklist(1)).length, 0);
        assert.deepEqual(runtimeErrors, []);
        console.log('PASS renderer deletes task and related checklist without runtime errors');
    } catch (error) {
        exitCode = 1;
        console.error(error.stack || error.message);
    } finally {
        if (window) window.destroy();
        if (staticServer) { staticServer.closeAllConnections(); await new Promise(resolve => staticServer.close(resolve)); }
        if (apiServer) { apiServer.closeAllConnections(); await new Promise(resolve => apiServer.close(resolve)); }
        if (database) await database.closePool();
        spawn(process.execPath, [path.join(__dirname, 'helpers/cleanup-electron-temp.cjs'), directory, String(process.pid)], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, detached: true, stdio: 'ignore'
        }).unref();
        app.exit(exitCode);
    }
});
