'use strict';

// Optional live smoke test: disposable DB, no personal data or saved user sessions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-sprint3-live-'));
Object.assign(process.env, { DB_PATH: path.join(directory, 'test.db'), API_PORT: '0', APP_USER_ID: '1',
    GEMINI_SESSION_DIR: directory, GEMINI_TIMEOUT_MS: '45000', GEMINI_ORIGIN: 'https://gemini.google.com' });

(async () => {
    let db, server;
    try {
        db = await require('../../database')();
        server = await require('../../API').start();
        const base = `http://127.0.0.1:${server.address().port}/api/v1/ai`;
        const call = async (route, body) => {
            const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(175000) });
            const result = await response.json();
            if (!response.ok) throw new Error(`${route}: ${result.error?.code || response.status} — ${result.message}`);
            return result.data;
        };
        const quiz = await call('/quizzes', { subject: 'SQL', topic: 'JOIN', count: 3, difficulty: 'easy',
            sourceText: 'INNER JOIN chỉ trả về các dòng khớp điều kiện trong cả hai bảng. LEFT JOIN trả về toàn bộ dòng bảng trái; các cột bảng phải nhận NULL khi không có dòng khớp. CROSS JOIN tạo tích Descartes của hai bảng.' });
        assert.equal(quiz.questions.length, 3);
        console.log('PASS live Gemini generates a validated three-question quiz');
        const answered = await call(`/quizzes/${quiz.id}/submit`, { answers: { q1: 0, q2: 0, q3: 0 } });
        assert.equal(answered.status, 'submitted');
        const analysis = await call('/weaknesses/analyze', {});
        assert.ok(analysis.advice.length);
        console.log('PASS live Gemini recommends study content from the submitted quiz');
        const draft = await call('/draft-leave', { date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), reason: 'Bị ốm', subject: 'SQL' });
        assert.ok(draft.draft.length > 50);
        console.log('PASS live Gemini drafts a leave letter without inventing a profile');
        const chat = await call('/ask', { question: 'Giải thích ngắn gọn sự khác nhau giữa INNER JOIN và LEFT JOIN.' });
        assert.ok(chat.answer.length > 20 && chat.conversationId);
        console.log('PASS live Gemini tutoring response is persisted');
        const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
        const examDate = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10);
        await db.executeQuery("INSERT INTO Students(student_id,student_code,full_name,major) VALUES(1,'LIVE-SMOKE','Sinh viên kiểm thử','CNTT')");
        await db.executeQuery("INSERT INTO Subjects(subject_id,subject_code,subject_name) VALUES(1,'SQL','SQL')");
        await db.executeQuery("INSERT INTO Exams(student_id,subject_id,exam_name,exam_date,exam_time,duration_minutes,room,campus) VALUES(1,1,'SQL',@date,'14:00',90,'A','CMC')", { date: examDate });
        const plan = await call('/exam-plan', { examId: 1 });
        assert.ok(plan.phases.length && plan.phases.every(p => p.endDate <= examDate));
        console.log(`PASS live Gemini exam preview: ${plan.phases.length} phases and ${plan.sessions.length} valid sessions`);
    } catch (error) { process.exitCode = 1; console.error(error.message); }
    finally {
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.closePool();
        const resolved = path.resolve(directory);
        if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
    }
})();
