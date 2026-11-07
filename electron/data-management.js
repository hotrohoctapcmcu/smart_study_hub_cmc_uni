'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isAppUrl } = require('./app-origin');

const LEARNING = ['LearningReviews', 'LearningCards', 'LearningCardBatches', 'LearningSummaryParts', 'LearningSummaries', 'LearningCourseTexts', 'LearningCourses', 'LearningSyncReports'];
const CATEGORIES = [
    { id: 'timetable', label: 'Thời khóa biểu', description: 'Lịch IU và lịch lớp đã thêm, gồm cả các học kỳ cũ.', tables: ['Timetables', 'TimetableSyncState'] },
    { id: 'grades', label: 'Bảng điểm & chương trình học', description: 'Điểm, môn đăng ký và chương trình đào tạo; giữ hồ sơ và các ghi chép.', tables: ['Grades', 'CurriculumSubjects', 'StudentPrograms', 'StudentSubjects'] },
    { id: 'tasks', label: 'Công việc & checklist', description: 'Công việc cá nhân, checklist và bài tập EDUX.', tables: ['Checklists', 'Assignments', 'EduxAssignments'] },
    { id: 'exams', label: 'Lịch thi & kế hoạch ôn thi', description: 'Kỳ thi đã lưu và kế hoạch ôn thi gắn với các kỳ thi đó.', tables: ['ExamStudyPlans', 'Exams', 'AiExamConfirmations'] },
    { id: 'study', label: 'Lịch tự học & Pomodoro', description: 'Buổi tự học, phiên tập trung và tiến độ đọc đã lưu trên máy.', tables: ['PomodoroSessions', 'StudySchedules', 'AiExamConfirmations'], prefixes: ['ssh-study-v1:', 'ssh-pomodoro'] },
    { id: 'documents', label: 'Tài liệu & học liệu', description: 'Tệp tải lên, học liệu EDUX, tóm tắt và flashcard; giữ nội dung ghi chú.', tables: ['EduxDocuments', 'EduxSyncLog', ...LEARNING], prefixes: ['ssh-slide', 'ssh-document'] },
    { id: 'notes', label: 'Ghi chú, sổ tay & vở canvas', description: 'Nội dung ghi chú, sổ tay, bản nháp và vở viết/vẽ.', tables: ['Notes', 'Notebooks'], prefixes: ['ssh-textbooks-v1:', 'ssh:typed-notebooks:v1:'] },
    { id: 'ai', label: 'Lịch sử & kết quả AI', description: 'Hội thoại, quiz, phân tích điểm yếu và bản nháp đơn nghỉ học.', tables: ['AiConversations', 'AiQuizzes', 'AiWeaknessReports', 'AiLeaveDrafts', 'AiExamConfirmations'] },
    { id: 'notifications', label: 'Thông báo & nhắc nhở', description: 'Thông báo và các mốc nhắc đã lưu.', tables: ['Reminders'] },
    { id: 'emails', label: 'Email đã đồng bộ', description: 'Bản email trên máy; giữ công việc hoặc kỳ thi đã tạo từ thư.', tables: ['SchoolEmails'] },
    { id: 'connections', label: 'Phiên đăng nhập', description: 'Đăng xuất IU, EDUX, Outlook và xóa tài khoản EDUX đã nhớ trên máy.', tables: [] },
    { id: 'preferences', label: 'Cài đặt cá nhân', description: 'Giao diện, mục tiêu cá nhân và tùy chỉnh công cụ.', tables: [], prefixes: ['ssh-preferences', 'ssh-profile:', 'ssh-notebook-toolbar', 'ssh-notebook-'] }
];
const markerPath = app => path.join(app.getPath('userData'), 'data-reset-request.json');
const quoted = name => '"' + name.replace(/"/g, '""') + '"';

function validateSelection(value) {
    if (!Array.isArray(value) || !value.length || value.some(id => typeof id !== 'string' || id !== 'all' && !CATEGORIES.some(item => item.id === id))) {
        throw new Error('Hãy chọn loại dữ liệu cần xóa.');
    }
    return value.includes('all') ? ['all'] : [...new Set(value)];
}

function readResetRequest(app) {
    const file = markerPath(app);
    if (!fs.existsSync(file)) return null;
    const request = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!/^[a-f\d-]{36}$/i.test(request.id || '')) throw new Error('Yêu cầu xóa dữ liệu không hợp lệ.');
    return { ...request, categories: validateSelection(request.categories) };
}

