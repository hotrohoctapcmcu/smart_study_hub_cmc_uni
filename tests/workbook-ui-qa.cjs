'use strict';
// Workbook-driven acceptance checks against React + real HTTP API + disposable SQLite.
// External university services are never logged into. AI uses the labelled local fixture.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests/artifacts/workbook-ui-qa-2026-11-03' + (process.env.QA_EXTENDED_ONLY ? '-extended' : process.env.QA_FILTER ? '-recheck' : ''));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (process.argv.includes('--vite-worker')) {
  (async () => {
    const { createServer } = await import(pathToFileURL(path.join(root, 'Frontend/node_modules/vite/dist/node/index.js')).href);
    const server = await createServer({ root: path.join(root, 'Frontend'),
      configFile: path.join(root, 'Frontend/vite.config.js'),
      server: { host: '127.0.0.1', port: 5186, strictPort: true },
      plugins: [{ name: 'qa-real-api', enforce: 'pre', transform(source, id) {
        if (id.replace(/\\/g, '/').endsWith('/src/api/apiClient.js')) return {
          code: source.replace('const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";',
            `const API_URL = ${JSON.stringify(process.env.QA_API_URL)};`) + `
;window.__qa={requests:[],fault:null};
apiClient.interceptors.request.use(config=>{window.__qa.requests.push({url:config.url,method:config.method,params:config.params,data:config.data});
 if(window.__qa.fault && config.url.startsWith(window.__qa.fault)){const e=new Error('QA simulated network loss');e.code='ERR_NETWORK';throw e;}return config;});`, map: null };
      } }] });
    await server.listen(); console.log('QA Vite ready');
  })().catch(e => { console.error(e); process.exit(1); });
} else {
  const electron = require('electron');
  if (!electron.app) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
    process.exit(result.status ?? 1);
  } else run(electron);
}

