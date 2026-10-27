'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unistudy-branches-'));
process.env.DB_PATH = path.join(directory, 'integration.db');
process.env.APP_USER_ID = '1';
process.env.API_PORT = '0';
process.env.NODE_ENV = 'test';

test('integration of Sprint 2 database and API branches', async t => {
    const SQL = await require('sql.js')();
    const legacy = new SQL.Database();
    legacy.run(fs.readFileSync(path.resolve(__dirname, '../../database/schema/00_sqlite_init.sql'), 'utf8')
        .replace('UNIQUE (student_id, target_type, target_id, tier),', ''));
    legacy.run(`
        INSERT INTO Students(student_id,student_code,full_name,major) VALUES(5,'TEST5','Integration student','Test'),(6,'TEST6','Other student','Test');
        INSERT INTO Subjects(subject_id,subject_code,subject_name,credits) VALUES(1,'TEST','Integration subject',3);
        DROP INDEX UX_Reminders_Student_Target_Tier;
        INSERT INTO Reminders(student_id,target_type,target_id,title,remind_time,tier)
            VALUES(5,'CUSTOM',1,'Legacy reminder','2030-01-01','CUSTOM'),(5,'CUSTOM',1,'Duplicate','2030-01-01','CUSTOM');
    `);
    fs.writeFileSync(process.env.DB_PATH, Buffer.from(legacy.export()));
    legacy.close();

    const connect = require('../../database');
    const migrations = require('../../database/sprint2/sprint2Migration');
    let db;
    let server;
    try {
        db = await connect();
        const query = (...args) => db.executeQuery(...args);
        const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());

        await t.test('legacy upgrade preserves records, removes duplicate reminders and is idempotent', async () => {
            assert.equal((await query('SELECT * FROM Students')).length, 2);
            assert.equal((await query('SELECT * FROM Reminders')).length, 1);
            assert.equal(await migrations.isSprint2Migrated(), true);
            assert.equal(await migrations.ensureSprint2Migration(), null);
            for (const name of ['batDauPomodoro', 'taoSoTay', 'themGhiChu', 'dongBoEdux', 'kiemTraToanVen']) {
                assert.equal(typeof db[name], 'function', name);
                assert.equal(typeof connect[name], 'function', `${name} direct export`);
            }
            assert.equal((await query('PRAGMA foreign_keys'))[0].foreign_keys, 1);
        });

        await t.test('Pomodoro records preserve actual focus minutes on completion', async () => {
            const session = await db.batDauPomodoro(5, { subjectId: 1, focusDuration: 25 });
            const result = await db.ketThucPomodoro(session.session_id, {
                completedCycles: 1, totalFocusMinutes: 17, totalBreakMinutes: 2
            });
            assert.equal(result.total_focus_minutes, 17);
            assert.equal(result.total_break_minutes, 2);
            assert.equal(result.session_date, today);
            await query('UPDATE PomodoroSessions SET started_at=@start WHERE session_id=@id', {
                start: `${today}T08:00:00+07:00`, id: session.session_id
            });
            const other = await db.batDauPomodoro(6);
            await db.ketThucPomodoro(other.session_id, { totalFocusMinutes: 60 });
            await db.batDauPomodoro(5);
        });

        const gemini = require('../../API/shared/gemini-client');
        const previousAsk = gemini.ask;
        let aiCalls = 0;
        gemini.ask = async () => { aiCalls++; return 'Integration advice'; };
        t.after(() => { gemini.ask = previousAsk; });
        server = await require('../../API').start();
        const base = `http://127.0.0.1:${server.address().port}/api/v1`;

        await t.test('Progress resolves the current profile and reads actual Pomodoro without automatic AI', async () => {
            const response = await fetch(`${base}/progress?advice=false`);
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.data.metrics.weeklyStudyHours.pomodoroHours, 0.28);
            assert.equal(body.data.metrics.weeklyStudyHours.sources.pomodoroAvailable, true);
            assert.equal(body.data.advice, null);
            assert.equal(aiCalls, 0);
        });

        await t.test('Time Map uses PomodoroSessions and excludes other profiles and running timers', async () => {
            const response = await fetch(`${base}/timemap?from=${today}&to=${today}`);
            assert.equal(response.status, 200);
            const body = await response.json();
            const blocks = body.data[today].filter(block => block.type === 'pomodoro');
            assert.equal(blocks.length, 1);
            assert.equal(blocks[0].startTime, `${today}T08:00:00+07:00`);
            assert.equal(blocks[0].endTime, `${today}T08:17:00+07:00`);
        });

        await t.test('AI reads difficult notes and EDUX documents with the Sprint 2 schema', async () => {
            const notebook = await db.taoSoTay(5, { title: 'Integration notebook', subjectId: 1 });
            await db.themGhiChu(5, notebook.notebook_id, { title: 'Hard topic', content: 'Actual difficult note', isHard: true });
            await db.dongBoEdux(5, [{ externalId: 'doc1', title: 'Original document', description: 'Actual document text' }]);
            const context = await require('../../API/shared/study-context').buildStudyContext(1);
            assert.equal(context.notes.length, 1);
            assert.equal(context.notes[0].isDifficult, true);
            assert.equal(context.documents[0].title, 'Original document');
        });

        await t.test('an invalid EDUX item rolls back earlier writes and leaves an auditable failure', async () => {
            await assert.rejects(db.dongBoEdux(5, [
                { externalId: 'doc1', title: 'Must be rolled back' },
                { externalId: 'bad', title: 'Invalid category', category: 'INVALID' }
            ]));
            const documents = await db.layTaiLieuEdux(5);
            assert.equal(documents.length, 1);
            assert.equal(documents[0].title, 'Original document');
            const logs = await db.layLogDongBoEdux(5);
            assert.ok(logs.some(log => log.status === 'FAILED'));
            assert.equal((await query('PRAGMA foreign_key_check')).length, 0);
        });

        await t.test('the integrated schema and data survive closing and reopening the database', async () => {
            await db.closePool();
            db = await connect();
            assert.equal((await db.layLichSuPomodoro(5)).length, 2);
            assert.equal((await db.layGhiChuKho(5)).length, 1);
            assert.equal((await db.layTaiLieuEdux(5))[0].title, 'Original document');
            assert.equal((await db.executeQuery('PRAGMA foreign_keys'))[0].foreign_keys, 1);
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.closePool();
        const resolved = path.resolve(directory);
        assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
});