function writeRequest(app, request) {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const file = markerPath(app), temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(request), { mode: 0o600 });
    fs.renameSync(temporary, file);
}

async function catalog() {
    const db = await require('../database')();
    const tables = new Set((await db.executeQuery("SELECT name FROM sqlite_master WHERE type='table'")).map(row => row.name));
    return Promise.all(CATEGORIES.map(async ({ tables: names, prefixes, ...item }) => ({ ...item,
        count: (await Promise.all(names.filter(name => tables.has(name)).map(async name =>
            Number((await db.executeQuery(`SELECT COUNT(*) AS count FROM ${quoted(name)}`))[0].count)))).reduce((sum, count) => sum + count, 0)
    })));
}

function restartApp(app, env = process.env, argv = process.argv) {
    const portable = env.PORTABLE_EXECUTABLE_FILE;
    // The portable launcher removes its extracted directory after exit.
    // Restart the original launcher so the next instance has its own files.
    if (app.isPackaged && portable && path.isAbsolute(portable) && fs.existsSync(portable)) {
        app.relaunch({ execPath: portable, args: argv.slice(1) });
    } else app.relaunch();
    app.quit();
}

function registerDataBridge({ electron = require('electron') } = {}) {
    const { app, ipcMain } = electron;
    const trusted = event => { if (!isAppUrl(event?.senderFrame?.url)) throw new Error('Nguồn yêu cầu quản lý dữ liệu không hợp lệ.'); };
    ipcMain.handle('data:catalog', event => { trusted(event); return catalog(); });
    ipcMain.handle('data:reset', (event, options = {}) => {
        trusted(event);
        const categories = validateSelection(options.categories);
        if (options.confirmation !== 'XÓA') throw new Error('Nhập XÓA để xác nhận.');
        if (readResetRequest(app)) throw new Error('Một yêu cầu xóa dữ liệu đang chờ khởi động lại.');
        writeRequest(app, { id: randomUUID(), categories, createdAt: new Date().toISOString() });
        // Apply in a fresh process: an old sync/AI job cannot write data back
        // after deletion, and all SQLite writes finish before restarting.
        setImmediate(() => restartApp(app));
        return { restarting: true };
    });
}

function removeFile(file) {
    if (fs.existsSync(file) && fs.lstatSync(file).isDirectory()) throw new Error('Đường dẫn tệp dữ liệu không hợp lệ.');
    fs.rmSync(file, { force: true });
}

