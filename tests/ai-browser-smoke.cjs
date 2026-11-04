'use strict';
// Real Chromium layout and notebook export checks with isolated storage/mocks.
const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');
if (!electron.app) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
    process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = electron;
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const root = path.resolve(__dirname, '..'), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-ai-browser-'));
app.setPath('userData', path.join(profile, 'profile'));
app.disableHardwareAcceleration();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.join(root, 'tests', 'artifacts', 'ai-qa');
fs.mkdirSync(output, { recursive: true });
app.whenReady().then(async () => {
    let win, vite, status = 0;
    const report = { date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), mode: 'Chromium, mocked AI, isolated browser storage', checks: [], errors: [], screenshots: [] };
    try {
        const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
        const base = `http://127.0.0.1:${port}`;
        vite = spawn(process.execPath, [path.join(root, 'Frontend/node_modules/vite/bin/vite.js'), '--mode', 'mock', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'Frontend'), windowsHide: true, stdio: 'pipe', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
        let log = ''; vite.stdout.on('data', data => { log += data; }); vite.stderr.on('data', data => { log += data; });
        for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) break; } catch {} if (i === 99) throw new Error('Vite failed: ' + log); await pause(100); }
        win = new BrowserWindow({ width: 1440, height: 1000, show: false, enableLargerThanScreen: true, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
        win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) report.errors.push(event.message); });
        win.webContents.on('render-process-gone', (_, details) => report.errors.push('Renderer: ' + details.reason));
        const js = code => win.webContents.executeJavaScript(code, true);
        const wait = async expression => { for (let i = 0; i < 150; i++) { if (await js(expression)) return; await pause(100); } throw new Error('Timed out: ' + expression); };
        const click = async label => { await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click()})()`); await pause(80); };
        const input = async (selector, value) => { await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await pause(80); };
        const check = (name, ok, detail = '') => { report.checks.push({ name, passed: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) throw new Error(name + ': ' + detail); };
        const screenshot = async name => { await pause(200); fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG()); report.screenshots.push(name + '.png'); };
        const fixture = '# Kiến thức trọng tâm\n\n**Chữ đậm tiếng Việt** và *nghiêng* 🧠 a\u0301\n\n- Định nghĩa\n- Ví dụ\n\n| Khái niệm | Diễn giải |\n|---|---|\n| Dữ liệu | ' + 'chuỗidàiliêntục'.repeat(45) + ' |\n\n```js\nconst path = "C:\\new\\test";\nconst long = "' + 'x'.repeat(240) + '";\n```\n\nCông thức \\(x^2+y^2\\)\n\n$$\\frac{a}{b}$$\n\nCông thức dài \\(' + 'x+'.repeat(100) + '1\\)\n\n[Không an toàn](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\nKẾT THÚC';
        const installMock = async () => js(`(async()=>{
            const client=(await import('/src/api/apiClient.js')).default, original=client.defaults.adapter;
            globalThis.aiFixture=${JSON.stringify(fixture)};globalThis.aiMode='ok';globalThis.pollCount=0;globalThis.cancelled=false;
            globalThis.savedAiChats={};
            client.defaults.adapter=async config=>{
                if(config.url==='/ai/ask'){
                    if(globalThis.aiMode==='fail')throw Object.assign(new Error('AI đang quá tải. Hãy thử lại.'),{response:{data:{message:'AI đang quá tải. Hãy thử lại.'}}});
                    const body=typeof config.data==='string'?JSON.parse(config.data):config.data;
                    const id=body.conversationId||'browser-'+Object.keys(globalThis.savedAiChats).length;
                    const row=globalThis.savedAiChats[id]||(globalThis.savedAiChats[id]={id,title:body.question,createdAt:new Date().toISOString(),messages:[]});
                    row.updatedAt=new Date().toISOString();row.messages.push({role:'user',text:body.question,createdAt:row.updatedAt},{role:'assistant',text:globalThis.aiFixture,createdAt:row.updatedAt});
                    return {config,status:200,data:{success:true,data:{answer:globalThis.aiFixture,conversationId:id}}};
                }
                if(config.url==='/ai/conversations')return {config,status:200,data:{success:true,data:Object.values(globalThis.savedAiChats).map(({messages,...row})=>row)}};
                if(config.url.startsWith('/ai/conversations/'))return {config,status:200,data:{success:true,data:globalThis.savedAiChats[decodeURIComponent(config.url.split('/').at(-1))]}};
                if(config.url==='/ai/summarize')return {config,status:202,data:{success:true,data:{jobId:'browser-job',status:'queued',message:'Đang chia tài liệu dài…'}}};
                if(config.url==='/ai/summary-jobs/browser-job'){
                    if(config.method==='delete'){globalThis.cancelled=true;return {config,status:200,data:{success:true,data:{status:'cancelled'}}};}
                    globalThis.pollCount++;return {config,status:200,data:{success:true,data:globalThis.aiMode==='hold'?{jobId:'browser-job',status:'running'}:{jobId:'browser-job',status:'completed',result:{summary:globalThis.aiFixture}}}};
                }
                return original(config);
            };return true;
        })()`);
        await win.loadURL(base + '/ai');
        await wait(`!!document.querySelector('textarea[aria-label="Tin nhắn cho AI Tutor"]')`);
        await installMock();
        await input('textarea', 'Giải thích kiến thức này'); await click('Gửi tin nhắn');
        await wait(`!!document.querySelector('.message.ai .ai-content strong')`);
        const content = await js(`(()=>{const e=document.querySelector('.message.ai .ai-content');return {bold:e.querySelector('strong').textContent,math:e.querySelectorAll('.katex').length,code:e.querySelector('pre code').textContent,table:!!e.querySelector('table'),unsafe:!!e.querySelector('script,img,a[href^="javascript"]')}})()`);
        check('Chat renders bold, math, table and literal code safely', content.bold === 'Chữ đậm tiếng Việt' && content.math === 3 && content.code.includes('C:\\new\\test') && content.table && !content.unsafe, JSON.stringify(content));
        for (const [name, width, height] of [['desktop', 1440, 1000], ['laptop', 1280, 720], ['mobile', 390, 844]]) {
            win.setContentSize(width, height); await pause(250);
            const layout = await js(`(()=>{const e=document.querySelector('.ai-chat-workspace'),table=document.querySelector('.ai-table-scroll'),pre=document.querySelector('.ai-content pre');return {viewport:innerWidth,document:document.documentElement.scrollWidth,workspace:e.getBoundingClientRect().width,tableWidth:table.clientWidth,tableScroll:table.scrollWidth,codeWidth:pre.clientWidth,codeScroll:pre.scrollWidth}})()`);
            check(name + ' layout keeps table/code scroll inside the message', layout.document <= layout.viewport + 2 && layout.workspace <= layout.viewport && layout.codeScroll > layout.codeWidth, JSON.stringify(layout));
            const readingArea = await js(`(()=>{const page=document.querySelector('.ai-workspace').getBoundingClientRect(),log=document.querySelector('.chat-messages').getBoundingClientRect(),ai=document.querySelector('.message.ai').getBoundingClientRect(),composer=document.querySelector('.chat-input').getBoundingClientRect();return {height:log.height,pageHeight:page.height,ratio:log.height/page.height,answerWidth:ai.width,logWidth:log.width,composerHeight:composer.height}})()`);
            check(name + ' gives most of the workspace to the answer', readingArea.ratio >= .5 && readingArea.answerWidth >= readingArea.logWidth * .8 && readingArea.composerHeight <= 110, JSON.stringify(readingArea));
            await click('Chế độ đọc');
            const expanded = await js(`(()=>{const log=document.querySelector('.chat-messages'),input=document.querySelector('.ai-composer-dock');return {height:log.clientHeight,composerHidden:getComputedStyle(input).display==='none',tail:log.textContent.includes('KẾT THÚC')}})()`);
            check(name + ' reading mode enlarges the answer without losing content', expanded.height >= readingArea.height + 120 && expanded.composerHidden && expanded.tail, JSON.stringify(expanded));
            await screenshot('ai-' + name + '-reading');
            await click('Thoát chế độ đọc');
            await screenshot('ai-' + name + '-end');
            await js(`document.querySelector('.chat-messages').scrollTop=0`);
            await screenshot('ai-' + name);
            await js(`(()=>{const e=document.querySelector('.chat-messages');e.scrollTop=e.scrollHeight})()`);
        }
        win.setContentSize(1440, 1000); await pause(100);
        await click('Chỉnh sửa định dạng');
        await input('.ai-editable textarea', '**Bản sửa tiếng Việt**\n\n`C:\\new`');
        await click('Xem trước');
        check('Edited Markdown preview renders bold', await js(`document.querySelector('.ai-content strong')?.textContent==='Bản sửa tiếng Việt'`));
        await click('Áp dụng bản sửa');
        check('Applied edits remain visible', await js(`document.querySelector('.ai-content strong')?.textContent==='Bản sửa tiếng Việt'`));
        await input('.chat-input textarea', 'x'.repeat(32001));
        check('Oversized chat is blocked without truncating the draft', await js(`document.querySelector('.chat-input textarea').value.length===32001&&document.querySelector('button[aria-label="Gửi tin nhắn"]').disabled`));
        await js(`(()=>{const e=document.querySelector('select[aria-label="Công cụ AI"]');e.value='summarize';e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await pause(100);
        await click('Gửi tin nhắn');
        await wait(`document.querySelectorAll('.message.ai').length===2`);
        check('Long summary polls and displays the final result', await js(`globalThis.pollCount===1&&document.querySelectorAll('.message.ai')[1].textContent.includes('KẾT THÚC')`));
        await js(`globalThis.aiMode='hold'`); await input('.chat-input textarea', 'Nội dung cần dừng'); await click('Gửi tin nhắn');
        await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Dừng tóm tắt')`); await click('Dừng tóm tắt');
        await wait(`globalThis.cancelled&&!!document.querySelector('.chat-error')`);
        check('Cancel requests the backend stop and restores the input', await js(`document.querySelector('.chat-input textarea').value==='Nội dung cần dừng'`));
        await js(`(()=>{globalThis.aiMode='fail';const e=document.querySelector('select[aria-label="Công cụ AI"]');e.value='ask';e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await pause(100);
        await input('.chat-input textarea', 'Bản nháp khi AI lỗi'); await click('Gửi tin nhắn');
        await wait(`!!document.querySelector('.chat-error')`);
        check('Provider failure keeps the draft and offers a readable error', await js(`document.querySelector('.chat-input textarea').value==='Bản nháp khi AI lỗi'&&document.querySelector('.chat-error').textContent.includes('quá tải')`));

        await click('Lịch sử trò chuyện');
        await wait(`!!document.querySelector('.ai-history-item')`);
        check('History lists the completed conversation from the API', await js(`document.querySelector('.ai-history-item strong').textContent==='Giải thích kiến thức này'`));
        await screenshot('ai-history-desktop');
        win.setContentSize(390,844);await pause(200);
        check('History drawer fits on mobile without covering its close control', await js(`(()=>{const d=document.querySelector('.ai-history-modal [role="dialog"]').getBoundingClientRect(),b=document.querySelector('.ai-history-modal button[aria-label="Đóng hộp thoại"]').getBoundingClientRect();return d.left>=0&&d.right<=innerWidth+1&&b.right<=innerWidth})()`));
        await screenshot('ai-history-mobile');
        await input('input[aria-label="Tìm cuộc trò chuyện"]','giai thich');
        check('History search accepts Vietnamese titles without accents', await js(`document.querySelectorAll('.ai-history-item').length===1`));
        await js(`document.querySelector('.ai-history-item').click()`);
        await wait(`!document.querySelector('[role="dialog"]')`);
        check('Opening history restores messages and keeps the unsent question', await js(`document.querySelectorAll('.message.user').length===1&&document.querySelector('.message.ai').textContent.includes('KẾT THÚC')&&document.querySelector('.chat-input textarea').value==='Bản nháp khi AI lỗi'`));
        await click('Cuộc trò chuyện mới');await click('Lịch sử trò chuyện');
        await wait(`!!document.querySelector('.ai-history-item')`);
        check('Starting a new conversation keeps saved history', await js(`document.querySelectorAll('.ai-history-item').length===1`));
        await click('Đóng hộp thoại');win.setContentSize(1440,1000);await pause(100);

        const bookId = await js(`(async()=>{const s=await import('/src/utils/textbookStore.js');const book=s.createBook({title:'AI QA — vở riêng'});book.pages[0].objects.push({id:'source',type:'text',x:40,y:40,width:600,height:60,data:{text:'Nội dung gốc để tóm tắt.',fontSize:16}});s.saveBook(book);return book.id})()`);
        await win.loadURL(base + '/textbook/' + bookId); await wait(`!!document.querySelector('.tb-paper')`); await installMock();
        const longResult = ('**Đậm a\u0301 🧠** và `C:\\new`\n\n').repeat(160) + 'KẾT THÚC SỔ TAY';
        await js(`globalThis.aiFixture=${JSON.stringify(longResult)}`);
        await click('Trợ lý AI'); await click('Tóm tắt');
        await wait(`!!document.querySelector('.tb-ai-preview strong')`);
        check('Notebook summary preview supports Markdown', await js(`document.querySelector('.tb-ai-preview strong').textContent.includes('Đậm')`));
        await click('Trang mới');
        check('Notebook preview identifies its original source after switching pages', await js(`document.querySelector('.tb-ai-preview h4')?.textContent.includes('Trang 1')`));
        await click('Thêm sau trang nguồn'); await pause(1100);
        const notebook = await js(`(async()=>{const s=await import('/src/utils/textbookStore.js'),m=await import('/src/utils/markdownCanvas.js'),c=await import('/src/utils/textbookCanvas.jsx'),book=s.getBook(${JSON.stringify(bookId)});const objects=book.pages.flatMap(p=>p.objects).filter(o=>o.data.markdown);const text=objects.map(o=>m.markdownRuns(o.data.text).map(r=>r.text).join('')).join('');const svg=c.pageToSvg(book.pages.find(p=>p.objects.some(o=>o.data.markdown)));const png=await c.pageToImage(book.pages.findLast(p=>p.objects.some(o=>o.data.markdown)),'png',1);return {sourceIntact:book.pages[0].objects.length===1&&book.pages[0].objects[0].id==='source',placement:!!book.pages[1].objects[0]?.data.markdown,pages:book.pages.length,objects:objects.length,tail:text.includes('KẾT THÚC SỔ TAY'),bold:svg.includes('font-weight="bold"'),png:png.startsWith('data:image/png;base64,'),bounds:objects.every(o=>o.y+o.height<=1123)}})()`);
        check('Notebook paginates AI output and exports the final page with the tail', notebook.pages > 2 && notebook.objects === notebook.pages - 2 && notebook.tail && notebook.bold && notebook.sourceIntact && notebook.placement && notebook.png && notebook.bounds, JSON.stringify(notebook));
        await screenshot('ai-notebook');
        check('No renderer errors', report.errors.length === 0, report.errors.join('\n'));
        fs.rmSync(path.join(output, 'ai-failure.png'), { force: true });
    } catch (error) {
        status = 1; report.failure = error.stack || String(error); console.error(report.failure);
        if (win) fs.writeFileSync(path.join(output, 'ai-failure.png'), (await win.webContents.capturePage()).toPNG());
    } finally {
        fs.writeFileSync(path.join(output, 'browser-smoke.json'), JSON.stringify(report, null, 2));
        win?.destroy(); vite?.kill();
        if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('ssh-ai-browser-')) try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
        app.exit(status);
    }
});
