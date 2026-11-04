'use strict';
// Read-only real API smoke; base64/PDF fixtures stay in an isolated renderer adapter.
const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = electron;
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'tests', 'artifacts', 'documents-qa');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-documents-qa-'));
app.setPath('userData', path.join(profile, 'profile'));
app.disableHardwareAcceleration();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const report = { date: '2026-10-30', mode: 'Real API, isolated Electron profile; EDUX base64 and PDF fixtures only in test adapter', checks: [], errors: [], screenshots: [] };
  let win, vite, status = 0;
  const check = (name, passed, detail) => { report.checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw new Error(name); };
  try {
    fs.mkdirSync(output, { recursive: true });
    vite = spawn(process.execPath, [path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { cwd: path.join(root, 'Frontend'), windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    let log = ''; vite.stdout.on('data', chunk => { log += chunk; }); vite.stderr.on('data', chunk => { log += chunk; });
    for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5177')).ok) break; } catch {} if (i === 99) throw new Error(log); await sleep(200); }
    win = new BrowserWindow({ width: 1440, height: 1000, show: false, enableLargerThanScreen: true, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    win.setContentSize(1440, 1000);
    win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
    const js = code => win.webContents.executeJavaScript(code, true);
    const wait = async expression => { for (let i = 0; i < 150; i++) { if (await js(expression)) return; await sleep(100); } throw new Error(`Timed out: ${expression}`); };
    const click = async label => { await js(`(()=>{const scope=document.querySelector('[role=dialog]')||document.querySelector('.study-documents-page')||document;const b=[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click()})()`); await sleep(150); };
    const screenshot = async name => { await sleep(200); const file = path.join(output, name + '.png'); fs.writeFileSync(file, (await win.webContents.capturePage()).toPNG()); report.screenshots.push(name + '.png'); };
    const key = async keyCode => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode }); await sleep(180); };
    await win.loadURL('http://127.0.0.1:5177/documents');
    await wait(`document.querySelectorAll('.study-subject-card').length > 0`);
    const api = await (await fetch('http://localhost:3001/api/v1/learning/courses')).json();
    const eduxStatus = await (await fetch('http://localhost:3001/api/v1/sync/edux/status')).json();
    report.liveEduxConnected = Boolean(eduxStatus.connected);
    const count = await js(`document.querySelectorAll('.study-subject-card').length`);
    check('Default tab is lectures, using real course catalog', count === api.data.courses.length, `${count} courses`);
    check('Real slide totals and zero invented image covers', await js(`+document.querySelectorAll('.study-stat strong')[2].textContent.replace(/[^0-9]/g,'')>100 && ![...document.querySelectorAll('.subject-cover img')].some(i=>/placeholder|unsplash|picsum/.test(i.src))`));
    await screenshot('subjects-desktop');
    for (const [width, height, name] of [[834, 1100, 'subjects-tablet'], [390, 844, 'subjects-mobile']]) {
      win.setContentSize(width, height); await sleep(250);
      check(`No horizontal overflow at ${width}px`, await js(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('.study-subject-grid').getBoundingClientRect().right<=innerWidth`));
      await screenshot(name);
    }
    win.setContentSize(1440, 1000); await sleep(200);
    await js(`document.querySelector('.study-subject-card').click()`);
    await wait(`!!document.querySelector('.study-chapter-card')`);
    check('Subject opens chapters before any viewer', await js(`!document.querySelector('[role=dialog]')`));
    await screenshot('chapters-desktop');
    await js(`document.querySelector('.chapter-cover').click()`);
    await wait(`document.querySelectorAll('.study-slide-card').length>1`);
    await screenshot('slides-desktop');
    await js(`document.querySelectorAll('.study-slide-card')[1].click()`);
    await wait(`!!document.querySelector('.study-viewer')`);
    check('Stored source slide opens in Study Viewer', await js(`!!document.querySelector('.study-slide-page img, .study-slide-page .slide-text-preview')`));
    await click('Ghi chú');
    await js(`(()=>{const e=document.querySelector('#slide-note');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Ghi chú kiểm thử riêng cho slide 02');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await click('Đánh dấu slide'); await click('Đánh dấu đã học');
    await js(`document.querySelector('.study-viewer-footer button:last-child').focus()`); await key('Right');
    check('Arrow key advances and isolates slide notes', await js(`document.querySelector('.study-page-count strong').textContent==='3' && document.querySelector('#slide-note').value===''`));
    await key('Left');
    check('Returning to slide restores notes and completion', await js(`document.querySelector('#slide-note').value.includes('slide 02') && [...document.querySelectorAll('.study-toolbar button')].some(b=>b.textContent==='Đã học'&&b.getAttribute('aria-pressed')==='true')`));
    await click('Đóng công cụ học'); await click('Phóng to');
    check('Zoom and fit-screen work', await js(`document.querySelector('.study-toolbar output').textContent==='125%'`));
    await click('Vừa màn hình'); await screenshot('viewer-desktop');
    win.setContentSize(390, 844); await sleep(250); await screenshot('viewer-mobile');
    check('Mobile viewer remains inside viewport', await js(`document.querySelector('.modal-study').getBoundingClientRect().right<=innerWidth && document.documentElement.scrollWidth<=innerWidth`));
    await click('Đóng hộp thoại'); await click('Tài liệu');
    await wait(`!!document.querySelector('.study-continue')`);
    check('Continue learning points to last real slide', await js(`document.querySelector('.continue-slide').textContent.includes('02')`));
    await click('Tiếp tục học'); await wait(`!!document.querySelector('.study-viewer')`);
    check('Resume reopens exact slide', await js(`document.querySelector('.study-page-count strong').textContent==='2'`));
    await click('Đóng hộp thoại'); await click('Tài liệu');
    await win.reload(); await wait(`!!document.querySelector('.study-continue')`);
    check('Progress survives reload', true);
    // A legacy EDUX fixture verifies image fields are ignored in all views.
    await js(`(async()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;const ctx=canvas.getContext('2d');ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,1200,675);ctx.fillStyle='#1e3a8a';ctx.fillRect(0,0,1200,150);ctx.fillStyle='white';ctx.font='bold 44px sans-serif';ctx.fillText('EDUX image_base64 — TEST FIXTURE',55,95);ctx.fillStyle='#172554';ctx.font='32px sans-serif';ctx.fillText('Original raster response rendered as a slide image',55,245);ctx.fillStyle='#2563eb';ctx.fillRect(55,315,460,220);ctx.fillStyle='#93c5fd';ctx.fillRect(565,315,570,220);const source=canvas.toDataURL('image/png');const fixture={id:'qa-edux-base64',subject:'EDUX Base64 QA',chapters:[{id:'chapter',title:'Base64 response',documents:[{id:'slide',title:'Original image field',content:'Text extraction remains separate.',image_base64:source.split(',')[1]}]}]};const {default:client}=await import('/src/api/apiClient.js');window.__docsQAAdapter=client.defaults.adapter;window.__docsQAImage=source;client.defaults.adapter=async config=>{const ok=data=>({config,status:200,statusText:'OK',headers:{},data:{success:true,data}});if(config.url==='/learning/courses')return ok({courses:[fixture],scope:{}});if(config.url==='/learning/courses/qa-edux-base64')return ok(fixture);if(config.url==='/documents')return ok([]);return client.request({...config,adapter:window.__docsQAAdapter})};const {router}=await import('/src/App.jsx');await router.navigate('/')})()`);
    await wait(`!document.querySelector('.study-documents-page')`);
    await js(`(async()=>{const {router}=await import('/src/App.jsx');await router.navigate('/documents')})()`);
    await wait(`!!document.querySelector('.subject-cover .slide-text-preview')`);
    check('EDUX subject cover uses text and ignores legacy image fields', await js(`!document.querySelector('.subject-cover img')`));
    await click('Mở môn EDUX Base64 QA');
    await wait(`!!document.querySelector('.chapter-cover .slide-text-preview')`);
    await click('Mở Base64 response');
    await wait(`!!document.querySelector('.study-slide-card .slide-text-preview')`);
    check('EDUX chapter and slide previews use text', await js(`!document.querySelector('.study-slide-card img')`));
    await click('Mở slide 1: Original image field');
    await wait(`!!document.querySelector('.study-slide-page .slide-text-preview')`);
    check('EDUX viewer shows source text without rendering an image', await js(`!document.querySelector('.study-slide-page img') && document.querySelector('.study-slide-page').textContent.includes('Text extraction remains separate.')`));
    await screenshot('viewer-edux-text-fixture');
    await click('Đóng hộp thoại');
    await js(`(async()=>{const {default:client}=await import('/src/api/apiClient.js');client.defaults.adapter=window.__docsQAAdapter;delete window.__docsQAAdapter;delete window.__docsQAImage;const {router}=await import('/src/App.jsx');await router.navigate('/')})()`);
    await wait(`!document.querySelector('.study-documents-page')`);
    // A genuine PDF document, never an image mock; no server/user data is changed.
    const { jsPDF } = require(path.join(root, 'Frontend/node_modules/jspdf'));
    const pdf = new jsPDF({ orientation: 'landscape' }); pdf.text('Study Viewer - PDF page 1', 20, 25); pdf.addPage(); pdf.text('Study Viewer - PDF page 2', 20, 25);
    const base64 = Buffer.from(pdf.output('arraybuffer')).toString('base64');
    await js(`(async()=>{const {default:client}=await import('/src/api/apiClient.js');const original=client.defaults.adapter;client.defaults.adapter=async config=>{const ok=data=>({config,status:200,statusText:'OK',headers:{},data:{success:true,data}});if(config.url==='/documents')return ok([{id:'qa-pdf',title:'PDF renderer verification.pdf',type:'pdf',subject:'PDF QA'}]);if(config.url==='/documents/qa-pdf/file'){const bytes=Uint8Array.from(atob(${JSON.stringify(base64)}),c=>c.charCodeAt(0));return {...ok(null),data:new Blob([bytes],{type:'application/pdf'})}}return client.request({...config,adapter:original})};const {router}=await import('/src/App.jsx');await router.navigate('/')})()`);
    await wait(`!document.querySelector('.study-documents-page')`);
    await js(`(async()=>{const {router}=await import('/src/App.jsx');await router.navigate('/documents')})()`);
    await wait(`!![...document.querySelectorAll('.study-subject-card')].find(b=>b.textContent.includes('PDF QA'))`);
    win.setContentSize(1440, 1000);
    await click('Mở môn PDF QA'); await click('Mở PDF renderer verification.pdf');
    await wait(`document.querySelectorAll('.study-slide-card img').length===2 && [...document.querySelectorAll('.study-slide-card img')].every(i=>i.complete&&i.naturalWidth>0)`);
    check('PDF.js renders actual PDF page images for each slide', true);
    await js(`document.querySelectorAll('.study-slide-card')[1].click()`);
    await wait(`!!document.querySelector('.study-slide-page img')?.naturalWidth`);
    await js(`(async()=>{const image=document.querySelector('.study-slide-page img');await image.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()`);
    check('Rendered PDF contains visible source content', await js(`(()=>{const image=document.querySelector('.study-slide-page img'),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]<100)dark++;return dark>100})()`));
    await wait(`document.querySelectorAll('.study-slide-navigator img').length===2 && [...document.querySelectorAll('.study-slide-navigator img')].every(i=>i.complete&&i.naturalWidth>0)`);
    check('Fit screen preserves the entire PDF page', await js(`(()=>{const image=document.querySelector('.study-slide-page img').getBoundingClientRect(),stage=document.querySelector('.study-slide-stage').getBoundingClientRect();return image.width<=stage.width && image.height<=stage.height})()`));
    await screenshot('viewer-pdf');
    await click('AI Tutor');
    await wait(`!![...document.querySelectorAll('.slide-ai-shortcuts button')].find(b=>!b.disabled)`);
    check('PDF text is available as AI context', true);
    check('No renderer errors', report.errors.length === 0, report.errors.join('\n'));
  } catch (error) { status = 1; report.failure = error.stack; console.error(error); }
  finally {
    if (win && !win.isDestroyed()) win.destroy();
    if (vite) vite.kill();
    fs.writeFileSync(path.join(output, 'browser-smoke.json'), JSON.stringify(report, null, 2));
    app.exit(status);
  }
});
