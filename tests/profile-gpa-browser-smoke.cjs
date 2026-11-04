'use strict';
const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
    process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = electron;
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const grades = require('./fixtures/iu-grade-transcript.cjs');
const summary = require('../database/shared/academic-results').summarizeGrades(grades);
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-gpa-browser-'));
const output = path.join(root, 'tests/artifacts/profile-gpa'); fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(directory, 'profile')); app.disableHardwareAcceleration();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
    let window, vite, api; let status = 0;
    const report = { date: '2026-11-05', provider: 'local synthetic HTTP fixture', checks: [], errors: [] };
    const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name); };
    try {
        api = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost');
            let data = [];
            if (url.pathname.endsWith('/student/profile')) data = { student_id: 1, student_code: 'GPA-FIXTURE', full_name: 'Academic fixture', major: 'IT', total_passed_credits: 25, academic_summary: summary };
            if (url.pathname.endsWith('/student/grades')) data = url.searchParams.has('hocKy') ? grades.filter(row => row.semester === url.searchParams.get('hocKy')) : grades;
            if (url.pathname.endsWith('/student/subjects')) data = [...new Map(grades.map(row => [row.subject_code, { subject_id: row.subject_id, subject_code: row.subject_code, subject_name: row.subject_name, credits: row.credits }])).values()];
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true' });
            res.end(JSON.stringify({ success: true, data }));
        });
        await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
        const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
        const base = `http://127.0.0.1:${port}`;
        vite = spawn(process.execPath, [path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'Frontend'), windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VITE_USE_MOCK: 'false', VITE_API_URL: `http://127.0.0.1:${api.address().port}/api/v1` } });
        let log = ''; for (const stream of [vite.stdout, vite.stderr]) stream.on('data', data => { log += data; });
        for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} if (i === 99) throw Error(log); await pause(100); }
        window = new BrowserWindow({ width: 1440, height: 1000, show: false, enableLargerThanScreen: true, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
        const js = code => window.webContents.executeJavaScript(code, true);
        const wait = async expression => { for (let i = 0; i < 150; i++) { if (await js(expression)) return; await pause(100); } throw Error('Timeout: ' + expression); };
        window.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
        await window.loadURL(base + '/profile');
        await wait(`document.querySelector('.profile-academic-summary')&&document.querySelectorAll('.profile-grade-table tbody tr').length===14`);
        const values = await js(`[...document.querySelectorAll('.profile-academic-summary dd')].map(e=>e.textContent.trim())`);
        check('The four IU indicators retain their scales and precision', JSON.stringify(values) === JSON.stringify(['5.95 / 10','2.25 / 4','6.66 / 10','2.52 / 4']), values);
        check('The main card uses cumulative GPA on scale 4', await js(`document.querySelector('.profile-stat-pink').textContent.includes('2.52 / 4')`));
        for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
            window.setContentSize(width, height); await pause(200);
            await js(`document.querySelector('.profile-academic-summary').scrollIntoView({block:'center'})`); await pause(200);
            check(name + ' recap fits without page overflow', await js(`document.documentElement.scrollWidth<=innerWidth+2`));
            fs.writeFileSync(path.join(output, name + '.png'), (await window.webContents.capturePage()).toPNG());
        }
        await js(`(()=>{const e=document.querySelector('select[aria-label="Lọc học kỳ"]');e.value='2_2025_2026';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await wait(`document.querySelectorAll('.profile-grade-table tbody tr').length===4`);
        check('Filtering a semester keeps overall GPA intact', await js(`document.querySelector('.profile-stat-pink').textContent.includes('2.52 / 4')`));
        check('No renderer errors', report.errors.length === 0, report.errors);
    } catch (error) { status = 1; report.failure = error.stack; console.error(error.stack); }
    finally {
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        window?.destroy(); vite?.kill(); if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
        if (path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('profile-gpa-browser-')) try { fs.rmSync(directory, { recursive: true, force: true }); } catch {}
        app.exit(status);
    }
});
