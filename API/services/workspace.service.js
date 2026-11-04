'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { NGUOI_DUNG_ID } = require('../utils/nguoiDung');
const { pomodoro } = require('../validators/workspace.validator');
const { createWorkspaceEmail } = require('./workspace.email.service');
const { exportNotes } = require('./workspace.export.service');
const { getCurrentCourseScope } = require('../utils/current-courses');

const { loi: fail } = require('../utils/error');
const parse = (value, fallback = []) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const tags = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(t => String(t).trim().slice(0, 100)).filter(Boolean))].slice(0, 30);
const text = (value, fallback = '') => String(value ?? fallback).trim();
const CATEGORIES = { 'Slide bài giảng': 'LECTURE', 'Đề cương & Tài liệu ôn': 'EXAM', 'Tài liệu tham khảo': 'REFERENCE', 'Bài tập & Đồ án': 'ASSIGNMENT' };
const MIME = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.txt': 'text/plain', '.md': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function createWorkspaceService({ getDb, userId = NGUOI_DUNG_ID, storageDir, outlook } = {}) {
    const root = path.resolve(storageDir || process.env.DOCUMENTS_PATH || path.join(path.dirname(process.env.DB_PATH || path.resolve(__dirname, '../../data/unistudy.db')), 'documents'));
    let queue = Promise.resolve();
    // Serialize read/modify/write operations and transactions on the shared sql.js handle.
    const mutate = fn => { const result = queue.then(fn); queue = result.catch(() => { }); return result; };
    const db = () => { const value = getDb(); if (!value) throw fail('Database chưa sẵn sàng.', 503); return value; };
    const query = (sql, params) => db().executeQuery(sql, params);
    async function owner() {
        const profile = await db().layHoSo(userId);
        if (!profile) throw fail('Hãy đồng bộ hồ sơ sinh viên IU trước khi lưu học liệu hoặc phiên học.', 409);
        return profile.student_id;
    }
    async function one(sql, params) {
        const rows = await query(sql, params);
        if (!rows.length) throw fail('Không tìm thấy dữ liệu thuộc hồ sơ hiện tại.', 404);
        return rows[0];
    }
    const documentView = row => ({
        id: String(row.document_id), title: row.title, subject: row.subject_label || row.subject_name || '',
        subjectId: row.subject_id || null, semester: row.semester || '', academicYear: row.academic_year || '',
        category: Object.keys(CATEGORIES).find(key => CATEGORIES[key] === row.category) || 'Tài liệu tham khảo',
        fileType: text(row.file_type).toUpperCase(), size: row.file_size || 0,
        sizeStr: row.file_size ? `${(row.file_size / 1024 / 1024).toFixed(2)} MB` : 'Chưa có tệp',
        uploadedAt: row.created_at, tags: parse(row.tags), isTextbook: Boolean(row.is_textbook),
        hasFile: Boolean(row.storage_key || /^https:\/\//i.test(row.file_url || '')),
        originalName: row.original_name, source: row.source
    });
    const noteView = row => ({
        id: row.client_id || `note-db-${row.note_id}`, databaseId: row.note_id, notebookId: row.notebook_id,
        title: row.title, content: row.content || '', subject: row.subject_label || 'Ghi chép tự học',
        tags: parse(row.tags), chapter: row.chapter || '', documentId: row.document_id ? String(row.document_id) : '',
        isDifficult: Boolean(row.is_hard), updatedAt: row.updated_at
    });
    const pomoView = row => ({
        id: row.client_id || `pomo-db-${row.session_id}`, createdAt: row.started_at, startTime: row.started_at,
        endTime: row.ended_at, actualStudySeconds: row.actual_study_seconds ?? row.total_focus_minutes * 60,
        workDurationMinutes: row.focus_duration, status: row.status === 'COMPLETED' ? 'Hoàn thành' : 'Kết thúc sớm',
        focusSegments: parse(row.focus_segments), learningContext: parse(row.learning_context, {}), synced: true
    });
    async function documents() {
        const sid = await owner();
        return (await query('SELECT d.*,s.subject_name FROM EduxDocuments d LEFT JOIN Subjects s ON s.subject_id=d.subject_id WHERE d.student_id=@sid ORDER BY d.document_id DESC', { sid })).map(documentView);
    }
    async function upload(meta, bytes) {
        if (!Buffer.isBuffer(bytes) || !bytes.length) throw fail('Vui lòng chọn tệp có nội dung.');
        if (bytes.length > 25 * 1024 * 1024) throw fail('Tệp tối đa 25 MB.', 413);
        const filename = path.basename(text(meta.filename)).replace(/[\x00-\x1f]/g, '');
        const extension = path.extname(filename).toLowerCase();
        if (!MIME[extension]) throw fail('Hỗ trợ PDF, DOCX, PPTX, TXT, MD, PNG và JPG.');
        if (!text(meta.title)) throw fail('Tên tài liệu là bắt buộc.');
        return mutate(async () => {
            const sid = await owner();
            const subjectId = meta.subjectId == null || meta.subjectId === '' ? null : Number(meta.subjectId);
            if (subjectId !== null && (!Number.isSafeInteger(subjectId) || subjectId <= 0)) throw fail('Môn học không hợp lệ.');
            const scope = subjectId ? await getCurrentCourseScope(db(), userId) : null;
            const subject = scope?.courses.find(course => Number(course.subjectId) === subjectId);
            if (subjectId && !subject) throw fail(scope?.resolved ? 'Môn học không thuộc kỳ hiện tại.' : scope?.message, 409);
            const key = randomUUID() + extension;
            await fs.mkdir(root, { recursive: true });
            await fs.writeFile(path.join(root, key), bytes, { flag: 'wx' });
            try {
                const [row] = await query(`INSERT INTO EduxDocuments(student_id,title,subject_id,subject_label,semester,academic_year,category,file_type,file_size,source,storage_key,original_name,mime_type,tags,is_textbook)
                    VALUES(@sid,@title,@subjectId,@subject,@semester,@year,@category,@type,@size,'LOCAL',@key,@filename,@mime,@tags,@book) RETURNING *`, {
                    sid, title: text(meta.title).slice(0, 300), subjectId, subject: text(subject?.subjectName || meta.subject).slice(0, 200),
                    semester: subject ? scope.semester : text(meta.semester).slice(0, 50) || null, year: subject ? scope.academicYear : text(meta.academicYear).slice(0, 50) || null, category: CATEGORIES[meta.category] || 'REFERENCE',
                    type: extension.slice(1), size: bytes.length, key, filename, mime: MIME[extension], tags: JSON.stringify(tags(meta.tags)), book: meta.isTextbook === true ? 1 : 0
                });
                return documentView(row);
            } catch (error) {
                await fs.unlink(path.join(root, key)).catch(() => { });
                throw error;
            }
        });
    }
    async function documentFile(id) {
        const row = await one('SELECT * FROM EduxDocuments WHERE document_id=@id AND student_id=@sid', { id, sid: await owner() });
        if (row.storage_key && /^[a-f\d-]+\.[a-z\d]+$/i.test(row.storage_key)) {
            const filename = path.join(root, row.storage_key);
            try { await fs.access(filename); } catch { throw fail('Tệp lưu trữ không còn trên máy.', 404); }
            return { path: filename, name: row.original_name, mime: row.mime_type };
        }
        if (/^https:\/\//i.test(row.file_url || '')) return { url: row.file_url };
        throw fail('Tài liệu này chưa có tệp; vui lòng tải lên tệp gốc.', 404);
    }
    async function removeDocument(id) {
        return mutate(async () => {
            const row = await one('SELECT * FROM EduxDocuments WHERE document_id=@id AND student_id=@sid', { id, sid: await owner() });
            await query('DELETE FROM EduxDocuments WHERE document_id=@id AND student_id=@sid', { id, sid: row.student_id });
            if (row.storage_key && /^[a-f\d-]+\.[a-z\d]+$/i.test(row.storage_key)) await fs.unlink(path.join(root, row.storage_key)).catch(error => { if (error.code !== 'ENOENT') console.warn('[Documents] Không dọn được tệp đã xóa:', error.message); });
            return true;
        });
    }
    async function setDocumentTags(id, data) {
        return mutate(async () => {
            const sid = await owner();
            return documentView(await one('UPDATE EduxDocuments SET tags=@tags WHERE document_id=@id AND student_id=@sid RETURNING *', { id, sid, tags: JSON.stringify(tags(data.tags)) }));
        });
    }
    async function notebooks() { return query('SELECT * FROM Notebooks WHERE student_id=@sid ORDER BY updated_at DESC', { sid: await owner() }); }
    async function saveNotebook(id, data) {
        return mutate(async () => {
            const sid = await owner();
            if (!text(data.title)) throw fail('Tên sổ tay là bắt buộc.');
            if (id) return one('UPDATE Notebooks SET title=@title,description=@description,updated_at=datetime(\'now\') WHERE notebook_id=@id AND student_id=@sid RETURNING *', { id, sid, title: text(data.title), description: text(data.description) });
            return (await query('INSERT INTO Notebooks(student_id,title,description) VALUES(@sid,@title,@description) RETURNING *', { sid, title: text(data.title), description: text(data.description) }))[0];
        });
    }
    async function removeNotebook(id) {
        return mutate(async () => { await one('DELETE FROM Notebooks WHERE notebook_id=@id AND student_id=@sid RETURNING notebook_id', { id, sid: await owner() }); return true; });
    }
    async function notes() { return (await query('SELECT * FROM Notes WHERE student_id=@sid ORDER BY updated_at DESC,note_id DESC', { sid: await owner() })).map(noteView); }
    async function saveNote(id, data) {
        return mutate(async () => {
            const sid = await owner();
            const previous = id ? await one('SELECT * FROM Notes WHERE student_id=@sid AND (client_id=@id OR CAST(note_id AS TEXT)=@numeric)', { sid, id, numeric: String(id).replace(/^note-db-/, '') }) : null;
            const merged = { ...(previous ? noteView(previous) : {}), ...data };
            let notebookId = Number(merged.notebookId) || null;
            if (notebookId) await one('SELECT notebook_id FROM Notebooks WHERE student_id=@sid AND notebook_id=@id', { sid, id: notebookId });
            else {
                const found = await query("SELECT notebook_id FROM Notebooks WHERE student_id=@sid AND title='Sổ tay học tập' ORDER BY notebook_id LIMIT 1", { sid });
                notebookId = found[0]?.notebook_id;
                if (!notebookId) notebookId = (await query("INSERT INTO Notebooks(student_id,title) VALUES(@sid,'Sổ tay học tập') RETURNING notebook_id", { sid }))[0].notebook_id;
            }
            const documentId = Number(merged.documentId) || null;
            if (documentId) await one('SELECT document_id FROM EduxDocuments WHERE student_id=@sid AND document_id=@id', { sid, id: documentId });
            const params = { sid, notebookId, client: previous?.client_id || text(data.id) || randomUUID(), title: text(merged.title, 'Trang ghi chú mới') || 'Trang ghi chú mới', subject: text(merged.subject), content: String(merged.content || ''), tags: JSON.stringify(tags(merged.tags)), chapter: text(merged.chapter), hard: merged.isDifficult ? 1 : 0, documentId };
            if (params.content.length > 1000000) throw fail('Ghi chú tối đa 1 triệu ký tự.');
            let row;
            if (previous) row = await one(`UPDATE Notes SET notebook_id=@notebookId,title=@title,subject_label=@subject,content=@content,tags=@tags,chapter=@chapter,is_hard=@hard,document_id=@documentId,updated_at=datetime('now') WHERE student_id=@sid AND note_id=@noteId RETURNING *`, { ...params, noteId: previous.note_id });
            else row = (await query(`INSERT INTO Notes(student_id,notebook_id,client_id,title,subject_label,content,tags,chapter,is_hard,document_id)
                VALUES(@sid,@notebookId,@client,@title,@subject,@content,@tags,@chapter,@hard,@documentId)
                ON CONFLICT(student_id,client_id) DO UPDATE SET client_id=excluded.client_id RETURNING *`, params))[0];
            return noteView(row);
        });
    }
    async function removeNote(id) {
        return mutate(async () => { await one('DELETE FROM Notes WHERE student_id=@sid AND (client_id=@id OR CAST(note_id AS TEXT)=@numeric) RETURNING note_id', { sid: await owner(), id, numeric: String(id).replace(/^note-db-/, '') }); return true; });
    }
    async function pomodoros() { return (await query("SELECT * FROM PomodoroSessions WHERE student_id=@sid AND status IN ('COMPLETED','CANCELLED') ORDER BY started_at DESC", { sid: await owner() })).map(pomoView); }
    async function savePomodoro(data) {
        const { start, seconds, end, segments, learningContext } = pomodoro(data);
        return mutate(() => db().withTransaction(async () => {
            const sid = await owner();
            const existing = (await query('SELECT * FROM PomodoroSessions WHERE student_id=@sid AND client_id=@client', { sid, client: data.id }))[0];
            if (existing) return pomoView(existing);
            const context = { ...learningContext };
            if (context.taskId) {
                const task = context.taskSource === 'EDUX'
                    ? (await query('SELECT title,subject_name FROM EduxAssignments WHERE user_id=@sid AND external_id=@id AND is_hidden=0', { sid: userId, id: context.taskId }))[0]
                    : (await query('SELECT a.title,a.subject_id,s.subject_name FROM Assignments a JOIN Subjects s ON s.subject_id=a.subject_id WHERE a.student_id=@sid AND CAST(a.assignment_id AS TEXT)=@id', { sid, id: context.taskId }))[0];
                if (!task) throw fail('Công việc đã bị xóa hoặc không thuộc hồ sơ hiện tại.', 404);
                context.taskTitle = task.title;
                context.subjectId = task.subject_id ?? null;
                context.subjectName = task.subject_name || 'Học phần EDUX';
            } else if (context.subjectId !== null) {
                const subject = (await query('SELECT subject_name FROM Subjects WHERE subject_id=@id', { id: context.subjectId }))[0];
                if (!subject) throw fail('Môn học đã chọn không tồn tại.', 404);
                context.subjectName = subject.subject_name;
            }
            const row = (await query(`INSERT INTO PomodoroSessions(student_id,client_id,focus_duration,started_at,ended_at,session_date,status,completed_cycles,total_focus_minutes,actual_study_seconds,focus_segments,learning_context)
                VALUES(@sid,@client,@duration,@start,@end,@date,@status,@cycles,@minutes,@seconds,@segments,@context)
                ON CONFLICT(student_id,client_id) DO UPDATE SET client_id=excluded.client_id RETURNING *`, {
                sid, client: data.id, duration: Math.max(1, Math.min(1440, Number(data.workDurationMinutes) || 25)), start: new Date(start).toISOString(), end: new Date(end).toISOString(),
                date: new Date(start + 7 * 3600000).toISOString().slice(0, 10), status: data.status === 'Hoàn thành' ? 'COMPLETED' : 'CANCELLED', cycles: data.status === 'Hoàn thành' ? 1 : 0,
                minutes: seconds / 60, seconds: Math.round(seconds), segments: JSON.stringify(segments), context: JSON.stringify(context)
            }))[0];
            if (data.completeTask) {
                if (context.taskSource === 'EDUX') await query("UPDATE EduxAssignments SET status='Hoàn thành',updated_at=datetime('now') WHERE user_id=@sid AND external_id=@id", { sid: userId, id: context.taskId });
                else await query("UPDATE Assignments SET status='COMPLETED',completed_at=datetime('now'),updated_at=datetime('now') WHERE student_id=@sid AND CAST(assignment_id AS TEXT)=@id", { sid, id: context.taskId });
            }
            return pomoView(row);
        }));
    }
    async function clearPomodoros() { return mutate(async () => { await query("DELETE FROM PomodoroSessions WHERE student_id=@sid AND status IN ('COMPLETED','CANCELLED')", { sid: await owner() }); return true; }); }
    async function setTaskTags(kind, id, data) {
        return mutate(async () => {
            const table = kind === 'edux' ? 'EduxAssignments' : 'Assignments';
            const pk = kind === 'edux' ? 'external_id' : 'assignment_id';
            const own = kind === 'edux' ? 'user_id' : 'student_id';
            const sid = kind === 'edux' ? userId : await owner();
            return one(`UPDATE ${table} SET tags=@tags WHERE ${own}=@sid AND ${pk}=@id RETURNING tags`, { id: String(id), sid, tags: JSON.stringify(tags(data.tags)) });
        });
    }
    async function search(term, tag) {
        const sid = await owner();
        const needle = text(term).toLocaleLowerCase('vi');
        const wantedTag = text(tag).replace(/^#/, '').toLocaleLowerCase('vi');
        if (!needle && !wantedTag) return [];
        const all = [];
        const add = (type, id, title, content, list, route, detail = {}) => {
            const normalized = tags(list);
            const haystack = `${title} ${content} ${normalized.join(' ')}`.toLocaleLowerCase('vi');
            if ((!needle || haystack.includes(needle.replace(/^#/, ''))) && (!wantedTag || normalized.some(t => t.toLocaleLowerCase('vi') === wantedTag))) all.push({ type, id: String(id), title, preview: text(content).slice(0, 160), tags: normalized, route, ...detail });
        };
        for (const row of await documents()) add('document', row.id, row.title, row.subject, row.tags, 'documents', { docTab: 'docs' });
        for (const row of await notes()) add('note', row.id, row.title, `${row.subject} ${row.chapter} ${row.content}`, row.tags, 'documents', { docTab: 'notes' });
        for (const row of await query('SELECT * FROM Assignments WHERE student_id=@sid', { sid })) add('task', row.assignment_id, row.title, row.description, parse(row.tags), 'tasks');
        for (const row of await query('SELECT * FROM EduxAssignments WHERE user_id=@userId AND is_hidden=0', { userId })) add('task', row.external_id, row.title, `${row.subject_name} ${row.description}`, parse(row.tags), 'tasks');
        for (const row of await query('SELECT * FROM StudySchedules WHERE student_id=@sid', { sid })) add('schedule', row.schedule_id, row.title, `${row.study_date} ${row.notes || ''}`, [], 'schedule', { selectedDate: row.study_date });
        for (const row of await query('SELECT t.*,s.subject_name FROM Timetables t JOIN Subjects s ON s.subject_id=t.subject_id WHERE student_id=@sid', { sid })) add('schedule', `class-${row.timetable_id}`, row.subject_name, `${row.class_name || ''} ${row.room || ''} ${row.start_date} ${row.start_time}`, [], 'schedule', { selectedDate: row.start_date });
        for (const row of await query('SELECT e.*,s.subject_name FROM Exams e JOIN Subjects s ON s.subject_id=e.subject_id WHERE student_id=@sid', { sid })) add('exam', row.exam_id, row.subject_name, `${row.exam_name} ${row.exam_date}`, [], 'exams');
        for (const row of await emails()) add('email', row.id, row.subject, row.body, [], 'school-email');
        return all.slice(0, 100);
    }
    const { emails, storeEmails, readEmail, processEmail, syncEmails, readAllEmails, refreshEmail, emailStatus, logoutEmail } =
        createWorkspaceEmail({ db, getDb, query, mutate, owner, one, userId, outlook });
    return {
        documents, upload, documentFile, removeDocument, setDocumentTags, notebooks, saveNotebook, removeNotebook, notes, saveNote, removeNote, pomodoros, savePomodoro, clearPomodoros, search, setTaskTags, emails, storeEmails, readEmail, processEmail, syncEmails, readAllEmails, refreshEmail,
        emailStatus, logoutEmail, exportNotes: async (id, notebook = false) => exportNotes(await notes(), id, notebook)
    };
}

module.exports = { createWorkspaceService, fail, tags };
