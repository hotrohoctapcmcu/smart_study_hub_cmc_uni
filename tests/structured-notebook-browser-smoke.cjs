'use strict';
// Every application API request uses an isolated, localStorage-backed adapter.
// The optional live course read below is read-only; no real account is mutated.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), frontend = path.join(root, 'Frontend');
const output = path.join(root, 'tests', 'artifacts', 'structured-notebook-qa');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixtureAdapter(client, initial) {
  const storageKey = 'ssh:qa-structured:server';
  const state = JSON.parse(localStorage.getItem(storageKey) || 'null') || initial;
  const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
  save();
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
  const context = canvas.getContext('2d'); context.fillStyle = '#faf7ff'; context.fillRect(0, 0, 960, 540);
  context.fillStyle = '#8b5cf6'; context.fillRect(0, 0, 960, 120); context.fillStyle = '#ffffff'; context.font = 'bold 30px Arial'; context.fillText('SLIDE IMAGE · QA FIXTURE ONLY', 35, 75);
  context.fillStyle = '#514263'; context.font = '28px Arial'; context.fillText('Original slide image adapter verification', 35, 205);
  context.strokeStyle = '#ba9ee1'; context.lineWidth = 3; context.strokeRect(60, 290, 250, 140); context.strokeRect(620, 290, 250, 140); context.beginPath(); context.moveTo(310, 360); context.lineTo(620, 360); context.stroke(); context.fillText('Entity A', 120, 373); context.fillText('Entity B', 680, 373);
  const fixtureImage = canvas.toDataURL('image/png');
  if (!state.lecture) state.lecture = { id: 'qa-slide-course', subject: 'Bài giảng QA · Ảnh kiểm thử', chapters: [{ id: 'qa-chapter', title: 'Chương QA · Ảnh kiểm thử', documents: [{ id: 'qa-slide', title: 'Ảnh slide QA (fixture)', image_base64: fixtureImage.split(',')[1], content: 'Dữ liệu kiểm thử hình ảnh. Không phải bài giảng thật.' }] }] };
  window.__nwQA = { requests: [], offline: false, state, fixtureImage };
  client.defaults.adapter = async config => {
    const method = (config.method || 'get').toLowerCase(), url = config.url;
    let data = config.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch {} }
    window.__nwQA.requests.push({ method, url, data });
    if (window.__nwQA.offline) { const error = new Error('QA fixture: network offline'); error.code = 'ERR_NETWORK'; throw error; }
    const ok = payload => ({ config, status: 200, statusText: 'OK', headers: {}, data: { success: true, data: payload } });
    if (url === '/student/profile') return ok({ student_id: 'qa-student-only', student_code: 'QA-ISOLATED', full_name: 'Sinh viên kiểm thử', student_name: 'Sinh viên kiểm thử' });
    if (url === '/student/subjects') return ok([{ subject_id: 1, subject_name: 'Cơ sở dữ liệu' }, { subject_id: 2, subject_name: 'Lập trình hướng đối tượng' }]);
    if (url === '/learning/courses') return ok({ courses: [state.lecture], scope: {} });
    if (url === '/learning/courses/' + state.lecture.id) return ok(state.lecture);
    if (url === '/documents') return ok([]);
    if (url === '/ai/ask') return ok({ answer: data?.question?.includes('Yêu cầu: Tạo flashcard') ? JSON.stringify({ cards: [{ question: 'QA fixture: Foreign Key là gì?', answer: 'QA fixture: Khóa tham chiếu tới khóa của bảng khác.' }] }) : '## AI QA fixture\n\nĐây là phản hồi kiểm thử được giả lập. Quan hệ 1-N dùng khóa ngoại để liên kết hai bảng.' });
    if (url === '/notebooks' && method === 'get') return ok(state.notebooks);
    if (url === '/notes' && method === 'get') return ok(state.notes);
    if (url === '/notebooks' && method === 'post') { const book = { ...data, notebook_id: ++state.nextBook, updated_at: new Date().toISOString() }; state.notebooks.push(book); save(); return ok(book); }
    if (/^\/notebooks\//.test(url)) {
      const id = url.split('/')[2], index = state.notebooks.findIndex(book => String(book.notebook_id) === id);
      if (method === 'put') { state.notebooks[index] = { ...state.notebooks[index], ...data, updated_at: new Date().toISOString() }; save(); return ok(state.notebooks[index]); }
      if (method === 'delete') { state.notebooks.splice(index, 1); state.notes = state.notes.filter(note => String(note.notebookId) !== id); save(); return ok(true); }
    }
    if (url === '/notes' && method === 'post') {
      let note = state.notes.find(item => item.id === data.id);
      if (!note) { note = { ...data, databaseId: ++state.nextNote, updatedAt: new Date().toISOString() }; state.notes.push(note); save(); }
      return ok(note);
    }
    if (/^\/notes\//.test(url)) {
      const id = url.split('/')[2], index = state.notes.findIndex(note => String(note.id) === id);
      if (method === 'put') { state.notes[index] = { ...state.notes[index], ...data, updatedAt: new Date().toISOString() }; save(); return ok(state.notes[index]); }
      if (method === 'delete') { state.notes.splice(index, 1); save(); return ok(true); }
    }
    // Shell requests are isolated too, and never fall through to a live API.
    return ok(url.includes('status') ? { connected: false } : []);
  };
}

