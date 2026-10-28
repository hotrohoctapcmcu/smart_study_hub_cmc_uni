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
const { createProvider, today, addDays } = require('./helpers/sprint3-provider.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-ai-e2e-sprint3-'));
app.setPath('userData', path.join(directory, 'browser'));

app.whenReady().then(async () => {
    let db, apiServer, staticServer, provider, window, exitCode = 0;
    try {
        const fake = await createProvider(); provider = fake.provider;
        Object.assign(process.env, { DB_PATH: path.join(directory, 'test.db'), API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test',
            GEMINI_ORIGIN: fake.origin, GEMINI_SESSION_DIR: directory, GEMINI_ENABLE_WEB_FALLBACK: 'false', GEMINI_TIMEOUT_MS: '2000' });
        db = await require('../database')();
        await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'SPRINT3UI','Sprint 3 UI','IT')");
        await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','CSDL')");
        await db.executeQuery("INSERT INTO Exams(student_id,subject_id,exam_name,exam_date,exam_time,duration_minutes,room,campus) VALUES(1,1,'CSDL',@date,'14:00',90,'A','CMC')", { date: addDays(today(), 3) });
        apiServer = await require('../API').start();
        const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
        const frontend = path.resolve(__dirname, '../Frontend');
        const staticApp = express();
        staticApp.get('/src/shared/config/app.config.js', (_req, res) => res.type('application/javascript').send(
            fs.readFileSync(path.join(frontend, 'src/shared/config/app.config.js'), 'utf8').replace('http://localhost:3001', apiUrl)));
        staticApp.use(express.static(frontend));
        staticServer = await new Promise(resolve => { const server = staticApp.listen(0, '127.0.0.1', () => resolve(server)); });
        const base = `http://127.0.0.1:${staticServer.address().port}/`;
        window = new BrowserWindow({ show: false, width: 1440, height: 1100, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } });
        window.webContents.on('console-message', event => {
            const details = event.details || event;
            if (details.level >= 3 || details.level === 'error') console.error('Renderer:', details.message);
        });
        const evaluate = async code => { try { return await window.webContents.executeJavaScript(code); } catch (error) { throw new Error(`${error.message}\nScript: ${code}`); } };
        const waitFor = async code => {
            const until = Date.now() + 20000;
            while (Date.now() < until) { if (await evaluate(code)) return; await new Promise(resolve => setTimeout(resolve, 80)); }
            throw new Error(`Timed out: ${code}\n${await evaluate("document.body.innerText.slice(-3000)")}`);
        };
        const goto = async route => { await evaluate(`import('/src/app/workspace.js').then(w=>w.changeCurrentTabRoute(${JSON.stringify(route)}))`); };
        const screenshot = async name => { await new Promise(resolve => setTimeout(resolve, 200)); const target = path.join(os.tmpdir(), `unistudy-sprint3-${name}.png`); fs.writeFileSync(target, (await window.webContents.capturePage()).toPNG()); console.log(`Screenshot: ${target}`); };

        await window.loadURL(base + '?route=quiz');
        await waitFor("Boolean(document.querySelector('#quizGenerateForm'))");
        await evaluate(`const form=document.querySelector('#quizGenerateForm');form.elements.subject.value='CSDL';form.elements.topic.value='JOIN';form.elements.count.value='3';form.requestSubmit()`);
        await waitFor("Boolean(document.querySelector('#quizAnswerForm'))");
        assert.equal(await evaluate("document.querySelector('#quizCurrent img') === null && window.__xss === undefined"), true);
        await evaluate(`document.querySelector('input[name=q1][value="1"]').click()`);
        await window.loadURL(base + '?route=quiz');
        await waitFor("Boolean(document.querySelector('[data-quiz-id]'))");
        await evaluate("document.querySelector('[data-quiz-id]').click()");
        await waitFor(`Boolean(document.querySelector('input[name=q1][value="1"]:checked'))`);
        await db.executeQuery("CREATE TRIGGER reject_quiz_submit BEFORE UPDATE ON AiQuizzes BEGIN SELECT RAISE(ABORT,'Save denied'); END");
        await evaluate(`document.querySelector('input[name=q2][value="1"]').click();document.querySelector('input[name=q3][value="1"]').click();document.querySelector('#quizAnswerForm').requestSubmit()`);
        await waitFor("document.querySelector('#quizStatus')?.dataset.error === 'true'");
        assert.equal(await evaluate(`Boolean(document.querySelector('input[name=q2][value="1"]:checked')) && !document.querySelector('#quizAnswerForm button').disabled`), true);
        await db.executeQuery('DROP TRIGGER reject_quiz_submit');
        await evaluate("document.querySelector('#quizAnswerForm').requestSubmit()");
        await waitFor("document.querySelector('.ai-study-score')?.textContent === '0/100'");
        assert.equal((await db.executeQuery('SELECT * FROM AiQuizzes WHERE submitted_at IS NOT NULL')).length, 1);
        await screenshot('quiz');
        console.log('PASS quiz generation, escaped AI output, answer recovery after reload, grading and persistence');

        await evaluate("document.querySelector('#quizResultWeakness').click()");
        await waitFor("document.querySelector('#weaknessContent')?.textContent.includes('0%')");
        await evaluate("document.querySelector('#weaknessAnalyze').click()");
        await waitFor("document.querySelector('#weaknessContent')?.textContent.includes('Viết một câu truy vấn')");
        await screenshot('weaknesses');
        await evaluate("document.querySelector('[data-practice]').click()");
        await waitFor("document.querySelector('#quizGenerateForm input[name=topic]')?.value === 'JOIN'");
        console.log('PASS measured weaknesses, persisted AI advice and topic practice navigation');

        await goto('exam-plan-ai');
        await waitFor("document.querySelector('#examAiSelect')?.value === '1'");
        await evaluate("document.querySelector('#examAiGenerate').requestSubmit()");
        await waitFor("Boolean(document.querySelector('#examAiConfirm'))");
        assert.equal(await evaluate("document.querySelector('#examAiPreview img') === null"), true);
        assert.equal((await db.executeQuery('SELECT * FROM ExamStudyPlans')).length, 0);
        const tomorrow = addDays(today(), 1);
        await db.executeQuery("INSERT INTO StudySchedules(student_id,title,study_date,start_time,end_time,duration_minutes) VALUES(1,'Conflict after preview',@date,'18:00','19:00',60)", { date: tomorrow });
        await evaluate("document.querySelector('input[name=phaseTitle0]').value='Lộ trình đã sửa';document.querySelector('input[name=confirmed]').click();document.querySelector('#examAiConfirm').requestSubmit()");
        await waitFor("document.querySelector('#examAiStatus')?.dataset.error === 'true'");
        assert.equal(await evaluate("document.querySelector('input[name=phaseTitle0]').value === 'Lộ trình đã sửa'"), true);
        assert.equal((await db.executeQuery('SELECT * FROM ExamStudyPlans')).length, 0);
        await db.executeQuery("DELETE FROM StudySchedules WHERE title='Conflict after preview'");
        await evaluate("document.querySelector('#examAiConfirm').requestSubmit()");
        await waitFor("Boolean(document.querySelector('#examAiSavedBack'))");
        assert.equal((await db.executeQuery('SELECT * FROM ExamStudyPlans'))[0].phase_title, 'Lộ trình đã sửa');
        assert.equal((await db.executeQuery('SELECT * FROM StudySchedules')).length, 1);
        await evaluate("document.querySelector('#examAiSavedBack').click()");
        await waitFor("document.querySelector('.roadmap-container')?.textContent.includes('Lộ trình đã sửa')");
        await evaluate("document.querySelector('[data-phase-status]').click()");
        await waitFor("document.querySelector('.roadmap-container')?.textContent.includes('Đã hoàn thành')");
        assert.equal((await db.executeQuery('SELECT status FROM ExamStudyPlans'))[0].status, 'COMPLETED');
        await screenshot('exams');
        console.log('PASS exam plan preview, edits, explicit confirmation, real calendar writes and phase completion');

        await goto('leave-letter');
        await waitFor("Boolean(document.querySelector('#leaveGenerateForm'))");
        await evaluate(`const form=document.querySelector('#leaveGenerateForm');form.elements.date.value=${JSON.stringify(addDays(today(), 1))};form.elements.subject.value='CSDL';form.elements.reason.value='Bị ốm';form.requestSubmit()`);
        await waitFor("document.querySelector('#leaveContent')?.value.includes('ĐƠN XIN PHÉP')");
        assert.equal(await evaluate("document.querySelector('.ai-study-page img') === null && window.__xss === undefined"), true);
        await evaluate("document.querySelector('#leaveContent').value+='\\nNội dung đã chỉnh sửa';document.querySelector('#leaveContent').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#leaveSave').click()");
        await waitFor("document.querySelector('#leaveStatus')?.textContent === 'Đã lưu bản nháp.'");
        await window.loadURL(base + '?route=leave-letter');
        await waitFor("document.querySelector('#leaveContent')?.value.includes('Nội dung đã chỉnh sửa')");
        assert.equal((await db.executeQuery('SELECT * FROM AiLeaveDrafts')).length, 1);
        const draftId = (await db.executeQuery('SELECT * FROM AiLeaveDrafts'))[0].draft_id;
        const docx = await fetch(`${apiUrl}/api/v1/ai/leave-drafts/${draftId}/docx`);
        assert.equal(Buffer.from(await docx.arrayBuffer()).subarray(0, 2).toString(), 'PK');
        await screenshot('leave-letter');
        console.log('PASS leave generation, editable content, draft recovery and DOCX export');

        await goto('ai-tutor');
        await waitFor("document.querySelector('#aiTutorPagePanel #aiChatInput')?.disabled === false");
        await evaluate("document.querySelector('#aiTutorPagePanel #aiChatInput').value='Giải thích JOIN';document.querySelector('#aiTutorPagePanel #aiChatForm').requestSubmit()");
        await waitFor("document.querySelector('#aiTutorPagePanel #aiChatBody')?.textContent.includes('Gia sư giải thích')");
        await window.loadURL(base + '?route=ai-tutor');
        await waitFor("document.querySelector('#aiTutorPagePanel #aiChatBody')?.textContent.includes('Giải thích JOIN')");
        fake.state.status = 403;
        await evaluate("document.querySelector('#aiTutorPagePanel #aiChatInput').value='Cho ví dụ tiếp theo';document.querySelector('#aiTutorPagePanel #aiChatForm').requestSubmit()");
        await waitFor("Boolean(document.querySelector('#aiTutorPagePanel #aiQuestionRetryBtn'))");
        fake.state.status = 200;
        await evaluate("document.querySelector('#aiTutorPagePanel #aiQuestionRetryBtn').click()");
        await waitFor("document.querySelectorAll('#aiTutorPagePanel .ai-msg-assistant').length === 2 && !document.querySelector('#aiQuestionRetryBtn') && !document.querySelector('#aiTutorPagePanel [data-ai-pending]')");
        assert.equal(JSON.parse((await db.executeQuery('SELECT messages_json FROM AiConversations'))[0].messages_json).length, 4);
        assert.equal((await db.executeQuery('SELECT * FROM AiConversations')).length, 1);
        await evaluate("document.querySelector('#aiNewConversation').click()");
        await waitFor("document.querySelector('#aiTutorPagePanel #aiChatBody')?.textContent.includes('Bạn cần học gì hôm nay?')");
        await evaluate("const select=document.querySelector('#aiHistorySelect');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))");
        await waitFor("document.querySelector('#aiTutorPagePanel #aiChatBody')?.textContent.includes('Giải thích JOIN')");
        assert.equal(await evaluate("window.__xss === undefined"), true);
        await screenshot('tutor');
        console.log('PASS chat survives reload, new conversations and selecting saved history');
    } catch (error) { exitCode = 1; console.error(error.stack || error.message); }
    finally {
        if (window) window.destroy();
        for (const server of [staticServer, apiServer, provider]) if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        spawn(process.execPath, [path.join(__dirname, 'helpers/cleanup-electron-temp.cjs'), directory, String(process.pid)], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, detached: true, stdio: 'ignore'
        }).unref();
        app.exit(exitCode);
    }
});
