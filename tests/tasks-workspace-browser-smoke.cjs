'use strict';
const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    process.exit(spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' }).status ?? 1);
}
const { app, BrowserWindow } = electron;
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-workspace-browser-'));
const output = path.join(root, 'tests/artifacts/tasks-workspace'); fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(directory, 'profile')); app.disableHardwareAcceleration();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
    let window, vite, api; let status = 0;
    const report = { provider: 'local synthetic HTTP fixture', checks: [], errors: [] };
    const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name + (detail ? ': ' + JSON.stringify(detail) : '')); };
    try {
        const subjects = ['Phát triển ứng dụng web', 'Công nghệ phần mềm – K4', 'Cấu trúc dữ liệu và giải thuật', 'Lập trình Python'];
        let undated = false, unavailable = false, freshPulls = 0;
        const assignments = Array.from({ length: 38 }, (_, i) => ({
            id: `edux-${i}`, title: `Chương ${i + 1}: Ôn tập và thực hành`, subject: subjects[i % 4],
            due: '2099-12-31', dueSource: 'subject', subjectStartTime: '2020-01-01', subjectDeadline: '2099-12-31',
            status: 'Hoàn thành', progress: { daHoc: 5, tongSo: 5 },
        }));
        api = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost');
            let data = [];
            if (url.pathname.endsWith('/student/profile')) data = { student_id: 1, full_name: 'Sinh viên thử nghiệm', major: 'IT' };
            if (url.pathname.endsWith('/tasks/edux')) {
                if (url.searchParams.get('refresh') === 'true') freshPulls++;
                if (unavailable) { res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true' }); res.end(JSON.stringify({ success: false, message: 'EDUX fixture unavailable' })); return; }
                data = { assignments: assignments.map(row => undated ? { ...row, due: null, subjectStartTime: null, subjectDeadline: null } : row) };
            }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true' });
            res.end(JSON.stringify({ success: true, data }));
        });
        await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
        const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
        const base = `http://127.0.0.1:${port}`;
        vite = spawn(process.execPath, [path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'Frontend'), windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VITE_USE_MOCK: 'false', VITE_API_URL: `http://127.0.0.1:${api.address().port}/api/v1` } });
        let log = ''; for (const stream of [vite.stdout, vite.stderr]) stream.on('data', data => { log += data; });
        for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} if (i === 99) throw Error(log); await pause(100); }
        window = new BrowserWindow({ width: 1600, height: 900, show: false, enableLargerThanScreen: true, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
        const js = code => window.webContents.executeJavaScript(code, true);
        const wait = async expression => { for (let i = 0; i < 120; i++) { if (await js(expression)) return; await pause(100); } throw Error('Timeout: ' + expression); };
        const click = text => js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)throw Error('Button missing');b.click()})()`);
        window.webContents.on('console-message', event => { if ((event.level === 'error' || event.level === 3) && !/Failed to load resource|API Request Error/.test(event.message)) report.errors.push(event.message); });
        await window.loadURL(base + '/tasks');
        await wait(`document.querySelector('.tasks-week-ring strong')?.textContent==='100%'`);
        check('38 completed EDUX chapters in an active course count toward this week', await js(`document.querySelector('.tasks-edux-summary strong').textContent==='38/38 bài'`));
        await click('Đã hoàn thành'); await wait(`document.querySelectorAll('.tasks-subject-header').length===4`);
        await pause(150); fs.writeFileSync(path.join(output, 'desktop-subjects.png'), (await window.webContents.capturePage()).toPNG());
        await click('Danh sách'); await wait(`document.querySelectorAll('.task-item').length===38`);
        for (const [name, width, height] of [['desktop', 1600, 900], ['laptop', 1280, 720], ['tablet', 900, 800], ['mobile', 390, 844], ['short', 1280, 560]]) {
            window.setContentSize(width, height); await pause(200);
            const sizing = await js(`({width:innerWidth,document:document.documentElement.scrollWidth,main:document.querySelector('.main-content').scrollWidth,client:document.querySelector('.main-content').clientWidth,wide:[...document.querySelectorAll('.tasks-page *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(e=>({class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))})`);
            check(name + ' has no horizontal page overflow', sizing.document <= sizing.width + 2 && sizing.main <= sizing.client + 2, sizing);
            if (width >= 768) {
                const before = await js(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();document.querySelector('.tasks-content').scrollTop=0;return {header:r('.page-header').top,controls:r('.tasks-controls').top,aside:r('.tasks-insights').top,list:r('.tasks-content').top,height:innerHeight}})()`);
                check(name + ' list starts in the upper half of the viewport', before.list < height * .52, before);
                const scroll = await js(`(()=>{const list=document.querySelector('.tasks-content');list.scrollTop=700;const r=s=>document.querySelector(s).getBoundingClientRect();return {scroll:list.scrollTop,outer:document.querySelector('.main-content').scrollTop,header:r('.page-header').top,controls:r('.tasks-controls').top,aside:r('.tasks-insights').top,bottom:r('.tasks-content').bottom}})()`);
                check(name + ' list scroll leaves header, controls and insights in place', scroll.scroll > 0 && scroll.outer === 0 && scroll.header === before.header && scroll.controls === before.controls && scroll.aside === before.aside && scroll.bottom <= height, scroll);
                await click('Bộ lọc'); await pause(100);
                check(name + ' expanded filters leave room for the list', await js(`document.querySelector('.tasks-content').clientHeight>150`));
                await click('Bộ lọc');
            }
            await pause(100); fs.writeFileSync(path.join(output, name + '.png'), (await window.webContents.capturePage()).toPNG());
        }
        window.setContentSize(1280, 720); await pause(100);
        await click('Lịch'); await wait(`document.querySelector('.tasks-calendar')`);
        check('Calendar remains inside the independent list viewport', await js(`document.querySelector('.tasks-content').scrollHeight>document.querySelector('.tasks-content').clientHeight&&document.querySelector('.main-content').scrollTop===0`));
        check('Changing presentation resets only the list scroll so the calendar heading stays visible', await js(`document.querySelector('.tasks-content').scrollTop===0&&document.querySelector('.tasks-calendar-heading').getBoundingClientRect().top>=document.querySelector('.tasks-content').getBoundingClientRect().top`));
        fs.writeFileSync(path.join(output, 'calendar.png'), (await window.webContents.capturePage()).toPNG());
        const refresh = () => js(`document.querySelector('button[aria-label="Làm mới công việc"]').click()`);
        await refresh();
        for (let i = 0; i < 30 && !freshPulls; i++) await pause(100);
        check('Refresh requests a fresh EDUX pull instead of re-reading only cached work', freshPulls > 0);
        await wait(`document.querySelector('button[aria-label="Làm mới công việc"]').disabled===false`);
        undated = true; await refresh();
        await wait(`document.querySelector('button[aria-label="Làm mới công việc"]').disabled===false&&document.querySelector('.tasks-week-ring strong')?.textContent==='—'`);
        check('Unknown weekly dates show no percentage while keeping the EDUX total', await js(`document.querySelector('.tasks-edux-summary strong').textContent==='38/38 bài'&&document.querySelector('.tasks-week-note').textContent.includes('Chưa có công việc')`));
        fs.writeFileSync(path.join(output, 'undated.png'), (await window.webContents.capturePage()).toPNG());
        await wait(`document.querySelector('button[aria-label="Làm mới công việc"]').disabled===false`);
        unavailable = true; await refresh();
        await wait(`document.querySelector('.tasks-week-note')?.textContent.includes('tạm tính')`);
        check('Unavailable EDUX is reported as incomplete data', await js(`document.querySelector('.tasks-week-ring strong').textContent==='—'&&!document.querySelector('.tasks-edux-summary')`));
        check('No renderer errors', report.errors.length === 0, report.errors);
    } catch (error) { status = 1; report.failure = error.stack; console.error(error.stack); if (window) fs.writeFileSync(path.join(output, 'failure.png'), (await window.webContents.capturePage()).toPNG()); }
    finally {
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        window?.destroy(); vite?.kill(); if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
        if (path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('tasks-workspace-browser-')) try { fs.rmSync(directory, { recursive: true, force: true }); } catch {}
        app.exit(status);
    }
});