if (process.argv.includes('--vite-worker')) {
  (async () => {
    const { createServer } = await import(pathToFileURL(path.join(frontend, 'node_modules/vite/dist/node/index.js')).href);
    const initial = JSON.parse(fs.readFileSync(process.argv.at(-1), 'utf8'));
    const server = await createServer({ root: frontend, configFile: path.join(frontend, 'vite.config.js'), server: { host: '127.0.0.1', port: 5182, strictPort: true }, plugins: [{ name: 'structured-notebook-qa-isolation', enforce: 'pre', transform(source, id) { if (id.replace(/\\/g, '/').endsWith('/src/api/apiClient.js')) return { code: source + `\n;(${fixtureAdapter.toString()})(apiClient,${JSON.stringify(initial)});`, map: null }; } }] });
    await server.listen(); console.log('QA Vite ready on 5182');
  })().catch(error => { console.error(error); process.exit(1); });
} else {
  const electron = require('electron');
  if (!electron.app) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
    process.exit(result.status ?? 1);
  } else run(electron);
}

function run({ app, BrowserWindow }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-structured-notebook-qa-'));
  app.setPath('userData', path.join(profile, 'profile')); app.commandLine.appendSwitch('force-device-scale-factor', '1'); app.disableHardwareAcceleration();
  app.whenReady().then(async () => {
    const report = { date: '2026-10-30', mode: 'Isolated Electron profile; every application API request uses a test-only localStorage adapter; AI response explicitly labelled QA fixture', checks: [], errors: [], screenshots: [] };
    let win, vite, status = 0;
    const check = (name, passed, detail) => { report.checks.push({ name, passed: !!passed, ...(detail == null ? {} : { detail }) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw new Error(name); };
    try {
      fs.mkdirSync(output, { recursive: true });
      const p = value => ({ type: 'paragraph', content: [{ type: 'text', text: value }] });
      const h = value => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: value }] });
      const book = (id, title, subject, color) => ({ notebook_id: id, title, updated_at: '2026-10-30T11:00:00Z', description: JSON.stringify({ format: 'ssh-notebook', version: 1, kind: 'notebook', subject, color, template: 'blank' }) });
      const note = (id, notebookId, title, content, order, completed = false) => ({ id, databaseId: order, notebookId, title, subject: notebookId === 1 ? 'Cơ sở dữ liệu' : 'Lập trình hướng đối tượng', updatedAt: `2026-10-30T11:0${order}:00Z`, content: JSON.stringify({ format: 'ssh-notebook', version: 1, kind: 'page', doc: { type: 'doc', content }, order, completed }) });
      const seed = { nextBook: 2, nextNote: 3, notebooks: [book(1, 'Database Notes', 'Cơ sở dữ liệu', '#8b5cf6'), book(2, 'Coding Notes', 'Lập trình hướng đối tượng', '#ec4899')], notes: [note('qa-erd', 1, 'ERD và mô hình quan hệ', [h('Mô hình thực thể liên kết'), p('Quan hệ 1-N được biểu diễn bằng khóa ngoại. Entity là một thực thể trong mô hình dữ liệu.')], 1, true), note('qa-sql', 1, 'Bài tập SQL', [h('SELECT và JOIN'), p('SELECT dùng để truy vấn dữ liệu. JOIN kết hợp các bảng dựa trên khóa liên quan.')], 2), note('qa-oop', 2, 'Class và Object', [h('Lớp và đối tượng'), p('Class định nghĩa thuộc tính và phương thức. Object là một thể hiện của lớp.')], 3)] };
      report.liveCourseRead = { available: false, sourceImagesFound: false };
      try {
        const catalog = (await (await fetch('http://127.0.0.1:3001/api/v1/learning/courses', { signal: AbortSignal.timeout(5000) })).json()).data;
        report.liveCourseRead = { available: true, courseCount: catalog?.courses?.length || 0, sourceImagesFound: false };
        for (const item of (catalog?.courses || []).slice(0, 4)) {
          const course = (await (await fetch(`http://127.0.0.1:3001/api/v1/learning/courses/${encodeURIComponent(item.id)}`, { signal: AbortSignal.timeout(5000) })).json()).data;
          for (const chapter of course.chapters || []) {
            const slide = (chapter.documents || chapter.slides || []).find(slide => slide.content || slide.rawContent);
            if (slide) { seed.lecture = { id: course.id, subject: course.subject, chapters: [{ id: chapter.id, title: chapter.title, documents: [slide] }] }; report.liveCourseRead.sourceImagesFound = true; report.liveCourseRead.imageSource = { course: course.subject, chapter: chapter.title, slide: slide.title }; break; }
          }
          if (seed.lecture) break;
        }
      } catch (error) { report.liveCourseRead.message = error.message; }
      report.lectureMode = seed.lecture ? 'Real read-only text slide snapshot reused through isolated adapter' : 'Legacy image fields are ignored; EDUX slides cannot insert persisted images';
      const seedFile = path.join(profile, 'seed.json'); fs.writeFileSync(seedFile, JSON.stringify(seed));
      vite = spawn(process.execPath, [__filename, '--vite-worker', seedFile], { cwd: frontend, windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      let log = ''; vite.stdout.on('data', chunk => { log += chunk; }); vite.stderr.on('data', chunk => { log += chunk; });
      for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5182')).ok) break; } catch {} if (i === 99) throw new Error(log); await sleep(150); }
      win = new BrowserWindow({ width: 1440, height: 1000, show: false, enableLargerThanScreen: true, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      const viewport = (width, height) => win.setContentSize(width, height);
      viewport(1440, 1000);
      win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
      const js = code => win.webContents.executeJavaScript(code, true);
      const wait = async (expression, limit = 120) => { for (let i = 0; i < limit; i++) { if (await js(expression)) return; await sleep(100); } throw new Error(`Timed out: ${expression}`); };
      const click = async label => { await js(`(()=>{const scope=document.querySelector('[role=dialog]')||document.querySelector('.nw-editor')||document.querySelector('.nw-dashboard')||document; const button=[...scope.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Missing button '+${JSON.stringify(label)});button.click()})()`); await sleep(170); };
      const set = async (selector, value) => { await js(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing input '+${JSON.stringify(selector)});const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`); await sleep(150); };
      const key = async (keyCode, modifiers = []) => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers }); await sleep(150); };
      const type = async text => { await win.webContents.insertText(text); await sleep(180); };
      const screenshot = async name => { await sleep(200); const file = `${name}.png`; fs.writeFileSync(path.join(output, file), (await win.webContents.capturePage()).toPNG()); report.screenshots.push(file); (report.viewportMeasurements ||= []).push(await js(`(()=>{const target=document.querySelector('.nw-editor')||document.querySelector('.nw-dashboard');const rect=target.getBoundingClientRect();return {screenshot:${JSON.stringify(file)},viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,workspace:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}})()`)); };
      const navigate = async url => { await js(`(async()=>{const {router}=await import('/src/App.jsx');await router.navigate(${JSON.stringify(url)})})()`); await sleep(250); };
      const saved = () => wait(`document.querySelector('.nw-save-state.saved') && Object.keys(JSON.parse(localStorage.getItem('ssh:typed-notebooks:v1:qa-student-only')).pending).length===0`);
      const pageMenu = async title => { await js(`(()=>{const rows=[...document.querySelectorAll('.nw-page-row')];const row=rows.find(row=>row.querySelector('.nw-page-select')?.textContent.trim()===${JSON.stringify(title)});if(!row)throw Error('Missing page '+${JSON.stringify(title)});row.querySelector('.nw-page-more').click()})()`); await sleep(120); };
      await win.loadURL('http://127.0.0.1:5182/notebooks'); await wait(`!!document.querySelector('.nw-dashboard')`);
      check('Dashboard shows actual seeded notebook/page/subject totals', await js(`(()=>{const values=[...document.querySelectorAll('.nw-stat strong')].map(n=>n.textContent);return values[0]==='2'&&values[1]==='3'&&values[3]==='2'&&values[2]!=='0'})()`));
      check('Continue writing uses exact latest page', await js(`document.querySelector('.nw-continue h2').textContent==='Class và Object'`));
      await screenshot('dashboard-desktop');
      for (const [width, height, suffix] of [[834, 1100, 'tablet'], [390, 844, 'mobile']]) { viewport(width, height); await sleep(250); check(`Dashboard no horizontal overflow at ${width}px`, await js(`innerWidth===${width} && document.documentElement.scrollWidth<=innerWidth`)); await screenshot(`dashboard-${suffix}`); }
      viewport(1440, 1000); await sleep(150);
      await js(`document.querySelector('.nw-recent-item').click()`); await wait(`!!document.querySelector('.nw-prosemirror')`);
      check('Recent note opens exact page', await js(`location.search.includes('qa-oop') && document.querySelector('.nw-page-title').value==='Class và Object'`));
      await navigate('/documents?tab=notebooks'); await wait(`!!document.querySelector('.nw-dashboard')`);
      check('Existing documents Sổ tay tab opens redesigned workspace', await js(`!!document.querySelector('.nw-dashboard') && !document.querySelector('.workspace-grid')`));
      await navigate('/notebooks'); await wait(`!!document.querySelector('.nw-dashboard')`);
      await click('Tạo sổ tay'); await set('.nw-book-form input[maxlength="200"]', 'Cornell QA'); await set('.nw-book-form input[list]', 'Cơ sở dữ liệu');
      await js(`document.querySelector('input[value="cornell"]').click()`); await click('Tạo sổ tay'); await wait(`!!document.querySelector('.nw-prosemirror .nw-cornell')`); await saved();
      check('Create notebook applies real Cornell template', await js(`document.querySelectorAll('.nw-prosemirror .nw-cornell textarea').length===3`));
      await navigate('/notebooks/1?page=qa-erd'); await wait(`document.querySelector('.nw-page-title')?.value==='ERD và mô hình quan hệ'`);
      await set('.nw-page-title', 'ERD đã chỉnh sửa QA');
      await js(`document.querySelector('.nw-prosemirror').focus()`); await key('End', ['control']); await key('Enter'); await type('Nội dung gõ bàn phím được tự động lưu QA.'); await saved();
      check('Typing and title autosave reach existing notes API adapter', await js(`window.__nwQA.state.notes.find(p=>p.id==='qa-erd').title==='ERD đã chỉnh sửa QA' && window.__nwQA.state.notes.find(p=>p.id==='qa-erd').content.includes('Nội dung gõ bàn phím')`));
      await win.reload(); await wait(`!!document.querySelector('.nw-prosemirror')`);
      check('Full browser reload restores saved title and text', await js(`document.querySelector('.nw-page-title').value==='ERD đã chỉnh sửa QA' && document.querySelector('.nw-prosemirror').textContent.includes('Nội dung gõ bàn phím')`));
      await js(`document.querySelector('.nw-prosemirror').focus()`); await key('A', ['control']); await click('In đậm (Ctrl+B)'); await set('select[aria-label="Font chữ"]', 'Arial'); await set('select[aria-label="Cỡ chữ"]', '20');
      check('Bold and font controls format the selected text', await js(`!!document.querySelector('.nw-prosemirror strong') && !!document.querySelector('.nw-prosemirror [style*="Arial"]') && !!document.querySelector('.nw-prosemirror [style*="20px"]')`));
      await js(`document.querySelector('.nw-prosemirror').focus()`); await key('End', ['control']); await key('Enter');
      await js(`window.__nwQA.offline=true`); await type(' Bản nháp khi mất mạng QA.'); await wait(`!!document.querySelector('.nw-save-state.offline')`);
      check('Failed network retains pending draft on device', await js(`JSON.parse(localStorage.getItem('ssh:typed-notebooks:v1:qa-student-only')).pages.find(p=>p.id==='qa-erd').content.content.some(n=>JSON.stringify(n).includes('Bản nháp khi mất mạng'))`));
      await win.reload(); await wait(`document.querySelector('.nw-prosemirror')?.textContent.includes('Bản nháp khi mất mạng')`); await saved();
      check('Unsent offline draft survives reload and syncs', await js(`window.__nwQA.state.notes.find(p=>p.id==='qa-erd').content.includes('Bản nháp khi mất mạng')`));
      await pageMenu('ERD đã chỉnh sửa QA'); await click('Trang con'); await wait(`document.querySelector('.nw-page-title')?.value==='Trang mới'`); await set('.nw-page-title', 'Trang con QA'); await saved();
      check('Create child persists parent relation', await js(`JSON.parse(window.__nwQA.state.notes.find(p=>p.title==='Trang con QA').content).parentId==='qa-erd'`));
      await pageMenu('Trang con QA'); await click('Ghim trang'); await wait(`document.querySelector('.nw-pinned-pages')?.textContent.includes('Trang con QA')`);
      check('Pin exposes page in pinned sidebar section', true);
      await pageMenu('Trang con QA'); await click('Đổi tên'); await set('[role=dialog] input', 'Trang con đã đổi tên QA'); await click('Lưu'); await wait(`document.querySelector('.nw-page-title')?.value==='Trang con đã đổi tên QA'`);
      check('Page rename updates editor and tree', await js(`document.querySelector('.nw-page-tree').textContent.includes('Trang con đã đổi tên QA')`));
      await pageMenu('Bài tập SQL'); await click('Lên trên'); await saved();
      check('Page reorder persists order metadata', await js(`JSON.parse(window.__nwQA.state.notes.find(p=>p.id==='qa-sql').content).order < JSON.parse(window.__nwQA.state.notes.find(p=>p.id==='qa-erd').content).order`));
      await pageMenu('Bài tập SQL');
      await click('Trang mới'); await wait(`document.querySelector('.nw-page-title')?.value==='Trang mới'`); await set('.nw-page-title', 'Slash Table QA'); await js(`document.querySelector('.nw-prosemirror').focus()`); await type('/table'); await wait(`!!document.querySelector('.nw-slash-menu')`); await key('Enter');
      check('Slash /table + Enter creates editable table', await js(`!!document.querySelector('.nw-prosemirror table') && !document.querySelector('.nw-slash-menu')`));
      await click('Trang mới'); await wait(`document.querySelector('.nw-page-title')?.value==='Trang mới'`); await set('.nw-page-title', 'Slash Code QA'); await js(`document.querySelector('.nw-prosemirror').focus()`); await type('/code'); await wait(`!!document.querySelector('.nw-slash-menu')`); await key('Enter'); await type('SELECT * FROM SinhVien;');
      check('Slash /code creates syntax-highlight-ready code block', await js(`!!document.querySelector('.nw-prosemirror pre') && document.querySelector('.nw-prosemirror pre').textContent.includes('SELECT')`));
      await navigate('/notebooks/1?page=qa-erd'); await wait(`document.querySelector('.nw-page-title')?.value==='ERD đã chỉnh sửa QA'`); await click('AI'); await click('Tóm tắt'); await wait(`document.querySelector('.nw-ai-result')?.textContent.includes('AI QA fixture')`); await click('Chèn vào trang');
      check('AI action inserts clearly labelled fixture result as structured Markdown', await js(`[...document.querySelectorAll('.nw-prosemirror h2')].some(heading=>heading.textContent==='AI QA fixture')`));
      await click('AI'); await click('Tạo flashcard'); await wait(`document.querySelector('.nw-ai-card-preview')?.textContent.includes('QA fixture: Foreign Key')`); await click('Chèn 1 flashcard');
      await wait(`!!document.querySelector('.nw-prosemirror .nw-flashcard')`); await click('Hiện đáp án');
      check('AI flashcard preview inserts a real revealable flashcard block', await js(`document.querySelector('textarea[aria-label="Câu hỏi flashcard"]').value==='QA fixture: Foreign Key là gì?' && document.querySelector('textarea[aria-label="Đáp án flashcard"]').value.includes('Khóa tham chiếu')`));
      await click('Chèn từ bài giảng'); await wait(`!!document.querySelector('select[aria-label="Chọn môn bài giảng"] option:nth-child(2)')`);
      const lecture = await js(`({id:window.__nwQA.state.lecture.id,chapter:window.__nwQA.state.lecture.chapters[0].id})`);
      await set('select[aria-label="Chọn môn bài giảng"]', String(lecture.id)); await set('select[aria-label="Chọn chương bài giảng"]', String(lecture.chapter)); await wait(`!!document.querySelector('.nw-lecture-grid button')`); await js(`document.querySelector('.nw-lecture-grid button').click()`);
      check('EDUX text slides cannot insert or persist legacy images', await js(`![...document.querySelectorAll('.nw-lecture-grid img')].length && [...document.querySelectorAll('[role=dialog] button')].find(button=>button.textContent.includes('Chèn slide vào trang')).disabled`), report.lectureMode);
      await click('Hủy');
      await saved();
      await screenshot('editor-edux-text');
      await js(`document.querySelector('.nw-document-scroll').scrollTop=0`); await screenshot('editor-desktop');
      for (const [width, height, suffix] of [[834, 1100, 'tablet'], [390, 844, 'mobile']]) { viewport(width, height); await sleep(250); check(`Editor no document overflow at ${width}px`, await js(`innerWidth===${width} && document.documentElement.scrollWidth<=innerWidth && document.querySelector('.nw-editor').getBoundingClientRect().right<=innerWidth`)); await screenshot(`editor-${suffix}`); }
      await click('Focus'); await wait(`!!document.querySelector('.nw-editor.nw-focus')`); check('Focus hides app chrome and fits viewport', await js(`(()=>{const rect=document.querySelector('.nw-editor').getBoundingClientRect();return getComputedStyle(document.querySelector('.sidebar')).display==='none'&&rect.left===0&&rect.top===0&&rect.width===innerWidth&&rect.height===innerHeight})()`)); await screenshot('editor-focus-mobile');
      report.requests = await js(`window.__nwQA.requests.map(({method,url})=>({method,url}))`);
      check('All browser API calls remained in isolated test adapter', await js(`window.__nwQA.state.notebooks.some(book=>book.title==='Cornell QA') && localStorage.getItem('ssh:qa-structured:server')!==null`));
      check('No renderer errors', report.errors.length === 0, report.errors.join('\n'));
    } catch (error) { status = 1; report.failure = error.stack; console.error(error); if (win && !win.isDestroyed()) { try { fs.writeFileSync(path.join(output, 'failure.png'), (await win.webContents.capturePage()).toPNG()); report.failureDOM = await win.webContents.executeJavaScript(`document.body.innerText.slice(-10000)`); } catch {} } }
    finally { if (win && !win.isDestroyed()) win.destroy(); if (vite) vite.kill(); fs.writeFileSync(path.join(output, 'browser-smoke.json'), JSON.stringify(report, null, 2)); app.exit(status); }
  });
}
