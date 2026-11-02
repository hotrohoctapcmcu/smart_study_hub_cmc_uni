'use strict';

const electron = require('electron');
const { spawn, spawnSync } = require('node:child_process');

if (!electron.app) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [__filename], { env, windowsHide: true, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const { app, BrowserWindow } = electron;
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const routes = [
  'dashboard', 'schedule', 'tasks', 'study-planner', 'exams', 'documents',
  'ai-tutor', 'quiz', 'flashcards', 'weaknesses', 'exam-plan-ai',
  'leave-letter', 'pomodoro', 'progress', 'notifications', 'sync', 'profile'
];

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-qa-ui-'));
app.setPath('userData', path.join(directory, 'browser'));

function closeServer(server) {
  if (!server) return Promise.resolve();
  server.closeAllConnections?.();
  return new Promise(resolve => server.close(resolve));
}

app.whenReady().then(async () => {
  let db;
  let apiServer;
  let staticServer;
  let window;
  let exitCode = 0;
  const findings = [];
  const consoleErrors = [];

  try {
    Object.assign(process.env, {
      DB_PATH: path.join(directory, 'qa.db'),
      API_PORT: '0',
      APP_USER_ID: '1',
      NODE_ENV: 'test',
      GEMINI_ENABLE_WEB_FALLBACK: 'false',
      GEMINI_TIMEOUT_MS: '500'
    });

    db = await require('../database')();
    await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major,email) VALUES(1,'QA001','QA UI Tester','IT','qa@st.cmcu.edu.vn')");
    apiServer = await require('../API').start();
    const apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
    const frontend = path.resolve(__dirname, '../Frontend');
    const staticApp = express();
    staticApp.get('/src/shared/config/app.config.js', (_req, res) => res
      .type('application/javascript')
      .send(fs.readFileSync(path.join(frontend, 'src/shared/config/app.config.js'), 'utf8')
        .replace('http://localhost:3001', apiUrl)));
    staticApp.use(express.static(frontend));
    staticServer = await new Promise(resolve => {
      const server = staticApp.listen(0, '127.0.0.1', () => resolve(server));
    });
    const base = `http://127.0.0.1:${staticServer.address().port}/`;

    window = new BrowserWindow({
      show: false,
      width: 1440,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        offscreen: true
      }
    });
    window.webContents.on('console-message', event => {
      const detail = event.details || event;
      if (detail.level >= 3 || detail.level === 'error') consoleErrors.push(detail.message);
    });

    const evaluate = code => window.webContents.executeJavaScript(code);
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const load = async (route, width, height) => {
      window.setSize(width, height);
      await window.loadURL(`${base}?route=${encodeURIComponent(route)}`);
      const until = Date.now() + 10000;
      while (Date.now() < until) {
        if (await evaluate("Boolean(document.querySelector('#workspaceContentPane')?.children.length)")) break;
        await delay(50);
      }
      await delay(350);
      return evaluate(`(() => {
        const visible = el => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
        const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        const unlabeledButtons = [...document.querySelectorAll('button')].filter(visible).filter(el =>
          !(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim())
        ).length;
        const unlabeledFields = [...document.querySelectorAll('input,select,textarea')].filter(visible).filter(el => {
          if (el.type === 'hidden') return false;
          if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.placeholder || el.title) return false;
          if (el.labels?.length) return false;
          return true;
        }).length;
        const brokenImages = [...document.images].filter(img => img.complete && !img.naturalWidth).map(img => img.src);
        const pane = document.querySelector('#workspaceContentPane');
        const fallback = pane?.innerText.includes('Không tải được nội dung') || false;
        const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const route = pane?.dataset.route;
        const title = document.querySelector('.tab-pill.active .tab-title-text')?.textContent.trim() || '';
        return { route, title, duplicateIds, unlabeledButtons, unlabeledFields, brokenImages, fallback,
          pageOverflow, buttons: document.querySelectorAll('button').length,
          fields: document.querySelectorAll('input,select,textarea').length };
      })()`);
    };

    for (const route of routes) {
      const desktop = await load(route, 1440, 900);
      const mobile = await load(route, 375, 812);
      findings.push({ route, desktop, mobile });
      console.log(`AUDIT ${route}: desktop overflow=${desktop.pageOverflow}, mobile overflow=${mobile.pageOverflow}, duplicateIds=${desktop.duplicateIds.length}, unlabeled=${desktop.unlabeledButtons + desktop.unlabeledFields}, brokenImages=${desktop.brokenImages.length}, fallback=${desktop.fallback}`);
    }

    const invalid = await load('route-khong-ton-tai', 1440, 900);
    console.log(`CHECK invalid route -> ${invalid.route} / ${invalid.title}`);

    await load('dashboard', 375, 812);
    await evaluate("document.querySelector('#mobileSidebarToggleBtn').click()");
    await delay(100);
    const drawerOpened = await evaluate("document.querySelector('#appSidebar')?.classList.contains('mobile-open')");
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}))");
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await delay(100);
    const drawerClosedAfterUnrelatedKey = await evaluate("!document.querySelector('#appSidebar')?.classList.contains('mobile-open')");
    console.log(`CHECK mobile drawer opened=${drawerOpened}, Escape-after-other-key closed=${drawerClosedAfterUnrelatedKey}`);

    await load('dashboard', 1440, 900);
    const tabKeyboard = await evaluate(`(() => {
      const tab = document.querySelector('.tab-pill[role=tab]');
      return { tag: tab?.tagName, tabindex: tab?.getAttribute('tabindex') };
    })()`);
    console.log(`CHECK workspace tab keyboard: tag=${tabKeyboard.tag}, tabindex=${tabKeyboard.tabindex}`);

    const targeted = {};

    await load('tasks', 1440, 900);
    targeted.taskEqualStartDue = await evaluate(`(async () => {
      document.querySelector('#openCreateTaskBtn').click();
      const form = document.querySelector('#taskModalForm');
      form.elements.title.value = 'QA equal start and due';
      form.elements.startTime.value = '2030-01-01T10:00';
      form.elements.due.value = '2030-01-01T10:00';
      form.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 150));
      return document.body.innerText.includes('QA equal start and due');
    })()`);
    console.log(`CHECK task equal start/due accepted=${targeted.taskEqualStartDue}`);

    await load('tasks', 1440, 900);
    targeted.taskXss = await evaluate(`(async () => {
      window.__qaTaskXss = 0;
      document.querySelector('#openCreateTaskBtn').click();
      const form = document.querySelector('#taskModalForm');
      form.elements.title.value = '<img src="qa-task-xss" onerror="window.__qaTaskXss++">';
      form.elements.due.value = '2030-01-02T10:00';
      form.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 250));
      return { executed: window.__qaTaskXss > 0, injectedImages: document.querySelectorAll('img[src*="qa-task-xss"]').length };
    })()`);
    console.log(`CHECK task stored XSS executed=${targeted.taskXss.executed}, injectedImages=${targeted.taskXss.injectedImages}`);

    await load('schedule', 1440, 900);
    targeted.scheduleXss = await evaluate(`(async () => {
      window.__qaScheduleXss = 0;
      document.querySelector('#openAddStudySessionBtn').click();
      const form = document.querySelector('#studySessionForm');
      form.elements.title.value = '<img src="qa-schedule-xss" onerror="window.__qaScheduleXss++">';
      form.elements.subject.value = 'QA';
      form.elements.date.value = '2030-01-03';
      form.elements.start.value = '06:00';
      form.elements.end.value = '07:00';
      form.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 500));
      const workspace = await import('/src/app/workspace.js');
      workspace.updateActiveTabLocalState({ selectedDate: '2030-01-03', scheduleMode: 'day' });
      await new Promise(resolve => setTimeout(resolve, 250));
      return { executed: window.__qaScheduleXss > 0, injectedImages: document.querySelectorAll('img[src*="qa-schedule-xss"]').length };
    })()`);
    targeted.schedulePersistedRows = (await db.executeQuery("SELECT * FROM StudySchedules WHERE title LIKE '%qa-schedule-xss%' ")).length;
    console.log(`CHECK schedule stored XSS executed=${targeted.scheduleXss.executed}, injectedImages=${targeted.scheduleXss.injectedImages}`);
    console.log(`CHECK schedule persisted DB rows=${targeted.schedulePersistedRows}`);

    await load('schedule', 1440, 900);
    targeted.scheduleDuplicateSubmit = await evaluate(`(async () => {
      document.querySelector('#openAddStudySessionBtn').click();
      const form = document.querySelector('#studySessionForm');
      form.elements.title.value = 'QA duplicate submit';
      form.elements.subject.value = 'QA';
      form.elements.date.value = '2030-01-04';
      form.elements.start.value = '06:00';
      form.elements.end.value = '07:00';
      form.requestSubmit();
      form.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 650));
      const { state } = await import('/src/app/state.js');
      return state.studyEvents.filter(item => item.title === 'QA duplicate submit').length;
    })()`);
    console.log(`CHECK schedule duplicate submit records=${targeted.scheduleDuplicateSubmit}`);

    await load('study-planner', 1440, 900);
    targeted.plannerXss = await evaluate(`(async () => {
      window.__qaPlannerXss = 0;
      const { addLocalStudyPlan } = await import('/src/app/state.js');
      addLocalStudyPlan({
        title: '<img src="qa-planner-xss" onerror="window.__qaPlannerXss++">',
        subject: 'QA', targetHours: 1, sessions: []
      });
      await new Promise(resolve => setTimeout(resolve, 250));
      return { executed: window.__qaPlannerXss > 0, injectedImages: document.querySelectorAll('img[src*="qa-planner-xss"]').length };
    })()`);
    console.log(`CHECK planner stored XSS executed=${targeted.plannerXss.executed}, injectedImages=${targeted.plannerXss.injectedImages}`);

    await load('dashboard', 1440, 900);
    targeted.dashboardProfileXss = await evaluate(`(async () => {
      window.__qaProfileXss = 0;
      const module = await import('/src/app/state.js');
      module.state.studentProfile = { name: '<img src="qa-profile-xss" onerror="window.__qaProfileXss++">', studentId: 'QA' };
      module.notifyStateChange();
      await new Promise(resolve => setTimeout(resolve, 250));
      return { executed: window.__qaProfileXss > 0, injectedImages: document.querySelectorAll('img[src*="qa-profile-xss"]').length };
    })()`);
    console.log(`CHECK dashboard profile XSS executed=${targeted.dashboardProfileXss.executed}, injectedImages=${targeted.dashboardProfileXss.injectedImages}`);

    await load('tasks', 1440, 900);
    await evaluate("document.querySelector('#openCreateTaskBtn').click()");
    await delay(100);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'TAB', modifiers: ['SHIFT'] });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'TAB', modifiers: ['SHIFT'] });
    await delay(100);
    targeted.modalFocusTrapped = await evaluate("Boolean(document.activeElement?.closest('[role=dialog]'))");
    console.log(`CHECK modal focus trapped after Shift+Tab=${targeted.modalFocusTrapped}`);
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await delay(100);
    targeted.modalFocusRestored = await evaluate("document.activeElement?.id === 'openCreateTaskBtn'");
    console.log(`CHECK modal focus restored=${targeted.modalFocusRestored}`);

    await load('tasks', 1440, 900);
    targeted.tablistSemantics = await evaluate(`(() => {
      const list = document.querySelector('.tasks-tabs-header[role=tablist]');
      const children = [...(list?.querySelectorAll('button') || [])];
      return { count: children.length, roleTabs: children.filter(el => el.getAttribute('role') === 'tab').length,
        ariaSelected: children.filter(el => el.hasAttribute('aria-selected')).length };
    })()`);
    console.log(`CHECK task tablist: buttons=${targeted.tablistSemantics.count}, roleTabs=${targeted.tablistSemantics.roleTabs}, ariaSelected=${targeted.tablistSemantics.ariaSelected}`);

    const summary = {
      generatedAt: new Date().toISOString(),
      routesAudited: routes.length,
      invalidRouteFallback: invalid.route === 'dashboard',
      drawerOpened,
      drawerClosedAfterUnrelatedKey,
      tabKeyboard,
      targeted,
      consoleErrors: [...new Set(consoleErrors)],
      findings
    };
    const output = path.resolve(__dirname, 'artifacts/qa-ui-audit-result.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(`RESULT ${output}`);
  } catch (error) {
    exitCode = 1;
    console.error(error.stack || error.message);
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await closeServer(staticServer);
    await closeServer(apiServer);
    if (db?.closePool) await db.closePool();
    spawn(process.execPath, [path.join(__dirname, 'helpers/cleanup-electron-temp.cjs'), directory, String(process.pid)], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      detached: true,
      stdio: 'ignore'
    }).unref();
    app.exit(exitCode);
  }
});
