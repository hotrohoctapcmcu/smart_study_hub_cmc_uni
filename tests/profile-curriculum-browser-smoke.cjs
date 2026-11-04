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
const fixture = require('./fixtures/iu-curriculum.cjs');
const summary = require('../database/shared/academic-results').summarizeGrades(grades);
const { mapChuongTrinhHoc } = require('../CRWEB/modules/IU/data/maps');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-curriculum-browser-'));
const output = path.join(root, 'tests/artifacts/profile-curriculum'); fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(directory, 'profile')); app.disableHardwareAcceleration();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
    let window, vite, api; let status = 0;
    const report = { date: '2026-11-05', provider: 'local synthetic HTTP fixture; no authenticated IU response', checks: [], errors: [] };
    const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name); };
    try {
        const catalog = mapChuongTrinhHoc([], fixture.accumulated.rsChiTiet).flatMap(term => term.hoc_phan);
        const subjects = catalog.map((course, i) => ({ subject_id: i + 100, subject_code: course.ma_mon, subject_name: course.ten_mon,
            credits: course.so_tin_chi, block_name: course.loai_hoc_phan, status: 'PLANNED' }));
        for (let i = subjects.length; i < 63; i++) subjects.push({ subject_id: i + 100, subject_code: `FUTURE${i}`, subject_name: `Học phần tương lai ${i}`, credits: 3, status: 'PLANNED' });
        let synced = false, refreshes = 0, allowRefresh;
        const refreshGate = new Promise(resolve => { allowRefresh = resolve; });
        api = http.createServer(async (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
            const url = new URL(req.url, 'http://localhost'); let data = [];
            if (url.pathname.endsWith('/student/profile')) data = { student_id: 1, student_code: 'BSE250001', full_name: 'Curriculum fixture', major: 'Kỹ thuật phần mềm',
                total_passed_credits: 25, total_program_credits: synced ? 126 : null,
                required_program_credits: synced ? 129 : null, available_block_credits: synced ? 203 : null,
                block_earned_credits: synced ? 28 : null, program_name: fixture.programs[0].TEN, academic_summary: summary };
            if (url.pathname.endsWith('/student/grades')) data = grades;
            if (url.pathname.endsWith('/student/subjects')) data = subjects;
            if (url.pathname.endsWith('/sync/iu/status')) data = { connected: true };
            if (url.pathname.endsWith('/sync/iu/group')) {
                let body = ''; for await (const chunk of req) body += chunk;
                const input = JSON.parse(body);
                if (input.nhom !== 'chuongtrinh' || input.luuDb !== true) { res.writeHead(400); res.end(); return; }
                refreshes++; await refreshGate; synced = true;
                data = { persisted: true, totalProgramCredits: 126 };
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data }));
        });
        await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
        const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
        const base = `http://127.0.0.1:${port}`;
        vite = spawn(process.execPath, [path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
            cwd: path.join(root, 'Frontend'), windowsHide: true, stdio: 'pipe',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', VITE_USE_MOCK: 'false', VITE_API_URL: `http://127.0.0.1:${api.address().port}/api/v1` } });
        let log = ''; for (const stream of [vite.stdout, vite.stderr]) stream.on('data', data => { log += data; });
        for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} if (i === 99) throw Error(log); await pause(100); }
        window = new BrowserWindow({ width: 1440, height: 1000, show: false, enableLargerThanScreen: true,
            webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
        const js = code => window.webContents.executeJavaScript(code, true);
        const wait = async expression => { for (let i = 0; i < 150; i++) { if (await js(expression)) return; await pause(100); } throw Error('Timeout: ' + expression); };
        window.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
        await window.loadURL(base + '/profile');
        await wait(`document.body.textContent.includes('25 tín chỉ')&&document.querySelector('.profile-credit-sync button:disabled')`);
        for (let i = 0; refreshes === 0 && i < 150; i++) await pause(100);
        check('Missing program total triggers a single scoped refresh and keeps earned credits visible', refreshes === 1);
        allowRefresh();
        await wait(`document.body.textContent.includes('25 / 126 tín chỉ')`);
        check('Official IU denominator displays automatically', await js(`document.body.textContent.includes('25 / 126 tín chỉ')&&document.body.textContent.includes('20% chương trình')`));
        check('129 required credits are displayed separately from the 126 program total', await js(`document.querySelector('.profile-required-credits').textContent.includes('129')&&document.querySelector('[aria-label="Tín chỉ theo khối IU"]').textContent.includes('203')&&document.querySelector('[aria-label="Tín chỉ theo khối IU"]').textContent.includes('28')`));
        check('Remaining credits and cohort match the profile', await js(`document.querySelector('.study-credit-list').textContent.includes('101')&&document.body.textContent.includes('Khóa 2025')`));
        check('GPA remains 2.52 with future subjects in the catalog', await js(`document.querySelector('.profile-stat-pink').textContent.includes('2.52 / 4')`));
        await js(`document.getElementById('profile-tab-subjects').click()`);
        await wait(`document.querySelectorAll('.subject-profile-card').length===76`);
        check('All 63 future subjects and 13 transcript subjects remain available', await js(`document.querySelector('.profile-subject-count').textContent.includes('76 / 76')`));
        const search = async value => js(`(()=>{const input=document.querySelector('input[type="search"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
        await search('SENG'); await wait(`document.querySelectorAll('.subject-profile-card').length===2`);
        check('Course code search finds ungraded curriculum subjects', await js(`document.querySelector('.subject-grid').textContent.includes('Phát triển ứng dụng web nâng cao')`));
        check('Ungraded subjects retain unknown scores and planned status', await js(`[...document.querySelectorAll('.subject-profile-card')].every(card=>card.querySelector('.grade-score').textContent==='—'&&card.textContent.includes('Chưa bắt đầu'))`));
        await js(`document.querySelector('.subject-profile-card button').click()`); await wait(`document.querySelector('[role="dialog"]')`);
        check('Course details include official code and knowledge block', await js(`document.querySelector('[role="dialog"]').textContent.includes('SENG3008')&&document.querySelector('[role="dialog"]').textContent.includes('Chuyên ngành')`));
        await js(`document.querySelector('[role="dialog"] button[aria-label^="Đóng"]').click()`); await wait(`!document.querySelector('[role="dialog"]')`);
        for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
            window.setContentSize(width, height); await pause(200);
            await js(`document.querySelector('.profile-subject-filters').scrollIntoView({block:'start'})`); await pause(200);
            check(name + ' catalog fits without horizontal overflow', await js(`document.documentElement.scrollWidth<=innerWidth+2`));
            fs.writeFileSync(path.join(output, name + '.png'), (await window.webContents.capturePage()).toPNG());
        }
        check('No renderer errors', report.errors.length === 0, report.errors);
    } catch (error) { status = 1; report.failure = error.stack; console.error(error.stack); }
    finally {
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        window?.destroy(); vite?.kill(); if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
        if (path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith('profile-curriculum-browser-')) try { fs.rmSync(directory, { recursive: true, force: true }); } catch {}
        app.exit(status);
    }
});