function run({ app, BrowserWindow }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-workbook-ui-'));
  app.setPath('userData', path.join(directory, 'profile'));
  app.disableHardwareAcceleration();
  app.whenReady().then(async () => {
    const report = { date: '2026-11-03', timezone: 'Asia/Saigon', source: 'Smart_Study_Hub_Test_Cases_Styled.xlsx',
      mode: 'React/Vite source, real Express + SQLite in temporary directory, isolated Electron profile. Local AI fixture. No live IU/EDUX/Outlook authentication.',
      checks: [], errors: [], screenshots: [], temporaryDirectory: directory };
    let db, apiServer, fake, vite, win;
    const assert = require('node:assert/strict');
    try {
      fs.mkdirSync(output, { recursive: true });
      report.revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim();
      fake = await require('./helpers/sprint3-provider.cjs').createProvider();
      Object.assign(process.env, { DB_PATH: path.join(directory, 'qa.db'), DOCUMENTS_PATH: path.join(directory, 'documents'),
        EDUX_ACCOUNTS_PATH: path.join(directory, 'accounts'),
        API_PORT: '0', APP_USER_ID: '1', NODE_ENV: 'test', GEMINI_ORIGIN: fake.origin,
        GEMINI_SESSION_DIR: directory, GEMINI_ENABLE_WEB_FALLBACK: 'false', GEMINI_TIMEOUT_MS: '2000' });
      db = await require('../database')();
      const query = (...args) => db.executeQuery(...args);
      const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
      const add = n => new Date(Date.parse(today() + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
      await query("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'QA-DISPOSABLE','Sinh viên QA','IT')");
      await query("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'MATH','Giải tích 1'),(2,'SQL','Cơ sở dữ liệu')");
      await query("INSERT INTO StudentSubjects(student_id,subject_id,status,semester,academic_year) VALUES(1,1,'STUDYING','1','2026-2027'),(1,2,'STUDYING','1','2026-2027')");
      await query(`INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,lecturer_name,source)
        VALUES(1,1,'Lớp QA IU','A101','CMC',@dow,'08:00','11:30',@date,@date,'Giảng viên QA','IU')`,
        { dow: new Date(add(1) + 'T12:00:00+07:00').getDay() === 0 ? 8 : new Date(add(1) + 'T12:00:00+07:00').getDay() + 1, date: add(1) });
      await query(`INSERT INTO StudySchedules(student_id,subject_id,title,study_date,start_time,end_time,duration_minutes)
        VALUES(1,1,'QA buổi học đã lưu',@date,'16:00','17:00',60)`, { date: add(1) });
      await query("INSERT INTO Timetables(student_id,subject_id,class_name,room,campus,day_of_week,start_time,end_time,start_date,end_date,source) VALUES(1,2,'Lớp SQL QA','A102','CMC',2,'13:00','14:00',@start,@end,'IU')", { start: add(-7), end: add(30) });
      await query("INSERT INTO Exams(student_id,subject_id,exam_name,exam_date,exam_time,duration_minutes,room,campus) VALUES(1,2,'QA kỳ thi có sẵn',@date,'08:30',90,'Lab QA','CMC')", { date: add(14) });
      const chapters = [{ id: 'qa-ch1', title: 'Chương QA SQL', documents: [{ id: 'qa-slide1', title: 'QA SELECT', content: 'SELECT dùng truy vấn dữ liệu. Đây là slide fixture.', status: 'ready' }, { id: 'qa-slide2', title: 'QA JOIN', content: 'JOIN ghép các dòng. Slide fixture.', status: 'ready' }] }];
      await query("INSERT INTO LearningCourses(user_id,course_id,subject_name,subject_code,chapters_json,source_hash,complete,updated_at) VALUES(1,'qa-sql','Cơ sở dữ liệu','SQL',@chapters,'qa-hash',1,@now)", { chapters: JSON.stringify(chapters), now: new Date().toISOString() });
      await query("INSERT INTO LearningSummaries(user_id,course_id,source_hash,content,coverage_json,created_at) VALUES(1,'qa-sql','qa-hash','QA tóm tắt đã lưu: SELECT và JOIN.','[]',@now)", { now: new Date().toISOString() });
      const { fingerprint, aggregateCourseText } = require('../API/utils/course-material-text');
      await query("UPDATE LearningSummaries SET input_hash=@hash,pipeline_version=@version,summary_hash='qa-summary-hash'", { hash: fingerprint(aggregateCourseText({ subject: 'Cơ sở dữ liệu', chapters })), version: require('../API/services/course-summary.pipeline').PIPELINE_VERSION });
      for (let n = 1; n <= 4; n++) await query("INSERT INTO LearningCards(user_id,card_id,course_id,source_hash,front,back,source_ids_json,due_at,created_at) VALUES(1,@id,'qa-sql','qa-hash',@front,@back,'[]',@now,@now)", { id: 'qa-card-' + n, front: 'QA câu hỏi ' + n, back: 'QA đáp án ' + n, now: new Date().toISOString() });
      await query("UPDATE LearningCards SET summary_hash='qa-summary-hash'");
      for (const [external, subject, body, read] of [['qa-mail-1', 'QA thông báo nộp bài SQL', 'Môn học: Cơ sở dữ liệu. Các em nộp bài trước 23:59 ngày 20/11/2026.', 0], ['qa-mail-2', 'QA thư đã đọc', 'Không có ngày giờ xác định.', 1]]) {
        await query("INSERT INTO SchoolEmails(user_id,external_id,mailbox,payload,is_read) VALUES(1,@external,'qa',@payload,@read)", { external, read, payload: JSON.stringify({ id: external, subject, body, sender: 'teacher@example.invalid', date: new Date().toISOString(), isRead: !!read }) });
      }
      apiServer = await require('../API').start();
      const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
      report.apiIsolation = { port: apiServer.address().port, database: process.env.DB_PATH };
      vite = spawn(process.execPath, [__filename, '--vite-worker'], { cwd: root, windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', QA_API_URL: apiUrl + '/api/v1' } });
      let viteLog = ''; vite.stdout.on('data', b => { viteLog += b; }); vite.stderr.on('data', b => { viteLog += b; });
      for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5186')).ok) break; } catch {} if (i === 99) throw Error(viteLog); await sleep(150); }
      win = new BrowserWindow({ show: false, width: 1440, height: 1000, enableLargerThanScreen: true,
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      win.setContentSize(1440, 1000);
      win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
      const js = code => win.webContents.executeJavaScript(code, true);
      const wait = async (expr, timeout = 7000) => { const until = Date.now() + timeout; while (Date.now() < until) { if (await js(expr)) return; await sleep(80); } throw Error('Timeout: ' + expr + '\n' + await js('document.body.innerText.slice(-1400)')); };
      const shot = async name => { const file = name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png'; fs.writeFileSync(path.join(output, file), (await win.webContents.capturePage()).toPNG()); report.screenshots.push(file); return file; };
      const test = async (id, scenario, refs, name, fn) => {
        if (process.env.QA_FILTER && !new RegExp(process.env.QA_FILTER).test(id)) return;
        const row = { id, scenario, refs, name }; const start = Date.now();
        try { const detail = await fn(); row.status = 'PASS'; if (detail !== undefined) row.detail = detail; }
        catch (e) { row.status = 'FAIL'; row.detail = String(e.message); row.screenshot = await shot(id).catch(() => null); }
        row.durationMs = Date.now() - start; report.checks.push(row); console.log(`${row.status} ${id} ${name}`);
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
      };
      const goto = async route => { await win.loadURL('http://127.0.0.1:5186' + route); await wait("!!document.querySelector('h1') && !document.querySelector('.loading-grid')"); await sleep(180); };
      const click = async (text, scope = 'document') => {
        await js(`(()=>{const scope=${scope}; const b=[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(text)}||b.textContent.trim()===${JSON.stringify(text)}||b.querySelector('h3')?.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button: '+${JSON.stringify(text)});if(b.disabled)throw Error('Disabled button: '+${JSON.stringify(text)});b.click()})()`); await sleep(120);
      };
      const set = async (label, value, scope = "document.querySelector('[role=dialog]')||document") => {
        await js(`(()=>{const scope=${scope};const field=[...scope.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent.trim()===${JSON.stringify(label)});const e=field?.querySelector('input,select,textarea')||scope.querySelector('[aria-label='+CSS.escape(${JSON.stringify(label)})+']');if(!e)throw Error('Missing field '+${JSON.stringify(label)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`); await sleep(70);
      };
      const submit = async () => { await js("document.querySelector('[role=dialog] form').requestSubmit()"); await sleep(250); };
      const dialogText = () => js("document.querySelector('[role=dialog]')?.innerText||''");
      const api = async (method, url, body) => { const target = /^\/(quizzes|weaknesses)/.test(url) ? '/ai' + url : url; const r = await fetch(apiUrl + '/api/v1' + target, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: r.status, ...await r.json() }; };
      const title = text => `document.querySelector('[role=dialog]')?.textContent.includes(${JSON.stringify(text)})`;

      if (!process.env.QA_EXTENDED_ONLY) {
      // Default routes and responsive viewports: actual rendered pages, no mock API adapter.
      for (const route of ['/', '/sync', '/schedule', '/tasks', '/exams', '/documents', '/ai', '/learning?tab=quiz', '/learning?tab=flashcards', '/learning?tab=weaknesses', '/learning?tab=pomodoro', '/notebooks', '/textbook', '/statistics', '/email', '/profile', '/settings']) {
        await test('ROUTE-' + route.replace(/\W/g, '_'), 'average', [], 'Mở trang ' + route, async () => {
          await goto(route); assert.ok(await js("!!document.querySelector('h1') && !document.querySelector('.error-boundary')"));
          return { heading: await js("document.querySelector('h1').textContent"), viewport: '1440x1000' };
        });
        for (const [width, height, scenario] of [[1440, 1000, 'best'], [834, 1100, 'average'], [390, 844, 'worst']]) await test('LAYOUT-' + route.replace(/\W/g, '_') + '-' + width, scenario, [], 'Không tràn ngang ' + route + ' @' + width, async () => {
          win.setContentSize(width, height); await sleep(100);
          const m = await js('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})'); assert.ok(m.scrollWidth <= m.width + 1, JSON.stringify(m)); return m;
        });
      }
      win.setContentSize(1440, 1000);
      await test('SYNC-CARDS', 'average', ['Sync-1'], 'Trang đồng bộ có đủ IU, EDUX, Outlook và lần đồng bộ cuối', async () => {
        await goto('/sync'); assert.equal(await js("document.querySelectorAll('.connection-card').length"), 3);
        assert.ok(await js("[...document.querySelectorAll('.connection-card')].every(c=>c.textContent.includes('Lần đồng bộ cuối'))")); await shot('sync-desktop');
      });
      await test('SYNC-DISCONNECT', 'worst', ['TC03'], 'Chưa kết nối IU thì không cho ngắt phiên', async () => {
        const buttons = await js("[...document.querySelectorAll('.connection-card')].find(c=>c.querySelector('h2').textContent==='IU').innerText");
        assert.ok(!buttons.includes('Ngắt IU'), buttons);
      });
      for (const value of ['không phải JSON', '{}', '{"session":"qa-only"}']) await test('SYNC-JSON-' + value.length, 'worst', ['Sync-3'], 'Phiên IU sai cấu trúc bị chặn: ' + value, async () => {
        await goto('/sync'); await click('Kết nối', "[...document.querySelectorAll('.connection-card')].find(c=>c.querySelector('h2').textContent==='IU')");
        await set('Dữ liệu phiên IU', value); await submit(); assert.ok((await dialogText()).includes('Chưa kết nối được')); assert.equal((await query('SELECT * FROM Students')).length, 1);
      });
      await test('SYNC-ALL-FORM', 'average', ['Sync-1'], 'Đồng bộ tất cả mở form nguồn thiếu phiên', async () => { await goto('/sync'); await click('Đồng bộ tất cả'); await wait("!!document.querySelector('[role=dialog]')"); assert.ok((await dialogText()).includes('Email EDUX')); await shot('sync-all-form'); });

      await test('SCHEDULE-VIEWS', 'average', ['Sched-1'], 'Tuần, tháng, danh sách hiển thị sự kiện', async () => {
        await goto('/schedule?date=' + add(1)); assert.ok(await js("!!document.querySelector('.weekly-calendar')||!!document.querySelector('.week-grid')||document.body.innerText.includes('Lớp QA IU')"));
        await click('Tháng'); assert.equal(await js("document.querySelectorAll('.month-cell').length"), 42);
        await click('Danh sách'); assert.ok(await js("document.body.innerText.includes('QA buổi học đã lưu')")); await shot('schedule-list');
      });
      const scheduleForm = async (name, from = '14:00', to = '15:00', date = add(1), subject = '1') => {
        await goto('/schedule?action=create&date=' + date); await set('Tên buổi tự học', name); await set('Môn học', subject); await set('Ngày học', date); await set('Bắt đầu', from); await set('Kết thúc', to);
      };
      await test('SCHEDULE-CREATE', 'best', ['Sched-2', 'TC04'], 'Tạo tự học hợp lệ và lưu SQLite', async () => {
        await scheduleForm('QA tự học mới'); await submit(); await wait("!document.querySelector('[role=dialog]')||!!document.querySelector('[role=alert]')");
        assert.ok((await query("SELECT * FROM StudySchedules WHERE title='QA tự học mới'")).length === 1, await dialogText());
        await goto('/schedule?date=' + add(1)); assert.ok(await js("document.body.innerText.includes('QA tự học mới')"));
      });
      for (const [name, from, to, shouldConflict] of [['inside', '09:00', '10:00', true], ['overlap-left', '07:00', '08:30', true], ['overlap-right', '11:00', '12:00', true], ['contains', '07:00', '12:00', true], ['exact', '08:00', '11:30', true], ['adjacent', '11:30', '13:00', false]]) await test('SCHEDULE-' + name, shouldConflict ? 'worst' : 'best', [shouldConflict ? 'Sched-3' : 'Sched-4'], 'Xung đột lịch: ' + name, async () => {
        await scheduleForm('QA ' + name, from, to); await submit();
        const text = await dialogText(); if (shouldConflict) { assert.ok(text.includes('trùng'), text); assert.ok(await js("document.querySelector('[role=dialog] input').value.startsWith('QA ')") ); }
        else assert.equal((await query("SELECT * FROM StudySchedules WHERE title='QA adjacent'")).length, 1, text);
      });
      for (const [from, to, label] of [['10:00', '10:00', 'equal'], ['11:00', '10:00', 'reverse'], ['06:59', '07:30', 'before-min'], ['21:30', '22:01', 'after-max']]) await test('SCHEDULE-TIME-' + label, 'worst', ['TC04'], 'Chặn khung giờ sai: ' + label, async () => {
        await scheduleForm('QA invalid ' + label, from, to, add(2)); await submit(); assert.equal((await query('SELECT * FROM StudySchedules WHERE title=@title', { title: 'QA invalid ' + label })).length, 0); assert.ok(await js("!!document.querySelector('[role=dialog]')"));
      });
      await test('SCHEDULE-FREE', 'average', ['Sched-5'], 'Tìm giờ trống 90 phút không chồng lớp', async () => {
        await goto('/schedule?date=' + add(1)); await set('Ngày', add(1), 'document'); await set('Thời lượng (phút)', '90', 'document'); await click('Tìm giờ trống'); await wait("!!document.querySelector('.slot-list')||document.body.innerText.includes('Không tìm thấy khoảng')");
        assert.ok(await js("!!document.querySelector('.slot-list')")); return { note: 'Đây là bộ tìm khoảng trống; không phải AI preview/áp dụng như kỳ vọng workbook.' };
      });
      await test('SCHEDULE-STATUS', 'average', ['Sched-6'], 'Trạng thái hoàn thành bền sau reload', async () => {
        await goto('/schedule?date=' + add(1)); await click('QA buổi học đã lưu'); await set('Trạng thái', 'COMPLETED');
        await wait("document.querySelector('[role=dialog] select')?.value==='COMPLETED'"); await goto('/schedule?date=' + add(1)); await click('QA buổi học đã lưu'); assert.equal(await js("document.querySelector('[role=dialog] select').value"), 'COMPLETED');
      });
      await test('SCHEDULE-IU-DELETE', 'worst', ['TC03'], 'Không cung cấp thao tác xóa lịch IU', async () => {
        await goto('/schedule?date=' + add(1)); await js("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Giải tích 1')&&b.closest('.weekly-calendar,.week-grid')).click()").catch(async () => { await click('Danh sách'); await js("[...document.querySelectorAll('.card-content button')].find(b=>b.textContent.includes('Giải tích 1')).click()"); });
        assert.ok(!(await dialogText()).includes('Xóa'), await dialogText());
      });

      const taskForm = async (name, deadline = add(12) + 'T23:59') => { await goto('/tasks?action=create'); await wait("!!document.querySelector('[role=dialog]')"); await set('Tên công việc', name); await set('Môn học', '1'); await set('Hạn hoàn thành', deadline); };
      await test('TASK-CREATE', 'best', ['Task-1', 'Task-2'], 'Tạo công việc ưu tiên Cao qua giao diện', async () => {
        await taskForm('QA Báo cáo đồ án'); await set('Mức độ ưu tiên', 'HIGH'); await submit(); await wait("!document.querySelector('[role=dialog]')"); assert.equal((await query("SELECT priority FROM Assignments WHERE title='QA Báo cáo đồ án'"))[0]?.priority, 'HIGH');
      });
      await test('TASK-CHECKLIST', 'average', ['Task-2'], 'Thêm và hoàn thành 3 checklist con', async () => {
        await goto('/tasks'); await click('Danh sách'); await click('QA Báo cáo đồ án');
        for (const name of ['Viết mở đầu', 'Thiết kế CSDL', 'Kết luận']) { await set('Bước checklist mới', name); await click('Thêm', "document.querySelector('[role=dialog]')"); await wait(title(name)); }
        const rows = await query("SELECT * FROM Checklists WHERE title IN ('Viết mở đầu','Thiết kế CSDL','Kết luận')"); assert.equal(rows.length, 3); await shot('task-checklist');
      });
      await test('TASK-PAST', 'worst', ['Task-3'], 'Deadline quá khứ được cảnh báo hoặc hiển thị quá hạn', async () => {
        await taskForm('QA task quá hạn', add(-1) + 'T09:00'); await submit(); await wait("!document.querySelector('[role=dialog]')||!!document.querySelector('[role=alert]')");
        const text = await js('document.body.innerText'); assert.ok(/Quá hạn|quá hạn|quá khứ/.test(text), text.slice(-700));
      });
      for (const name of ['', '   ']) await test('TASK-EMPTY-' + name.length, 'worst', ['Task-2'], 'Chặn tiêu đề task rỗng hoặc chỉ khoảng trắng', async () => {
        await taskForm(name); await submit(); assert.equal((await query('SELECT * FROM Checklists WHERE title=@title', { title: name })).length, 0); assert.ok(await js("!!document.querySelector('[role=dialog]')"));
      });
      await test('TASK-XSS', 'worst', ['Task-5'], 'Task chứa script không thực thi sau reload', async () => {
        const payload = '<img src=x onerror="window.__qaXSS=1">'; await taskForm(payload); await submit(); await goto('/tasks');
        assert.ok(await js(`document.body.innerText.includes(${JSON.stringify(payload)})`)); assert.ok(await js("!window.__qaXSS && !document.querySelector('img[onerror]')"));
      });
      await test('TASK-VIEWS-FILTER', 'average', ['Task-1'], 'Tìm task, chuyển bảng và lịch', async () => {
        await goto('/tasks'); await click('Danh sách'); await set('Tìm công việc...', 'QA Báo cáo', 'document'); assert.ok(await js("document.querySelector('.tasks-content').innerText.includes('QA Báo cáo')"));
        await click('Bảng'); assert.ok(await js("!!document.querySelector('.tasks-board')")); await click('Lịch'); assert.ok(await js("!!document.querySelector('.tasks-calendar')"));
      });

      await test('EXAM-CREATE', 'best', ['Exam-2'], 'Thêm kỳ thi 90 phút, tải lại không mất', async () => {
        await goto('/exams'); await click('Thêm kỳ thi'); await set('Tên kỳ thi', 'QA thi thủ công'); await set('Môn học', '2'); await set('Ngày thi', add(10)); await set('Bắt đầu', '08:30'); await set('Kết thúc', '10:00'); await set('Phòng thi', 'Lab 302'); await submit();
        await wait("!document.querySelector('[role=dialog]')"); const [row] = await query("SELECT * FROM Exams WHERE exam_name='QA thi thủ công'"); assert.equal(row?.duration_minutes, 90); await goto('/exams'); assert.ok(await js("document.body.innerText.includes('QA thi thủ công')")); await shot('exams');
      });
      await test('EXAM-TIME', 'worst', ['Exam-2'], 'Kỳ thi có giờ kết thúc trước bắt đầu bị chặn', async () => {
        await goto('/exams'); await click('Thêm kỳ thi'); await set('Tên kỳ thi', 'QA exam invalid'); await set('Môn học', '2'); await set('Ngày thi', add(11)); await set('Bắt đầu', '10:00'); await set('Kết thúc', '08:30'); await set('Phòng thi', 'Lab QA'); await submit(); assert.ok((await dialogText()).includes('Giờ kết thúc phải sau')); assert.equal((await query("SELECT * FROM Exams WHERE exam_name='QA exam invalid'")).length, 0);
      });
      await test('EXAM-MANUAL-PLAN', 'average', ['Exam-3'], 'Tạo giai đoạn ôn và đánh dấu hoàn thành', async () => {
        await goto('/exams'); await click('Lên lịch ôn'); await submit(); await wait("!document.querySelector('[role=dialog]')"); await click('Kế hoạch ôn thi'); assert.ok(await js("!!document.querySelector('.task-row input[type=checkbox]')")); await js("document.querySelector('.task-row input[type=checkbox]').click()"); await sleep(200); assert.equal((await query('SELECT status FROM ExamStudyPlans'))[0]?.status, 'COMPLETED');
      });

      await test('DOC-CATALOG', 'average', ['Doc-1'], 'Môn -> chương -> slide fixture từ SQLite', async () => {
        await goto('/documents'); await wait("!!document.querySelector('.study-subject-card')"); await click('Mở môn Cơ sở dữ liệu'); await click('Mở Chương QA SQL'); await click('Mở slide 1: QA SELECT'); await wait("!!document.querySelector('.study-viewer')"); assert.ok(await js("document.querySelector('.study-viewer').innerText.includes('SELECT')")); await shot('documents-viewer');
      });
      await test('FLASHCARD-FLIP', 'best', ['Doc-3', 'Doc-4'], 'Flashcard lật và lưu đánh giá bằng nút', async () => {
        await goto('/learning?tab=flashcards'); await wait("!!document.querySelector('.flashcard')"); await js("document.querySelector('.flashcard').click()"); assert.ok(await js("document.querySelector('.flashcard').textContent.includes('ĐÁP ÁN')")); await click('Đã nhớ'); await wait("document.querySelector('.flashcard').textContent.includes('CÂU HỎI')"); assert.equal((await query('SELECT * FROM LearningReviews')).length, 1);
      });
      await test('FLASHCARD-KEYS', 'worst', ['Doc-4'], 'Space và phím 1-4 điều khiển flashcard', async () => {
        await goto('/learning?tab=flashcards'); await wait("!!document.querySelector('.flashcard')"); await js("document.querySelector('h1').focus();document.activeElement?.blur()");
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' }); await sleep(150); assert.ok(await js("document.querySelector('.flashcard').textContent.includes('ĐÁP ÁN')"), 'Space không lật thẻ khi focus ở trang.');
      });

      await test('AI-LENGTH', 'worst', ['AI-2'], '32.500 codepoint bị chặn gửi', async () => {
        await goto('/ai'); await set('Tin nhắn cho AI Tutor', 'a'.repeat(32500), 'document'); assert.equal(await js("document.querySelector('[aria-label=\"Gửi tin nhắn\"]').disabled"), true); assert.equal(await js("document.querySelector('textarea').getAttribute('aria-invalid')"), 'true'); await shot('ai-over-limit');
      });
      for (const [length, scenario] of [[31999, 'average'], [32000, 'best'], [32001, 'worst']]) await test('AI-LIMIT-' + length, scenario, ['AI-2'], 'Biên AI ' + length + ' codepoint', async () => {
        await set('Tin nhắn cho AI Tutor', 'a'.repeat(length), 'document'); assert.equal(await js("document.querySelector('[aria-label=\"Gửi tin nhắn\"]').disabled"), length > 32000);
      });
      await test('AI-UNICODE', 'worst', ['AI-2'], 'Emoji đếm theo codepoint', async () => { await set('Tin nhắn cho AI Tutor', '😀'.repeat(32000), 'document'); assert.equal(await js("document.querySelector('[aria-label=\"Gửi tin nhắn\"]').disabled"), false); });
      await test('AI-CHAT', 'best', ['AI-1'], 'Gửi chat với provider fixture và kiểm tra SQLite', async () => {
        await goto('/ai'); await set('Tin nhắn cho AI Tutor', 'Giải thích JOIN - dữ liệu kiểm thử', 'document'); await click('Gửi tin nhắn'); await wait("document.body.innerText.includes('Gia sư giải thích')", 14000); assert.equal((await query('SELECT * FROM AiConversations')).length, 1); await shot('ai-chat-fixture');
      });
      await test('AI-CHAT-RELOAD', 'average', ['AI-1'], 'Hội thoại giữ sau reload', async () => { await goto('/ai'); assert.ok(await js("document.body.innerText.includes('Giải thích JOIN - dữ liệu kiểm thử')"), 'Hội thoại không được phục hồi trên UI sau reload.'); });
      await test('QUIZ-CONFIG', 'average', ['AI-3'], 'Giao diện cho chọn 5 câu và độ khó', async () => {
        await goto('/learning?tab=quiz'); await click('Tạo quiz'); assert.ok(await js("[...document.querySelectorAll('[role=dialog] input,[role=dialog] select')].some(e=>e.type==='number')"), 'Quiz cố định 10 câu, không có trường số câu hoặc độ khó.');
      });
      await test('QUIZ-GENERATE', 'best', ['AI-3'], 'Tạo và làm quiz 10 câu qua HTTP thật, AI fixture', async () => {
        await goto('/learning?tab=quiz'); await click('Tạo quiz'); await set('Môn học / chủ đề', 'Cơ sở dữ liệu'); await set('Chủ đề ôn tập', 'JOIN'); await submit(); await wait("!document.querySelector('[role=dialog]')", 16000); await click('Làm bài'); await wait("document.querySelectorAll('.quiz-question').length===10"); await shot('quiz-unsubmitted');
        assert.equal(await js("document.querySelectorAll('.quiz-question input[type=radio]').length"), 40);
        assert.equal(await js("document.querySelector('[role=dialog] button[type=submit]').disabled"), true);
        await js("document.querySelectorAll('.quiz-question').forEach((q,i)=>q.querySelectorAll('input')[i%2].click())"); await sleep(120); await submit(); await wait("document.querySelector('[role=dialog]')?.textContent.includes('Kết quả:')"); assert.ok((await query('SELECT * FROM AiQuizzes WHERE submitted_at IS NOT NULL')).length === 1); assert.ok(await js("!window.__xss && !document.querySelector('[role=dialog] img[onerror]')")); await shot('quiz-results');
      });
      await test('QUIZ-ANSWERS', 'worst', ['AI-4'], 'API quiz chưa nộp không lộ đáp án', async () => {
        const r = await api('POST', '/quizzes', { subject: 'Cơ sở dữ liệu', topic: 'JOIN', count: 5, difficulty: 'medium' });
        const data = r.data; assert.ok(data, JSON.stringify(r)); const detail = await api('GET', '/quizzes/' + (data.id || data.quiz?.id));
        assert.ok(!/correctIndex|correctAnswer|explanation/.test(JSON.stringify(detail.data)), JSON.stringify(detail.data)); return { scope: 'HTTP payload thật của API; provider AI fixture' };
      });
      await test('WEAKNESS', 'average', ['AI-5'], 'Điểm yếu hiển thị từ bài đã nộp', async () => { await goto('/learning?tab=weaknesses'); assert.ok(await js("document.body.innerText.includes('JOIN')")); await click('Phân tích'); await wait("document.body.innerText.includes('Ôn JOIN')", 14000); });

      await test('POMO-TICK', 'best', ['Pomo-1'], 'Pomodoro 25 phút, pause/resume', async () => {
        await goto('/learning?tab=pomodoro'); assert.equal(await js("document.querySelector('.timer-value').textContent"), '25:00'); await click('Bắt đầu'); await sleep(1200); const before = await js("document.querySelector('.timer-value').textContent"); assert.notEqual(before, '25:00'); await click('Tạm dừng'); const paused = await js("document.querySelector('.timer-value').textContent"); await sleep(1100); assert.equal(await js("document.querySelector('.timer-value').textContent"), paused); await click('Bắt đầu');
      });
      await test('POMO-RELOAD', 'average', ['Pomo-2'], 'Phiên Pomodoro tiếp tục qua reload', async () => { const before = await js("document.querySelector('.timer-value').textContent"); await goto('/learning?tab=pomodoro'); const after = await js("document.querySelector('.timer-value').textContent"); assert.notEqual(after, '25:00'); assert.ok(after <= before); });
      await test('POMO-SAVE', 'average', ['Pomo-3'], 'Lưu phiên chỉ tính các đoạn tập trung', async () => { await click('Tạm dừng'); await click('Lưu phiên học'); await click('Lưu phiên học', "[...document.querySelectorAll('section.card')].find(s=>s.textContent.includes('Lưu phiên vừa học'))"); await wait("document.querySelector('.timer-value').textContent==='25:00'"); const rows = await query('SELECT * FROM PomodoroSessions'); assert.equal(rows.length, 1); assert.ok(rows[0].actual_study_seconds >= 1 && rows[0].actual_study_seconds < 10); return { seconds: rows[0].actual_study_seconds, segments: rows[0].focus_segments }; });
      await test('STATS-NO-AI', 'best', ['Stat-2'], 'Mở thống kê không gọi AI', async () => { const before = fake.state.calls.length; await goto('/statistics'); assert.equal(fake.state.calls.length, before); assert.ok(await js("window.__qa.requests.some(r=>r.url==='/progress'&&r.params?.advice===false)")); await shot('statistics'); });
      await test('STATS-TIMEMAP', 'average', ['Stat-1'], 'Time Map đúng ngày VN trong API và có nhật ký UI', async () => { await goto('/statistics'); const r = await api('GET', '/timemap?from=' + today() + '&to=' + add(6)); assert.equal(r.status, 200); assert.ok(await js("document.body.innerText.includes('Nhật ký học tập')")); return { scope: 'UI nhật ký + HTTP timemap, chưa phải trục 24 giờ như workbook', dataKeys: Object.keys(r.data || {}) }; });

      await test('MAIL-FILTER', 'average', ['Mail-1'], 'Email fixture chưa đọc và bộ lọc', async () => { await goto('/email'); assert.equal(await js("document.querySelectorAll('.mail-item').length"), 2); await js("[...document.querySelectorAll('.mail-folders button')].find(b=>b.textContent.includes('Chưa đọc')).click()"); await sleep(100); assert.equal(await js("document.querySelectorAll('.mail-item').length"), 1); await shot('email-unread'); });
      await test('MAIL-DEADLINE-BANNER', 'average', ['Mail-2'], 'Mở email có hạn 20/11 và banner trích xuất', async () => { await click('QA thông báo nộp bài SQL'); assert.ok(await js("document.querySelector('.mail-detail').textContent.includes('23:59 ngày 20/11/2026')")); assert.ok(await js("/Phát hiện deadline|Hạn chót/.test(document.querySelector('.mail-detail').textContent)"), 'Chỉ hiện nội dung thư và nút Tạo công việc, không có banner deadline.'); });
      await test('MAIL-TO-TASK', 'best', ['Mail-3'], 'Email -> task và chống nhân đôi khi bấm lại', async () => {
        await click('Tạo công việc', "document.querySelector('.mail-detail')"); await sleep(200); const first = await query("SELECT * FROM Assignments WHERE title LIKE '%QA thông báo%'"); assert.equal(first.length, 1);
        await click('Tạo công việc', "document.querySelector('.mail-detail')"); await sleep(200); assert.equal((await query("SELECT * FROM Assignments WHERE title LIKE '%QA thông báo%'")).length, 1); return { uiButton: await js("[...document.querySelectorAll('.mail-detail button')].find(b=>b.textContent.includes('Tạo công việc'))?.textContent") };
      });
      await test('MAIL-NO-DATE', 'worst', ['Mail-2', 'Mail-3'], 'Email thiếu ngày không bịa deadline/tạo task', async () => { await goto('/email'); await click('QA thư đã đọc'); await click('Tạo công việc', "document.querySelector('.mail-detail')"); await sleep(150); assert.equal((await query("SELECT * FROM Assignments WHERE title='QA thư đã đọc'")).length, 0); });
      await test('SEARCH-HOTKEY', 'average', ['Search-1'], 'Ctrl+K mở tìm kiếm toàn cục', async () => { await goto('/'); win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers: ['control'] }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'K', modifiers: ['control'] }); await wait("!!document.querySelector('[role=dialog]')"); await shot('global-search'); return await dialogText(); });
      await test('ERROR-RECOVERY', 'worst', ['Sync-4', 'Sync-5'], 'Mất HTTP task báo lỗi; retry phục hồi dữ liệu', async () => {
        await goto('/tasks'); await js("window.__qa.fault='/tasks'"); await click('Làm mới công việc'); await wait("document.body.innerText.includes('Chưa tải được')||!!document.querySelector('[role=alert]')");
        await js("window.__qa.fault=null"); await click('Làm mới công việc'); await wait("document.body.innerText.includes('QA Báo cáo đồ án')"); assert.ok((await query("SELECT * FROM Assignments WHERE title='QA Báo cáo đồ án'")).length === 1);
      });
      }
      if (process.env.QA_EXTENDED_ONLY) {
        // Upload boundary cases: real File objects through the mounted React form.
        for (const [size, label, oversized] of [[0, 'zero', false], [1024, 'normal', false], [25 * 1024 * 1024 - 1, 'under', false], [25 * 1024 * 1024, 'exact', false], [25 * 1024 * 1024 + 1, 'over', true], [Math.floor(26.5 * 1024 * 1024), '26_5MB', true]]) {
          await test('UPLOAD-' + label, oversized ? 'worst' : label === 'normal' ? 'average' : 'best', ['Doc-5'], 'Upload ' + label + ' (' + size + ' bytes)', async () => {
            await goto('/documents?tab=files'); await click('Tải lên'); await wait("!!document.querySelector('input[type=file]')");
            await js(`(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${size})],'qa-${label}.txt',{type:'text/plain'}));const e=document.querySelector('input[type=file]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
            await set('Môn học', 'Cơ sở dữ liệu'); await submit();
            await wait("!document.querySelector('[role=dialog]')||!!document.querySelector('[role=alert]')", 10000);
            const rows = await query('SELECT * FROM EduxDocuments WHERE title=@title', { title: 'qa-' + label + '.txt' });
            if (oversized) { assert.equal(rows.length, 0); assert.ok((await dialogText()).includes('25 MB')); assert.ok(await js("!window.__qa.requests.some(r=>r.url==='/documents'&&r.method==='post')")); }
            else if (size === 0) { assert.equal(rows.length, 0, 'Tệp rỗng được lưu như tài liệu hợp lệ.'); }
            else { assert.equal(rows.length, 1, await dialogText()); assert.equal(Number(rows[0].file_size), size); }
            return { bytes: size, rows: rows.length };
          });
        }
        await test('DOC-SUMMARY-JOB', 'best', ['Doc-2'], 'Nút tóm tắt toàn môn chạy job và lưu SQLite (AI fixture)', async () => {
          // Deliberately valid deterministic summary/cards fixture, used only on localhost.
          fake.state.override = prompt => prompt.includes('cards') || prompt.includes('flashcard') ? JSON.stringify({ cards: [{ front: 'SELECT?', back: 'Truy vấn dữ liệu', chapter: 'SQL' }] }) : 'QA tóm tắt: SELECT truy vấn và JOIN kết hợp dữ liệu.';
          await goto('/learning'); await click('Vào học ↗', "[...document.querySelectorAll('.course-card')].find(c=>c.textContent.includes('Cơ sở dữ liệu'))"); await click('Tạo / cập nhật tóm tắt');
          await wait("!document.body.innerText.includes('Đang tạo tóm tắt...')", 20000);
          const rows = await query("SELECT * FROM LearningSummaries WHERE course_id='qa-sql'"); assert.ok(rows[0]?.content.includes('QA tóm tắt')); await shot('summary-job'); fake.state.override = null;
        });
        await test('NOTE-CORNELL', 'best', ['Note-1'], 'Tạo Cornell qua UI với backend SQLite thật', async () => {
          await goto('/notebooks'); await click('Tạo sổ tay'); await set('Tên sổ tay', 'QA Cornell thật'); await set('Môn học', 'Cơ sở dữ liệu');
          await js("document.querySelector('.nw-book-form input[value=cornell]').click()"); await submit();
          await wait("document.querySelectorAll('.nw-cornell textarea').length===3"); assert.equal((await query("SELECT * FROM Notebooks WHERE title='QA Cornell thật'")).length, 1); await shot('cornell-real-api');
        });
        await test('NOTE-AUTOSAVE', 'average', ['Note-1', 'Note-2'], 'Cornell lưu và khôi phục sau tải lại', async () => {
          await js("(()=>{const e=document.querySelector('.nw-cornell textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'QA Cornell đã lưu');e.dispatchEvent(new Event('input',{bubbles:true}))})()");
          await wait("!!document.querySelector('.nw-save-state.saved')", 12000); await sleep(600);
          await win.reload(); await wait("document.querySelector('.nw-cornell textarea')?.value==='QA Cornell đã lưu'"); assert.ok((await query('SELECT * FROM Notes')).some(n => n.content.includes('QA Cornell đã lưu')));
        });
        await test('NOTE-DRAFT', 'worst', ['Note-2'], 'Mất API Notes giữ bản nháp và phục hồi reload', async () => {
          await js("window.__qa.fault='/notes'"); await js("(()=>{const e=document.querySelector('.nw-cornell textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'QA bản nháp mất mạng');e.dispatchEvent(new Event('input',{bubbles:true}))})()");
          await wait("!!document.querySelector('.nw-save-state.offline')", 12000); assert.ok(await js("Object.keys(localStorage).some(k=>k.includes('typed-notebooks')&&localStorage.getItem(k).includes('QA bản nháp mất mạng'))"));
          // Reload restores networking; the unsent local draft must win over the stale server row.
          await win.reload(); await wait("document.querySelector('.nw-cornell textarea')?.value==='QA bản nháp mất mạng'", 12000); await shot('note-draft-restored');
        });
        await test('NOTE-MATH', 'average', ['Note-1'], 'Cornell cho chèn công thức toán KaTeX', async () => {
          assert.ok(await js("[...document.querySelectorAll('button')].some(b=>/công thức|toán/i.test((b.getAttribute('aria-label')||'')+' '+b.textContent))"), 'Không thấy công cụ công thức trong sổ tay cấu trúc.');
        });
        await test('AI-PROVIDER-ERROR', 'worst', ['AI-1'], 'Provider 403 hiển thị lỗi, giữ câu hỏi', async () => {
          fake.state.status = 403; await goto('/ai'); await set('Tin nhắn cho AI Tutor', 'QA câu hỏi khi provider lỗi', 'document'); await click('Gửi tin nhắn');
          await wait("document.body.innerText.includes('QA câu hỏi khi provider lỗi') && !document.querySelector('[aria-label=\"Gửi tin nhắn\"]').disabled", 15000);
          assert.ok(await js("/lỗi|không|thất bại|quyền/i.test(document.querySelector('.message.assistant:last-child')?.textContent||document.body.innerText)")); fake.state.status = 200; await shot('ai-provider-error');
        });
        await test('AI-PLAN-PREVIEW', 'best', ['Exam-3', 'Exam-4'], 'Kế hoạch ôn thi chỉ xem trước, chưa ghi SQLite', async () => {
          fake.state.status = 200; await goto('/ai'); await set('Công cụ AI', 'examPlan', 'document'); await set('Mã kỳ thi (để trống để ôn tất cả)', '1', 'document'); await set('Tin nhắn cho AI Tutor', 'QA lập kế hoạch ôn thi', 'document'); await click('Gửi tin nhắn');
          await wait("!!document.querySelector('.plan-preview')", 15000); assert.equal((await query('SELECT * FROM ExamStudyPlans')).length, 0); await shot('exam-ai-preview');
        });
        await test('AI-PLAN-CONFLICT', 'worst', ['Exam-4'], 'Lịch mới sau preview làm server từ chối toàn bộ plan', async () => {
          const rows = await query('SELECT messages_json FROM AiConversations');
          const text = rows.map(r => r.messages_json).join('');
          // Fixture provider proposes tomorrow 18:00-19:00. Insert concurrent event after preview.
          await query("INSERT INTO StudySchedules(student_id,title,study_date,start_time,end_time,duration_minutes) VALUES(1,'QA concurrent conflict',@date,'18:00','19:00',60)", { date: add(1) });
          await click('Xác nhận kế hoạch'); await sleep(350); assert.equal((await query('SELECT * FROM ExamStudyPlans')).length, 0); assert.equal((await query("SELECT * FROM StudySchedules WHERE is_ai_suggested=1")).length, 0);
          return { conflictInserted: add(1) + ' 18:00-19:00', conversationRecorded: text.length > 0 };
        });
        await test('AI-LEAVE-EXPORT', 'average', ['AI-6'], 'Soạn đơn, chỉnh sửa và xuất DOCX từ giao diện', async () => {
          await goto('/ai'); await set('Công cụ AI', 'draftLeave', 'document'); await set('Ngày nghỉ', add(1), 'document'); await set('Môn học (tùy chọn)', 'Cơ sở dữ liệu', 'document'); await set('Tin nhắn cho AI Tutor', 'QA nghỉ có việc riêng', 'document'); await click('Gửi tin nhắn');
          await wait("document.body.innerText.includes('ĐƠN XIN PHÉP')", 15000); await shot('leave-letter-fixture');
          assert.ok(await js("[...document.querySelectorAll('button,a')].some(e=>/docx|word/i.test(e.textContent))"), 'Không có nút xuất Word/DOCX trong UI AI Tutor.');
        });
        await test('POMO-COMPLETE-BREAK', 'worst', ['Pomo-1'], 'Hết phiên focus tự chuyển nghỉ ngắn 5 phút', async () => {
          await goto('/learning?tab=pomodoro'); await js(`sessionStorage.setItem('smart-study-hub:pomodoro:v1',JSON.stringify({mode:'focus',remaining:1,running:true,pending:false,end:Date.now()+1200,start:Date.now()-1498800,segment:Date.now()-1498800,segments:[],sessionId:'qa-complete'}))`); await win.reload(); await wait("document.querySelector('.timer-value')?.textContent==='00:00'", 7000); await sleep(300);
          assert.equal(await js("document.querySelector('.timer-value').textContent"), '05:00', 'Focus dừng ở 00:00, cần lưu/thao tác để sang nghỉ.');
        });
        await test('STATS-AI-BUTTON', 'average', ['Stat-2'], 'Trang thống kê có nút chủ động nhận xét AI', async () => { await goto('/statistics'); assert.ok(await js("[...document.querySelectorAll('button')].some(b=>/AI/.test(b.textContent))"), 'Không có nút nhận xét AI tại /statistics.'); });
        await test('SEARCH-RESULT-NAV', 'average', ['Search-1'], 'Tìm sổ tay và mở đúng ngữ cảnh', async () => {
          await goto('/'); win.webContents.sendInputEvent({type:'keyDown',keyCode:'K',modifiers:['control']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'K',modifiers:['control']});
          await wait("!!document.querySelector('[aria-label=\"Tìm kiếm toàn bộ\"]')"); await set('Tìm kiếm toàn bộ', 'QA Cornell', 'document'); await wait("!!document.querySelector('.search-results button')"); await js("document.querySelector('.search-results button').click()"); await wait("!document.querySelector('[aria-label=\"Tìm kiếm toàn bộ\"]')"); assert.ok(await js("location.pathname==='/notebooks'||location.pathname==='/documents'")); return await js('location.pathname+location.search');
        });
        await test('SEARCH-EMPTY', 'worst', ['Search-1'], 'Từ khóa không tồn tại hiển thị trạng thái rỗng', async () => {
          await goto('/'); win.webContents.sendInputEvent({type:'keyDown',keyCode:'K',modifiers:['control']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'K',modifiers:['control']}); await wait("!!document.querySelector('[aria-label=\"Tìm kiếm toàn bộ\"]')"); await set('Tìm kiếm toàn bộ', 'qa-khong-co-987654321', 'document'); await wait("document.body.innerText.includes('Không tìm thấy kết quả')");
        });
      }
      report.providerCalls = fake.state.calls.length;
      report.summary = Object.fromEntries(['PASS', 'FAIL'].map(s => [s, report.checks.filter(c => c.status === s).length]));
    } catch (e) { report.fatal = e.stack; console.error(e); }
    finally {
      if (win && !win.isDestroyed()) win.destroy();
      if (vite) vite.kill();
      for (const server of [apiServer, fake?.provider]) if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
      if (db) await db.closePool();
      fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
      console.log('REPORT ' + path.join(output, 'result.json'));
      console.log(JSON.stringify(report.summary || {}));
      app.exit(report.fatal || report.checks.some(c => c.status === 'FAIL') ? 1 : 0);
    }
  });
}
