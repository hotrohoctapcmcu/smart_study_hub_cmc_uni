'use strict';

const { randomUUID } = require('node:crypto');
const { loi: fail } = require('../utils/error');
const parse = (value, fallback = []) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };

function createWorkspaceEmail({ db, getDb, query, mutate, owner, one, userId, outlook }) {
    const emailView = row => ({ ...parse(row.payload, {}), id: String(row.email_id), externalId: row.external_id, isRead: Boolean(row.is_read), isProcessed: Boolean(row.task_id), isExamProcessed: Boolean(row.exam_id) });
    async function emails() { return (await query('SELECT * FROM SchoolEmails WHERE user_id=@userId ORDER BY json_extract(payload,\'$.date\') DESC', { userId })).map(emailView); }
    async function storeEmails(messages, mailbox = '') {
        return mutate(async () => db().withTransaction(async () => {
            const { analyzeMessage } = require('../../CRWEB/modules/OUTLOOK/analysis');
            for (const message of messages) {
                if (!message.id) continue;
                const payload = { ...message, ...analyzeMessage(message) };
                await query(`INSERT INTO SchoolEmails(user_id,external_id,mailbox,payload,is_read) VALUES(@userId,@external,@mailbox,@payload,@read)
                    ON CONFLICT(user_id,mailbox,external_id) DO UPDATE SET payload=excluded.payload,is_read=MAX(SchoolEmails.is_read,excluded.is_read),synced_at=datetime('now')`, { userId, external: String(message.id), mailbox, payload: JSON.stringify(payload), read: message.isRead ? 1 : 0 });
            }
            return emails();
        }));
    }
    async function readEmail(id) {
        return mutate(async () => emailView(await one('UPDATE SchoolEmails SET is_read=1 WHERE user_id=@userId AND email_id=@id RETURNING *', { userId, id })));
    }
    async function processEmail(id, kind) {
        return mutate(async () => db().withTransaction(async () => {
            const row = await one('SELECT * FROM SchoolEmails WHERE user_id=@userId AND email_id=@id', { userId, id });
            const email = emailView(row);
            const field = kind === 'task' ? 'task_id' : 'exam_id';
            if (row[field]) return { id: row[field], alreadyProcessed: true };
            const extracted = kind === 'task' ? email.extractedDeadline : email.extractedExam;
            if (!extracted) throw fail('Email chưa có ngày giờ đủ rõ để tạo mục này.');
            const sid = await owner();
            const subjectName = extracted.subject || email.subject;
            let subject = (await query('SELECT subject_id FROM Subjects WHERE subject_name=@name LIMIT 1', { name: subjectName }))[0];
            if (!subject) subject = (await query('INSERT INTO Subjects(subject_code,subject_name,credits) VALUES(@code,@name,0) RETURNING subject_id', { code: `MAIL-${randomUUID()}`, name: subjectName }))[0];
            let created;
            if (kind === 'task') created = (await query(`INSERT INTO Assignments(student_id,subject_id,title,description,deadline,priority,source,external_id) VALUES(@sid,@sub,@title,@body,@due,'HIGH','SYSTEM',@external) RETURNING assignment_id AS id`, { sid, sub: subject.subject_id, title: extracted.title, body: email.body, due: extracted.due + '+07:00', external: `outlook:${row.mailbox}:${row.external_id}` }))[0];
            else created = (await query(`INSERT INTO Exams(student_id,subject_id,exam_name,exam_date,exam_time,duration_minutes,room,campus,source) VALUES(@sid,@sub,@title,@date,@start,@duration,@room,'CMC','OUTLOOK') ON CONFLICT(student_id,subject_id,exam_date,exam_time) DO UPDATE SET exam_id=exam_id RETURNING exam_id AS id`, { sid, sub: subject.subject_id, title: email.subject, date: extracted.date, start: extracted.start, duration: extracted.duration || 90, room: extracted.room || 'Chưa rõ' }))[0];
            await query(`UPDATE SchoolEmails SET ${field}=@created,is_read=1 WHERE user_id=@userId AND email_id=@id`, { created: created.id, userId, id });
            return created;
        }));
    }
    async function syncEmails(top) {
        const result = await outlook.listMessages({ top });
        const messages = await storeEmails(result.messages, result.account || '');
        return { messages, source: result.source, account: result.account, syncedCount: result.messages.length };
    }
    async function readAllEmails() {
        await getDb().executeQuery('UPDATE SchoolEmails SET is_read=1 WHERE user_id=@uid', { uid: userId });
        return true;
    }
    async function refreshEmail(id) {
        const row = (await getDb().executeQuery('SELECT * FROM SchoolEmails WHERE user_id=@uid AND email_id=@id', { uid: userId, id }))[0];
        if (!row) throw fail('Không tìm thấy email.', 404);
        const message = await outlook.getMessage(row.external_id);
        await storeEmails([message], row.mailbox);
        return (await emails()).find(mail => mail.id === id);
    }
    return { emails, storeEmails, readEmail, processEmail, syncEmails, readAllEmails, refreshEmail,
        emailStatus: () => outlook.status(), logoutEmail: () => outlook.logout() };
}

module.exports = { createWorkspaceEmail };