async function applyPendingReset(electron) {
    const { app, session } = electron;
    const request = readResetRequest(app);
    if (!request) return null;
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
    const db = await require('../database')();
    const all = request.categories.includes('all'), chosen = id => all || request.categories.includes(id);
    const existing = new Set((await db.executeQuery("SELECT name FROM sqlite_master WHERE type='table'")).map(row => row.name));
    const root = path.resolve(process.env.DOCUMENTS_PATH || path.join(path.dirname(process.env.DB_PATH || path.resolve(__dirname, '../data/unistudy.db')), 'documents'));
    if (chosen('documents') && !request.documentKeys) {
        request.documentKeys = existing.has('EduxDocuments') ? (await db.executeQuery('SELECT storage_key FROM EduxDocuments'))
            .map(row => row.storage_key).filter(key => /^[a-f\d-]+\.[a-z\d]+$/i.test(key || '')) : [];
        writeRequest(app, request);
    }
    const connection = await db.getPool();
    // No API or background workers have been started in this new process.
    if (all) connection.run('PRAGMA foreign_keys=OFF');
    try {
        await db.withTransaction(async () => {
            const names = all ? [...existing].filter(name => !name.startsWith('sqlite_'))
                : [...new Set(CATEGORIES.filter(item => chosen(item.id)).flatMap(item => item.tables))];
            for (const name of names) if (existing.has(name)) await db.executeQuery(`DELETE FROM ${quoted(name)}`);
            if (all && existing.has('sqlite_sequence')) await db.executeQuery('DELETE FROM sqlite_sequence');
            if (!all && existing.has('Reminders')) {
                const types = [
                    ...(chosen('tasks') ? ['ASSIGNMENT', 'TASK', 'DEADLINE', 'CHECKLIST', 'EDUX'] : []),
                    ...(chosen('exams') ? ['EXAM'] : []), ...(chosen('study') || chosen('exams') ? ['STUDY_PLAN'] : []),
                    ...(chosen('timetable') ? ['LESSON'] : [])
                ];
                for (const type of types) await db.executeQuery('DELETE FROM Reminders WHERE target_type=@type', { type });
            }
            if ((await db.executeQuery('PRAGMA foreign_key_check')).length) throw new Error('Không thể xóa vì dữ liệu còn liên kết.');
        });
    } finally { connection.run('PRAGMA foreign_keys=ON'); }
    if (chosen('documents')) {
        for (const key of request.documentKeys || []) {
            if (!/^[a-f\d-]+\.[a-z\d]+$/i.test(key)) throw new Error('Tên tệp tài liệu không hợp lệ.');
            const target = path.resolve(root, key);
            if (path.dirname(target) !== root) throw new Error('Tệp nằm ngoài thư mục tài liệu.');
            removeFile(target);
        }
    }
    if (chosen('connections')) {
        const data = path.dirname(path.resolve(process.env.DB_PATH || path.join(__dirname, '../data/unistudy.db')));
        const accounts = path.resolve(process.env.EDUX_ACCOUNTS_PATH || path.join(data, 'edux-accounts'));
        for (const name of fs.existsSync(accounts) ? fs.readdirSync(accounts) : []) {
            if (/^\d+\.json$/.test(name)) removeFile(path.join(accounts, name));
        }
        removeFile(path.resolve(process.env.EDUX_COOKIE_PATH || path.join(__dirname, '../CRWEB/modules/EDUX/login/cookie.txt')));
        const gemini = path.resolve(process.env.GEMINI_SESSION_DIR || path.join(__dirname, '../data'));
        removeFile(path.join(gemini, 'gemini/guest-session.json'));
        for (const partition of ['persist:cmc-portal', 'persist:cmc-outlook']) {
            await session.fromPartition(partition).clearStorageData();
        }
        await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    }
    return { id: request.id, categories: request.categories };
}

function resetStorageScript(request) {
    const all = request.categories.includes('all');
    const prefixes = CATEGORIES.filter(item => request.categories.includes(item.id)).flatMap(item => item.prefixes || []);
    return `(() => {
        const id = ${JSON.stringify(request.id)};
        if (localStorage.getItem('__studyhub_last_reset__') === id) return;
        const prefixes = ${JSON.stringify(prefixes)};
        for (const key of Object.keys(localStorage)) {
            if (${all} || prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
        }
        sessionStorage.clear();
        localStorage.setItem('__studyhub_localhost_storage_migrated__', '1');
        localStorage.setItem('__studyhub_last_reset__', id);
    })();`;
}

function completeReset(app, id) {
    if (readResetRequest(app)?.id === id) removeFile(markerPath(app));
}

module.exports = { CATEGORIES, validateSelection, catalog, registerDataBridge, readResetRequest,
    writeRequest, applyPendingReset, resetStorageScript, completeReset, restartApp };
