'use strict';

const electron = require('electron');
const { spawnSync } = require('node:child_process');
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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-learning-e2e-'));
app.setPath('userData', path.join(directory, 'browser'));

app.whenReady().then(async () => {
    let db, api, assets, provider, window, releaseAi, exitCode = 0;
    try {
        const fake = await createProvider(); provider = fake.provider;
        fake.state.override = prompt => {
            const part = prompt.match(/NỘI DUNG PHẦN ([AB]):\n/);
            if (part) {
                assert.ok(prompt.includes('NỘI_DUNG_GỐC_sql-slide'));
                return `TÓM_TẮT_PHẦN_${part[1]}: SQL và JOIN.`;
            }
            if (prompt.includes('A+B — TOÀN MÔN')) {
                assert.ok(prompt.includes('TÓM_TẮT_PHẦN_A') && prompt.includes('TÓM_TẮT_PHẦN_B'));
                return 'BẢN TÓM TẮT TOÀN MÔN: SQL kết hợp dữ liệu bằng JOIN. <img src=x onerror=window.__xss=1>';
            }
            assert.ok(prompt.includes('BẢN TÓM TẮT ĐÃ LƯU:\nBẢN TÓM TẮT TOÀN MÔN:'));
            assert.ok(!prompt.includes('NỘI_DUNG_GỐC_sql-slide1'));
            return JSON.stringify({ cards: [1, 2].map(index => ({ front: `Nội dung ${index}?`, back: 'JOIN kết hợp các dòng theo điều kiện. <script>window.__xss=1</script>' })) });
        };
        Object.assign(process.env, { DB_PATH: path.join(directory, 'test.db'), API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test',
            GEMINI_ORIGIN: fake.origin, GEMINI_SESSION_DIR: directory, GEMINI_TIMEOUT_MS: '3000' });
        db = await require('../database')();
        const q = (...args) => db.executeQuery(...args);
        await q("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'LEARNUI','Learning UI','IT')");
        await q("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','Cơ sở dữ liệu'),(2,'OLD','Môn kỳ cũ'),(3,'NEXT','Môn kỳ sau')");
        await q(`INSERT INTO LearningCourses(user_id,course_id,subject_name,subject_code,chapters_json,source_hash,complete,updated_at)
            VALUES(1,'sql-course','Cơ sở dữ liệu','SQL',@chapters,'old',0,'2026-01-01')`, {
            chapters: JSON.stringify([{ id: 'sql-ch1', title: 'Truy vấn SQL', complete: false, documents: [], error: 'Không đọc được học liệu EDUX (HTTP 404).' }])
        });
        await q(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,semester,academic_year,source)
            VALUES(1,1,'SQL01','A1','CMC',4,'08:00','10:00',@start,@end,'1','2026-2027','IU'),
            (1,2,'OLD01','A1','CMC',4,'08:00','10:00','2025-01-01','2025-05-01','2','2024-2025','IU'),
            (1,3,'NEXT01','A1','CMC',4,'08:00','10:00','2030-01-01','2030-05-01','2','2029-2030','IU')`, { start: addDays(today(), -14), end: addDays(today(), 14) });
        await db.luuBaiTapEDUX(1, [{ id: 'edux-sql-task', title: 'Bài chương JOIN', subject: 'Cơ sở dữ liệu', subjectCode: 'SQL' },
            { id: 'edux-old-task', title: 'Bài kỳ cũ', subject: 'Môn kỳ cũ', subjectCode: 'OLD' }]);
        const edux = require('../CRWEB/modules/EDUX');
        edux.layHocPhan = async () => [{ id: 'sql-course', subject_code: 'SQL', name: 'Cơ sở dữ liệu' }, { id: 'old-course', subject_code: 'OLD', name: 'Môn kỳ cũ' }];
        edux.layChuongTrinhHoc = async id => { assert.equal(id, 'sql-course'); return [{ id: 'sql-ch1', title: 'Truy vấn SQL' }]; };
        edux.laySlide = async () => [{ id: 'sql-slide1', title: 'SELECT', document_number: 1 }, { id: 'sql-slide2', title: 'JOIN', document_number: 2 }];
        edux.layNoiDungSlide = async id => `<p>NỘI_DUNG_GỐC_${id}: SELECT và JOIN.</p><script>window.__sourceXss=1</script>`;
        require('../API/utils/edux-session').saveSession(1, { cookie: 'test-only', email: 'test@example.invalid' });
        api = await require('../API').start();
        const apiUrl = `http://127.0.0.1:${api.address().port}`;
        const frontend = path.resolve(__dirname, '../Frontend');
        const staticApp = express();
        staticApp.get('/src/shared/config/app.config.js', (_req, res) => res.type('application/javascript').send(
            fs.readFileSync(path.join(frontend, 'src/shared/config/app.config.js'), 'utf8').replace('http://localhost:3001', apiUrl)));
        staticApp.use(express.static(frontend));
        assets = await new Promise(resolve => { const server = staticApp.listen(0, '127.0.0.1', () => resolve(server)); });
        const url = `http://127.0.0.1:${assets.address().port}/`;
        window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, offscreen: true } });
        const rendererErrors = [];
        window.webContents.on('console-message', event => { const detail = event.details || event; if (detail.level >= 3 || detail.level === 'error') rendererErrors.push(detail.message); });
        const evaluate = code => window.webContents.executeJavaScript(code);
        const waitFor = async code => {
            const until = Date.now() + 20000;
            while (Date.now() < until) { if (await evaluate(code)) return; await new Promise(resolve => setTimeout(resolve, 80)); }
            throw new Error(`Timed out: ${code}\n${await evaluate('document.body.innerText.slice(-3500)')}`);
        };
        const goto = route => evaluate(`import('/src/app/workspace.js').then(module => module.changeCurrentTabRoute(${JSON.stringify(route)}))`);
        await window.loadURL(url + '?route=documents');
        await waitFor("Boolean(document.querySelector('[data-course-id]'))");
        assert.equal(await evaluate("document.querySelectorAll('[data-course-id]').length"), 1);
        assert.equal(await evaluate("document.querySelector('[data-course-id]').textContent.includes('Cơ sở dữ liệu')"), true);
        assert.equal(await evaluate("document.querySelector('.course-knowledge-failures')?.textContent.includes('404')"), true);
        fake.state.beforeReply = () => new Promise(resolve => { releaseAi = resolve; });
        await evaluate("document.querySelector('[data-sync-knowledge]').click()");
        await waitFor("document.querySelectorAll('.course-knowledge-source').length===2 && !document.querySelector('.course-knowledge-failures')");
        assert.equal(await evaluate("document.querySelector('.course-knowledge-summary')===null"), true);
        assert.equal(typeof releaseAi, 'function');
        const running = (await(await fetch(`${apiUrl}/api/v1/learning/courses`)).json()).data.jobs;
        assert.ok(running.some(job => job.status === 'running' && job.phase === 'summaries'));
        const exported = await fetch(`${apiUrl}/api/v1/learning/courses/sql-course/source`);
        assert.match(exported.headers.get('content-disposition'), /^attachment/);
        const sourceText = await exported.text();
        assert.ok(sourceText.includes('[1] SELECT') && sourceText.includes('NỘI_DUNG_GỐC_sql-slide2'));
        assert.equal(await evaluate("Boolean(document.querySelector('[data-export-course]'))"), true);
        console.log('PASS old 404 errors disappear and original tool-style knowledge is readable/exportable before AI finishes');
        releaseAi(); releaseAi = null;
        await waitFor("Boolean(document.querySelector('.course-knowledge-summary'))");
        assert.equal(await evaluate("document.querySelectorAll('.course-knowledge-source').length"), 2);
        assert.equal(await evaluate("document.querySelector('[data-course-detail]').textContent.includes('NỘI_DUNG_GỐC_sql-slide2')"), true);
        assert.equal(await evaluate("document.querySelector('.course-knowledge-summary img')===null && window.__xss===undefined && window.__sourceXss===undefined"), true);
        assert.equal((await q('SELECT * FROM LearningCourses')).length, 1);
        assert.equal((await q('SELECT * FROM LearningSummaries')).length, 1);
        assert.equal((await q('SELECT content FROM LearningSummaries'))[0].content, 'BẢN TÓM TẮT TOÀN MÔN: SQL kết hợp dữ liệu bằng JOIN. <img src=x onerror=window.__xss=1>');
        const summaryExport = await fetch(`${apiUrl}/api/v1/learning/courses/sql-course/summary`);
        assert.equal(await summaryExport.text(), (await q('SELECT content FROM LearningSummaries'))[0].content);
        fs.writeFileSync(path.join(os.tmpdir(), 'unistudy-learning-documents.png'), (await window.webContents.capturePage()).toPNG());
        console.log('PASS current-term documents, full source text, AI HTTP provider, persisted summary and escaped content');

        await evaluate("document.querySelector('[data-open-flashcards]').click()");
        await waitFor("Boolean(document.querySelector('[data-start-review=due]'))");
        await evaluate("document.querySelector('[data-start-review=due]').click()");
        assert.equal(await evaluate("document.querySelector('.flashcard-answer')===null"), true);
        await evaluate("document.querySelector('[data-reveal-card]').click()");
        assert.equal(await evaluate("Boolean(document.querySelector('.flashcard-answer')) && document.querySelector('.flashcard-answer script')===null"), true);
        fs.writeFileSync(path.join(os.tmpdir(), 'unistudy-learning-flashcards.png'), (await window.webContents.capturePage()).toPNG());
        await q("CREATE TRIGGER reject_review BEFORE INSERT ON LearningReviews BEGIN SELECT RAISE(ABORT,'Save denied'); END");
        await evaluate("document.querySelector('[data-rating=good]').click()");
        await waitFor("Boolean(document.querySelector('[data-retry-review]'))");
        assert.equal((await q('SELECT * FROM LearningCards WHERE review_count>0')).length, 0);
        await q('DROP TRIGGER reject_review');
        await evaluate("document.querySelector('[data-retry-review]').click()");
        await waitFor("Boolean(document.querySelector('[data-reveal-card]'))");
        assert.equal((await q('SELECT * FROM LearningReviews')).length, 1);
        const saved = (await q('SELECT * FROM LearningCards WHERE review_count=1'))[0];
        assert.ok(Date.parse(saved.due_at) > Date.now());
        await goto('documents'); await goto('flashcards');
        await waitFor("document.querySelector('.flashcard-review-meta')?.textContent.includes('2/2')");
        assert.equal(await evaluate('window.__xss===undefined'), true);
        await window.loadURL(url + '?route=flashcards');
        await waitFor("Boolean(document.querySelector('[data-start-review=due]'))");
        assert.equal(await evaluate("document.querySelector('[data-flashcard-detail]').textContent.includes('1 đến hạn')"), true);
        console.log('PASS reveal-before-rating, save failure rollback/retry, tab session recovery and persisted review after reload');

        const readSlides = edux.laySlide;
        edux.laySlide = async () => { throw Object.assign(new Error('Missing list endpoint'), { status: 404 }); };
        await goto('documents');
        await waitFor("Boolean(document.querySelector('[data-sync-knowledge]'))");
        await evaluate("document.querySelector('[data-sync-knowledge]').click()");
        await waitFor("Boolean(document.querySelector('[data-retry-course]')) && !document.querySelector('[data-retry-course]').disabled");
        assert.equal(await evaluate("document.querySelector('.course-knowledge-failures').textContent.includes('Truy vấn SQL') && document.querySelector('.course-knowledge-failures').textContent.includes('404')"), true);
        assert.equal(await evaluate("document.querySelector('[data-knowledge-status]').textContent.includes('chương chưa lấy được danh sách slide')"), true);
        await window.loadURL(url + '?route=documents');
        await waitFor("Boolean(document.querySelector('[data-retry-course]'))");
        edux.laySlide = readSlides;
        await evaluate("document.querySelector('[data-retry-course]').click()");
        await waitFor("Boolean(document.querySelector('.course-knowledge-summary')) && !document.querySelector('.course-knowledge-failures') && !document.querySelector('[data-sync-knowledge]').disabled");
        assert.equal((await q('SELECT complete FROM LearningCourses'))[0].complete, 1);
        console.log('PASS persistent chapter error details, correct error category and retry for the selected course');

        const tasks = await (await fetch(`${apiUrl}/api/v1/tasks/edux`)).json();
        assert.deepEqual(tasks.data.assignments.map(item => item.id), ['edux-sql-task']);
        assert.equal((await db.layBaiTapEDUX(1)).length, 2);
        await q("UPDATE Timetables SET start_date='2025-01-01',end_date='2025-05-01' WHERE subject_id=1");
        await window.loadURL(url + '?route=flashcards');
        await waitFor("Boolean(document.querySelector('[data-go-sync]'))");
        assert.equal((await q('SELECT * FROM LearningCourses')).length, 1);
        assert.equal((await q('SELECT * FROM LearningReviews')).length, 1);
        console.log('PASS term changes hide old courses/tasks while preserving historical sources and reviews');
        assert.deepEqual(rendererErrors.filter(message => !message.includes('Save denied') && !message.includes('Môn học này không có trong lịch học hiện tại')), []);
    } catch (error) { console.error(error.stack || error); exitCode = 1; }
    finally {
        if (releaseAi) releaseAi();
        if (window && !window.isDestroyed()) window.destroy();
        for (const server of [api, assets, provider]) if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
        // Chromium may hold profile files until process exit on Windows.
        try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* temp profile only */ }
        app.exit(exitCode);
    }
});
