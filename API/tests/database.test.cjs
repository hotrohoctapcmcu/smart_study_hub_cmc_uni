'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

test('Database modules share transactions, retain lookup rules and persist together', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'api-database-boundary-'));
    const previousDbPath = process.env.DB_PATH;
    process.env.DB_PATH = path.join(directory, 'boundary.db');
    let connection;

    t.after(async () => {
        try {
            await connection?.closePool();
        } finally {
            if (previousDbPath === undefined) delete process.env.DB_PATH;
            else process.env.DB_PATH = previousDbPath;
            assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    // Configure the isolated database before loading the connection singleton.
    const connect = require('../../database');
    connection = require('../../database/connection/db');
    const tasks = require('../../database/modules/task');
    const notebooks = require('../../database/modules/notebook');
    let db = await connect();

    await db.executeQuery(`
        INSERT INTO Students(student_id, student_code, full_name, major)
            VALUES (7, 'BOUNDARY7', 'Database boundary student', 'IT');
    `);
    await db.executeQuery(`
        INSERT INTO Subjects(subject_id, subject_code, subject_name, credits)
            VALUES (11, 'BOUNDARY', 'Database boundaries', 3);
    `);
    await db.executeQuery(`
        INSERT INTO StudySchedules(student_id, subject_id, title, study_date, start_time, end_time, duration_minutes)
            VALUES (7, 11, 'Boundary study', '2099-06-01', '09:00', '10:00', 60);
    `);

    const tables = ['Assignments', 'Checklists', 'Notebooks', 'Notes', 'Reminders'];
    async function counts() {
        const result = {};
        for (const table of tables) {
            result[table] = (await db.executeQuery(`SELECT COUNT(*) AS count FROM ${table}`))[0].count;
        }
        return result;
    }

    async function writeWorkspace(label) {
        const assignment = await tasks.themBaiTap('BOUNDARY7', {
            subjectId: 11, title: `${label} assignment`, deadline: '2099-06-10T12:00:00Z'
        });
        const checklist = await db.themChecklist(7, {
            subjectId: 11, assignmentId: assignment.assignment_id, title: `${label} checklist`
        });
        const notebook = await notebooks.taoSoTay('BOUNDARY7', {
            subjectId: 11, title: `${label} notebook`
        });
        const note = await db.themGhiChu(7, notebook.notebook_id, {
            title: `${label} note`, content: 'One transaction across independent modules', isHard: true
        });
        return { assignment, checklist, notebook, note };
    }

    await t.test('failure rolls back direct module writes and facade writes on the same connection', async () => {
        const handle = await db.getPool();
        assert.equal(await connection.getPool(), handle);
        const failure = new Error('Abort cross-module workspace');
        await assert.rejects(db.withTransaction(async () => {
            await writeWorkspace('Rolled back');
            assert.equal((await db.layDanhSachDeadline(7)).length, 1);
            assert.equal((await notebooks.layDanhSachSoTay(7)).length, 1);
            // Let the deferred persistence callback run while the transaction is open.
            await delay(75);
            throw failure;
        }), error => error === failure);
        assert.deepEqual(await counts(), Object.fromEntries(tables.map(table => [table, 0])));
        assert.equal(await db.getPool(), handle);
    });

    let saved;
    await t.test('commit saves linked assignments, checklists, notebooks, notes and reminders atomically', async () => {
        saved = await db.withTransaction(async () => {
            const workspace = await writeWorkspace('Committed');
            await delay(75);
            return workspace;
        });
        assert.deepEqual(await counts(), {
            Assignments: 1, Checklists: 1, Notebooks: 1, Notes: 1, Reminders: 3
        });
        assert.equal((await db.layChecklist(7))[0].assignment_id, saved.assignment.assignment_id);
        assert.equal((await notebooks.layGhiChuTheoSoTay(saved.notebook.notebook_id))[0].note_id, saved.note.note_id);
        assert.equal((await db.layDanhSachNhacNho(7)).every(row => row.target_id === saved.assignment.assignment_id), true);
    });

    await t.test('academic lookup keeps its fallback while notebook and study lookup remain strict', async () => {
        assert.equal((await db.layHoSo(1)).student_id, 7);
        assert.equal((await db.layDanhSachDeadline(1))[0].assignment_id, saved.assignment.assignment_id);
        assert.equal((await db.layLichTuHoc(1, '2099-06-01', '2099-06-01')).length, 1);
        assert.deepEqual(await notebooks.layDanhSachSoTay(1), []);
        await assert.rejects(notebooks.taoSoTay(1, { title: 'Must not use academic fallback' }));
        assert.deepEqual(await db.layLichTuHocTheoKhoangThoiGian(1, '2099-06-01', '2099-06-01'), []);
        assert.equal((await notebooks.layDanhSachSoTay('BOUNDARY7'))[0].notebook_id, saved.notebook.notebook_id);
        assert.equal((await db.layLichTuHocTheoKhoangThoiGian('BOUNDARY7', '2099-06-01', '2099-06-01')).length, 1);
    });

    await t.test('all modules reopen the same persisted database without rolled-back rows or broken links', async () => {
        const previousHandle = await connection.getPool();
        await db.closePool();
        assert.ok(fs.statSync(path.join(directory, 'boundary.db')).size > 0);
        db = await connect();
        assert.notEqual(await db.getPool(), previousHandle);
        assert.equal(await db.getPool(), await connection.getPool());
        assert.deepEqual(await counts(), {
            Assignments: 1, Checklists: 1, Notebooks: 1, Notes: 1, Reminders: 3
        });
        assert.equal((await tasks.layDanhSachDeadline(7))[0].title, 'Committed assignment');
        assert.equal((await notebooks.layGhiChuTheoSoTay(saved.notebook.notebook_id))[0].content,
            'One transaction across independent modules');
        assert.equal((await db.layChecklist(7))[0].assignment_id, saved.assignment.assignment_id);
        assert.deepEqual(await db.executeQuery('PRAGMA foreign_key_check'), []);
    });
});
