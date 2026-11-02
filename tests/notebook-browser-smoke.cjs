'use strict';
// Run with node tests/notebook-browser-smoke.cjs. Uses a fresh browser profile.
const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
const { app, BrowserWindow, clipboard, ClipboardItem } = electron;
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-notebook-browser-'));
app.setPath('userData', path.join(profile, 'profile'));
app.disableHardwareAcceleration();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.join(root, 'tests', 'artifacts', 'notebook-qa');
fs.mkdirSync(output, { recursive: true });
app.whenReady().then(async () => {
  const report = { date: '2026-10-30', mode: 'Vite mock, isolated Electron profile', checks: [], errors: [], screenshots: [] };
  let win, vite, status = 0;
  const clipboardTextBefore=await clipboard.readText();
  try {
    vite = spawn(process.execPath, [path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), '--mode', 'mock', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { cwd: path.join(root, 'Frontend'), windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    let log = ''; vite.stdout.on('data', data => { log += data; }); vite.stderr.on('data', data => { log += data; });
    for (let i = 0; i < 120; i++) { try { if ((await fetch('http://127.0.0.1:5175')).ok) break; } catch {} if (i === 119) throw new Error('Vite startup failed: ' + log); await sleep(250); }
    win = new BrowserWindow({ width: 1440, height: 1000, enableLargerThanScreen:true, show: false, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    win.setContentSize(1440,1000);
    win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
    win.webContents.on('render-process-gone', (_event, details) => report.errors.push('Renderer gone: ' + details.reason));
    const js = async code => { try { return await win.webContents.executeJavaScript(code, true); } catch (error) { throw new Error(error.message + '\nScript: ' + code); } };
    const wait = async expression => { for (let i = 0; i < 100; i++) { if (await js(expression)) return; await sleep(100); } throw new Error('Timed out: ' + expression); };
    const click = async label => { await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)}+' Available: '+[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')).join('|'));b.click()})()`); await sleep(120); };
    const key = async (keyCode, modifiers = []) => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers }); await sleep(160); };
    const data = () => js(`(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('ssh-textbooks-v1:'));return k?JSON.parse(localStorage.getItem(k)).books[0]:null})()`);
    const check = (name, ok, detail = '') => { report.checks.push({ name, passed: !!ok, detail }); console.log((ok?'PASS ':'FAIL ')+name); if (!ok) throw new Error(name + ': ' + detail); };
    const pointer = async (points) => {
      await js(`(()=>{const e=document.querySelector('.tb-viewport');e.scrollTop=${JSON.stringify(Math.max(0,points[0][1]*.75-120))};document.querySelector('.textbook-editor').scrollIntoView({block:'start'})})()`);await sleep(80);
      const rect = await js(`(()=>{const e=document.querySelector('.tb-paper'),r=e.getBoundingClientRect(),v=e.viewBox.baseVal;return {x:r.x,y:r.y,s:r.width/v.width}})()`);
      for (const [i, p] of points.entries()) { const x = Math.round(rect.x + p[0] * rect.s), y = Math.round(rect.y + p[1] * rect.s); if(i===0){win.webContents.sendInputEvent({type:'mouseMove',x,y});await sleep(35);}win.webContents.sendInputEvent({ type: i === 0 ? 'mouseDown' : i === points.length - 1 ? 'mouseUp' : 'mouseMove', x, y, button: 'left', clickCount: 1 }); await sleep(35); }
      await sleep(160);
    };
    await win.loadURL('http://127.0.0.1:5175/textbook');
    await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Tạo vở mới')`);
    await click('Tạo vở mới');
    await js(`(()=>{const e=document.querySelector('.textbook-create-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Kiểm tra Vở ghi — tiếng Việt');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await sleep(100); await js(`document.querySelector('.textbook-create-form').requestSubmit()`);
    await wait(`!!document.querySelector('.tb-paper')`);
    check('Create notebook through library form', !!(await data())?.id);
    await click('Dụng cụ'); await click('Thước kẻ'); await sleep(950);
    let book = await data(), ruler = book.pages[0].objects.find(o => o.type === 'ruler');
    check('Insert real ruler', !!ruler);
    await click('Bút mực · P');
    await pointer([[ruler.x + 25, ruler.y - 4], [ruler.x + 80, ruler.y + 3], [ruler.x + 160, ruler.y - 5], [ruler.x + 220, ruler.y + 2], [ruler.x + 250, ruler.y]]);
    await sleep(1000); book = await data(); const stroke = book.pages[0].objects.find(o => o.type === 'drawing');
    check('Pen snaps to ruler edge', !!stroke && stroke.data.points.every(p => Math.abs(stroke.y + p.y - ruler.y) < .1), JSON.stringify({ruler,stroke,rect:await js(`(()=>{const r=document.querySelector('.tb-paper').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,viewport:innerHeight}})()`)}));
    await key('v');await pointer([[ruler.x+150,ruler.y+30],[ruler.x+150,ruler.y+30]]);
    await js(`(()=>{const e=document.querySelector('.tb-properties input[type="range"][max="180"]');if(!e)throw Error('Rotation input missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'45');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(1000);
    ruler=(await data()).pages[0].objects.find(o=>o.type==='ruler');check('Rotate ruler from properties',ruler.rotation===45);
    await click('Bút mực · P');
    const world=(x,y)=>{const a=Math.PI/4,cx=ruler.width/2,cy=ruler.height/2;return [ruler.x+cx+(x-cx)*Math.cos(a)-(y-cy)*Math.sin(a),ruler.y+cy+(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a)];};
    await pointer([world(40,-3),world(100,2),world(180,-4),world(250,3),world(260,0)]);await sleep(1000);
    const rotated=(await data()).pages[0].objects.filter(o=>o.type==='drawing').at(-1),edge=world(0,0);
    check('Pen follows rotated ruler edge',!!rotated&&rotated.data.points.every(p=>Math.abs((rotated.y+p.y-edge[1])-(rotated.x+p.x-edge[0]))<.1));
    await key('v');await pointer([world(150,30),world(150,30)]);await key('Delete');await sleep(1000);
    check('Delete removes selected ruler',!(await data()).pages[0].objects.some(o=>o.type==='ruler'));await key('z',['control']);await sleep(1000);
    check('Undo restores deleted ruler',(await data()).pages[0].objects.some(o=>o.type==='ruler'));
    await key('y',['control']);await sleep(1000);check('Redo deletes ruler again',!(await data()).pages[0].objects.some(o=>o.type==='ruler'));await key('z',['control']);await sleep(1000);
    await click('Văn bản · T'); await pointer([[80, 110], [80, 110]]);
    await wait(`!!document.querySelector('.tb-inline-editor')`);
    await js(`(()=>{const e=document.querySelector('.tb-inline-editor');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Ghi chú tiếng Việt: Định lý và ví dụ');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await sleep(1100); book = await data();
    check('Autosave Vietnamese while inline editing', book.pages[0].objects.some(o => o.data?.text?.includes('Định lý')));
    await key('Enter', ['control']); await key('d', ['control']); await sleep(1000);
    book = await data(); const count = book.pages[0].objects.length;
    check('Ctrl D duplicates selected text', book.pages[0].objects.filter(o => o.type === 'text').length === 2);
    await key('z', ['control']); await sleep(1000); check('Ctrl Z restores object count', (await data()).pages[0].objects.length === count - 1);
    await key('y', ['control']); await sleep(1000); check('Ctrl Y redoes duplicate', (await data()).pages[0].objects.length === count);
    const copied=(await data()).pages[0].objects.filter(o=>o.type==='text').at(-1);
    await key('v');await pointer([[copied.x+20,copied.y+20],[copied.x+20,copied.y+20]]);
    await key('c',['control']);await sleep(350);await key('v',['control']);await sleep(950);await key('v',['control']);await sleep(950);
    const pasted=(await data()).pages[0].objects.filter(o=>o.type==='text').slice(-2);
    check('Native Ctrl C / V repeats with independent 24 / 48 offsets',pasted.length===2&&pasted[0].id!==pasted[1].id&&Math.abs(pasted[0].x-copied.x-24)<.1&&Math.abs(pasted[1].x-copied.x-48)<.1&&Math.abs(pasted[0].y-copied.y-24)<.1&&Math.abs(pasted[1].y-copied.y-48)<.1,JSON.stringify(pasted.map(o=>({id:o.id,x:o.x,y:o.y}))));
    await key('Delete');await sleep(150);await pointer([[copied.x+35,copied.y+35],[copied.x+35,copied.y+35]]);await key('Delete');await sleep(950);
    // Replace the native clipboard image even while the internal object clipboard
    // still contains copied text. Paste must honor the OS image first.
    const clipboardPng=await js(`(()=>{const c=document.createElement('canvas');c.width=120;c.height=80;const x=c.getContext('2d');x.fillStyle='#d5e8ff';x.fillRect(0,0,120,80);x.fillStyle='#345';x.font='18px Arial';x.fillText('Clipboard',10,40);return c.toDataURL('image/png')})()`);
    await clipboard.write([new ClipboardItem({'image/png':new Blob([Buffer.from(clipboardPng.split(',')[1],'base64')],{type:'image/png'})})]);await key('v',['control']);await sleep(1300);
    const imagePaste=(await data()).pages[0].objects.filter(o=>o.type==='image');
    check('Native image paste wins over stale object clipboard',imagePaste.length===1);
    await key('Delete');await sleep(950);
    await key('v');await pointer([[110,140],[110,175],[110,215],[110,225]]);await sleep(950);
    await js(`(()=>{const canvas=document.createElement('canvas');canvas.width=240;canvas.height=140;const c=canvas.getContext('2d');c.fillStyle='#e9ddff';c.fillRect(0,0,240,140);c.fillStyle='#7450bb';c.font='24px Arial';c.fillText('Study image',20,75);canvas.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'qa-image.png',{type:'image/png'}));document.querySelector('.tb-viewport').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));},'image/png');})()`);
    await sleep(1300);check('Drag-drop image imports real PNG',(await data()).pages[0].objects.some(o=>o.type==='image'));
    await key('v');await pointer([[100,140],[100,140]]);
    await js(`(()=>{const es=[...document.querySelectorAll('.tb-properties input[type="number"]')];const e=es.find(e=>e.closest('.field')?.textContent.trim()==='Trái');if(!e)throw Error('Crop X input missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'10');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(950);
    check('Image crop persists percent rectangle',(await data()).pages[0].objects.find(o=>o.type==='image')?.data.crop?.x===10);
    await js(`(()=>{const es=[...document.querySelectorAll('.tb-properties input[type="number"]')];const e=es.filter(e=>e.closest('.field')?.textContent.trim()==='Rộng').at(-1);if(!e)throw Error('Resize width input missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'300');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(950);
    check('Selected image resizes',(await data()).pages[0].objects.find(o=>o.type==='image')?.width===300);
    await key('Delete');await sleep(950);check('Selected image deletes',!(await data()).pages[0].objects.some(o=>o.type==='image'));
    await win.webContents.reload(); await wait(`!!document.querySelector('.tb-paper')`); await sleep(400);
    check('Reload retains notebook and Vietnamese content', (await data()).pages[0].objects.length === count && (await js(`document.querySelector('.tb-book-title-input').value`)).includes('tiếng Việt'));
    await click('Chế độ tập trung'); check('Focus mode activates', await js(`document.querySelector('.textbook-editor').classList.contains('tb-fullscreen')`));
    await click('Thoát chế độ tập trung'); check('Focus mode exits', await js(`!document.querySelector('.textbook-editor').classList.contains('tb-fullscreen')`));
    const zoomBefore = await js(`Number(document.querySelector('[aria-label="Mức thu phóng"]').value)`);
    const touchRect=await js(`(()=>{const r=document.querySelector('.tb-paper').getBoundingClientRect();return {x:r.x,y:Math.max(r.y,300)}})()`);
    win.webContents.debugger.attach('1.3');
    const touch=async(type,points)=>{await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x])=>({id,x:touchRect.x+x,y:touchRect.y+40,radiusX:3,radiusY:3,force:.5}))});await sleep(80);};
    await touch('touchStart',[[1,30],[2,130]]);await touch('touchMove',[[1,30],[2,180]]);await touch('touchEnd',[]);
    win.webContents.debugger.detach();
    await sleep(250); check('Browser-emulated touch pinch changes zoom', await js(`Number(document.querySelector('[aria-label="Mức thu phóng"]').value)>${zoomBefore}`));
    await js(`(()=>{const e=document.querySelector('[aria-label="Mức thu phóng"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'75');e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    for (const format of ['svg','png','jpg','pdf']) {
      await click('Xuất vở');
      await js(`(()=>{const e=document.querySelector('.tb-dialog-form select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(format)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(100);
      const download = new Promise((resolve,reject) => { const timer=setTimeout(()=>reject(new Error('Download timed out: '+format)),20000); win.webContents.session.once('will-download',(_event,item)=>{const target=path.join(profile,'export.'+format);item.setSavePath(target);item.once('done',(_event,state)=>{clearTimeout(timer);state==='completed'?resolve(fs.readFileSync(target)):reject(new Error('Download state '+state));});}); });
      await click('Xuất'); const bytes=await download;
      check(`Real ${format.toUpperCase()} download signature`,format==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):format==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:format==='pdf'?bytes.subarray(0,5).toString()==='%PDF-':bytes.toString().includes('<svg'),`${bytes.length} bytes`);
    }
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 900, 1200], ['narrow', 600, 900]]) {
      if(name==='desktop')await sleep(4500);
      win.setContentSize(width, height); await sleep(500);
      const image = await win.webContents.capturePage(); const filename = `notebook-${name}.png`; fs.writeFileSync(path.join(output, filename), image.toPNG()); report.screenshots.push(filename);
      const dimensions = await js(`({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:!!document.querySelector('.tb-paper')})`);
      check(`${name} layout no document horizontal overflow`, dimensions.canvas && dimensions.scroll <= dimensions.width + 2, JSON.stringify(dimensions));
    }
    check('No renderer errors', report.errors.length===0, report.errors.join('\n'));
    fs.rmSync(path.join(output,'notebook-failure.png'),{force:true});
  } catch (error) { status = 1; report.failure = error.stack || String(error); if(win)fs.writeFileSync(path.join(output,'notebook-failure.png'),(await win.webContents.capturePage()).toPNG()); console.error(report.failure); }
  finally {
    await clipboard.writeText(clipboardTextBefore);
    fs.writeFileSync(path.join(output, 'browser-smoke.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    win?.destroy(); vite?.kill();
    // User data uses only this generated, verified temporary directory.
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('ssh-notebook-browser-')) { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }
    app.exit(status);
  }
});
